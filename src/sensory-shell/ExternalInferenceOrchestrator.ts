/**
 * External Inference Orchestrator
 * Routes cortex.wasm inference through external API channels during beta
 * Integrates with cognitive shell to provide seamless AI processing
 */

import { EventEmitter } from './EventEmitter';
import { 
  externalAPIService, 
  InferenceRequest, 
  InferenceResponse, 
  InferenceProvider 
} from '../services/ExternalAPIService';

export interface CortexInferenceRequest {
  prompt: string;
  context?: Record<string, unknown>;
  taskType?: 'conversation' | 'reasoning' | 'code-generation' | 'analysis' | 'creative';
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: Date;
  }>;
  metadata?: {
    agentId?: string;
    skillId?: string;
    sessionId?: string;
  };
}

export interface CortexInferenceResponse {
  success: boolean;
  content: string;
  reasoning?: string;
  confidence: number;
  provider: InferenceProvider;
  processingTime: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: {
    model?: string;
    temperature?: number;
    adaptations?: string[];
  };
  error?: string;
}

export interface InferenceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  providerUsage: Record<InferenceProvider, number>;
  tokenUsage: {
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
  };
}

export class ExternalInferenceOrchestrator extends EventEmitter {
  private metrics: InferenceMetrics;
  private conversationHistory: Map<string, Array<{ role: 'user' | 'assistant' | 'system'; content: string; timestamp: Date }>>;
  private systemPrompts: Map<string, string>;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      providerUsage: {
        gemini: 0,
        claude: 0,
        openai: 0,
        deepseek: 0
      },
      tokenUsage: {
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0
      }
    };
    this.conversationHistory = new Map();
    this.systemPrompts = new Map();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Set default system prompts for different task types
      this.systemPrompts.set('conversation', 
        'You are an intelligent AI assistant integrated into the KNIRV cognitive shell. ' +
        'Provide helpful, accurate, and contextually appropriate responses. ' +
        'You have access to advanced reasoning capabilities and can adapt to user needs.'
      );
      
      this.systemPrompts.set('reasoning', 
        'You are a reasoning specialist in the KNIRV cognitive shell. ' +
        'Break down complex problems step by step, show your reasoning process, ' +
        'and provide logical, well-structured solutions.'
      );
      
      this.systemPrompts.set('code-generation', 
        'You are a code generation expert in the KNIRV cognitive shell. ' +
        'Generate clean, efficient, and well-documented code. ' +
        'Follow best practices and explain your implementation choices.'
      );
      
      this.systemPrompts.set('analysis', 
        'You are an analysis specialist in the KNIRV cognitive shell. ' +
        'Provide thorough, objective analysis with clear insights and actionable recommendations. ' +
        'Support your conclusions with evidence and reasoning.'
      );
      
      this.systemPrompts.set('creative', 
        'You are a creative AI in the KNIRV cognitive shell. ' +
        'Generate original, innovative ideas and content while maintaining quality and relevance. ' +
        'Be imaginative but grounded in practical considerations.'
      );

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize External Inference Orchestrator:', error);
      this.emit('error', error);
    }
  }

  /**
   * Process inference request through external API
   */
  async processInference(request: CortexInferenceRequest): Promise<CortexInferenceResponse> {
    if (!this.isInitialized) {
      throw new Error('External Inference Orchestrator not initialized');
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Get active provider
      const activeProvider = externalAPIService.getActiveProvider();
      if (!activeProvider) {
        throw new Error('No active external inference provider configured');
      }

      // Prepare system prompt
      const systemPrompt = request.systemPrompt || 
        this.systemPrompts.get(request.taskType || 'conversation') ||
        this.systemPrompts.get('conversation')!;

      // Get conversation history for session
      const sessionId = request.metadata?.sessionId || 'default';
      const history = this.conversationHistory.get(sessionId) || [];

      // Prepare inference request
      const inferenceRequest: InferenceRequest = {
        prompt: request.prompt,
        maxTokens: request.maxTokens || 1024,
        temperature: request.temperature || 0.7,
        systemPrompt,
        conversationHistory: [
          ...history.slice(-10), // Keep last 10 messages for context
          ...(request.conversationHistory || [])
        ]
      };

      // Perform inference
      const response = await externalAPIService.performInference(inferenceRequest);

      if (response.success) {
        // Update conversation history
        this.updateConversationHistory(sessionId, request.prompt, response.content);
        
        // Update metrics
        this.updateMetrics(response, Date.now() - startTime);
        
        // Emit success event
        this.emit('inference-success', {
          request,
          response,
          processingTime: Date.now() - startTime
        });

        return {
          success: true,
          content: response.content,
          confidence: this.calculateConfidence(response),
          provider: response.provider,
          processingTime: response.processingTime,
          usage: response.usage,
          metadata: {
            model: response.model,
            temperature: request.temperature,
            adaptations: this.getAppliedAdaptations(request)
          }
        };
      } else {
        throw new Error(response.error || 'Inference failed');
      }
    } catch (error) {
      this.metrics.failedRequests++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('inference-error', {
        request,
        error: errorMessage,
        processingTime: Date.now() - startTime
      });

      return {
        success: false,
        content: '',
        confidence: 0,
        provider: externalAPIService.getActiveProvider() || 'gemini',
        processingTime: Date.now() - startTime,
        error: errorMessage
      };
    }
  }

  /**
   * Process batch inference requests
   */
  async processBatchInference(requests: CortexInferenceRequest[]): Promise<CortexInferenceResponse[]> {
    const responses: CortexInferenceResponse[] = [];
    
    for (const request of requests) {
      try {
        const response = await this.processInference(request);
        responses.push(response);
      } catch (error) {
        responses.push({
          success: false,
          content: '',
          confidence: 0,
          provider: externalAPIService.getActiveProvider() || 'gemini',
          processingTime: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return responses;
  }

  /**
   * Update conversation history for a session
   */
  private updateConversationHistory(sessionId: string, userMessage: string, assistantMessage: string): void {
    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, []);
    }
    
    const history = this.conversationHistory.get(sessionId)!;
    const timestamp = new Date();
    
    history.push(
      { role: 'user', content: userMessage, timestamp },
      { role: 'assistant', content: assistantMessage, timestamp }
    );
    
    // Keep only last 20 messages to prevent memory bloat
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
  }

  /**
   * Calculate confidence score based on response characteristics
   */
  private calculateConfidence(response: InferenceResponse): number {
    let confidence = 0.8; // Base confidence
    
    // Adjust based on response length (longer responses often more confident)
    if (response.content.length > 100) confidence += 0.1;
    if (response.content.length > 500) confidence += 0.05;
    
    // Adjust based on processing time (faster responses often more confident)
    if (response.processingTime < 1000) confidence += 0.05;
    
    // Adjust based on provider (some providers might be more reliable)
    switch (response.provider) {
      case 'claude':
        confidence += 0.05;
        break;
      case 'openai':
        confidence += 0.03;
        break;
      case 'gemini':
        confidence += 0.02;
        break;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Get applied adaptations for the request
   */
  private getAppliedAdaptations(request: CortexInferenceRequest): string[] {
    const adaptations: string[] = [];
    
    if (request.taskType) {
      adaptations.push(`task-type-${request.taskType}`);
    }
    
    if (request.context) {
      adaptations.push('context-aware');
    }
    
    if (request.conversationHistory && request.conversationHistory.length > 0) {
      adaptations.push('conversation-history');
    }
    
    return adaptations;
  }

  /**
   * Update metrics after successful inference
   */
  private updateMetrics(response: InferenceResponse, processingTime: number): void {
    this.metrics.successfulRequests++;
    this.metrics.providerUsage[response.provider]++;
    
    // Update average response time
    const totalTime = this.metrics.averageResponseTime * (this.metrics.successfulRequests - 1) + processingTime;
    this.metrics.averageResponseTime = totalTime / this.metrics.successfulRequests;
    
    // Update token usage
    if (response.usage) {
      this.metrics.tokenUsage.totalPromptTokens += response.usage.promptTokens;
      this.metrics.tokenUsage.totalCompletionTokens += response.usage.completionTokens;
      this.metrics.tokenUsage.totalTokens += response.usage.totalTokens;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): InferenceMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear conversation history for a session
   */
  clearConversationHistory(sessionId: string): void {
    this.conversationHistory.delete(sessionId);
  }

  /**
   * Clear all conversation history
   */
  clearAllConversationHistory(): void {
    this.conversationHistory.clear();
  }

  /**
   * Set custom system prompt for a task type
   */
  setSystemPrompt(taskType: string, prompt: string): void {
    this.systemPrompts.set(taskType, prompt);
  }

  /**
   * Get system prompt for a task type
   */
  getSystemPrompt(taskType: string): string | undefined {
    return this.systemPrompts.get(taskType);
  }

  /**
   * Check if orchestrator is ready
   */
  isReady(): boolean {
    return this.isInitialized && externalAPIService.getActiveProvider() !== null;
  }
}

// Export singleton instance
export const externalInferenceOrchestrator = new ExternalInferenceOrchestrator();
