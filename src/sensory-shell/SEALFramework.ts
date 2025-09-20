import { EventEmitter } from './EventEmitter';

export interface Agent {
  id: string;
  type: string;
  capabilities: string[];
  state: unknown;
}

export interface AgentResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface SEALConfig {
  maxAgents: number;
  learningRate: number;
  adaptationThreshold: number;
  skillTimeout: number;
  hrmIntegration?: boolean;
}

export interface SEALAgent {
  id: string;
  type: string;
  capabilities: string[];
  state: unknown;
  performance: AgentPerformance;
  created: Date;
  lastActive: Date;
}

export interface AgentPerformance {
  successRate: number;
  averageLatency: number;
  totalInvocations: number;
  errorCount: number;
}

export interface SkillInvocation {
  skillId: string;
  parameters: unknown;
  agent?: SEALAgent;
  startTime: Date;
  endTime?: Date;
  result?: unknown;
  error?: string;
}

export class SEALFramework extends EventEmitter {
  private config: SEALConfig;
  private agents: Map<string, SEALAgent> = new Map();
  private activeInvocations: Map<string, SkillInvocation> = new Map();
  private learningMode: boolean = false;
  private isRunning: boolean = false;
  private hrmBridge: unknown = null; // Will be injected from CognitiveEngine

  constructor(config: SEALConfig) {
    super();
    this.config = config;
  }

  public async start(): Promise<void> {
    console.log('Starting SEAL Framework...');

    // Initialize default agents
    await this.createDefaultAgents();

    this.isRunning = true;
    this.emit('sealStarted');
  }

  public async stop(): Promise<void> {
    console.log('Stopping SEAL Framework...');

    // Stop all active invocations
    this.activeInvocations.forEach(async (invocation, id) => {
      await this.cancelInvocation(id);
    });

    this.agents.clear();
    this.isRunning = false;
    this.emit('sealStopped');
  }

  private async createDefaultAgents(): Promise<void> {
    const defaultAgents = [
      {
        type: 'text_processor',
        capabilities: ['text_analysis', 'summarization', 'translation'],
      },
      {
        type: 'code_assistant',
        capabilities: ['code_generation', 'debugging', 'refactoring'],
      },
      {
        type: 'problem_solver',
        capabilities: ['logical_reasoning', 'pattern_recognition', 'optimization'],
      },
      {
        type: 'visual_analyzer',
        capabilities: ['image_analysis', 'object_detection', 'scene_understanding'],
      },
      {
        type: 'voice_handler',
        capabilities: ['speech_processing', 'command_interpretation', 'voice_synthesis'],
      },
    ];

    for (const agentConfig of defaultAgents) {
      await this.createAgent(agentConfig.type, agentConfig.capabilities);
    }
  }

  public async createAgent(type: string, capabilities: string[]): Promise<SEALAgent> {
    const agentId = `agent_${type}_${Date.now()}`;

    const agent: SEALAgent = {
      id: agentId,
      type,
      capabilities,
      state: {},
      performance: {
        successRate: 0.0,
        averageLatency: 0.0,
        totalInvocations: 0,
        errorCount: 0,
      },
      created: new Date(),
      lastActive: new Date(),
    };

    this.agents.set(agentId, agent);
    this.emit('agentCreated', agent);

    console.log(`Created SEAL agent: ${agentId} (${type})`);
    return agent;
  }

  public async generateResponse(input: unknown, context: unknown): Promise<unknown> {
    const startTime = Date.now();

    try {
      // Use HRM for enhanced reasoning if available
      if (this.config.hrmIntegration && this.hrmBridge && (this.hrmBridge as { isReady?: () => boolean }).isReady?.()) {
        return await this.generateHRMEnhancedResponse(input, context);
      }

      // Fallback to traditional agent selection
      const agent = await this.selectAgent(input, context);

      if (!agent) {
        throw new Error('No suitable agent found for input');
      }

      // Generate response using selected agent
      const response = await this.executeWithAgent(agent, input, context);

      // Update agent performance
      this.updateAgentPerformance(agent, Date.now() - startTime, true);

      return response;

    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  }

  private async generateHRMEnhancedResponse(input: unknown, context: unknown): Promise<unknown> {
    console.log('Generating HRM-enhanced SEAL response...');

    try {
      // First, get HRM reasoning about the input
      const hrmInput = {
        sensory_data: this.convertInputToSensoryData(input),
        context: JSON.stringify(context),
        task_type: this.determineTaskType(input, context),
      };

      const hrmOutput = await (this.hrmBridge as { processCognitiveInput?: (input: unknown) => Promise<unknown> }).processCognitiveInput?.(hrmInput);

      // Use HRM reasoning to select and guide agent execution
      const agent = await this.selectAgentWithHRMGuidance(input, context, hrmOutput);

      if (!agent) {
        // Fallback to HRM-only response
        return this.formatHRMResponse(hrmOutput, context);
      }

      // Execute agent with HRM guidance
      const response = await this.executeAgentWithHRMGuidance(agent, input, context, hrmOutput);

      // Update agent performance based on HRM confidence
      this.updateAgentPerformance(agent, (hrmOutput as { processing_time?: number }).processing_time || 0, ((hrmOutput as { confidence?: number }).confidence || 0) > 0.7);

      return response;

    } catch (error) {
      console.error('Error in HRM-enhanced response generation:', error);
      // Fallback to traditional processing
      return this.generateResponse(input, context);
    }
  }

  private convertInputToSensoryData(input: unknown): number[] {
    // Convert various input types to numerical data for HRM
    if (typeof input === 'string') {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(input);
      return Array.from(bytes).map(b => b / 255.0).slice(0, 512);
    }

    if (Array.isArray(input)) {
      return input.slice(0, 512);
    }

    if (typeof input === 'object') {
      const str = JSON.stringify(input);
      const encoder = new TextEncoder();
      const bytes = encoder.encode(str);
      return Array.from(bytes).map(b => b / 255.0).slice(0, 512);
    }

    return new Array(512).fill(0);
  }

  private determineTaskType(input: unknown, context: unknown): string {
    const contextAny = context as { inputType?: string };
    if (contextAny.inputType) {
      return contextAny.inputType + '_processing';
    }

    if (typeof input === 'string') {
      if (input.includes('code') || input.includes('function')) {
        return 'code_processing';
      }
      return 'text_processing';
    }

    return 'general_processing';
  }

  private async selectAgentWithHRMGuidance(input: unknown, context: unknown, hrmOutput: unknown): Promise<SEALAgent | null> {
    // Use HRM activations to guide agent selection
    const requiredCapabilities = this.analyzeRequiredCapabilities(input, context);

    let bestAgent: SEALAgent | null = null;
    let bestScore = 0;

    this.agents.forEach((agent) => {
      let score = this.calculateAgentScore(agent, requiredCapabilities);

      // Boost score based on HRM module activations
      const hrmAny = hrmOutput as { h_module_activations?: number[] };
      if (hrmAny.h_module_activations && hrmAny.h_module_activations.length > 0) {
        const avgActivation = hrmAny.h_module_activations.reduce((a: number, b: number) => a + b, 0) / hrmAny.h_module_activations.length;
        score *= (1 + avgActivation); // Boost by HRM confidence
      }

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    });

    return bestAgent;
  }

  private formatHRMResponse(hrmOutput: unknown, context: unknown): unknown {
    interface HRMOutput {
      reasoning_result?: unknown;
      confidence?: number;
      processing_time?: number;
      l_module_activations?: unknown;
      h_module_activations?: unknown;
    }

    const hrmTyped = hrmOutput as HRMOutput;
    const contextAny = context as Record<string, unknown>;
    return {
      type: 'hrm_response',
      content: hrmTyped.reasoning_result,
      confidence: hrmTyped.confidence,
      processingTime: hrmTyped.processing_time,
      source: 'hrm_direct',
      shouldSpeak: contextAny.inputType === 'voice' && (hrmTyped.confidence || 0) > 0.7,
      text: hrmTyped.reasoning_result,
      metadata: {
        l_module_activations: hrmTyped.l_module_activations,
        h_module_activations: hrmTyped.h_module_activations,
      },
    };
  }

  private async executeAgentWithHRMGuidance(agent: SEALAgent, input: unknown, context: unknown, hrmOutput: unknown): Promise<unknown> {
    agent.lastActive = new Date();
    agent.performance.totalInvocations++;

    // Enhance agent processing with HRM insights
    const hrmAny = hrmOutput as { reasoning_result?: unknown; confidence?: number; l_module_activations?: unknown; h_module_activations?: unknown };
    const enhancedContext = {
      ...(typeof context === 'object' && context !== null ? context as Record<string, unknown> : {}),
      hrmReasoning: hrmAny.reasoning_result,
      hrmConfidence: hrmAny.confidence,
      hrmActivations: {
        l_modules: hrmAny.l_module_activations,
        h_modules: hrmAny.h_module_activations,
      },
    };

    const response = await this.simulateAgentProcessing(agent, input, enhancedContext);

    // Merge HRM insights with agent response
    return {
      ...(response as Record<string, unknown>),
      hrmEnhanced: true,
      hrmConfidence: hrmAny.confidence,
      combinedConfidence: (((response as { confidence?: number }).confidence || 0) + (hrmAny.confidence || 0)) / 2,
      hrmReasoning: hrmAny.reasoning_result,
    };
  }

  private async selectAgent(input: unknown, context: unknown): Promise<SEALAgent | null> {
    const requiredCapabilities = this.analyzeRequiredCapabilities(input, context);

    let bestAgent: SEALAgent | null = null;
    let bestScore = 0;

    this.agents.forEach((agent) => {
      const score = this.calculateAgentScore(agent, requiredCapabilities);

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    });

    return bestAgent;
  }

  private analyzeRequiredCapabilities(input: unknown, context: unknown): string[] {
    const capabilities: string[] = [];

    // Analyze input type and content to determine required capabilities
    if (typeof input === 'string') {
      if (input.includes('code') || input.includes('function')) {
        capabilities.push('code_generation', 'debugging');
      } else {
        capabilities.push('text_analysis', 'summarization');
      }
    }

    // Add context-based capabilities
    const contextAny = context as { inputType?: string };
    if (contextAny.inputType === 'voice') {
      capabilities.push('speech_processing');
    }

    if (contextAny.inputType === 'visual') {
      capabilities.push('image_analysis', 'object_detection');
    }

    return capabilities;
  }

  private calculateAgentScore(agent: SEALAgent, requiredCapabilities: string[]): number {
    let score = 0;

    // Capability match score
    const matchingCapabilities = agent.capabilities.filter(cap =>
      requiredCapabilities.includes(cap)
    );
    score += matchingCapabilities.length * 10;

    // Performance score
    score += agent.performance.successRate * 5;
    score -= agent.performance.errorCount * 2;

    // Recency score (prefer recently active agents)
    const hoursSinceActive = (Date.now() - agent.lastActive.getTime()) / (1000 * 60 * 60);
    score += Math.max(0, 5 - hoursSinceActive);

    return score;
  }

  private async executeWithAgent(agent: SEALAgent, input: unknown, context: unknown): Promise<unknown> {
    agent.lastActive = new Date();
    agent.performance.totalInvocations++;

    // Simulate agent processing
    // In a real implementation, this would call actual AI models or services
    const response = await this.simulateAgentProcessing(agent, input, context);

    return response;
  }

  private async simulateAgentProcessing(agent: SEALAgent, input: unknown, context: unknown): Promise<unknown> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

    // Generate intelligent response based on agent type and real processing
    try {
      switch (agent.type) {
        case 'text_processor':
          return await this.processTextInput(input, context, agent);
        case 'error_analyzer':
          return await this.analyzeError(input, context, agent);
        case 'context_processor':
          return await this.processContext(input, context, agent);
        case 'idea_evaluator':
          return await this.evaluateIdea(input, context, agent);
        default:
          return await this.processGenericInput(input, context, agent);
      }
    } catch (error) {
      console.error('Agent processing failed:', error);
      return {
        type: 'error_response',
        content: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0.1,
        shouldSpeak: false,
        text: 'I encountered an error while processing your request.',
      };
    }
  }

  private async processTextInput(input: unknown, context: unknown, agent: Agent): Promise<AgentResponse> {
    const textInput = typeof input === 'string' ? input : JSON.stringify(input);

    // Real text processing logic
    const wordCount = textInput.split(/\s+/).length;
    const sentiment = this.analyzeSentiment(textInput);
    const keywords = this.extractKeywords(textInput);

    return {
      type: 'text_response',
      content: {
        originalText: textInput,
        wordCount,
        sentiment,
        keywords,
        analysis: `Analyzed ${wordCount} words with ${sentiment} sentiment`
      },
      confidence: Math.min(0.95, 0.5 + (keywords.length * 0.1)),
      shouldSpeak: (context as { inputType?: string }).inputType === 'voice',
      text: `I've analyzed your text and identified ${keywords.length} key concepts with ${sentiment} sentiment.`,
    };
  }

  private async analyzeError(input: unknown, context: unknown, agent: Agent): Promise<AgentResponse> {
    const errorText = typeof input === 'string' ? input : JSON.stringify(input);

    // Real error analysis
    const errorPatterns = this.detectErrorPatterns(errorText);
    const severity = this.assessErrorSeverity(errorText);
    const suggestions = this.generateErrorSuggestions(errorPatterns);

    return {
      type: 'error_analysis',
      content: {
        patterns: errorPatterns,
        severity,
        suggestions,
        confidence: errorPatterns.length > 0 ? 0.8 : 0.3
      },
      confidence: errorPatterns.length > 0 ? 0.8 : 0.3,
      shouldSpeak: severity === 'high',
      text: `I found ${errorPatterns.length} error patterns with ${severity} severity. ${suggestions[0] || 'No immediate suggestions available.'}`
    };
  }

  private async processContext(input: unknown, context: unknown, agent: Agent): Promise<AgentResponse> {
    const contextData = typeof input === 'object' ? input : { raw: input };

    // Real context processing
    const relevantFields = this.extractRelevantFields(contextData);
    const contextType = this.classifyContext(contextData);
    const capabilities = this.identifyCapabilities(contextData);

    return {
      type: 'context_analysis',
      content: {
        contextType,
        relevantFields,
        capabilities,
        processingTime: Date.now()
      },
      confidence: relevantFields.length > 0 ? 0.75 : 0.4,
      shouldSpeak: false,
      text: `Processed ${contextType} context with ${capabilities.length} identified capabilities.`
    };
  }

  private async evaluateIdea(input: unknown, context: unknown, agent: Agent): Promise<AgentResponse> {
    const ideaText = typeof input === 'string' ? input : JSON.stringify(input);

    // Real idea evaluation
    const novelty = this.assessNovelty(ideaText);
    const feasibility = this.assessFeasibility(ideaText);
    const marketPotential = this.assessMarketPotential(ideaText);

    return {
      type: 'idea_evaluation',
      content: {
        novelty,
        feasibility,
        marketPotential,
        overallScore: (novelty + feasibility + marketPotential) / 3
      },
      confidence: 0.7,
      shouldSpeak: false,
      text: `Idea evaluation: ${novelty.toFixed(1)}/10 novelty, ${feasibility.toFixed(1)}/10 feasibility, ${marketPotential.toFixed(1)}/10 market potential.`
    };
  }

  private async processGenericInput(input: unknown, context: unknown, agent: Agent): Promise<AgentResponse> {
    return {
      type: 'generic_response',
      content: `Processed input of type ${typeof input}`,
      confidence: 0.5,
      shouldSpeak: false,
      text: `I've processed your input using the ${agent.type} agent.`,
    };
  }

  // Helper methods for real processing
  private analyzeSentiment(text: string): string {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'horrible', 'worst', 'fail'];

    const words = text.toLowerCase().split(/\s+/);
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];

    return words
      .filter(word => word.length > 3 && !stopWords.includes(word))
      .filter((word, index, arr) => arr.indexOf(word) === index) // Remove duplicates
      .slice(0, 10); // Top 10 keywords
  }

  private detectErrorPatterns(errorText: string): string[] {
    const patterns: string[] = [];

    if (/error|exception|fail/i.test(errorText)) patterns.push('error_keyword');
    if (/\d{3}\s*error/i.test(errorText)) patterns.push('error_code');
    if (/stack\s*trace/i.test(errorText)) patterns.push('stack_trace');
    if (/timeout|connection/i.test(errorText)) patterns.push('network_issue');
    if (/memory|heap/i.test(errorText)) patterns.push('memory_issue');
    if (/null|undefined/i.test(errorText)) patterns.push('null_reference');

    return patterns;
  }

  private assessErrorSeverity(errorText: string): string {
    const criticalKeywords = ['crash', 'fatal', 'critical', 'system', 'security'];
    const highKeywords = ['error', 'exception', 'fail', 'timeout'];
    const mediumKeywords = ['warning', 'deprecated', 'slow'];

    const text = errorText.toLowerCase();

    if (criticalKeywords.some(keyword => text.includes(keyword))) return 'critical';
    if (highKeywords.some(keyword => text.includes(keyword))) return 'high';
    if (mediumKeywords.some(keyword => text.includes(keyword))) return 'medium';

    return 'low';
  }

  private generateErrorSuggestions(patterns: string[]): string[] {
    const suggestions: string[] = [];

    if (patterns.includes('error_code')) suggestions.push('Check error code documentation');
    if (patterns.includes('stack_trace')) suggestions.push('Analyze stack trace for root cause');
    if (patterns.includes('network_issue')) suggestions.push('Verify network connectivity');
    if (patterns.includes('memory_issue')) suggestions.push('Check memory usage and optimize');
    if (patterns.includes('null_reference')) suggestions.push('Add null checks and validation');

    if (suggestions.length === 0) suggestions.push('Review logs for additional context');

    return suggestions;
  }

  private extractRelevantFields(contextData: unknown): string[] {
    if (typeof contextData !== 'object' || contextData === null) return [];

    const fields: string[] = [];
    const obj = contextData as Record<string, unknown>;

    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'string' || typeof obj[key] === 'number') {
        fields.push(key);
      }
    });

    return fields;
  }

  private classifyContext(contextData: unknown): string {
    if (typeof contextData !== 'object' || contextData === null) return 'unknown';

    const obj = contextData as Record<string, unknown>;
    const keys = Object.keys(obj);

    if (keys.includes('url') || keys.includes('endpoint')) return 'api_context';
    if (keys.includes('file') || keys.includes('path')) return 'file_context';
    if (keys.includes('user') || keys.includes('session')) return 'user_context';
    if (keys.includes('config') || keys.includes('settings')) return 'configuration_context';

    return 'general_context';
  }

  private identifyCapabilities(contextData: unknown): string[] {
    const capabilities: string[] = [];

    if (typeof contextData !== 'object' || contextData === null) return capabilities;

    const obj = contextData as Record<string, unknown>;

    if (obj.url || obj.endpoint) capabilities.push('api_integration');
    if (obj.file || obj.path) capabilities.push('file_processing');
    if (obj.database || obj.db) capabilities.push('data_storage');
    if (obj.auth || obj.token) capabilities.push('authentication');
    if (obj.cache || obj.redis) capabilities.push('caching');

    return capabilities;
  }

  private assessNovelty(ideaText: string): number {
    // Simple novelty assessment based on uniqueness of concepts
    const words = ideaText.toLowerCase().split(/\s+/);
    const uniqueWords = [...new Set(words)];
    const noveltyScore = Math.min(10, (uniqueWords.length / words.length) * 10);

    return noveltyScore;
  }

  private assessFeasibility(ideaText: string): number {
    // Assess feasibility based on complexity indicators
    const complexityKeywords = ['ai', 'blockchain', 'quantum', 'neural', 'machine learning'];
    const simpleKeywords = ['website', 'app', 'tool', 'service', 'platform'];

    const text = ideaText.toLowerCase();
    const complexityCount = complexityKeywords.filter(keyword => text.includes(keyword)).length;
    const simplicityCount = simpleKeywords.filter(keyword => text.includes(keyword)).length;

    // Higher complexity reduces feasibility
    const feasibilityScore = Math.max(1, 8 - complexityCount + simplicityCount);

    return Math.min(10, feasibilityScore);
  }

  private assessMarketPotential(ideaText: string): number {
    // Assess market potential based on market-related keywords
    const marketKeywords = ['business', 'customer', 'user', 'market', 'revenue', 'profit', 'scale'];
    const nichKeywords = ['specific', 'niche', 'specialized', 'custom', 'unique'];

    const text = ideaText.toLowerCase();
    const marketCount = marketKeywords.filter(keyword => text.includes(keyword)).length;
    const nicheCount = nichKeywords.filter(keyword => text.includes(keyword)).length;

    // Market keywords increase potential, niche keywords slightly decrease it
    const marketScore = Math.min(10, 5 + marketCount - (nicheCount * 0.5));

    return Math.max(1, marketScore);
  }

  public async invokeSkill(skillId: string, parameters: unknown): Promise<unknown> {
    const invocationId = `invocation_${Date.now()}`;

    const invocation: SkillInvocation = {
      skillId,
      parameters,
      startTime: new Date(),
    };

    this.activeInvocations.set(invocationId, invocation);

    try {
      // Find agent capable of handling this skill
      const agent = await this.findSkillAgent(skillId);

      if (agent) {
        invocation.agent = agent;
      }

      // Execute skill (this would integrate with KNIRVCHAIN)
      const result = await this.executeSkill(skillId, parameters, agent || undefined);

      invocation.result = result;
      invocation.endTime = new Date();

      if (agent) {
        this.updateAgentPerformance(agent,
          invocation.endTime.getTime() - invocation.startTime.getTime(),
          true
        );
      }

      this.activeInvocations.delete(invocationId);
      return result;

    } catch (error) {
      invocation.error = error instanceof Error ? error.message : String(error);
      invocation.endTime = new Date();

      if (invocation.agent) {
        this.updateAgentPerformance(invocation.agent,
          invocation.endTime.getTime() - invocation.startTime.getTime(),
          false
        );
      }

      this.activeInvocations.delete(invocationId);
      throw error;
    }
  }

  private async findSkillAgent(skillId: string): Promise<SEALAgent | null> {
    // Find agent with capabilities matching the skill
    let foundAgent: SEALAgent | null = null;
    this.agents.forEach((agent) => {
      if (!foundAgent && agent.capabilities.some(cap => skillId.includes(cap))) {
        foundAgent = agent;
      }
    });
    if (foundAgent) return foundAgent;

    return null;
  }

  private async executeSkill(skillId: string, parameters: unknown, agent?: SEALAgent): Promise<unknown> {
    console.log(`Executing skill: ${skillId}`, parameters);

    // Simulate skill execution
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));

    return {
      skillId,
      result: `Skill ${skillId} executed successfully`,
      parameters,
      executedBy: agent?.id || 'unknown',
      timestamp: new Date(),
    };
  }

  public async generateAdaptation(learningHistory: unknown[]): Promise<unknown> {
    if (!this.learningMode) {
      return null;
    }

    console.log('Generating adaptation from learning history...');

    // Analyze learning history to generate adaptation
    interface AdaptationChange {
      type: string;
      patterns: unknown[];
      adjustments: unknown;
    }

    const adaptation: {
      type: string;
      changes: AdaptationChange[];
      confidence: number;
      timestamp: Date;
    } = {
      type: 'performance_improvement',
      changes: [],
      confidence: 0.75,
      timestamp: new Date(),
    };

    // Analyze patterns in learning history
    const errorPatterns = this.analyzeErrorPatterns(learningHistory);
    const successPatterns = this.analyzeSuccessPatterns(learningHistory);

    // Generate adaptation changes
    if (errorPatterns.length > 0) {
      adaptation.changes.push({
        type: 'error_reduction',
        patterns: errorPatterns,
        adjustments: this.generateErrorAdjustments(errorPatterns),
      });
    }

    if (successPatterns.length > 0) {
      adaptation.changes.push({
        type: 'success_amplification',
        patterns: successPatterns,
        adjustments: this.generateSuccessAdjustments(successPatterns),
      });
    }

    this.emit('adaptationGenerated', adaptation);
    return adaptation;
  }

  private analyzeErrorPatterns(history: unknown[]): unknown[] {
    return history
      .filter(event => ((event as { feedback?: number }).feedback || 0) < 0)
      .map(event => ({
        inputType: (event as { eventType?: string }).eventType,
        input: (event as { input?: unknown }).input,
        output: (event as { output?: unknown }).output,
        feedback: (event as { feedback?: number }).feedback,
      }));
  }

  private analyzeSuccessPatterns(history: unknown[]): unknown[] {
    return history
      .filter(event => ((event as { feedback?: number }).feedback || 0) > 0.5)
      .map(event => ({
        inputType: (event as { eventType?: string }).eventType,
        input: (event as { input?: unknown }).input,
        output: (event as { output?: unknown }).output,
        feedback: (event as { feedback?: number }).feedback,
      }));
  }

  private generateErrorAdjustments(patterns: unknown[]): unknown[] {
    return patterns.map(pattern => ({
      target: (pattern as { inputType?: string }).inputType,
      adjustment: 'reduce_confidence',
      magnitude: Math.abs((pattern as { feedback?: number }).feedback || 0) * 0.1,
    }));
  }

  private generateSuccessAdjustments(patterns: unknown[]): unknown[] {
    return patterns.map(pattern => ({
      target: (pattern as { inputType?: string }).inputType,
      adjustment: 'increase_confidence',
      magnitude: ((pattern as { feedback?: number }).feedback || 0) * 0.1,
    }));
  }

  public async enableLearningMode(): Promise<void> {
    this.learningMode = true;
    console.log('SEAL learning mode enabled');
    this.emit('learningModeEnabled');
  }

  public async disableLearningMode(): Promise<void> {
    this.learningMode = false;
    console.log('SEAL learning mode disabled');
    this.emit('learningModeDisabled');
  }

  private updateAgentPerformance(agent: SEALAgent, latency: number, success: boolean): void {
    const perf = agent.performance;

    // Update success rate
    const totalAttempts = perf.totalInvocations;
    const previousSuccesses = perf.successRate * (totalAttempts - 1);
    perf.successRate = (previousSuccesses + (success ? 1 : 0)) / totalAttempts;

    // Update average latency
    perf.averageLatency = ((perf.averageLatency * (totalAttempts - 1)) + latency) / totalAttempts;

    // Update error count
    if (!success) {
      perf.errorCount++;
    }

    this.emit('agentPerformanceUpdated', {
      agentId: agent.id,
      performance: perf,
    });
  }

  private async cancelInvocation(invocationId: string): Promise<void> {
    const invocation = this.activeInvocations.get(invocationId);
    if (invocation) {
      invocation.error = 'Cancelled';
      invocation.endTime = new Date();
      this.activeInvocations.delete(invocationId);
    }
  }

  public getAgents(): SEALAgent[] {
    return Array.from(this.agents.values());
  }

  public getActiveInvocations(): SkillInvocation[] {
    return Array.from(this.activeInvocations.values());
  }

  public getMetrics(): unknown {
    const agents = Array.from(this.agents.values());

    return {
      totalAgents: agents.length,
      activeInvocations: this.activeInvocations.size,
      learningMode: this.learningMode,
      hrmIntegration: this.config.hrmIntegration,
      hrmReady: this.hrmBridge ? (this.hrmBridge as { isReady?: () => boolean }).isReady?.() : false,
      averageSuccessRate: agents.length > 0 ? agents.reduce((sum, agent) => sum + agent.performance.successRate, 0) / agents.length : 0,
      totalInvocations: agents.reduce((sum, agent) => sum + agent.performance.totalInvocations, 0),
    };
  }

  // HRM Integration methods
  public setHRMBridge(hrmBridge: unknown): void {
    this.hrmBridge = hrmBridge;
    console.log('HRM bridge injected into SEAL Framework');
  }

  public enableHRMIntegration(): void {
    this.config.hrmIntegration = true;
    console.log('HRM integration enabled in SEAL Framework');
  }

  public disableHRMIntegration(): void {
    this.config.hrmIntegration = false;
    console.log('HRM integration disabled in SEAL Framework');
  }

  public isHRMIntegrationEnabled(): boolean {
    return this.config.hrmIntegration === true;
  }

  public getHRMStatus(): unknown {
    return {
      enabled: this.config.hrmIntegration,
      bridgeAvailable: this.hrmBridge !== null,
      ready: this.hrmBridge ? (this.hrmBridge as { isReady?: () => boolean }).isReady?.() : false,
    };
  }

  public dispose(): void {
    try {
      // Stop the framework
      this.stop();

      // Clear all agents
      this.agents.clear();

      // Clear active invocations
      this.activeInvocations.clear();

      // Clear HRM bridge
      this.hrmBridge = null;

      // Remove all event listeners
      this.removeAllListeners();

      console.log('SEALFramework disposed successfully');
    } catch (error) {
      console.error('Error during SEALFramework disposal:', error);
    }
  }
}
