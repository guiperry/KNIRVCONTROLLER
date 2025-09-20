/**
 * External API Configuration Manager Component
 * Provides UI for managing external model API keys during onboarding and settings
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Eye, EyeOff, Copy, Check, X, Settings, Zap, Activity } from 'lucide-react';
import { 
  externalAPIService, 
  ExternalAPIConfig, 
  InferenceProvider, 
  ProviderCapabilities 
} from '../services/ExternalAPIService';

interface ExternalAPIConfigManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigurationComplete?: (provider: InferenceProvider) => void;
  showOnboardingMode?: boolean;
}

export const ExternalAPIConfigManager: React.FC<ExternalAPIConfigManagerProps> = ({
  isOpen,
  onClose,
  onConfigurationComplete,
  showOnboardingMode = false
}) => {
  const [configs, setConfigs] = useState<ExternalAPIConfig[]>([]);
  const [providers, setProviders] = useState<ProviderCapabilities[]>([]);
  const [activeProvider, setActiveProvider] = useState<InferenceProvider | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<InferenceProvider>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = () => {
    const allConfigs = externalAPIService.getAPIConfigs();
    const allProviders = externalAPIService.getProviderCapabilities();
    const currentActiveProvider = externalAPIService.getActiveProvider();

    setConfigs(allConfigs);
    setProviders(allProviders);
    setActiveProvider(currentActiveProvider);

    // Set default model for selected provider
    const providerCapabilities = allProviders.find(p => p.provider === selectedProvider);
    if (providerCapabilities && !selectedModel) {
      setSelectedModel(providerCapabilities.defaultModel);
      setCustomEndpoint(providerCapabilities.endpoint);
    }
  };

  const handleProviderChange = (provider: InferenceProvider) => {
    setSelectedProvider(provider);
    const capabilities = providers.find(p => p.provider === provider);
    if (capabilities) {
      setSelectedModel(capabilities.defaultModel);
      setCustomEndpoint(capabilities.endpoint);
    }
    setApiKey('');
    setValidationResult(null);
  };

  const handleAddConfig = async () => {
    if (!apiKey.trim()) {
      setValidationResult({ success: false, error: 'API key is required' });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const config = await externalAPIService.setAPIConfig(selectedProvider, apiKey, {
        endpoint: customEndpoint || undefined,
        model: selectedModel || undefined
      });

      // Set as active provider if it's the first one or in onboarding mode
      if (configs.length === 0 || showOnboardingMode) {
        externalAPIService.setActiveProvider(selectedProvider);
        setActiveProvider(selectedProvider);
      }

      setValidationResult({ success: true });
      setApiKey('');
      setShowAddForm(false);
      loadData();

      if (showOnboardingMode && onConfigurationComplete) {
        onConfigurationComplete(selectedProvider);
      }
    } catch (error) {
      setValidationResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Configuration failed' 
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveConfig = (configId: string) => {
    if (confirm('Are you sure you want to remove this API configuration?')) {
      externalAPIService.removeAPIConfig(configId);
      loadData();
    }
  };

  const handleSetActiveProvider = (provider: InferenceProvider) => {
    externalAPIService.setActiveProvider(provider);
    setActiveProvider(provider);
  };

  const toggleKeyVisibility = (configId: string) => {
    setShowKeys(prev => ({ ...prev, [configId]: !prev[configId] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getProviderIcon = (provider: InferenceProvider) => {
    switch (provider) {
      case 'gemini': return '🔮';
      case 'claude': return '🧠';
      case 'openai': return '🤖';
      case 'deepseek': return '🔍';
      default: return '⚡';
    }
  };

  const getProviderColor = (provider: InferenceProvider) => {
    switch (provider) {
      case 'gemini': return 'from-blue-500 to-purple-500';
      case 'claude': return 'from-orange-500 to-red-500';
      case 'openai': return 'from-green-500 to-teal-500';
      case 'deepseek': return 'from-purple-500 to-pink-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-4xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {showOnboardingMode ? 'Configure External AI Models' : 'External API Configuration'}
              </h2>
              <p className="text-sm text-gray-400">
                {showOnboardingMode 
                  ? 'Set up external AI providers for cortex.wasm inference during beta'
                  : 'Manage external model API keys for inference routing'
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          {showOnboardingMode && (
            <div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <h3 className="text-lg font-medium text-blue-400 mb-2">Beta Configuration</h3>
              <p className="text-sm text-gray-300">
                During beta, all cortex.wasm inference will be routed through your chosen external AI provider. 
                Configure at least one provider to continue with agent compilation.
              </p>
            </div>
          )}

          {/* Active Provider Display */}
          {activeProvider && (
            <div className="mb-6 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getProviderIcon(activeProvider)}</span>
                <div>
                  <h3 className="text-lg font-medium text-green-400">Active Provider</h3>
                  <p className="text-sm text-gray-300">
                    {providers.find(p => p.provider === activeProvider)?.name} is currently handling inference
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Add Configuration Button */}
          <div className="mb-6">
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add API Configuration</span>
            </button>
          </div>

          {/* Add Configuration Form */}
          {showAddForm && (
            <div className="mb-6 p-6 bg-gray-800 rounded-lg border border-gray-700">
              <h3 className="text-lg font-medium text-white mb-4">Add New API Configuration</h3>
              
              {/* Provider Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Provider *</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {providers.map(provider => (
                    <button
                      key={provider.provider}
                      onClick={() => handleProviderChange(provider.provider)}
                      className={`p-3 rounded-lg border transition-colors ${
                        selectedProvider === provider.provider
                          ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                          : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      <div className="text-2xl mb-1">{getProviderIcon(provider.provider)}</div>
                      <div className="text-sm font-medium">{provider.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">API Key *</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  placeholder={`Enter your ${providers.find(p => p.provider === selectedProvider)?.name} API key`}
                />
              </div>

              {/* Model Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  >
                    {providers.find(p => p.provider === selectedProvider)?.models.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Custom Endpoint (Optional)</label>
                  <input
                    type="text"
                    value={customEndpoint}
                    onChange={(e) => setCustomEndpoint(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    placeholder="Custom API endpoint"
                  />
                </div>
              </div>

              {/* Validation Result */}
              {validationResult && (
                <div className={`mb-4 p-3 rounded ${
                  validationResult.success 
                    ? 'bg-green-900/20 border border-green-500/30 text-green-400'
                    : 'bg-red-900/20 border border-red-500/30 text-red-400'
                }`}>
                  <div className="flex items-center space-x-2">
                    {validationResult.success ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    <span className="text-sm">
                      {validationResult.success ? 'API key validated successfully!' : validationResult.error}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={handleAddConfig}
                  disabled={isValidating || !apiKey.trim()}
                  className={`px-4 py-2 rounded transition-colors ${
                    isValidating || !apiKey.trim()
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {isValidating ? 'Validating...' : 'Add Configuration'}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setApiKey('');
                    setValidationResult(null);
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Existing Configurations */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">Configured Providers</h3>
            {configs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No API configurations yet</p>
                <p className="text-sm">Add your first provider to get started</p>
              </div>
            ) : (
              configs.map(config => (
                <div key={config.id} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 bg-gradient-to-r ${getProviderColor(config.provider)} rounded-lg flex items-center justify-center`}>
                        <span className="text-xl">{getProviderIcon(config.provider)}</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-white">
                          {providers.find(p => p.provider === config.provider)?.name}
                        </h4>
                        <p className="text-sm text-gray-400">Model: {config.model}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {activeProvider === config.provider && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                          Active
                        </span>
                      )}
                      {activeProvider !== config.provider && (
                        <button
                          onClick={() => handleSetActiveProvider(config.provider)}
                          className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded hover:bg-blue-500/30 transition-colors"
                        >
                          Set Active
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveConfig(config.id)}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* API Key Display */}
                  <div className="mb-3 p-3 bg-gray-700 rounded border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">API Key</span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleKeyVisibility(config.id)}
                          className="p-1 text-gray-400 hover:text-white transition-colors"
                        >
                          {showKeys[config.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(config.apiKey)}
                          className="p-1 text-gray-400 hover:text-white transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <code className="text-sm font-mono text-green-400">
                      {showKeys[config.id] ? config.apiKey : '••••••••••••••••••••••••••••••••'}
                    </code>
                  </div>

                  {/* Usage Stats */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="flex items-center space-x-1 text-gray-400 mb-1">
                        <Activity className="w-3 h-3" />
                        <span>Usage</span>
                      </div>
                      <p className="text-white">{config.usageCount} requests</p>
                    </div>
                    <div>
                      <div className="flex items-center space-x-1 text-gray-400 mb-1">
                        <Settings className="w-3 h-3" />
                        <span>Status</span>
                      </div>
                      <p className={config.isActive ? 'text-green-400' : 'text-red-400'}>
                        {config.isActive ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center space-x-1 text-gray-400 mb-1">
                        <span>Last Used</span>
                      </div>
                      <p className="text-white">
                        {config.lastUsed ? new Date(config.lastUsed).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Onboarding Continue Button */}
          {showOnboardingMode && activeProvider && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => onConfigurationComplete?.(activeProvider)}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
              >
                Continue with {providers.find(p => p.provider === activeProvider)?.name}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
