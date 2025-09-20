// Factuality Slice types aligned with factuality_slice_integration.md
export interface Citation {
  id: string; // evidence id or hash
  source: string; // e.g., 'wikipedia', 'arxiv', 'user', 'ipfs', 'logs', 'stacktrace'
  snippet: string; // short excerpt used as evidence
  score: number; // confidence/score for this citation
  metadata?: {
    lineNumber?: number;
    timestamp?: number;
    sourceFile?: string;
    errorCode?: string;
  };
}

export interface FactualityAnswer {
  answer: string;
  citations: string[]; // array of citation ids
  confidence: number; // 0-1
  refused: boolean;
  hallucination_risk?: number; // optional 0-1
  evidence_quality_score?: number; // optional 0-1
}

export interface FactualitySlice {
  response: FactualityAnswer;
  citations: Citation[]; // detailed citation objects
  provenance: { generatedBy: string; model?: string; timestamp: number };
}

// Enhanced statement extraction patterns
const STATEMENT_PATTERNS = {
  // Error patterns
  ERROR_CODES: /\b[A-Z]+_?[A-Z]*_?\d+\b/g,
  STACK_TRACES: /at\s+[\w.]+\s*\([^)]+\)/g,
  FILE_PATHS: /[\\/]?[\w-]+[\\/][\w.-]+/g,
  TIMESTAMPS: /\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/g,

  // Technical assertions
  FUNCTION_CALLS: /\w+\([^)]*\)/g,
  VARIABLE_ASSIGNMENTS: /\w+\s*=\s*[^;,\n]+/g,
  CONDITIONAL_STATEMENTS: /if\s*\([^)]+\)/g,

  // Factual claims
  NUMERIC_CLAIMS: /\b\d+(?:\.\d+)?\s*(?:ms|seconds?|minutes?|hours?|days?|MB|GB|KB|%)\b/g,
  VERSION_NUMBERS: /v?\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9]+)?/g,
  URL_REFERENCES: /https?:\/\/[^\s]+/g
};

// Evidence quality scoring heuristics
function scoreEvidence(statement: string, context: Record<string, unknown>): number {
  let score = 0.3; // Base score

  // Higher score for technical specificity
  if (STATEMENT_PATTERNS.ERROR_CODES.test(statement)) score += 0.3;
  if (STATEMENT_PATTERNS.STACK_TRACES.test(statement)) score += 0.25;
  if (STATEMENT_PATTERNS.TIMESTAMPS.test(statement)) score += 0.2;
  if (STATEMENT_PATTERNS.NUMERIC_CLAIMS.test(statement)) score += 0.15;

  // Context correlation
  const contextStr = JSON.stringify(context).toLowerCase();
  const statementLower = statement.toLowerCase();
  const commonWords = statementLower.split(/\s+/).filter(word =>
    word.length > 3 && contextStr.includes(word)
  );
  score += Math.min(commonWords.length * 0.05, 0.2);

  // Penalty for vague statements
  const vagueWords = ['maybe', 'possibly', 'might', 'could', 'seems', 'appears'];
  const vagueCount = vagueWords.filter(word => statementLower.includes(word)).length;
  score -= vagueCount * 0.1;

  return Math.max(0.1, Math.min(1.0, score));
}

// Extract factual statements from text
function extractFactualStatements(text: string, context: Record<string, unknown> = {}): Array<{statement: string; score: number; type: string}> {
  const statements: Array<{statement: string; score: number; type: string}> = [];

  // Split into sentences
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length < 10) continue;

    let type = 'general';
    let score = scoreEvidence(trimmed, context);

    // Classify statement type
    if (STATEMENT_PATTERNS.ERROR_CODES.test(trimmed) || STATEMENT_PATTERNS.STACK_TRACES.test(trimmed)) {
      type = 'error_evidence';
      score += 0.1;
    } else if (STATEMENT_PATTERNS.NUMERIC_CLAIMS.test(trimmed)) {
      type = 'metric_claim';
      score += 0.05;
    } else if (STATEMENT_PATTERNS.FILE_PATHS.test(trimmed) || STATEMENT_PATTERNS.FUNCTION_CALLS.test(trimmed)) {
      type = 'technical_reference';
      score += 0.05;
    }

    statements.push({ statement: trimmed, score, type });
  }

  // Sort by score and return top statements
  return statements.sort((a, b) => b.score - a.score).slice(0, 5);
}

// Enhanced factuality slice creation with real analysis
export function createFactualitySlice(questionOrText: string, context: Record<string, unknown> = {}): FactualitySlice {
  const statements = extractFactualStatements(questionOrText, context);

  // Create citations from extracted statements
  const citations: Citation[] = statements.map((stmt, index) => ({
    id: `fact_${Date.now()}_${index}`,
    source: stmt.type === 'error_evidence' ? 'logs' :
            stmt.type === 'technical_reference' ? 'code' : 'user',
    snippet: stmt.statement.slice(0, 200),
    score: stmt.score,
    metadata: {
      timestamp: Date.now(),
      sourceFile: context.sourceFile as string || 'unknown',
      errorCode: stmt.statement.match(STATEMENT_PATTERNS.ERROR_CODES)?.[0]
    }
  }));

  // Add context-based citations
  if (context.logs) {
    citations.push({
      id: `context_logs_${Date.now()}`,
      source: 'logs',
      snippet: String(context.logs).slice(0, 200),
      score: 0.7,
      metadata: { timestamp: Date.now() }
    });
  }

  if (context.stackTrace) {
    citations.push({
      id: `context_stack_${Date.now()}`,
      source: 'stacktrace',
      snippet: String(context.stackTrace).slice(0, 200),
      score: 0.8,
      metadata: { timestamp: Date.now() }
    });
  }

  // Calculate overall confidence based on evidence quality
  const avgScore = citations.length > 0 ?
    citations.reduce((sum, c) => sum + c.score, 0) / citations.length : 0.3;

  const confidence = Math.min(0.95, Math.max(0.1, avgScore));
  const evidenceQuality = avgScore;
  const hallucinationRisk = Math.max(0.05, 1 - confidence);

  const response: FactualityAnswer = {
    answer: statements.length > 0 ?
      `Analysis of "${questionOrText.slice(0, 100)}..." identified ${statements.length} factual statements with ${citations.length} supporting evidence items.` :
      `No significant factual statements identified in: "${questionOrText.slice(0, 100)}..."`,
    citations: citations.map(c => c.id),
    confidence,
    refused: false,
    hallucination_risk: hallucinationRisk,
    evidence_quality_score: evidenceQuality
  };

  return {
    response,
    citations,
    provenance: {
      generatedBy: 'factuality-slice-enhanced',
      model: 'heuristic-v1.0',
      timestamp: Date.now()
    }
  };
}
