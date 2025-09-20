/**
 * Model Creation and Training Page
 * Handles cortex.wasm compilation with external API configuration
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Brain, 
  Cpu, 
  Settings, 
  Play, 
  Download, 
  Upload, 
  CheckCircle, 
  AlertCircle,
  ArrowLeft,
  Zap,
  Code,
  Layers
} from 'lucide-react';
import { ExternalAPIConfigManager } from '../components/ExternalAPIConfigManager';
import { externalAPIService, InferenceProvider } from '../services/ExternalAPIService';

interface ModelCreationStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  active: boolean;
}

interface CortexCompilationConfig {
  modelName: string;
  description: string;
  targetPlatform: 'typescript' | 'wasm' | 'hybrid';
  optimizationLevel: 'none' | 'basic' | 'aggressive';
  enableLoRA: boolean;
  maxMemoryMB: number;
  inferenceProvider: InferenceProvider | null;
  customPrompts: {
    systemPrompt: string;
    taskPrompts: string[];
  };
}

export const ModelCreation: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [showAPIConfig, setShowAPIConfig] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationProgress, setCompilationProgress] = useState(0);
  const [compilationLogs, setCompilationLogs] = useState<string[]>([]);
  const [compiledWasm, setCompiledWasm] = useState<Uint8Array | null>(null);

  const [config, setConfig] = useState<CortexCompilationConfig>({
    modelName: '',
    description: '',
    targetPlatform: 'hybrid',
    optimizationLevel: 'basic',
    enableLoRA: true,
    maxMemoryMB: 512,
    inferenceProvider: null,
    customPrompts: {
      systemPrompt: 'You are a helpful AI assistant integrated into the KNIRV cognitive shell.',
      taskPrompts: []
    }
  });

  const [steps, setSteps] = useState<ModelCreationStep[]>([
    {
      id: 'basic-config',
      title: 'Basic Configuration',
      description: 'Set up model name and basic parameters',
      completed: false,
      active: true
    },
    {
      id: 'api-config',
      title: 'External API Setup',
      description: 'Configure external inference provider',
      completed: false,
      active: false
    },
    {
      id: 'advanced-config',
      title: 'Advanced Settings',
      description: 'Configure LoRA, memory, and optimization',
      completed: false,
      active: false
    },
    {
      id: 'compilation',
      title: 'Cortex Compilation',
      description: 'Compile cortex.wasm with cognitive shell',
      completed: false,
      active: false
    },
    {
      id: 'testing',
      title: 'Testing & Validation',
      description: 'Test the compiled cortex.wasm',
      completed: false,
      active: false
    }
  ]);

  useEffect(() => {
    // Check if external API is already configured
    const activeProvider = externalAPIService.getActiveProvider();
    if (activeProvider) {
      setConfig(prev => ({ ...prev, inferenceProvider: activeProvider }));
      updateStepCompletion('api-config', true);
    }
  }, []);

  const updateStepCompletion = (stepId: string, completed: boolean) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, completed } : step
    ));
  };

  const goToStep = (stepIndex: number) => {
    setSteps(prev => prev.map((step, index) => ({
      ...step,
      active: index === stepIndex
    })));
    setCurrentStep(stepIndex);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      goToStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  };

  const handleBasicConfigComplete = () => {
    if (config.modelName && config.description) {
      updateStepCompletion('basic-config', true);
      nextStep();
    }
  };

  const handleAPIConfigComplete = (provider: InferenceProvider) => {
    setConfig(prev => ({ ...prev, inferenceProvider: provider }));
    updateStepCompletion('api-config', true);
    setShowAPIConfig(false);
    nextStep();
  };

  const handleAdvancedConfigComplete = () => {
    updateStepCompletion('advanced-config', true);
    nextStep();
  };

  const addLog = (message: string) => {
    setCompilationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const simulateCompilation = async () => {
    setIsCompiling(true);
    setCompilationProgress(0);
    setCompilationLogs([]);

    const steps = [
      { progress: 10, message: 'Initializing cortex compilation environment...' },
      { progress: 20, message: 'Loading external API configuration...' },
      { progress: 30, message: 'Generating cognitive shell wrapper...' },
      { progress: 45, message: 'Compiling TypeScript to WASM...' },
      { progress: 60, message: 'Integrating LoRA adapters...' },
      { progress: 75, message: 'Optimizing WASM module...' },
      { progress: 85, message: 'Linking external inference routing...' },
      { progress: 95, message: 'Finalizing cortex.wasm...' },
      { progress: 100, message: 'Compilation complete!' }
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setCompilationProgress(step.progress);
      addLog(step.message);
    }

    // Simulate compiled WASM
    const mockWasm = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    setCompiledWasm(mockWasm);
    updateStepCompletion('compilation', true);
    setIsCompiling(false);
    nextStep();
  };

  const downloadCompiledWasm = () => {
    if (compiledWasm) {
      const blob = new Blob([compiledWasm], { type: 'application/wasm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.modelName.toLowerCase().replace(/\s+/g, '-')}-cortex.wasm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Basic Configuration
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Model Name *</label>
              <input
                type="text"
                value={config.modelName}
                onChange={(e) => setConfig(prev => ({ ...prev, modelName: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                placeholder="My Custom Cortex Model"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
              <textarea
                value={config.description}
                onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white h-24"
                placeholder="Describe your model's purpose and capabilities..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Target Platform</label>
              <select
                value={config.targetPlatform}
                onChange={(e) => setConfig(prev => ({ ...prev, targetPlatform: e.target.value as any }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              >
                <option value="typescript">TypeScript (Browser)</option>
                <option value="wasm">Pure WASM</option>
                <option value="hybrid">Hybrid (Recommended)</option>
              </select>
            </div>
            <button
              onClick={handleBasicConfigComplete}
              disabled={!config.modelName || !config.description}
              className={`w-full py-2 px-4 rounded transition-colors ${
                config.modelName && config.description
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              Continue to API Configuration
            </button>
          </div>
        );

      case 1: // API Configuration
        return (
          <div className="space-y-6">
            <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <h3 className="text-lg font-medium text-blue-400 mb-2">External Inference Provider</h3>
              <p className="text-sm text-gray-300 mb-4">
                During beta, all cortex.wasm inference will be routed through external AI providers. 
                This ensures reliable performance while the local inference engine is being optimized.
              </p>
            </div>

            {config.inferenceProvider ? (
              <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-medium text-green-400">
                      {externalAPIService.getProviderCapabilities()
                        .find(p => p.provider === config.inferenceProvider)?.name} Configured
                    </h4>
                    <p className="text-sm text-gray-300">
                      Your cortex.wasm will use this provider for inference
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAPIConfig(true)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                  >
                    Change Provider
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Zap className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-white mb-2">No Provider Configured</h3>
                <p className="text-gray-400 mb-4">Configure an external AI provider to continue</p>
                <button
                  onClick={() => setShowAPIConfig(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                >
                  Configure Provider
                </button>
              </div>
            )}

            {config.inferenceProvider && (
              <button
                onClick={nextStep}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Continue to Advanced Settings
              </button>
            )}
          </div>
        );

      case 2: // Advanced Configuration
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Optimization Level</label>
                <select
                  value={config.optimizationLevel}
                  onChange={(e) => setConfig(prev => ({ ...prev, optimizationLevel: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                >
                  <option value="none">None (Fastest compilation)</option>
                  <option value="basic">Basic (Recommended)</option>
                  <option value="aggressive">Aggressive (Smallest size)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Max Memory (MB)</label>
                <input
                  type="number"
                  value={config.maxMemoryMB}
                  onChange={(e) => setConfig(prev => ({ ...prev, maxMemoryMB: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  min="64"
                  max="2048"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={config.enableLoRA}
                  onChange={(e) => setConfig(prev => ({ ...prev, enableLoRA: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-gray-300">Enable LoRA Adapters</span>
              </label>
              <p className="text-xs text-gray-400 mt-1">
                Allows runtime adaptation and skill learning
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">System Prompt</label>
              <textarea
                value={config.customPrompts.systemPrompt}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  customPrompts: { ...prev.customPrompts, systemPrompt: e.target.value }
                }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white h-24"
                placeholder="Define the AI's personality and behavior..."
              />
            </div>

            <button
              onClick={handleAdvancedConfigComplete}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Continue to Compilation
            </button>
          </div>
        );

      case 3: // Compilation
        return (
          <div className="space-y-6">
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <h3 className="text-lg font-medium text-white mb-4">Compilation Configuration</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Model Name:</span>
                  <span className="text-white ml-2">{config.modelName}</span>
                </div>
                <div>
                  <span className="text-gray-400">Platform:</span>
                  <span className="text-white ml-2">{config.targetPlatform}</span>
                </div>
                <div>
                  <span className="text-gray-400">Provider:</span>
                  <span className="text-white ml-2">
                    {externalAPIService.getProviderCapabilities()
                      .find(p => p.provider === config.inferenceProvider)?.name}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Memory:</span>
                  <span className="text-white ml-2">{config.maxMemoryMB}MB</span>
                </div>
              </div>
            </div>

            {!isCompiling && !compiledWasm && (
              <button
                onClick={simulateCompilation}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex items-center justify-center space-x-2"
              >
                <Play className="w-5 h-5" />
                <span>Start Compilation</span>
              </button>
            )}

            {isCompiling && (
              <div className="space-y-4">
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${compilationProgress}%` }}
                  />
                </div>
                <div className="text-center text-sm text-gray-400">
                  {compilationProgress}% Complete
                </div>
              </div>
            )}

            {compilationLogs.length > 0 && (
              <div className="bg-black rounded-lg p-4 h-48 overflow-y-auto">
                <div className="font-mono text-sm space-y-1">
                  {compilationLogs.map((log, index) => (
                    <div key={index} className="text-green-400">{log}</div>
                  ))}
                </div>
              </div>
            )}

            {compiledWasm && (
              <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-medium text-green-400">Compilation Successful!</h4>
                    <p className="text-sm text-gray-300">Your cortex.wasm is ready for deployment</p>
                  </div>
                  <button
                    onClick={downloadCompiledWasm}
                    className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            )}

            {compiledWasm && (
              <button
                onClick={nextStep}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Continue to Testing
              </button>
            )}
          </div>
        );

      case 4: // Testing
        return (
          <div className="space-y-6">
            <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
              <h3 className="text-lg font-medium text-green-400 mb-2">Model Ready!</h3>
              <p className="text-sm text-gray-300">
                Your cortex.wasm has been compiled successfully and is ready for use in agents.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={downloadCompiledWasm}
                className="flex items-center justify-center space-x-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                <Download className="w-5 h-5" />
                <span>Download cortex.wasm</span>
              </button>
              <button
                onClick={() => navigate('/manager/skills')}
                className="flex items-center justify-center space-x-2 py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Go to Agent Manager</span>
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/manager/skills')}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Model Creation & Training</h1>
                <p className="text-sm text-gray-400">Create custom cortex.wasm with external AI integration</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center space-x-2 ${
                  step.active ? 'text-blue-400' : step.completed ? 'text-green-400' : 'text-gray-400'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    step.active ? 'border-blue-400 bg-blue-400/20' : 
                    step.completed ? 'border-green-400 bg-green-400/20' : 'border-gray-600'
                  }`}>
                    {step.completed ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </div>
                  <div className="hidden md:block">
                    <div className="text-sm font-medium">{step.title}</div>
                    <div className="text-xs">{step.description}</div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-4 ${
                    steps[index + 1].completed || steps[index + 1].active ? 'bg-blue-400' : 'bg-gray-600'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h2 className="text-xl font-bold text-white mb-6">{steps[currentStep]?.title}</h2>
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className={`px-4 py-2 rounded transition-colors ${
              currentStep === 0
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-600 hover:bg-gray-700 text-white'
            }`}
          >
            Previous
          </button>
          <div className="text-sm text-gray-400">
            Step {currentStep + 1} of {steps.length}
          </div>
        </div>
      </div>

      {/* External API Config Modal */}
      <ExternalAPIConfigManager
        isOpen={showAPIConfig}
        onClose={() => setShowAPIConfig(false)}
        onConfigurationComplete={handleAPIConfigComplete}
        showOnboardingMode={true}
      />
    </div>
  );
};
