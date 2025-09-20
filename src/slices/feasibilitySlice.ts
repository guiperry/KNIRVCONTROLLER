export interface MarketAnalysis {
  estimatedMarketSize: number; // in USD
  competitionLevel: 'low' | 'medium' | 'high' | 'saturated';
  trendScore: number; // 0-10, higher is better
  barriers: string[];
  opportunities: string[];
}

export interface SimilarProject {
  id: string;
  score: number; // similarity score 0-1
  summary: string;
  source: 'local' | 'github' | 'patents' | 'market' | 'academic';
  url?: string;
  status: 'active' | 'inactive' | 'unknown';
  lastUpdated?: number;
}

export interface FeasibilityReport {
  exists: boolean;
  similar: SimilarProject[];
  feasibilityScore: number; // 0-100
  marketAnalysis: MarketAnalysis;
  technicalComplexity: 'low' | 'medium' | 'high' | 'extreme';
  resourceRequirements: {
    estimatedDevelopmentTime: string;
    skillsRequired: string[];
    estimatedCost: string;
  };
  riskFactors: string[];
  recommendations: string[];
  provenance: { generatedBy: string; timestamp: number; version: string };
}

// Enhanced text normalization and preprocessing
function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(word));
}

// Advanced similarity calculation using multiple algorithms
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = normalizeText(text1);
  const words2 = normalizeText(text2);

  if (words1.length === 0 || words2.length === 0) return 0;

  // Jaccard similarity
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  const jaccardScore = intersection.size / union.size;

  // Cosine similarity (simplified)
  const allWords = [...union];
  const vector1 = allWords.map(word => words1.filter(w => w === word).length);
  const vector2 = allWords.map(word => words2.filter(w => w === word).length);

  const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
  const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));

  const cosineScore = magnitude1 && magnitude2 ? dotProduct / (magnitude1 * magnitude2) : 0;

  // Weighted combination
  return (jaccardScore * 0.6) + (cosineScore * 0.4);
}

// Market analysis heuristics
function analyzeMarket(title: string, description: string): MarketAnalysis {
  const text = `${title} ${description}`.toLowerCase();

  // Technology trend keywords
  const trendingKeywords = ['ai', 'machine learning', 'blockchain', 'cloud', 'mobile', 'web3', 'automation', 'analytics', 'security', 'iot'];
  const saturatedKeywords = ['social media', 'photo sharing', 'messaging', 'email', 'calendar', 'todo', 'note taking'];
  const emergingKeywords = ['quantum', 'ar', 'vr', 'metaverse', 'nft', 'defi', 'edge computing', 'serverless'];

  let trendScore = 5; // baseline

  // Adjust trend score based on keywords
  trendingKeywords.forEach(keyword => {
    if (text.includes(keyword)) trendScore += 1;
  });

  emergingKeywords.forEach(keyword => {
    if (text.includes(keyword)) trendScore += 2;
  });

  saturatedKeywords.forEach(keyword => {
    if (text.includes(keyword)) trendScore -= 2;
  });

  trendScore = Math.max(0, Math.min(10, trendScore));

  // Determine competition level
  let competitionLevel: MarketAnalysis['competitionLevel'] = 'medium';
  if (saturatedKeywords.some(keyword => text.includes(keyword))) {
    competitionLevel = 'saturated';
  } else if (emergingKeywords.some(keyword => text.includes(keyword))) {
    competitionLevel = 'low';
  } else if (trendingKeywords.filter(keyword => text.includes(keyword)).length > 2) {
    competitionLevel = 'high';
  }

  // Estimate market size (very rough heuristics)
  let marketSize = 1000000; // $1M baseline
  if (text.includes('enterprise') || text.includes('business')) marketSize *= 10;
  if (text.includes('consumer') || text.includes('mobile')) marketSize *= 5;
  if (text.includes('niche') || text.includes('specialized')) marketSize *= 0.1;

  return {
    estimatedMarketSize: Math.round(marketSize),
    competitionLevel,
    trendScore,
    barriers: competitionLevel === 'saturated' ? ['High competition', 'Market saturation'] :
              competitionLevel === 'high' ? ['Established competitors', 'High development costs'] :
              ['Technical complexity', 'User adoption'],
    opportunities: trendScore > 7 ? ['Growing market', 'Technology adoption'] :
                   trendScore > 4 ? ['Moderate growth potential'] :
                   ['Niche market opportunity']
  };
}

// Assess technical complexity
function assessTechnicalComplexity(title: string, description: string): FeasibilityReport['technicalComplexity'] {
  const text = `${title} ${description}`.toLowerCase();

  const highComplexityKeywords = ['ai', 'machine learning', 'blockchain', 'distributed', 'real-time', 'scalable', 'security', 'encryption'];
  const extremeComplexityKeywords = ['quantum', 'neural network', 'deep learning', 'consensus', 'cryptographic', 'autonomous'];
  const lowComplexityKeywords = ['website', 'blog', 'simple', 'basic', 'static', 'crud'];

  if (extremeComplexityKeywords.some(keyword => text.includes(keyword))) return 'extreme';
  if (highComplexityKeywords.some(keyword => text.includes(keyword))) return 'high';
  if (lowComplexityKeywords.some(keyword => text.includes(keyword))) return 'low';
  return 'medium';
}

// Generate resource requirements
function estimateResources(complexity: FeasibilityReport['technicalComplexity'], _marketAnalysis: MarketAnalysis): FeasibilityReport['resourceRequirements'] {
  const complexityMultiplier = {
    low: 1,
    medium: 2,
    high: 4,
    extreme: 8
  };

  const baseTime = 3; // months
  const estimatedMonths = baseTime * complexityMultiplier[complexity];

  const skillsByComplexity = {
    low: ['Frontend development', 'Basic backend'],
    medium: ['Full-stack development', 'Database design', 'API development'],
    high: ['Advanced backend', 'System architecture', 'DevOps', 'Security'],
    extreme: ['Research & development', 'Specialized algorithms', 'Distributed systems', 'Advanced mathematics']
  };

  const baseCost = 50000; // USD
  const estimatedCost = baseCost * complexityMultiplier[complexity];

  return {
    estimatedDevelopmentTime: `${estimatedMonths} months`,
    skillsRequired: skillsByComplexity[complexity],
    estimatedCost: `$${estimatedCost.toLocaleString()}`
  };
}

// Enhanced feasibility slice creation
export function createFeasibilitySlice(
  title: string,
  description: string,
  existingItems: Array<{ id: string; text: string; source?: string; url?: string }> = []
): FeasibilityReport {

  const projectText = `${title} ${description}`;

  // Find similar projects with enhanced scoring
  const similar: SimilarProject[] = existingItems.map(item => {
    const score = calculateSimilarity(projectText, item.text);
    return {
      id: item.id,
      score,
      summary: item.text.slice(0, 200),
      source: (item.source as SimilarProject['source']) || 'local',
      url: item.url,
      status: 'unknown' as const,
      lastUpdated: Date.now()
    };
  })
  .filter(s => s.score > 0.1)
  .sort((a, b) => b.score - a.score)
  .slice(0, 10);

  // Determine if project already exists
  const exists = similar.length > 0 && similar[0].score > 0.7;

  // Perform market analysis
  const marketAnalysis = analyzeMarket(title, description);

  // Assess technical complexity
  const technicalComplexity = assessTechnicalComplexity(title, description);

  // Calculate feasibility score (0-100)
  let feasibilityScore = 70; // baseline

  // Adjust based on similarity (lower is better for feasibility)
  if (exists) feasibilityScore -= 40;
  else if (similar.length > 0 && similar[0].score > 0.5) feasibilityScore -= 20;

  // Adjust based on market conditions
  feasibilityScore += marketAnalysis.trendScore * 2;
  if (marketAnalysis.competitionLevel === 'low') feasibilityScore += 10;
  else if (marketAnalysis.competitionLevel === 'saturated') feasibilityScore -= 20;

  // Adjust based on technical complexity
  const complexityPenalty = { low: 0, medium: -5, high: -15, extreme: -25 };
  feasibilityScore += complexityPenalty[technicalComplexity];

  feasibilityScore = Math.max(0, Math.min(100, feasibilityScore));

  // Generate resource requirements
  const resourceRequirements = estimateResources(technicalComplexity, marketAnalysis);

  // Identify risk factors
  const riskFactors: string[] = [];
  if (exists) riskFactors.push('Similar project already exists');
  if (marketAnalysis.competitionLevel === 'saturated') riskFactors.push('Highly competitive market');
  if (technicalComplexity === 'extreme') riskFactors.push('Extremely high technical complexity');
  if (marketAnalysis.estimatedMarketSize < 100000) riskFactors.push('Limited market size');

  // Generate recommendations
  const recommendations: string[] = [];
  if (feasibilityScore > 70) recommendations.push('High feasibility - proceed with development');
  else if (feasibilityScore > 50) recommendations.push('Moderate feasibility - conduct further research');
  else recommendations.push('Low feasibility - consider alternative approaches');

  if (similar.length > 0) recommendations.push('Study similar projects for differentiation opportunities');
  if (technicalComplexity === 'high' || technicalComplexity === 'extreme') {
    recommendations.push('Consider breaking down into smaller, manageable components');
  }

  return {
    exists,
    similar,
    feasibilityScore,
    marketAnalysis,
    technicalComplexity,
    resourceRequirements,
    riskFactors,
    recommendations,
    provenance: {
      generatedBy: 'feasibility-slice-enhanced',
      timestamp: Date.now(),
      version: 'v1.0'
    }
  };
}
