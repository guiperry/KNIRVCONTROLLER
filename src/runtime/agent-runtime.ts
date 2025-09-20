/**
 * Agent Runtime Service
 * Provides WASM skill execution sandbox with resource limits and billing integration
 */

import { rxdbService } from '../services/RxDBService';

// Types for agent runtime
export interface SkillExecutionRequest {
  skillId: string;
  agentId: string;
  parameters: Record<string, unknown>;
  context: Record<string, unknown>;
  maxExecutionTime?: number; // milliseconds
  maxMemory?: number; // bytes
  billingAccountId?: string;
}

export interface SkillExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime: number;
  memoryUsed: number;
  gasUsed: number;
  billingInfo: {
    nrnCost: number;
    accountId: string;
    transactionId: string;
  };
}

export interface AgentRuntimeConfig {
  maxConcurrentExecutions: number;
  defaultExecutionTimeout: number;
  defaultMemoryLimit: number;
  wasmModulePath: string;
  billingEnabled: boolean;
}

export interface WasmModule {
  instance: WebAssembly.Instance;
  memory: WebAssembly.Memory;
  exports: Record<string, WebAssembly.ExportValue>;
}

export interface ResourceLimits {
  maxExecutionTime: number;
  maxMemory: number;
  maxGas: number;
}

export interface ExecutionContext {
  skillId: string;
  agentId: string;
  startTime: number;
  memoryUsed: number;
  gasUsed: number;
  resourceLimits: ResourceLimits;
}

class AgentRuntimeService {
  private config: AgentRuntimeConfig;
  private wasmModules: Map<string, WasmModule> = new Map();
  private activeExecutions: Map<string, ExecutionContext> = new Map();
  private executionQueue: SkillExecutionRequest[] = [];
  private isProcessingQueue = false;

  constructor(config: AgentRuntimeConfig) {
    this.config = config;
  }

  // Initialize the runtime service
  async initialize(): Promise<void> {
    console.log('Initializing Agent Runtime Service...');
    
    // Load default WASM modules
    await this.loadWasmModule('default', this.config.wasmModulePath);
    
    // Start queue processor
    this.startQueueProcessor();
    
    console.log('Agent Runtime Service initialized');
  }

  // Load a WASM module
  async loadWasmModule(moduleId: string, wasmPath: string): Promise<void> {
    try {
      // In a real implementation, this would load from file system or network
      // For now, we'll simulate loading a WASM module
      const wasmBytes = await this.fetchWasmBytes(wasmPath);
      const wasmModule = await WebAssembly.instantiate(wasmBytes, {
        env: {
          memory: new WebAssembly.Memory({ initial: 256, maximum: 512 }),
          abort: () => { throw new Error('WASM execution aborted'); },
          log: (ptr: number, len: number) => {
            // Log function for WASM modules
            console.log(`WASM Log: ${this.readStringFromMemory(ptr, len)}`);
          }
        }
      });

      const module: WasmModule = {
        instance: wasmModule.instance,
        memory: wasmModule.instance.exports.memory as WebAssembly.Memory,
        exports: wasmModule.instance.exports
      };

      this.wasmModules.set(moduleId, module);
      console.log(`WASM module ${moduleId} loaded successfully`);
    } catch (error) {
      console.error(`Failed to load WASM module ${moduleId}:`, error);
      throw error;
    }
  }

  // Execute a skill in the WASM sandbox
  async executeSkill(request: SkillExecutionRequest): Promise<SkillExecutionResult> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Check if we're at max concurrent executions
      if (this.activeExecutions.size >= this.config.maxConcurrentExecutions) {
        // Queue the request
        this.executionQueue.push(request);
        return new Promise((resolve) => {
          // This would be handled by the queue processor
          setTimeout(() => {
            resolve(this.executeSkillInternal(request, executionId));
          }, 100);
        });
      }

      return await this.executeSkillInternal(request, executionId);
    } catch (error) {
      console.error(`Skill execution failed for ${request.skillId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0,
        memoryUsed: 0,
        gasUsed: 0,
        billingInfo: {
          nrnCost: 0,
          accountId: request.billingAccountId || 'unknown',
          transactionId: executionId
        }
      };
    }
  }

  // Internal skill execution
  private async executeSkillInternal(
    request: SkillExecutionRequest, 
    executionId: string
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();
    
    // Create execution context
    const context: ExecutionContext = {
      skillId: request.skillId,
      agentId: request.agentId,
      startTime,
      memoryUsed: 0,
      gasUsed: 0,
      resourceLimits: {
        maxExecutionTime: request.maxExecutionTime || this.config.defaultExecutionTimeout,
        maxMemory: request.maxMemory || this.config.defaultMemoryLimit,
        maxGas: 1000000 // Default gas limit
      }
    };

    this.activeExecutions.set(executionId, context);

    try {
      // Get WASM module (use default for now)
      const wasmModule = this.wasmModules.get('default');
      if (!wasmModule) {
        throw new Error('WASM module not loaded');
      }

      // Prepare execution environment
      const executionEnv = this.prepareExecutionEnvironment(request, wasmModule);
      
      // Execute with timeout
      const result = await this.executeWithTimeout(
        () => this.runSkillInWasm(request, wasmModule, executionEnv),
        context.resourceLimits.maxExecutionTime
      );

      const executionTime = Date.now() - startTime;
      const gasUsed = this.calculateGasUsed(executionTime, context.memoryUsed);
      const nrnCost = this.calculateNrnCost(gasUsed);

      // Record billing if enabled
      if (this.config.billingEnabled) {
        await this.recordBilling(request.billingAccountId || 'default', nrnCost, executionId);
      }

      return {
        success: true,
        result,
        executionTime,
        memoryUsed: context.memoryUsed,
        gasUsed,
        billingInfo: {
          nrnCost,
          accountId: request.billingAccountId || 'default',
          transactionId: executionId
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
        executionTime,
        memoryUsed: context.memoryUsed,
        gasUsed: context.gasUsed,
        billingInfo: {
          nrnCost: 0,
          accountId: request.billingAccountId || 'default',
          transactionId: executionId
        }
      };
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  // Prepare execution environment for WASM
  private prepareExecutionEnvironment(
    request: SkillExecutionRequest, 
    wasmModule: WasmModule
  ): Record<string, unknown> {
    return {
      skillId: request.skillId,
      agentId: request.agentId,
      parameters: JSON.stringify(request.parameters),
      context: JSON.stringify(request.context),
      memory: wasmModule.memory,
      exports: wasmModule.exports
    };
  }

  // Execute skill in WASM with resource monitoring
  private async runSkillInWasm(
    request: SkillExecutionRequest,
    wasmModule: WasmModule,
    env: Record<string, unknown>
  ): Promise<unknown> {
    // This is a simplified simulation of WASM execution
    // In a real implementation, this would:
    // 1. Set up memory for parameters
    // 2. Call the WASM function
    // 3. Monitor resource usage
    // 4. Extract results from memory

    // Simulate skill execution
    const skillFunction = wasmModule.exports[`skill_${request.skillId}`] as CallableFunction;
    
    if (!skillFunction) {
      // Fallback to generic execution
      return this.simulateSkillExecution(request);
    }

    // Call the WASM function (simplified)
    const result = skillFunction();
    return result;
  }

  // Simulate skill execution for demo purposes
  private async simulateSkillExecution(request: SkillExecutionRequest): Promise<unknown> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    
    return {
      skillId: request.skillId,
      agentId: request.agentId,
      result: `Skill ${request.skillId} executed successfully`,
      parameters: request.parameters,
      timestamp: new Date().toISOString()
    };
  }

  // Execute with timeout
  private async executeWithTimeout<T>(
    fn: () => Promise<T>, 
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      fn().then(
        (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      );
    });
  }

  // Calculate gas used based on execution metrics
  private calculateGasUsed(executionTime: number, memoryUsed: number): number {
    // Simple gas calculation: base cost + time cost + memory cost
    const baseCost = 1000;
    const timeCost = Math.floor(executionTime / 10); // 1 gas per 10ms
    const memoryCost = Math.floor(memoryUsed / 1024); // 1 gas per KB
    
    return baseCost + timeCost + memoryCost;
  }

  // Calculate NRN cost from gas
  private calculateNrnCost(gasUsed: number): number {
    // Simple conversion: 1 NRN = 10000 gas
    return gasUsed / 10000;
  }

  // Record billing transaction
  private async recordBilling(
    accountId: string, 
    nrnCost: number, 
    transactionId: string
  ): Promise<void> {
    try {
      const db = rxdbService.getDatabase();
      await db.transactions.insert({
        id: transactionId,
        type: 'transaction',
        walletId: accountId,
        hash: transactionId,
        from: accountId,
        to: 'skill_execution',
        amount: nrnCost.toString(),
        nrnAmount: nrnCost.toString(),
        status: 'confirmed',
        timestamp: Date.now(),
        blockHeight: 0,
        gasUsed: this.calculateGasUsed(0, 0), // Would be actual values
        memo: `Skill execution: ${transactionId}`,
        category: 'skill_payment'
      });
    } catch (error) {
      console.error('Failed to record billing:', error);
    }
  }

  // Fetch WASM bytes (mock implementation)
  private async fetchWasmBytes(wasmPath: string): Promise<ArrayBuffer> {
    // In a real implementation, this would fetch from file system or network
    // For now, return a minimal WASM module
    return new ArrayBuffer(8);
  }

  // Read string from WASM memory
  private readStringFromMemory(ptr: number, len: number): string {
    // This would read from the WASM memory
    return `Memory[${ptr}:${ptr + len}]`;
  }

  // Start queue processor
  private startQueueProcessor(): void {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    setInterval(() => {
      if (this.executionQueue.length > 0 && 
          this.activeExecutions.size < this.config.maxConcurrentExecutions) {
        const request = this.executionQueue.shift();
        if (request) {
          this.executeSkill(request).catch(console.error);
        }
      }
    }, 100);
  }

  // Get runtime statistics
  getStats(): {
    activeExecutions: number;
    queuedExecutions: number;
    loadedModules: number;
    totalExecutions: number;
  } {
    return {
      activeExecutions: this.activeExecutions.size,
      queuedExecutions: this.executionQueue.length,
      loadedModules: this.wasmModules.size,
      totalExecutions: 0 // Would track this in real implementation
    };
  }

  // Shutdown the runtime
  async shutdown(): Promise<void> {
    console.log('Shutting down Agent Runtime Service...');
    this.isProcessingQueue = false;
    this.activeExecutions.clear();
    this.executionQueue.length = 0;
    this.wasmModules.clear();
    console.log('Agent Runtime Service shut down');
  }
}

// Default configuration
const defaultConfig: AgentRuntimeConfig = {
  maxConcurrentExecutions: 5,
  defaultExecutionTimeout: 30000, // 30 seconds
  defaultMemoryLimit: 64 * 1024 * 1024, // 64MB
  wasmModulePath: '/wasm/agent-skills.wasm',
  billingEnabled: true
};

// Export singleton instance
export const agentRuntimeService = new AgentRuntimeService(defaultConfig);

// Export types and service
export { AgentRuntimeService };
export default agentRuntimeService;
