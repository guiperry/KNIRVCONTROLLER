/**
 * KNIRVCHAIN RPC Service
 * Provides integration with KNIRVCHAIN for billing, skill execution, and agent management
 * Uses @cosmjs for Cosmos SDK integration
 */

import { StargateClient, SigningStargateClient } from '@cosmjs/stargate';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { GasPrice } from '@cosmjs/stargate';
// Import secure keystore lazily to avoid circular imports at module load time
import { secureKeyStoreService } from './SecureKeyStoreService';

// Types for KNIRVCHAIN integration
export interface ChainConfig {
  rpcEndpoint: string;
  chainId: string;
  addressPrefix: string;
  gasPrice: string;
  defaultGas: number;
}

export interface NrnTransaction {
  txHash: string;
  from: string;
  to: string;
  amount: string;
  fee: string;
  timestamp: number;
  blockHeight: number;
  status: 'pending' | 'success' | 'failed';
}

export interface SkillExecutionBilling {
  skillId: string;
  agentId: string;
  executionId: string;
  nrnCost: number;
  gasUsed: number;
  billingAccount: string;
  timestamp: number;
}

export interface AgentRegistration {
  agentId: string;
  ownerAddress: string;
  skillIds: string[];
  metadata: Record<string, unknown>;
  registrationTx: string;
  status: 'active' | 'inactive' | 'suspended';
}

export interface WalletInfo {
  address: string;
  balance: string;
  sequence: number;
  accountNumber: number;
}

class KnirvChainService {
  private config: ChainConfig;
  private client: StargateClient | null = null;
  private signingClient: SigningStargateClient | null = null;
  private wallet: DirectSecp256k1HdWallet | null = null;
  private isConnected = false;

  constructor(config: ChainConfig) {
    this.config = config;
  }

  // Initialize connection to KNIRVCHAIN
  async initialize(mnemonic?: string): Promise<void> {
    try {
      console.log('Connecting to KNIRVCHAIN...');
      // If no mnemonic provided, attempt to load from secure keystore (default user)
      if (!mnemonic) {
        try {
          const stored = await secureKeyStoreService.getMnemonic('default');
          if (stored) mnemonic = stored;
        } catch {
          // ignore and continue without mnemonic
        }
      }
      // Connect read-only client
      this.client = await StargateClient.connect(this.config.rpcEndpoint);
      
      // If mnemonic provided, set up signing client
      if (mnemonic) {
        await this.setupSigningClient(mnemonic);
      }
      
      this.isConnected = true;
      console.log(`Connected to KNIRVCHAIN at ${this.config.rpcEndpoint}`);
    } catch (error) {
      console.error('Failed to connect to KNIRVCHAIN:', error);
      throw error;
    }
  }

  // Store mnemonic for a user into secure keystore
  async storeMnemonicForUser(userId: string, mnemonic: string): Promise<void> {
    await secureKeyStoreService.storeMnemonic(userId, mnemonic);
  }

  // Clear mnemonic for a user
  async clearMnemonicForUser(userId: string): Promise<void> {
    await secureKeyStoreService.clearMnemonic(userId);
  }

  // Setup signing client with wallet
  private async setupSigningClient(mnemonic: string): Promise<void> {
    try {
      this.wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
        prefix: this.config.addressPrefix
      });

      const accounts = await this.wallet.getAccounts();
      console.log(`Wallet address: ${accounts[0].address}`);

      this.signingClient = await SigningStargateClient.connectWithSigner(
        this.config.rpcEndpoint,
        this.wallet,
        {
          gasPrice: GasPrice.fromString(this.config.gasPrice)
        }
      );
    } catch (error) {
      console.error('Failed to setup signing client:', error);
      throw error;
    }
  }

  // Get wallet information
  async getWalletInfo(): Promise<WalletInfo | null> {
    if (!this.client || !this.wallet) return null;

    try {
      const accounts = await this.wallet.getAccounts();
      const address = accounts[0].address;
      
      const balance = await this.client.getBalance(address, 'unrn');
      const account = await this.client.getAccount(address);

      return {
        address,
        balance: balance?.amount || '0',
        sequence: account?.sequence || 0,
        accountNumber: account?.accountNumber || 0
      };
    } catch (error) {
      console.error('Failed to get wallet info:', error);
      return null;
    }
  }

  // Send NRN tokens
  async sendNrn(
    toAddress: string, 
    amount: string, 
    memo?: string
  ): Promise<NrnTransaction | null> {
    if (!this.signingClient || !this.wallet) {
      throw new Error('Signing client not initialized');
    }

    try {
      const accounts = await this.wallet.getAccounts();
      const fromAddress = accounts[0].address;

      const result = await this.signingClient.sendTokens(
        fromAddress,
        toAddress,
        [{ denom: 'unrn', amount }],
        this.config.defaultGas,
        memo
      );

      return {
        txHash: result.transactionHash,
        from: fromAddress,
        to: toAddress,
        amount,
        fee: '0', // Would calculate from result
        timestamp: Date.now(),
        blockHeight: result.height,
        status: result.code === 0 ? 'success' : 'failed'
      };
    } catch (error) {
      console.error('Failed to send NRN:', error);
      return null;
    }
  }

  // Bill for skill execution
  async billSkillExecution(billing: SkillExecutionBilling): Promise<string | null> {
    if (!this.signingClient || !this.wallet) {
      console.warn('Billing disabled: no signing client');
      return null;
    }

    try {
      const accounts = await this.wallet.getAccounts();
      const fromAddress = accounts[0].address;

      // In a real implementation, this would call a custom KNIRVCHAIN module
      // For now, we'll simulate with a token transfer
      const amount = Math.ceil(billing.nrnCost * 1000000).toString(); // Convert to micro-NRN
      
      const result = await this.signingClient.sendTokens(
        fromAddress,
        billing.billingAccount,
        [{ denom: 'unrn', amount }],
        this.config.defaultGas,
        `Skill execution: ${billing.skillId} (${billing.executionId})`
      );

      console.log(`Billed ${billing.nrnCost} NRN for skill execution ${billing.executionId}`);
      return result.transactionHash;
    } catch (error) {
      console.error('Failed to bill skill execution:', error);
      return null;
    }
  }

  // Register agent on chain
  async registerAgent(registration: Omit<AgentRegistration, 'registrationTx' | 'status'>): Promise<string | null> {
    if (!this.signingClient || !this.wallet) {
      throw new Error('Signing client not initialized');
    }

    try {
      const accounts = await this.wallet.getAccounts();
      const fromAddress = accounts[0].address;

      // In a real implementation, this would call a custom KNIRVCHAIN module
      // For now, we'll simulate with a memo transaction
      const memo = JSON.stringify({
        type: 'agent_registration',
        agentId: registration.agentId,
        skillIds: registration.skillIds,
        metadata: registration.metadata
      });

      const result = await this.signingClient.sendTokens(
        fromAddress,
        fromAddress, // Self-send for registration
        [{ denom: 'unrn', amount: '1' }], // Minimal amount
        this.config.defaultGas,
        memo
      );

      console.log(`Agent ${registration.agentId} registered with tx: ${result.transactionHash}`);
      return result.transactionHash;
    } catch (error) {
      console.error('Failed to register agent:', error);
      return null;
    }
  }

  // Query agent registration
  async queryAgent(agentId: string): Promise<AgentRegistration | null> {
    if (!this.client) return null;

    try {
      // In a real implementation, this would query a custom KNIRVCHAIN module
      // For now, we'll return a mock response
      return {
        agentId,
        ownerAddress: 'knirv1...',
        skillIds: ['skill1', 'skill2'],
        metadata: { name: 'Test Agent', version: '1.0' },
        registrationTx: 'mock_tx_hash',
        status: 'active'
      };
    } catch (error) {
      console.error('Failed to query agent:', error);
      return null;
    }
  }

  // Get transaction history
  async getTransactionHistory(address: string, limit = 50): Promise<NrnTransaction[]> {
    if (!this.client) {
      // Return mock data when client not available
      return [
        {
          txHash: 'mock_tx_1',
          from: address,
          to: 'knirv1recipient',
          amount: '1000000',
          fee: '5000',
          timestamp: Date.now() - 3600000,
          blockHeight: 12345,
          status: 'success' as const
        }
      ].slice(0, limit);
    }

    try {
      // In a real implementation, this would query transaction history from RPC or indexer
      // For now, return the same mock dataset sliced by the requested limit
      const data: NrnTransaction[] = [
        {
          txHash: 'mock_tx_1',
          from: address,
          to: 'knirv1recipient',
          amount: '1000000',
          fee: '5000',
          timestamp: Date.now() - 3600000,
          blockHeight: 12345,
          status: 'success' as const
        }
      ];

      return data.slice(0, limit);
    } catch (error) {
      console.error('Failed to get transaction history:', error);
      return [];
    }
  }

  // Get chain status
  async getChainStatus(): Promise<{
    chainId: string;
    latestBlockHeight: number;
    latestBlockTime: string;
    connected: boolean;
  } | null> {
    if (!this.client) {
      // Return status indicating disconnected
      return {
        chainId: this.config.chainId,
        latestBlockHeight: 0,
        latestBlockTime: new Date().toISOString(),
        connected: false
      };
    }

    try {
      const height = await this.client.getHeight();

      return {
        chainId: this.config.chainId,
        latestBlockHeight: height,
        latestBlockTime: new Date().toISOString(),
        connected: this.isConnected
      };
    } catch (error) {
      console.error('Failed to get chain status:', error);
      return {
        chainId: this.config.chainId,
        latestBlockHeight: 0,
        latestBlockTime: new Date().toISOString(),
        connected: false
      };
    }
  }

  // Estimate gas for transaction
  async estimateGas(
    fromAddress: string,
    toAddress: string,
    amount: string,
    memo?: string
  ): Promise<number> {
    if (!this.signingClient) return this.config.defaultGas;

    try {
      // In a real implementation, simulate transaction via RPC to estimate gas
      // As a fallback, estimate based on memo length
      const baseGas = 21000;
      const memoGas = memo ? memo.length * 10 : 0;
      return baseGas + memoGas;
    } catch (error) {
      console.error('Failed to estimate gas:', error);
      return this.config.defaultGas;
    }
  }

  // Disconnect from chain
  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    
    this.signingClient = null;
    this.wallet = null;
    this.isConnected = false;
    
    console.log('Disconnected from KNIRVCHAIN');
  }

  // Check if connected
  isChainConnected(): boolean {
    return this.isConnected && this.client !== null;
  }

  // Get current configuration
  getConfig(): ChainConfig {
    return { ...this.config };
  }

  // Update configuration
  updateConfig(newConfig: Partial<ChainConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Default configuration for KNIRVCHAIN
const defaultChainConfig: ChainConfig = {
  rpcEndpoint: process.env.KNIRVCHAIN_API || 'http://localhost:26657', // Local testnet or env override
  chainId: process.env.KNIRV_CHAIN_ID || 'knirv-testnet-1',
  addressPrefix: process.env.KNIRV_ADDRESS_PREFIX || 'knirv',
  gasPrice: process.env.KNIRV_GAS_PRICE || '0.025unrn',
  defaultGas: process.env.KNIRV_DEFAULT_GAS ? parseInt(process.env.KNIRV_DEFAULT_GAS) : 200000
};

// Export singleton instance
export const knirvChainService = new KnirvChainService(defaultChainConfig);

// Factory helper to create chain service from testnet endpoints file via env
export function createKnirvChainServiceFromEnv(): KnirvChainService {
  const cfg: ChainConfig = {
    rpcEndpoint: process.env.KNIRVCHAIN_API || defaultChainConfig.rpcEndpoint,
    chainId: process.env.KNIRV_CHAIN_ID || defaultChainConfig.chainId,
    addressPrefix: process.env.KNIRV_ADDRESS_PREFIX || defaultChainConfig.addressPrefix,
    gasPrice: process.env.KNIRV_GAS_PRICE || defaultChainConfig.gasPrice,
    defaultGas: process.env.KNIRV_DEFAULT_GAS ? parseInt(process.env.KNIRV_DEFAULT_GAS) : defaultChainConfig.defaultGas
  };

  return new KnirvChainService(cfg);
}

// Export types and service
export { KnirvChainService };
export default knirvChainService;
