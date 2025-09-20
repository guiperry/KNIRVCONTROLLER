import * as React from 'react';
import { useState, useEffect } from 'react';
import { Cpu, Zap, AlertTriangle, FileText, Lightbulb, Plus, X, Camera } from 'lucide-react';
import { SubmissionModal, SubmissionData, ErrorSubmissionData, ContextSubmissionData, IdeaSubmissionData } from './SubmissionModal';
import { personalKNIRVGRAPHService } from '../services/PersonalKNIRVGRAPHService';
import { ErrorNodeClustering } from '../core/knirvgraph/ErrorNodeClustering';

interface KnirvShellProps {
  status: 'idle' | 'processing' | 'listening' | 'error';
  nrnBalance: number;
  onScreenshotCapture: () => void;
  cognitiveMode: boolean;
  onSubmitError?: (data: ErrorSubmissionData) => Promise<void>;
  onSubmitContext?: (data: ContextSubmissionData) => Promise<void>;
  onSubmitIdea?: (data: IdeaSubmissionData) => Promise<void>;
}

interface AnimationState {
  isAnimating: boolean;
  type: 'error' | 'context' | 'idea' | null;
  stage: 'submitting' | 'clustering' | 'minting' | 'complete';
  progress: number;
}

export const KnirvShell: React.FC<KnirvShellProps> = ({
  status,
  nrnBalance,
  onScreenshotCapture,
  cognitiveMode,
  onSubmitError,
  onSubmitContext,
  onSubmitIdea
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isExpanded, setIsExpanded] = useState(false);
  const [modalType, setModalType] = useState<'error' | 'context' | 'idea' | null>(null);
  const [animationState, setAnimationState] = useState<AnimationState>({
    isAnimating: false,
    type: null,
    stage: 'submitting',
    progress: 0
  });
  const [errorClustering] = useState(() => new ErrorNodeClustering());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Initialize error clustering
  useEffect(() => {
    const initClustering = async () => {
      try {
        await errorClustering.initialize();
      } catch (error) {
        console.error('Failed to initialize error clustering:', error);
      }
    };
    initClustering();
  }, [errorClustering]);

  // Enhanced submission handlers with animations
  const handleSubmitError = async (data: ErrorSubmissionData) => {
    setAnimationState({
      isAnimating: true,
      type: 'error',
      stage: 'submitting',
      progress: 0
    });

    try {
      // Stage 1: Submit error
      setAnimationState(prev => ({ ...prev, stage: 'submitting', progress: 25 }));

      // Add error node to personal graph
      const errorNode = await personalKNIRVGRAPHService.addErrorNode({
        errorId: `error_${Date.now()}`,
        errorType: data.errorType,
        description: data.description,
        context: {
          title: data.title,
          severity: data.severity,
          stackTrace: data.stackTrace,
          logs: data.logs,
          steps: data.steps,
          environment: data.environment
        },
        timestamp: Date.now()
      });

      // Stage 2: Clustering
      setAnimationState(prev => ({ ...prev, stage: 'clustering', progress: 50 }));

      // Add to error clustering system
      await errorClustering.addErrorNode({
        id: errorNode.id,
        errorType: data.errorType,
        errorMessage: data.description,
        stackTrace: data.stackTrace || '',
        context: {
          title: data.title,
          severity: data.severity,
          environment: data.environment
        },
        severity: data.severity,
        timestamp: new Date(),
        bountyAmount: 0,
        tags: [data.errorType],
        metadata: {
          originalSubmission: data
        }
      });

      // Stage 3: Complete
      setAnimationState(prev => ({ ...prev, stage: 'complete', progress: 100 }));

      // Call original handler if provided
      if (onSubmitError) {
        await onSubmitError(data);
      }

      // Reset animation after delay
      setTimeout(() => {
        setAnimationState({
          isAnimating: false,
          type: null,
          stage: 'submitting',
          progress: 0
        });
      }, 2000);

    } catch (error) {
      console.error('Error submission failed:', error);
      setAnimationState({
        isAnimating: false,
        type: null,
        stage: 'submitting',
        progress: 0
      });
      throw error;
    }
  };

  const handleSubmitIdea = async (data: IdeaSubmissionData) => {
    setAnimationState({
      isAnimating: true,
      type: 'idea',
      stage: 'submitting',
      progress: 0
    });

    try {
      // Stage 1: Submit idea
      setAnimationState(prev => ({ ...prev, stage: 'submitting', progress: 25 }));

  // Add idea node to personal graph
      await personalKNIRVGRAPHService.addIdeaNode({
        ideaId: `idea_${Date.now()}`,
        ideaName: data.title,
        description: data.description,
        timestamp: Date.now()
      });

      // Stage 2: Clustering (simulate idea clustering)
      setAnimationState(prev => ({ ...prev, stage: 'clustering', progress: 50 }));

      // Simulate clustering delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Stage 3: Complete
      setAnimationState(prev => ({ ...prev, stage: 'complete', progress: 100 }));

      // Call original handler if provided
      if (onSubmitIdea) {
        await onSubmitIdea(data);
      }

      // Reset animation after delay
      setTimeout(() => {
        setAnimationState({
          isAnimating: false,
          type: null,
          stage: 'submitting',
          progress: 0
        });
      }, 2000);

    } catch (error) {
      console.error('Idea submission failed:', error);
      setAnimationState({
        isAnimating: false,
        type: null,
        stage: 'submitting',
        progress: 0
      });
      throw error;
    }
  };

  const handleSubmitContext = async (data: ContextSubmissionData) => {
    setAnimationState({
      isAnimating: true,
      type: 'context',
      stage: 'submitting',
      progress: 0
    });

    try {
      // Stage 1: Submit context
      setAnimationState(prev => ({ ...prev, stage: 'submitting', progress: 25 }));

      // Add context node to personal graph
      const contextNode = await personalKNIRVGRAPHService.addContextNode({
        contextId: `context_${Date.now()}`,
        contextName: data.title,
        description: data.description,
        mcpServerInfo: {
          serverUrl: data.serverUrl || '',
          mcpServerType: data.mcpServerType,
          configuration: data.configuration,
          capabilities: data.capabilities
        },
        category: data.category,
        timestamp: Date.now()
      });

      // Stage 2: Capability Minting
      setAnimationState(prev => ({ ...prev, stage: 'minting', progress: 50 }));

      // Create capability from context submission
      const capability = {
        ID: `cap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        Name: data.title,
        Description: data.description,
        CapabilityType: data.capabilityType || data.mcpServerType,
        MCPServerURL: data.serverUrl || '',
        Schema: data.schema || '{}',
        LocationHints: data.locationHints || [],
        Metadata: {
          gas_fee_nrn: data.gasFeeNRN || 0.1,
          original_id: contextNode.id,
          category: data.category,
          mcpServerType: data.mcpServerType
        },
        CreatedAt: new Date(),
        Status: 'active'
      };

      // Add capability to personal graph
      await personalKNIRVGRAPHService.addCapabilityNode({
        capabilityId: capability.ID,
        name: capability.Name,
        description: capability.Description,
        capabilityType: capability.CapabilityType,
        mcpServerUrl: capability.MCPServerURL,
        schema: capability.Schema,
        locationHints: capability.LocationHints,
        gasFeeNRN: capability.Metadata.gas_fee_nrn,
        status: capability.Status
      });

      // Stage 3: Complete
      setAnimationState(prev => ({ ...prev, stage: 'complete', progress: 100 }));

      // Call original handler if provided
      if (onSubmitContext) {
        await onSubmitContext(data);
      }

      // Reset animation after delay
      setTimeout(() => {
        setAnimationState({
          isAnimating: false,
          type: null,
          stage: 'submitting',
          progress: 0
        });
      }, 2000);

    } catch (error) {
      console.error('Context submission failed:', error);
      setAnimationState({
        isAnimating: false,
        type: null,
        stage: 'submitting',
        progress: 0
      });
      throw error;
    }
  };

  const handleModalSubmit = async (data: SubmissionData) => {
    try {
      if (modalType === 'error') {
        await handleSubmitError(data as ErrorSubmissionData);
      } else if (modalType === 'context') {
        await handleSubmitContext(data as ContextSubmissionData);
      } else if (modalType === 'idea') {
        await handleSubmitIdea(data as IdeaSubmissionData);
      }
      setModalType(null);
    } catch (error) {
      console.error('Failed to submit:', error);
      throw error; // Re-throw to let modal handle the error
    }
  };

  return (
    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" data-testid="knirv-shell">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-30 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700/50">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg flex items-center justify-center">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">KNIRV Cortex</h1>
              <p className="text-xs text-gray-400">Train Your Own SLM Agent</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium text-white">{nrnBalance.toLocaleString()} NRN</p>
              <p className="text-xs text-gray-400">Balance</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-white">{currentTime.toLocaleTimeString()}</p>
              <p className="text-xs text-gray-400">{currentTime.toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="absolute inset-0 pt-20 pb-16 px-8">
        <div className="relative w-full h-full bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700/50 overflow-hidden">
          {/* Central Interface */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-6">
              {/* Main Action Button - Expandable */}
              <div className="relative">
                {!isExpanded ? (
                  /* Main Button */
                  <button
                    onClick={() => setIsExpanded(true)}
                    className="relative w-32 h-32 mx-auto group cursor-pointer transition-transform hover:scale-105"
                  >
                    <div className={`absolute inset-0 rounded-full transition-all duration-1000 ${
                      status === 'idle' ? 'bg-green-500/20 border-2 border-green-500/50 group-hover:bg-green-500/30' :
                      status === 'processing' ? 'bg-blue-500/20 border-2 border-blue-500/50 animate-pulse' :
                      status === 'listening' ? 'bg-teal-500/20 border-2 border-teal-500/50 animate-pulse' :
                      'bg-red-500/20 border-2 border-red-500/50'
                    }`}>
                      <div className="absolute inset-4 rounded-full bg-gradient-to-r from-blue-500 to-teal-500 flex items-center justify-center group-hover:from-blue-400 group-hover:to-teal-400 transition-all">
                        <Plus className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    {status === 'processing' && (
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin"></div>
                    )}
                  </button>
                ) : (
                  /* Expanded 3-Button Interface */
                  <div className="relative mb-16">
                    {/* Close Button */}
                    <button
                      onClick={() => setIsExpanded(false)}
                      className="absolute -top-4 -right-4 w-8 h-8 bg-gray-700/80 hover:bg-gray-600/80 rounded-full flex items-center justify-center transition-colors z-10"
                    >
                      <X className="w-4 h-4 text-gray-300" />
                    </button>

                    {/* Three Action Buttons */}
                    <div className="flex items-center justify-center space-x-6">
                      {/* Submit Error */}
                      <button
                        onClick={() => {
                          setModalType('error');
                          setIsExpanded(false);
                        }}
                        className="group relative w-24 h-24 cursor-pointer transition-transform hover:scale-105"
                      >
                        <div className="absolute inset-0 rounded-full bg-red-500/20 border-2 border-red-500/50 group-hover:bg-red-500/30 transition-all">
                          <div className="absolute inset-3 rounded-full bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center group-hover:from-red-400 group-hover:to-red-500 transition-all">
                            <AlertTriangle className="w-6 h-6 text-white" />
                          </div>
                        </div>
                        <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 text-xs text-red-400 font-medium whitespace-nowrap text-center">
                          <div>Submit Error</div>
                          <div className="text-gray-500 text-[10px]">→ Train Skill</div>
                        </div>
                      </button>

                      {/* Submit Context */}
                      <button
                        onClick={() => {
                          setModalType('context');
                          setIsExpanded(false);
                        }}
                        className="group relative w-24 h-24 cursor-pointer transition-transform hover:scale-105"
                      >
                        <div className="absolute inset-0 rounded-full bg-blue-500/20 border-2 border-blue-500/50 group-hover:bg-blue-500/30 transition-all">
                          <div className="absolute inset-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center group-hover:from-blue-400 group-hover:to-blue-500 transition-all">
                            <FileText className="w-6 h-6 text-white" />
                          </div>
                        </div>
                        <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 text-xs text-blue-400 font-medium whitespace-nowrap text-center">
                          <div>Submit Context</div>
                          <div className="text-gray-500 text-[10px]">→ Train Capability</div>
                        </div>
                      </button>

                      {/* Submit Idea */}
                      <button
                        onClick={() => {
                          setModalType('idea');
                          setIsExpanded(false);
                        }}
                        className="group relative w-24 h-24 cursor-pointer transition-transform hover:scale-105"
                      >
                        <div className="absolute inset-0 rounded-full bg-yellow-500/20 border-2 border-yellow-500/50 group-hover:bg-yellow-500/30 transition-all">
                          <div className="absolute inset-3 rounded-full bg-gradient-to-r from-yellow-500 to-yellow-600 flex items-center justify-center group-hover:from-yellow-400 group-hover:to-yellow-500 transition-all">
                            <Lightbulb className="w-6 h-6 text-white" />
                          </div>
                        </div>
                        <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 text-xs text-yellow-400 font-medium whitespace-nowrap text-center">
                          <div>Submit Idea</div>
                          <div className="text-gray-500 text-[10px]">→ Train Property</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Message */}
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">
                  {!isExpanded && status === 'idle' && 'Ready for Data Capture'}
                  {!isExpanded && status === 'processing' && 'Processing Request'}
                  {!isExpanded && status === 'listening' && 'Listening...'}
                  {!isExpanded && status === 'error' && 'Error Detected'}
                  {isExpanded && 'Choose Data Type'}
                </h2>
                <p className="text-gray-400 max-w-md mx-auto">
                  {!isExpanded && status === 'idle' && 'Train your own KNIRVCORTEX by capturing errors, context, or ideas. Each submission helps build your personalized SLM agent.'}
                  {!isExpanded && status === 'processing' && 'Training your KNIRVCORTEX: The Fabric algorithm is analyzing your input and generating specialized neural pathways.'}
                  {!isExpanded && status === 'listening' && 'Speak clearly to train your KNIRVCORTEX with voice commands and natural language patterns.'}
                  {!isExpanded && status === 'error' && 'Error detected - this will help train your KNIRVCORTEX to handle similar issues in the future.'}
                  {isExpanded && 'Train your KNIRVCORTEX: Errors become Skills, Context becomes Capabilities, Ideas become Properties.'}
                </p>
              </div>


            </div>
          </div>

          {/* Floating Action Icons */}
          <div className="absolute top-6 left-6 flex flex-col space-y-4">
            {/* Cognitive Mode Indicator */}
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center backdrop-blur-sm transition-all duration-300 ${
              cognitiveMode
                ? 'bg-yellow-500/30 border border-yellow-500/50'
                : 'bg-gray-700/50'
            }`}>
              <Zap className={`w-6 h-6 transition-all duration-300 ${
                cognitiveMode ? 'text-yellow-300' : 'text-yellow-400'
              }`} fill={cognitiveMode ? 'currentColor' : 'none'} />
            </div>

            {/* Screenshot Capture Button */}
            <button
              onClick={onScreenshotCapture}
              className="w-12 h-12 rounded-lg flex items-center justify-center backdrop-blur-sm bg-gray-700/50 hover:bg-gray-600/50 transition-all duration-300 border border-gray-600/50 hover:border-gray-500/50"
              title="Capture Screenshot"
            >
              <Camera className="w-6 h-6 text-gray-300 hover:text-white transition-colors" />
            </button>
          </div>
        </div>
      </div>

      {/* Animation Overlay */}
      {animationState.isAnimating && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 max-w-md w-full mx-4">
            <div className="text-center space-y-6">
              {/* Animation Icon */}
              <div className="relative w-24 h-24 mx-auto">
                <div className={`absolute inset-0 rounded-full border-4 ${
                  animationState.type === 'error' ? 'border-red-500/30' :
                  animationState.type === 'context' ? 'border-blue-500/30' :
                  'border-yellow-500/30'
                }`}>
                  <div className={`absolute inset-0 rounded-full border-4 border-transparent ${
                    animationState.type === 'error' ? 'border-t-red-500' :
                    animationState.type === 'context' ? 'border-t-blue-500' :
                    'border-t-yellow-500'
                  } animate-spin`}></div>
                </div>
                <div className={`absolute inset-4 rounded-full flex items-center justify-center ${
                  animationState.type === 'error' ? 'bg-red-500/20' :
                  animationState.type === 'context' ? 'bg-blue-500/20' :
                  'bg-yellow-500/20'
                }`}>
                  {animationState.type === 'error' && <AlertTriangle className="w-8 h-8 text-red-400" />}
                  {animationState.type === 'context' && <FileText className="w-8 h-8 text-blue-400" />}
                  {animationState.type === 'idea' && <Lightbulb className="w-8 h-8 text-yellow-400" />}
                </div>
              </div>

              {/* Progress Text */}
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">
                  {animationState.stage === 'submitting' && 'Submitting to KNIRVGRAPH...'}
                  {animationState.stage === 'clustering' && animationState.type === 'error' && 'Adding to Error Cluster...'}
                  {animationState.stage === 'clustering' && animationState.type === 'idea' && 'Adding to Idea Cluster...'}
                  {animationState.stage === 'minting' && 'Minting Capability...'}
                  {animationState.stage === 'complete' && 'Complete!'}
                </h3>
                <p className="text-gray-400">
                  {animationState.stage === 'submitting' && 'Processing your submission...'}
                  {animationState.stage === 'clustering' && animationState.type === 'error' && 'Analyzing semantic similarity with existing errors...'}
                  {animationState.stage === 'clustering' && animationState.type === 'idea' && 'Analyzing semantic similarity with existing ideas...'}
                  {animationState.stage === 'minting' && 'Creating new capability from context schema...'}
                  {animationState.stage === 'complete' && 'Successfully added to your personal KNIRVGRAPH!'}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    animationState.type === 'error' ? 'bg-red-500' :
                    animationState.type === 'context' ? 'bg-blue-500' :
                    'bg-yellow-500'
                  }`}
                  style={{ width: `${animationState.progress}%` }}
                ></div>
              </div>

              {/* Stage Indicators */}
              <div className="flex justify-center space-x-4">
                <div className={`w-3 h-3 rounded-full ${
                  animationState.progress >= 25 ?
                    (animationState.type === 'error' ? 'bg-red-500' :
                     animationState.type === 'context' ? 'bg-blue-500' :
                     'bg-yellow-500') : 'bg-gray-600'
                }`}></div>
                <div className={`w-3 h-3 rounded-full ${
                  animationState.progress >= 50 ?
                    (animationState.type === 'error' ? 'bg-red-500' :
                     animationState.type === 'context' ? 'bg-blue-500' :
                     'bg-yellow-500') : 'bg-gray-600'
                }`}></div>
                <div className={`w-3 h-3 rounded-full ${
                  animationState.progress >= 100 ?
                    (animationState.type === 'error' ? 'bg-red-500' :
                     animationState.type === 'context' ? 'bg-blue-500' :
                     'bg-yellow-500') : 'bg-gray-600'
                }`}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submission Modal */}
      {modalType && (
        <SubmissionModal
          isOpen={true}
          type={modalType}
          onClose={() => setModalType(null)}
          onSubmit={handleModalSubmit}
        />
      )}
    </div>
  );
};
