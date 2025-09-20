/**
 * External API Configuration Service
 * Manages external model API keys for inference providers during beta
 * Supports Google Gemini, Anthropic Claude, OpenAI ChatGPT-5, and Deepseek
 */

export type InferenceProvider = 'gemini' | 'claude' | 'openai' | 'deepseek';

export interface ExternalAPIConfig {
  id: string;
  provider: InferenceProvider;
  apiKey: string;
  endpoint?: string;
  model?: string;
  isActive: boolean;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
}

export interface InferenceRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  systemPrompt?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
}

export interface InferenceResponse {
  success: boolean;
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  provider: InferenceProvider;
  processingTime: number;
  error?: string;
}

export interface ProviderCapabilities {
  provider: InferenceProvider;
  name: string;
  description: string;
  models: string[];
  maxTokens: number;
  supportsSystemPrompt: boolean;
  supportsConversationHistory: boolean;
  supportsStreaming: boolean;
  defaultModel: string;
  endpoint: string;
}

export class ExternalAPIService {
  private configs: Map<string, ExternalAPIConfig> = new Map();
  private activeProvider: InferenceProvider | null = null;
  private readonly storageKey = 'knirv_external_api_configs';

  constructor() {
    this.loadConfigs();
  }

  /**
   * Get available inference providers and their capabilities
   */
  getProviderCapabilities(): ProviderCapabilities[] {
    return [
      {
        provider: 'gemini',
        name: 'Google Gemini',
        description: 'Google\'s advanced multimodal AI model',
        models: ['gemini-pro', 'gemini-pro-vision', 'gemini-ultra'],
        maxTokens: 32768,
        supportsSystemPrompt: true,
        supportsConversationHistory: true,
        supportsStreaming: true,
        defaultModel: 'gemini-pro',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta'
      },
      {
        provider: 'claude',
        name: 'Anthropic Claude',
        description: 'Anthropic\'s constitutional AI assistant',
        models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
        maxTokens: 200000,
        supportsSystemPrompt: true,
        supportsConversationHistory: true,
        supportsStreaming: true,
        defaultModel: 'claude-3-sonnet',
        endpoint: 'https://api.anthropic.com/v1'
      },
      {
        provider: 'openai',
        name: 'OpenAI ChatGPT-5',
        description: 'OpenAI\'s latest language model',
        models: ['gpt-5', 'gpt-4-turbo', 'gpt-4'],
        maxTokens: 128000,
        supportsSystemPrompt: true,
        supportsConversationHistory: true,
        supportsStreaming: true,
        defaultModel: 'gpt-5',
        endpoint: 'https://api.openai.com/v1'
      },
      {
        provider: 'deepseek',
        name: 'Deepseek',
        description: 'Deepseek\'s efficient reasoning model',
        models: ['deepseek-chat', 'deepseek-coder', 'deepseek-math'],
        maxTokens: 32768,
        supportsSystemPrompt: true,
        supportsConversationHistory: true,
        supportsStreaming: true,
        defaultModel: 'deepseek-chat',
        endpoint: 'https://api.deepseek.com/v1'
      }
    ];
  }

  /**
   * Add or update an API configuration
   */
  async setAPIConfig(provider: InferenceProvider, apiKey: string, options?: {
    endpoint?: string;
    model?: string;
    rateLimit?: ExternalAPIConfig['rateLimit'];
  }): Promise<ExternalAPIConfig> {
    const capabilities = this.getProviderCapabilities().find(p => p.provider === provider);
    if (!capabilities) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const config: ExternalAPIConfig = {
      id: `${provider}_${Date.now()}`,
      provider,
      apiKey,
      endpoint: options?.endpoint || capabilities.endpoint,
      model: options?.model || capabilities.defaultModel,
      isActive: true,
      createdAt: new Date(),
      usageCount: 0,
      rateLimit: options?.rateLimit || {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000
      }
    };

    // Validate API key format
    if (!this.validateAPIKey(provider, apiKey)) {
      throw new Error(`Invalid API key format for ${provider}`);
    }

    // Test the API key
    const testResult = await this.testAPIKey(config);
    if (!testResult.success) {
      throw new Error(`API key validation failed: ${testResult.error}`);
    }

    this.configs.set(config.id, config);
    this.saveConfigs();

    return config;
  }

  /**
   * Get all configured APIs
   */
  getAPIConfigs(): ExternalAPIConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Get active API configuration for a provider
   */
  getActiveConfig(provider: InferenceProvider): ExternalAPIConfig | null {
    return Array.from(this.configs.values())
      .find(config => config.provider === provider && config.isActive) || null;
  }

  /**
   * Set active provider for inference
   */
  setActiveProvider(provider: InferenceProvider): void {
    const config = this.getActiveConfig(provider);
    if (!config) {
      throw new Error(`No active configuration found for provider: ${provider}`);
    }
    this.activeProvider = provider;
    localStorage.setItem('knirv_active_provider', provider);
  }

  /**
   * Get current active provider
   */
  getActiveProvider(): InferenceProvider | null {
    if (!this.activeProvider) {
      this.activeProvider = localStorage.getItem('knirv_active_provider') as InferenceProvider || null;
    }
    return this.activeProvider;
  }

  /**
   * Perform inference using the active provider
   */
  async performInference(request: InferenceRequest): Promise<InferenceResponse> {
    const provider = this.getActiveProvider();
    if (!provider) {
      throw new Error('No active inference provider configured');
    }

    const config = this.getActiveConfig(provider);
    if (!config) {
      throw new Error(`No active configuration for provider: ${provider}`);
    }

    const startTime = Date.now();

    try {
      const response = await this.callProviderAPI(config, request);
      
      // Update usage statistics
      config.usageCount++;
      config.lastUsed = new Date();
      this.saveConfigs();

      return {
        ...response,
        provider,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        provider,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Remove an API configuration
   */
  removeAPIConfig(configId: string): void {
    this.configs.delete(configId);
    this.saveConfigs();
  }

  /**
   * Toggle API configuration active state
   */
  toggleAPIConfig(configId: string): void {
    const config = this.configs.get(configId);
    if (config) {
      config.isActive = !config.isActive;
      this.saveConfigs();
    }
  }

  private validateAPIKey(provider: InferenceProvider, apiKey: string): boolean {
    switch (provider) {
      case 'gemini':
        return /^AIza[0-9A-Za-z-_]{35}$/.test(apiKey);
      case 'claude':
        return /^sk-ant-[a-zA-Z0-9-_]{95,}$/.test(apiKey);
      case 'openai':
        return /^sk-[a-zA-Z0-9]{48,}$/.test(apiKey);
      case 'deepseek':
        return /^sk-[a-zA-Z0-9]{32,}$/.test(apiKey);
      default:
        return false;
    }
  }

  private async testAPIKey(config: ExternalAPIConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const testRequest: InferenceRequest = {
        prompt: 'Hello, this is a test message.',
        maxTokens: 10,
        temperature: 0.1
      };

      await this.callProviderAPI(config, testRequest);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private async callProviderAPI(config: ExternalAPIConfig, request: InferenceRequest): Promise<Omit<InferenceResponse, 'provider' | 'processingTime'>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    let url: string;
    let body: unknown;

    switch (config.provider) {
      case 'gemini':
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        url = `${config.endpoint}/models/${config.model}:generateContent`;
        body = {
          contents: [{
            parts: [{ text: request.prompt }]
          }],
          generationConfig: {
            maxOutputTokens: request.maxTokens || 1024,
            temperature: request.temperature || 0.7,
            topP: request.topP || 0.9
          }
        };
        break;

      case 'claude':
        headers['x-api-key'] = config.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        url = `${config.endpoint}/messages`;
        body = {
          model: config.model,
          max_tokens: request.maxTokens || 1024,
          temperature: request.temperature || 0.7,
          messages: [
            ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
            ...(request.conversationHistory || []),
            { role: 'user', content: request.prompt }
          ]
        };
        break;

      case 'openai':
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        url = `${config.endpoint}/chat/completions`;
        body = {
          model: config.model,
          max_tokens: request.maxTokens || 1024,
          temperature: request.temperature || 0.7,
          top_p: request.topP || 0.9,
          messages: [
            ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
            ...(request.conversationHistory || []),
            { role: 'user', content: request.prompt }
          ]
        };
        break;

      case 'deepseek':
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        url = `${config.endpoint}/chat/completions`;
        body = {
          model: config.model,
          max_tokens: request.maxTokens || 1024,
          temperature: request.temperature || 0.7,
          top_p: request.topP || 0.9,
          messages: [
            ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
            ...(request.conversationHistory || []),
            { role: 'user', content: request.prompt }
          ]
        };
        break;

      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return this.parseProviderResponse(config.provider, data);
  }

  private parseProviderResponse(provider: InferenceProvider, data: any): Omit<InferenceResponse, 'provider' | 'processingTime'> {
    switch (provider) {
      case 'gemini':
        return {
          success: true,
          content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
          usage: {
            promptTokens: data.usageMetadata?.promptTokenCount || 0,
            completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata?.totalTokenCount || 0
          },
          model: data.modelVersion
        };

      case 'claude':
        return {
          success: true,
          content: data.content?.[0]?.text || '',
          usage: {
            promptTokens: data.usage?.input_tokens || 0,
            completionTokens: data.usage?.output_tokens || 0,
            totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
          },
          model: data.model
        };

      case 'openai':
      case 'deepseek':
        return {
          success: true,
          content: data.choices?.[0]?.message?.content || '',
          usage: {
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0
          },
          model: data.model
        };

      default:
        throw new Error(`Unsupported provider response format: ${provider}`);
    }
  }

  private loadConfigs(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const configs = JSON.parse(stored);
        this.configs = new Map(configs.map((config: ExternalAPIConfig) => [config.id, {
          ...config,
          createdAt: new Date(config.createdAt),
          lastUsed: config.lastUsed ? new Date(config.lastUsed) : undefined
        }]));
      }
    } catch (error) {
      console.error('Failed to load API configs:', error);
    }
  }

  private saveConfigs(): void {
    try {
      const configs = Array.from(this.configs.values());
      localStorage.setItem(this.storageKey, JSON.stringify(configs));
    } catch (error) {
      console.error('Failed to save API configs:', error);
    }
  }
}

// Export singleton instance
export const externalAPIService = new ExternalAPIService();
