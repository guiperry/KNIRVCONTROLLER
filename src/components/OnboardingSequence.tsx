/**
 * Onboarding Sequence Component
 * Guides users through cortex.wasm compilation and external API configuration during beta
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Brain, 
  Zap, 
  CheckCircle, 
  ArrowRight, 
  Sparkles, 
  Settings,
  Play,
  Download,
  X
} from 'lucide-react';
import { ExternalAPIConfigManager } from './ExternalAPIConfigManager';
import { externalAPIService, InferenceProvider } from '../services/ExternalAPIService';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

interface OnboardingSequenceProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const OnboardingSequence: React.FC<OnboardingSequenceProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [showAPIConfig, setShowAPIConfig] = useState(false);
  const [configuredProvider, setConfiguredProvider] = useState<InferenceProvider | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationComplete, setCompilationComplete] = useState(false);

  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: 'welcome',
      title: 'Welcome to KNIRV',
      description: 'Get started with AI agent development',
      completed: false
    },
    {
      id: 'api-setup',
      title: 'Configure External AI',
      description: 'Set up external inference provider for beta',
      completed: false
    },
    {
      id: 'cortex-compilation',
      title: 'Compile Your First Cortex',
      description: 'Create your first cortex.wasm',
      completed: false
    },
    {
      id: 'complete',
      title: 'Ready to Build',
      description: 'Start creating intelligent agents',
      completed: false
    }
  ]);

  useEffect(() => {
    // Check if user already has API configured
    const activeProvider = externalAPIService.getActiveProvider();
    if (activeProvider) {
      setConfiguredProvider(activeProvider);
      updateStepCompletion('api-setup', true);
    }
  }, []);

  const updateStepCompletion = (stepId: string, completed: boolean) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, completed } : step
    ));
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleAPIConfigComplete = (provider: InferenceProvider) => {
    setConfiguredProvider(provider);
    updateStepCompletion('api-setup', true);
    setShowAPIConfig(false);
    nextStep();
  };

  const handleStartCompilation = async () => {
    setIsCompiling(true);
    
    // Simulate compilation process
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setIsCompiling(false);
    setCompilationComplete(true);
    updateStepCompletion('cortex-compilation', true);
    nextStep();
  };

  const handleCompleteOnboarding = () => {
    updateStepCompletion('complete', true);
    localStorage.setItem('knirv_onboarding_completed', 'true');
    onComplete();
    onClose();
  };

  const handleSkipOnboarding = () => {
    localStorage.setItem('knirv_onboarding_skipped', 'true');
    onClose();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Welcome
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto">
              <Brain className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome to KNIRV</h2>
              <p className="text-gray-300 max-w-md mx-auto">
                Build intelligent AI agents with cortex.wasm and external AI integration. 
                Let's get you set up in just a few steps.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                <Zap className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <h3 className="font-medium text-white mb-1">External AI</h3>
                <p className="text-sm text-gray-400">Connect to powerful AI models</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                <Brain className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <h3 className="font-medium text-white mb-1">Cortex.wasm</h3>
                <p className="text-sm text-gray-400">Compile intelligent agents</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                <Sparkles className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <h3 className="font-medium text-white mb-1">Deploy</h3>
                <p className="text-sm text-gray-400">Launch your AI agents</p>
              </div>
            </div>
            <button
              onClick={nextStep}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2 mx-auto"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        );

      case 1: // API Setup
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Configure External AI Provider</h2>
              <p className="text-gray-300 max-w-md mx-auto">
                During beta, cortex.wasm uses external AI providers for inference. 
                Choose your preferred provider to continue.
              </p>
            </div>

            {configuredProvider ? (
              <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg text-center">
                <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <h3 className="text-lg font-medium text-green-400 mb-1">
                  {externalAPIService.getProviderCapabilities()
                    .find(p => p.provider === configuredProvider)?.name} Configured
                </h3>
                <p className="text-sm text-gray-300 mb-4">
                  Your cortex.wasm will use this provider for inference
                </p>
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={() => setShowAPIConfig(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Change Provider
                  </button>
                  <button
                    onClick={nextStep}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <button
                  onClick={() => setShowAPIConfig(true)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Configure AI Provider
                </button>
              </div>
            )}
          </div>
        );

      case 2: // Cortex Compilation
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Compile Your First Cortex</h2>
              <p className="text-gray-300 max-w-md mx-auto">
                Create a sample cortex.wasm with your configured AI provider. 
                This will be your first intelligent agent core.
              </p>
            </div>

            {!isCompiling && !compilationComplete && (
              <div className="text-center">
                <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 mb-4">
                  <h3 className="font-medium text-white mb-2">Sample Cortex Configuration</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Provider:</span>
                      <span className="text-white ml-2">
                        {externalAPIService.getProviderCapabilities()
                          .find(p => p.provider === configuredProvider)?.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Platform:</span>
                      <span className="text-white ml-2">Hybrid WASM</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Memory:</span>
                      <span className="text-white ml-2">256MB</span>
                    </div>
                    <div>
                      <span className="text-gray-400">LoRA:</span>
                      <span className="text-white ml-2">Enabled</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleStartCompilation}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center space-x-2 mx-auto"
                >
                  <Play className="w-4 h-4" />
                  <span>Compile Sample Cortex</span>
                </button>
              </div>
            )}

            {isCompiling && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-300">Compiling cortex.wasm with external AI integration...</p>
              </div>
            )}

            {compilationComplete && (
              <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg text-center">
                <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <h3 className="text-lg font-medium text-green-400 mb-1">Compilation Complete!</h3>
                <p className="text-sm text-gray-300 mb-4">
                  Your sample cortex.wasm is ready. You can now create intelligent agents.
                </p>
                <button
                  onClick={nextStep}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        );

      case 3: // Complete
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">You're All Set!</h2>
              <p className="text-gray-300 max-w-md mx-auto">
                Your KNIRV environment is configured and ready. Start building intelligent agents 
                with your cortex.wasm and external AI integration.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
              <button
                onClick={() => navigate('/manager/model-creation')}
                className="p-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <Brain className="w-6 h-6 mx-auto mb-2" />
                <span className="font-medium">Create Models</span>
              </button>
              <button
                onClick={() => navigate('/manager/skills')}
                className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Sparkles className="w-6 h-6 mx-auto mb-2" />
                <span className="font-medium">Manage Agents</span>
              </button>
            </div>
            <button
              onClick={handleCompleteOnboarding}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              Complete Setup
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">KNIRV Setup</h1>
              <p className="text-sm text-gray-400">Step {currentStep + 1} of {steps.length}</p>
            </div>
          </div>
          <button
            onClick={handleSkipOnboarding}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 border-b border-gray-700">
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-700">
          <button
            onClick={handleSkipOnboarding}
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            Skip setup
          </button>
          <div className="flex space-x-1">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index <= currentStep ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              />
            ))}
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
