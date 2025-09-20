/**
 * End-to-End Billing Tests
 * Tests the complete billing flow from skill execution to chain transaction
 */

import { agentRuntimeService } from '../runtime/agent-runtime';
import { knirvChainService } from '../services/KnirvChainService';
import { rxdbService } from '../services/RxDBService';

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock WebAssembly for WASM tests
global.WebAssembly = {
  instantiate: jest.fn().mockResolvedValue({
    instance: {
      exports: {
        memory: new ArrayBuffer(1024),
        skill_test: jest.fn().mockReturnValue(42)
      }
    }
  }),
  Memory: jest.fn().mockImplementation(() => new ArrayBuffer(1024))
} as unknown as typeof globalThis.WebAssembly;

// Helper to convert RxDB document to plain object; placed at file scope for reuse
function toPlain<T>(doc: unknown): T {
  if (doc && typeof (doc as { toJSON?: () => unknown }).toJSON === 'function') {
    return (doc as { toJSON: () => unknown }).toJSON() as T;
  }
  return doc as T;
}

describe('End-to-End Billing Tests', () => {
  beforeEach(async () => {
    // Initialize services
    await rxdbService.initialize();
    await agentRuntimeService.initialize();
    
    // Mock chain service initialization
    jest.spyOn(knirvChainService, 'initialize').mockResolvedValue();
    jest.spyOn(knirvChainService, 'isChainConnected').mockReturnValue(true);
    
    // Reset mocks
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });
  });

  afterEach(async () => {
    await agentRuntimeService.shutdown();
    await rxdbService.destroy();
    jest.clearAllMocks();
  });

  describe('Skill Execution Billing Flow', () => {
    it('should execute skill and bill correctly', async () => {
      // Mock chain billing
      const mockBillSkillExecution = jest.spyOn(knirvChainService, 'billSkillExecution')
        .mockResolvedValue('mock_tx_hash');

      const skillRequest = {
        skillId: 'test-skill-1',
        agentId: 'test-agent-1',
        parameters: { input: 'test data' },
        context: { environment: 'test' },
        billingAccountId: 'test-account'
      };

      // Execute skill
      const result = await agentRuntimeService.executeSkill(skillRequest);

      // Verify execution success
      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.gasUsed).toBeGreaterThan(0);
      expect(result.billingInfo.nrnCost).toBeGreaterThan(0);
      expect(result.billingInfo.accountId).toBe('test-account');

      // Verify billing was called
      expect(mockBillSkillExecution).toHaveBeenCalledWith({
        skillId: 'test-skill-1',
        agentId: 'test-agent-1',
        executionId: expect.any(String),
        nrnCost: result.billingInfo.nrnCost,
        gasUsed: result.gasUsed,
        billingAccount: 'test-account',
        timestamp: expect.any(Number)
      });
    });

    it('should handle billing failures gracefully', async () => {
      // Mock chain billing failure
      jest.spyOn(knirvChainService, 'billSkillExecution')
        .mockResolvedValue(null);

      const skillRequest = {
        skillId: 'test-skill-2',
        agentId: 'test-agent-2',
        parameters: { input: 'test data' },
        context: { environment: 'test' },
        billingAccountId: 'test-account'
      };

      // Execute skill
      const result = await agentRuntimeService.executeSkill(skillRequest);

      // Skill should still execute successfully even if billing fails
      expect(result.success).toBe(true);
      expect(result.billingInfo.transactionId).toBeDefined();
    });

    it('should calculate gas costs correctly', async () => {
      const skillRequest = {
        skillId: 'gas-test-skill',
        agentId: 'gas-test-agent',
        parameters: { complexity: 'high' },
        context: { largeData: 'x'.repeat(10000) }, // Large context
        billingAccountId: 'test-account'
      };

      const result = await agentRuntimeService.executeSkill(skillRequest);

      expect(result.success).toBe(true);
      expect(result.gasUsed).toBeGreaterThan(1000); // Should use significant gas
      expect(result.billingInfo.nrnCost).toBeGreaterThan(0.1); // Should cost more than minimal
    });
  });

  describe('Resource Limits and Billing', () => {
    it('should enforce execution timeout and bill accordingly', async () => {
      const skillRequest = {
        skillId: 'timeout-test-skill',
        agentId: 'timeout-test-agent',
        parameters: { delay: 5000 }, // 5 second delay
        context: {},
        maxExecutionTime: 1000, // 1 second timeout
        billingAccountId: 'test-account'
      };

      const result = await agentRuntimeService.executeSkill(skillRequest);

      // Should fail due to timeout
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(result.executionTime).toBeLessThan(1500); // Should be close to timeout
      expect(result.billingInfo.nrnCost).toBe(0); // No billing for failed execution
    });

    it('should handle memory limits', async () => {
      const skillRequest = {
        skillId: 'memory-test-skill',
        agentId: 'memory-test-agent',
        parameters: { memoryIntensive: true },
        context: {},
        maxMemory: 1024 * 1024, // 1MB limit
        billingAccountId: 'test-account'
      };

      const result = await agentRuntimeService.executeSkill(skillRequest);

      // Should track memory usage
      expect(result.memoryUsed).toBeGreaterThanOrEqual(0);
      if (result.success) {
        expect(result.memoryUsed).toBeLessThanOrEqual(1024 * 1024);
      }
    });
  });

  describe('Concurrent Execution Billing', () => {
    it('should handle multiple concurrent skill executions', async () => {
      const mockBillSkillExecution = jest.spyOn(knirvChainService, 'billSkillExecution')
        .mockResolvedValue('mock_tx_hash');

      const requests = Array.from({ length: 5 }, (_, i) => ({
        skillId: `concurrent-skill-${i}`,
        agentId: `concurrent-agent-${i}`,
        parameters: { index: i },
        context: {},
        billingAccountId: `account-${i}`
      }));

      // Execute all skills concurrently
      const results = await Promise.all(
        requests.map(request => agentRuntimeService.executeSkill(request))
      );

      // All should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.billingInfo.accountId).toBe(`account-${index}`);
      });

      // Billing should be called for each execution
      expect(mockBillSkillExecution).toHaveBeenCalledTimes(5);
    });

    it('should queue executions when at capacity', async () => {
  // Get current stats (not used directly but useful when debugging locally)
  // Keep as a transient call but avoid linter unused-var by not assigning
  agentRuntimeService.getStats();
      
      // Create more requests than max concurrent executions
      const requests = Array.from({ length: 10 }, (_, i) => ({
        skillId: `queue-skill-${i}`,
        agentId: `queue-agent-${i}`,
        parameters: { index: i },
        context: {},
        billingAccountId: 'queue-account'
      }));

      // Execute all skills
      const resultPromises = requests.map(request => 
        agentRuntimeService.executeSkill(request)
      );

      // Check that some are queued
      const statsAfterSubmission = agentRuntimeService.getStats();
      expect(statsAfterSubmission.queuedExecutions).toBeGreaterThan(0);

      // Wait for all to complete
      const results = await Promise.all(resultPromises);

      // All should eventually succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Queue should be empty after completion
      const finalStats = agentRuntimeService.getStats();
      expect(finalStats.queuedExecutions).toBe(0);
    });
  });

  describe('Chain Integration', () => {
    it('should register agent and execute skills', async () => {
      // Mock agent registration
      jest.spyOn(knirvChainService, 'registerAgent')
        .mockResolvedValue('registration_tx_hash');

      jest.spyOn(knirvChainService, 'queryAgent')
        .mockResolvedValue({
          agentId: 'chain-test-agent',
          ownerAddress: 'knirv1test',
          skillIds: ['skill1', 'skill2'],
          metadata: { name: 'Test Agent' },
          registrationTx: 'registration_tx_hash',
          status: 'active'
        });

      // Register agent
      const registrationTx = await knirvChainService.registerAgent({
        agentId: 'chain-test-agent',
        ownerAddress: 'knirv1test',
        skillIds: ['skill1', 'skill2'],
        metadata: { name: 'Test Agent' }
      });

      expect(registrationTx).toBe('registration_tx_hash');

      // Query agent
      const agent = await knirvChainService.queryAgent('chain-test-agent');
      expect(agent).toBeDefined();
      expect(agent!.status).toBe('active');

      // Execute skill for registered agent
      const skillRequest = {
        skillId: 'skill1',
        agentId: 'chain-test-agent',
        parameters: { test: true },
        context: {},
        billingAccountId: 'knirv1test'
      };

      const result = await agentRuntimeService.executeSkill(skillRequest);
      expect(result.success).toBe(true);
    });

    it('should handle wallet operations', async () => {
      // Mock wallet info
      jest.spyOn(knirvChainService, 'getWalletInfo')
        .mockResolvedValue({
          address: 'knirv1testwallet',
          balance: '1000000000',
          sequence: 1,
          accountNumber: 123
        });

      // Mock send transaction
      jest.spyOn(knirvChainService, 'sendNrn')
        .mockResolvedValue({
          txHash: 'send_tx_hash',
          from: 'knirv1testwallet',
          to: 'knirv1recipient',
          amount: '1000000',
          fee: '5000',
          timestamp: Date.now(),
          blockHeight: 12345,
          status: 'success'
        });

      // Get wallet info
      const walletInfo = await knirvChainService.getWalletInfo();
      expect(walletInfo).toBeDefined();
      expect(walletInfo!.address).toBe('knirv1testwallet');

      // Send NRN
      const transaction = await knirvChainService.sendNrn(
        'knirv1recipient',
        '1000000',
        'Test payment'
      );

      expect(transaction).toBeDefined();
      expect(transaction!.status).toBe('success');
    });
  });

  describe('Billing Persistence', () => {
    it('should persist billing records to database', async () => {
      const skillRequest = {
        skillId: 'persist-test-skill',
        agentId: 'persist-test-agent',
        parameters: { test: true },
        context: {},
        billingAccountId: 'persist-account'
      };

      const result = await agentRuntimeService.executeSkill(skillRequest);
      expect(result.success).toBe(true);

      // Check that transaction was recorded in database
      const db = rxdbService.getDatabase();
      const transactions = await db.transactions.find({
        selector: { id: result.billingInfo.transactionId }
      }).exec();

      expect(transactions.length).toBe(1);

      const transactionDoc = transactions[0];
      type TestTransaction = { id: string; type: string; accountId: string; amount: number; status: string };
      const transaction = toPlain<TestTransaction>(transactionDoc);
      expect(transaction.type).toBe('skill_execution');
      expect(transaction.accountId).toBe('persist-account');
      expect(transaction.amount).toBe(result.billingInfo.nrnCost);
      expect(transaction.status).toBe('completed');
    });

    it('should track billing statistics', async () => {
      // Execute multiple skills
      const requests = Array.from({ length: 3 }, (_, i) => ({
        skillId: `stats-skill-${i}`,
        agentId: `stats-agent-${i}`,
        parameters: { index: i },
        context: {},
        billingAccountId: 'stats-account'
      }));

      const results = await Promise.all(
        requests.map(request => agentRuntimeService.executeSkill(request))
      );

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Check database for billing records
  const db = rxdbService.getDatabase();
  const allTransactions = await db.transactions.find().exec();

  // Filter in-memory to avoid strict Mango selector typings in tests
  const filtered = allTransactions.filter(doc => toPlain<{ accountId?: string }>(doc).accountId === 'stats-account');

  expect(filtered.length).toBe(3);

  // Map to plain objects then calculate total billing
  const plainTx = filtered.map(doc => toPlain<{ amount: number }>(doc));
  const totalBilling = plainTx.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  expect(totalBilling).toBeGreaterThan(0);
    });
  });
});
