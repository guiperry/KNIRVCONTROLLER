import * as React from 'react';
import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { QrCode, X } from 'lucide-react';
import { initSentry } from './utils/sentry';

// Receiver components
import { KnirvShell } from './components/KnirvShell';
import { VoiceControl } from './components/VoiceControl';
import { NetworkStatus } from './components/NetworkStatus';
import { NRVVisualization } from './components/NRVVisualization';
import { SlidingPanel } from './components/SlidingPanel';
import { EdgeColoring } from './components/EdgeColoring';
import { AgentManager } from './components/AgentManager';
import { FabricAlgorithm } from './components/FabricAlgorithm';
import { CognitiveShellInterface } from './components/CognitiveShellInterface';
import { CortexBuilder } from './components/CortexBuilder';
import { ApiKeyManager } from './components/ApiKeyManager';
import { OnboardingSequence } from './components/OnboardingSequence';
import USDCToNRNPurchase from './components/USDCToNRNPurchase';
interface CognitiveState {
  activeSkills: string[];
  confidenceLevel: number;
}
import NetworkSelector, { NetworkType } from './components/NetworkSelector';

// Manager components - lazy loaded
const Skills = lazy(() => import('./pages/Skills'));
const UDC = lazy(() => import('./pages/UDC'));
const WalletPage = lazy(() => import('./pages/Wallet'));
const Badges = lazy(() => import('./pages/Badges'));
const CapabilitiesBadges = lazy(() => import('./pages/CapabilitiesBadges'));
const PropertiesBadges = lazy(() => import('./pages/PropertiesBadges'));
const ModelCreation = lazy(() => import('./pages/ModelCreation'));

// Types
import { Agent } from './types/common';
import { ErrorSubmissionData, ContextSubmissionData, IdeaSubmissionData } from './components/SubmissionModal';







// Types from receiver
export interface Adaptation {
  id: string;
  type: string;
  description: string;
  parameters: Record<string, unknown>;
  timestamp: Date;
  confidence: number;
}

export interface SkillResult {
  success: boolean;
  data?: unknown;
  output?: unknown;
  error?: string;
  executionTime?: number;
}

export interface NRV {
  id: string;
  problemDescription: string;
  sourceID: string;
  inputType: 'Voice' | 'Screenshot' | 'Log' | 'Camera' | 'Error' | 'Context' | 'Idea';
  visualContext?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  temporalContext: Date;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  suggestedSolutionType: string;
  status: 'Identified' | 'Mapped' | 'Assigned' | 'Resolved';
}

// Note: convertAgentToLegacy function removed - not currently needed but can be added back if LegacyAgent compatibility is required


// Burger Menu Component
interface BurgerMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  showNetworkSelector?: boolean;
  setShowNetworkSelector?: (show: boolean) => void;
  currentNetwork?: NetworkType | null;
  setCurrentNetwork?: (network: NetworkType | null) => void;
}

const BurgerMenu: React.FC<BurgerMenuProps> = ({ isOpen, onToggle, children, showNetworkSelector, setShowNetworkSelector, currentNetwork, setCurrentNetwork }) => {
  return (
    <div className="relative">
      {/* Burger Button */}
      <button
        onClick={onToggle}
        className="bg-gray-800/80 hover:bg-gray-700/80 text-white p-3 rounded-lg shadow-lg transition-all duration-200 border border-gray-600/50 backdrop-blur-sm"
        aria-label="Navigation menu"
        data-testid="burger-menu"
      >
        <div className="w-5 h-5 flex flex-col justify-center items-center">
          <div className={`w-5 h-0.5 bg-white transition-all duration-300 ${isOpen ? 'rotate-45 translate-y-1' : ''}`}></div>
          <div className={`w-5 h-0.5 bg-white transition-all duration-300 mt-1 ${isOpen ? 'opacity-0' : ''}`}></div>
          <div className={`w-5 h-0.5 bg-white transition-all duration-300 mt-1 ${isOpen ? '-rotate-45 -translate-y-1' : ''}`}></div>
        </div>
      </button>

      {/* Menu Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-gray-800/90 backdrop-blur-sm border border-gray-600/50 rounded-lg shadow-xl min-w-48 z-50" data-testid="burger-menu-content">
          <div className="p-2 space-y-1">
            {children}
          </div>
        </div>
      )}

      {/* Network Selector Modal */}
      {showNetworkSelector && (
        <NetworkSelector
          isOpen={showNetworkSelector}
          onClose={() => setShowNetworkSelector?.(false)}
          onNetworkChange={(network) => {
            setCurrentNetwork?.(network);
            console.log('Network changed to:', network.name);
          }}
          currentNetwork={currentNetwork ?? undefined}
        />
      )}
    </div>
  );
};

// Menu Item Component
interface MenuItemProps {
  onClick: () => void;
  children: React.ReactNode;
  icon: string;
  className?: string;
}

const MenuItem: React.FC<MenuItemProps> = ({ onClick, children, icon, className = '' }) => {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md text-white hover:bg-gray-700/80 transition-all duration-200 flex items-center space-x-2 ${className}`}
    >
      {icon && <span className="text-lg">{icon}</span>}
      <span className="font-medium">{children}</span>
    </button>
  );
};

// Receiver Interface Component
const ReceiverInterface = () => {
  const navigate = useNavigate();
  const [shellStatus, setShellStatus] = useState<'idle' | 'processing' | 'listening' | 'error'>('idle');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [currentNRVs, setCurrentNRVs] = useState<NRV[]>([]);
  const [selectedNRV, setSelectedNRV] = useState<NRV | null>(null);
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  const [activePanels, setActivePanels] = useState<string[]>([]);
  const [nrnBalance, setNrnBalance] = useState(1250);
  const [cognitiveMode, setCognitiveMode] = useState(false);
  const [isCortexBuilderOpen, setIsCortexBuilderOpen] = useState(false);
  const [isApiKeyManagerOpen, setIsApiKeyManagerOpen] = useState(false);
  const [isUSDCPurchaseOpen, setIsUSDCPurchaseOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [networkConnections] = useState<{
    [key: string]: 'connected' | 'disconnected' | 'connecting';
  }>({
    knirvChain: 'connected',
    knirvGraph: 'connected',
    knirvWallet: 'connected',
    knirvRouters: 'connected',
    knirvana: 'connected',
    knirvNexus: 'connected'
  });

  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if user needs onboarding
    const onboardingCompleted = localStorage.getItem('knirv_onboarding_completed');
    const onboardingSkipped = localStorage.getItem('knirv_onboarding_skipped');

    if (!onboardingCompleted && !onboardingSkipped) {
      setShowOnboarding(true);
    }

    // Initialize mock agents using the new Agent interface
    const mockAgents: Agent[] = [
      {
        agentId: 'agent-1',
        name: 'System Diagnostics Agent',
        version: '1.0.0',
        type: 'wasm',
        status: 'Available',
        nrnCost: 50,
        capabilities: ['error-detection', 'system-analysis'],
        metadata: {
          name: 'System Diagnostics Agent',
          version: '1.0.0',
          description: 'Advanced system diagnostics and error detection',
          author: 'KNIRV Network',
          capabilities: ['error-detection', 'system-analysis'],
          requirements: { memory: 256, cpu: 1, storage: 50 },
          permissions: ['read', 'analyze']
        },
        createdAt: new Date().toISOString()
      },
      {
        agentId: 'agent-2',
        name: 'UI/UX Optimization Agent',
        version: '1.0.0',
        type: 'lora',
        status: 'Available',
        nrnCost: 75,
        capabilities: ['interface-design', 'user-experience'],
        metadata: {
          name: 'UI/UX Optimization Agent',
          version: '1.0.0',
          description: 'User interface and experience optimization specialist',
          author: 'KNIRV Network',
          capabilities: ['interface-design', 'user-experience'],
          requirements: { memory: 512, cpu: 2, storage: 100 },
          permissions: ['read', 'write', 'design']
        },
        createdAt: new Date().toISOString()
      },
      {
        agentId: 'agent-3',
        name: 'Network Security Agent',
        version: '1.0.0',
        type: 'hybrid',
        status: 'Deployed',
        nrnCost: 100,
        capabilities: ['security-analysis', 'threat-detection'],
        metadata: {
          name: 'Network Security Agent',
          version: '1.0.0',
          description: 'Network security analysis and threat detection system',
          author: 'KNIRV Network',
          capabilities: ['security-analysis', 'threat-detection'],
          requirements: { memory: 1024, cpu: 4, storage: 200 },
          permissions: ['admin', 'security', 'monitor']
        },
        createdAt: new Date().toISOString()
      }
    ];
    setAvailableAgents(mockAgents);
  }, []);

  const handleVoiceCommand = (command: string) => {
    setShellStatus('processing');

    setTimeout(() => {
      const lowerCommand = command.toLowerCase();

      if (lowerCommand.includes('identify problems')) {
        const newNRV: NRV = {
          id: `nrv-${Date.now()}`,
          problemDescription: `User reported issue: ${command}`,
          sourceID: 'KNIRV-CORTEX-main',
          inputType: 'Voice',
          temporalContext: new Date(),
          severity: 'Medium',
          suggestedSolutionType: 'investigation',
          status: 'Identified'
        };
        setCurrentNRVs(prev => [...prev, newNRV]);
        setShellStatus('idle');
      } else if (lowerCommand.includes('show network')) {
        setActivePanels(['network-status']);
        setShellStatus('idle');
      } else if (lowerCommand.includes('assign agents')) {
        setActivePanels(['agent-manager']);
        setShellStatus('idle');
      } else if (lowerCommand.includes('cognitive mode') || lowerCommand.includes('enable cognitive')) {
        setCognitiveMode(true);
        setActivePanels(prev => [...prev, 'cognitive-shell']);
        setShellStatus('idle');
      } else if (lowerCommand.includes('start learning')) {
        setActivePanels(prev => [...prev, 'cognitive-shell']);
        setShellStatus('idle');
      } else if (lowerCommand.includes('capture screen')) {
        handleScreenshotCapture();
        return;
      } else if (lowerCommand.includes('toggle network')) {
        handleNetworkToggle();
        setShellStatus('idle');
      } else {
        setShellStatus('idle');
      }
    }, 1500);
  };

  const handleScreenshotCapture = async () => {
    setShellStatus('processing');

    try {
      // Capture actual screenshot using browser APIs
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // Get the current viewport
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // Use html2canvas or similar library if available, otherwise use basic capture
        if (typeof (window as any).html2canvas === 'function') {
          const screenshot = await (window as any).html2canvas(document.body);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          // Analyze the screenshot for actual visual anomalies
          const anomalies = await analyzeScreenshotForAnomalies(imageData);

          if (anomalies.length > 0) {
            const newNRV: NRV = {
              id: `nrv-${Date.now()}`,
              problemDescription: `Visual anomaly detected: ${anomalies[0].description}`,
              sourceID: 'KNIRV-CORTEX-visual-analyzer',
              inputType: 'Screenshot',
              visualContext: anomalies[0].location,
              temporalContext: new Date(),
              severity: anomalies[0].severity,
              suggestedSolutionType: anomalies[0].suggestedFix,
              status: 'Identified'
            };
            setCurrentNRVs(prev => [...prev, newNRV]);
          }
        } else {
          // Fallback: Create NRV based on current UI state analysis
          const uiElements = document.querySelectorAll('[data-testid], .error, .warning');
          const hasErrors = Array.from(uiElements).some(el =>
            el.className.includes('error') || el.textContent?.toLowerCase().includes('error')
          );

          if (hasErrors || Math.random() > 0.7) { // 30% chance to detect issues
            const newNRV: NRV = {
              id: `nrv-${Date.now()}`,
              problemDescription: hasErrors ? 'UI error state detected' : 'Potential UI improvement opportunity',
              sourceID: 'KNIRV-CORTEX-ui-analyzer',
              inputType: 'Screenshot',
              visualContext: {
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                width: 200,
                height: 150
              },
              temporalContext: new Date(),
              severity: hasErrors ? 'Medium' : 'Low',
              suggestedSolutionType: hasErrors ? 'error-fix' : 'ui-enhancement',
              status: 'Identified'
            };
            setCurrentNRVs(prev => [...prev, newNRV]);
          }
        }
      }
    } catch (error) {
      console.error('Screenshot capture failed:', error);
    } finally {
      setShellStatus('idle');
    }
  };

  // Helper function to analyze screenshots for real anomalies
  const analyzeScreenshotForAnomalies = async (imageData: ImageData): Promise<Array<{
    description: string;
    location: { x: number; y: number; width: number; height: number };
    severity: 'Low' | 'Medium' | 'High';
    suggestedFix: string;
  }>> => {
    const anomalies: Array<{
      description: string;
      location: { x: number; y: number; width: number; height: number };
      severity: 'Low' | 'Medium' | 'High';
      suggestedFix: string;
    }> = [];

    // Basic image analysis for UI anomalies
    const { data, width, height } = imageData;

    // Check for color inconsistencies (potential UI bugs)
    const colorVariance = calculateColorVariance(data);
    if (colorVariance > 100) {
      anomalies.push({
        description: 'High color variance detected - possible rendering issue',
        location: { x: 0, y: 0, width: width, height: height },
        severity: 'Medium',
        suggestedFix: 'css-optimization'
      });
    }

    // Check for potential accessibility issues (very bright or dark areas)
    const brightnessIssues = detectBrightnessIssues(data, width, height);
    if (brightnessIssues.length > 0) {
      anomalies.push(...brightnessIssues);
    }

    return anomalies;
  };

  const calculateColorVariance = (data: Uint8ClampedArray): number => {
    const colors: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      colors.push((data[i] + data[i + 1] + data[i + 2]) / 3);
    }

    const mean = colors.reduce((a, b) => a + b) / colors.length;
    const variance = colors.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / colors.length;
    return Math.sqrt(variance);
  };

  const detectBrightnessIssues = (data: Uint8ClampedArray, width: number, height: number): Array<{
    description: string;
    location: { x: number; y: number; width: number; height: number };
    severity: 'Low' | 'Medium' | 'High';
    suggestedFix: string;
  }> => {
    const issues: Array<{
      description: string;
      location: { x: number; y: number; width: number; height: number };
      severity: 'Low' | 'Medium' | 'High';
      suggestedFix: string;
    }> = [];

    // Sample brightness in grid
    const gridSize = 50;
    for (let y = 0; y < height - gridSize; y += gridSize) {
      for (let x = 0; x < width - gridSize; x += gridSize) {
        let totalBrightness = 0;
        let pixelCount = 0;

        for (let py = y; py < y + gridSize && py < height; py++) {
          for (let px = x; px < x + gridSize && px < width; px++) {
            const idx = (py * width + px) * 4;
            const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            totalBrightness += brightness;
            pixelCount++;
          }
        }

        const avgBrightness = totalBrightness / pixelCount;

        if (avgBrightness < 30) {
          issues.push({
            description: 'Very dark area detected - potential accessibility issue',
            location: { x, y, width: gridSize, height: gridSize },
            severity: 'Low',
            suggestedFix: 'contrast-improvement'
          });
        } else if (avgBrightness > 240) {
          issues.push({
            description: 'Very bright area detected - potential glare issue',
            location: { x, y, width: gridSize, height: gridSize },
            severity: 'Low',
            suggestedFix: 'brightness-reduction'
          });
        }
      }
    }

    return issues.slice(0, 3); // Limit to top 3 issues
  };

  const handleAnalyze = async () => {
    setShellStatus('processing');

    setActivePanels(prev =>
      prev.includes('agent-manager')
        ? prev
        : [...prev, 'agent-manager']
    );

    try {
      // Perform real system analysis
      const performanceMetrics = await analyzeSystemPerformance();
      const memoryUsage = await analyzeMemoryUsage();
      const networkLatency = await analyzeNetworkLatency();

      // Create NRV based on actual analysis results
      const issues: Array<{
        description: string;
        severity: 'Low' | 'Medium' | 'High';
        solutionType: string;
        source: string;
      }> = [];

      if (performanceMetrics.fps < 30) {
        issues.push({
          description: `Low FPS detected: ${performanceMetrics.fps.toFixed(1)} FPS`,
          severity: 'Medium',
          solutionType: 'performance-optimization',
          source: 'performance-monitor'
        });
      }

      if (memoryUsage.percentage > 80) {
        issues.push({
          description: `High memory usage: ${memoryUsage.percentage.toFixed(1)}%`,
          severity: 'High',
          solutionType: 'memory-optimization',
          source: 'memory-monitor'
        });
      }

      if (networkLatency.average > 1000) {
        issues.push({
          description: `High network latency: ${networkLatency.average}ms`,
          severity: 'Medium',
          solutionType: 'network-optimization',
          source: 'network-monitor'
        });
      }

      // Create NRVs for identified issues
      if (issues.length > 0) {
        const newNRVs = issues.map(issue => ({
          id: `nrv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          problemDescription: issue.description,
          sourceID: `KNIRV-CORTEX-${issue.source}`,
          inputType: 'Log' as const,
          temporalContext: new Date(),
          severity: issue.severity,
          suggestedSolutionType: issue.solutionType,
          status: 'Identified' as const
        }));

        setCurrentNRVs(prev => [...prev, ...newNRVs]);
      } else {
        // No issues found - create a positive NRV
        const newNRV: NRV = {
          id: `nrv-${Date.now()}`,
          problemDescription: 'System analysis complete - no critical issues detected',
          sourceID: 'KNIRV-CORTEX-system-analyzer',
          inputType: 'Log',
          temporalContext: new Date(),
          severity: 'Low',
          suggestedSolutionType: 'monitoring',
          status: 'Identified'
        };
        setCurrentNRVs(prev => [...prev, newNRV]);
      }
    } catch (error) {
      console.error('System analysis failed:', error);

      // Create error NRV
      const errorNRV: NRV = {
        id: `nrv-${Date.now()}`,
        problemDescription: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sourceID: 'KNIRV-CORTEX-error-handler',
        inputType: 'Error',
        temporalContext: new Date(),
        severity: 'Medium',
        suggestedSolutionType: 'error-investigation',
        status: 'Identified'
      };
      setCurrentNRVs(prev => [...prev, errorNRV]);
    } finally {
      setShellStatus('idle');
    }
  };

  // Helper functions for real system analysis
  const analyzeSystemPerformance = async (): Promise<{ fps: number; loadTime: number }> => {
    return new Promise((resolve) => {
      let frameCount = 0;
      const startTime = performance.now();

      const countFrames = () => {
        frameCount++;
        if (frameCount < 60) {
          requestAnimationFrame(countFrames);
        } else {
          const endTime = performance.now();
          const fps = 1000 / ((endTime - startTime) / frameCount);
          resolve({
            fps,
            loadTime: endTime - startTime
          });
        }
      };

      requestAnimationFrame(countFrames);
    });
  };

  const analyzeMemoryUsage = async (): Promise<{ used: number; total: number; percentage: number }> => {
    if (typeof window !== 'undefined' && (window.performance as any).memory) {
      const memory = (window.performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
      };
    }

    // Fallback estimation
    return {
      used: 50 * 1024 * 1024, // 50MB estimate
      total: 100 * 1024 * 1024, // 100MB estimate
      percentage: 50
    };
  };

  const analyzeNetworkLatency = async (): Promise<{ average: number; samples: number[] }> => {
    const samples: number[] = [];

    // Test network latency with multiple requests
    for (let i = 0; i < 3; i++) {
      try {
        const startTime = performance.now();
        await fetch('/api/health', { method: 'HEAD' });
        const endTime = performance.now();
        samples.push(endTime - startTime);
      } catch {
        samples.push(1000); // Default high latency for failed requests
      }
    }

    const average = samples.reduce((a, b) => a + b, 0) / samples.length;
    return { average, samples };
  };

  const handleSubmitError = async (data: ErrorSubmissionData) => {
    setShellStatus('processing');

    try {
      // Generate factuality slice and POST to server endpoint
      const { createFactualitySlice } = await import('./slices/factualitySlice');
      const errorId = `error-${Date.now()}`;

      // Create enhanced context from submission data
      const context = {
        source: 'KNIRV-CONTROLLER-user',
        submissionType: 'structured',
        errorType: data.errorType,
        severity: data.severity,
        stackTrace: data.stackTrace,
        logs: data.logs,
        steps: data.steps,
        environment: data.environment
      };

      const factuality = createFactualitySlice(
        `${data.title}: ${data.description}`,
        context
      );

      const response = await fetch('/api/graph/error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'dev-key' // TODO: Use proper API key management
        },
        body: JSON.stringify({
          errorId,
          errorType: data.errorType,
          description: `${data.title}: ${data.description}`,
          context,
          timestamp: Date.now(),
          factualitySlice: factuality
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to submit error: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Error submitted successfully:', result);

      const newNRV: NRV = {
        id: `nrv-${Date.now()}`,
        problemDescription: data.title,
        sourceID: 'KNIRV-CONTROLLER-user',
        inputType: 'Error',
        temporalContext: new Date(),
        severity: data.severity === 'critical' ? 'Critical' :
                 data.severity === 'high' ? 'High' :
                 data.severity === 'medium' ? 'Medium' : 'Low',
        suggestedSolutionType: 'skill-training',
        status: 'Identified'
      };
      setCurrentNRVs(prev => [...prev, newNRV]);
      setShellStatus('idle');
    } catch (error) {
      console.error('Failed to submit error:', error);
      setShellStatus('error');
      setTimeout(() => setShellStatus('idle'), 2000);
      throw error; // Re-throw to let modal handle the error
    }
  };

  const handleSubmitContext = async (data: ContextSubmissionData) => {
    setShellStatus('processing');

    try {
      // Generate a capability slice and POST to server
      const { createFactualitySlice } = await import('./slices/factualitySlice');
      const contextId = `context-${Date.now()}`;

      // Create enhanced MCP server info from submission data
      const mcpServerInfo = {
        serverType: data.mcpServerType,
        serverUrl: data.serverUrl,
        configuration: data.configuration,
        capabilities: data.capabilities || [],
        version: '1.0.0',
        submissionType: 'structured'
      };

      const capabilitySlice = createFactualitySlice(
        `${data.title}: ${data.description}`,
        {
          mcpServerInfo,
          category: data.category,
          serverType: data.mcpServerType
        }
      );

      const response = await fetch('/api/graph/context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'dev-key' // TODO: Use proper API key management
        },
        body: JSON.stringify({
          contextId,
          contextName: data.title,
          description: data.description,
          mcpServerInfo,
          category: data.category,
          timestamp: Date.now(),
          capabilitySlice
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to submit context: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Context submitted successfully:', result);

      const newNRV: NRV = {
        id: `nrv-${Date.now()}`,
        problemDescription: data.title,
        sourceID: 'KNIRV-CONTROLLER-user',
        inputType: 'Context',
        temporalContext: new Date(),
        severity: 'Medium',
        suggestedSolutionType: 'capability-mapping',
        status: 'Identified'
      };
      setCurrentNRVs(prev => [...prev, newNRV]);
      setShellStatus('idle');
    } catch (error) {
      console.error('Failed to submit context:', error);
      setShellStatus('error');
      setTimeout(() => setShellStatus('idle'), 2000);
      throw error; // Re-throw to let modal handle the error
    }
  };

  const handleSubmitIdea = async (data: IdeaSubmissionData) => {
    setShellStatus('processing');

    try {
      // Generate feasibility slice and POST to server
      const { createFeasibilitySlice } = await import('./slices/feasibilitySlice');
      const ideaId = `idea-${Date.now()}`;

      // Get existing ideas for similarity comparison (mock for now)
      const existingIdeas = currentNRVs
        .filter(nrv => nrv.inputType === 'Idea')
        .map(nrv => ({
          id: nrv.id,
          text: nrv.problemDescription,
          source: 'local'
        }));

      const feasibility = createFeasibilitySlice(
        data.title,
        data.description,
        existingIdeas
      );

      const response = await fetch('/api/graph/idea', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'dev-key' // TODO: Use proper API key management
        },
        body: JSON.stringify({
          ideaId,
          ideaName: data.title,
          description: data.description,
          timestamp: Date.now(),
          feasibilitySlice: feasibility
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to submit idea: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Idea submitted successfully:', result);

      const newNRV: NRV = {
        id: `nrv-${Date.now()}`,
        problemDescription: data.title,
        sourceID: 'KNIRV-CONTROLLER-user',
        inputType: 'Idea',
        temporalContext: new Date(),
        severity: 'Low',
        suggestedSolutionType: 'property-development',
        status: 'Identified'
      };
      setCurrentNRVs(prev => [...prev, newNRV]);
      setShellStatus('idle');
    } catch (error) {
      console.error('Failed to submit idea:', error);
      setShellStatus('error');
      setTimeout(() => setShellStatus('idle'), 2000);
      throw error; // Re-throw to let modal handle the error
    }
  };

  const handleNetworkToggle = () => {
    setActivePanels(prev =>
      prev.includes('network-status')
        ? prev.filter(id => id !== 'network-status')
        : [...prev, 'network-status']
    );
  };

  const handleNRVMapping = (nrv: NRV) => {
    setCurrentNRVs(prev => prev.map(n =>
      n.id === nrv.id ? { ...n, status: 'Mapped' } : n
    ));
    setShellStatus('processing');

    // Open Fabric Algorithm slideout
    setActivePanels(prev =>
      prev.includes('fabric-algorithm')
        ? prev
        : [...prev, 'fabric-algorithm']
    );

    setTimeout(() => {
      setShellStatus('idle');
    }, 1000);
  };

  const handleAgentAssignment = (nrv: NRV, agent: Agent) => {
    if (nrnBalance >= agent.nrnCost) {
      setNrnBalance(prev => prev - agent.nrnCost);
      setCurrentNRVs(prev => prev.map(n =>
        n.id === nrv.id ? { ...n, status: 'Assigned' } : n
      ));
      setAvailableAgents(prev => prev.map(a =>
        a.agentId === agent.agentId ? { ...a, status: 'Deployed' } : a
      ));

      setTimeout(() => {
        setCurrentNRVs(prev => prev.map(n =>
          n.id === nrv.id ? { ...n, status: 'Resolved' } : n
        ));
        setAvailableAgents(prev => prev.map(a =>
          a.agentId === agent.agentId ? { ...a, status: 'Available' } : a
        ));
      }, 5000);
    }
  };

  const handleNRVClose = (nrv: NRV) => {
    setCurrentNRVs(prev => prev.filter(n => n.id !== nrv.id));
    if (selectedNRV?.id === nrv.id) {
      setSelectedNRV(null);
    }
  };

  const closePanel = (panelId: string) => {
    setActivePanels(prev => prev.filter(id => id !== panelId));
  };

  const handleCognitiveStateChange = (state: CognitiveState) => {
    // Set cognitive mode based on whether the cognitive shell has active skills or confidence
    const isActive = state.activeSkills.length > 0 || state.confidenceLevel > 0.5;
    setCognitiveMode(isActive);

    // Update shell status based on cognitive engine state
    if (isActive) {
      if (state.activeSkills.includes('error-monitoring')) {
        setShellStatus('processing'); // Show as actively monitoring/processing
      } else {
        setShellStatus('listening'); // Show as ready and listening
      }
    } else {
      setShellStatus('idle'); // Back to idle when engine is stopped
    }

    console.log('Cognitive state changed:', {
      activeSkills: state.activeSkills,
      confidenceLevel: state.confidenceLevel,
      cognitiveMode: isActive,
      shellStatus: isActive ? (state.activeSkills.includes('error-monitoring') ? 'processing' : 'listening') : 'idle'
    });
  };

  const handleSkillInvoked = (skillId: string, result: unknown) => {
    const skillResult = result as SkillResult;
    console.log('Skill invoked:', skillId, skillResult);

    const newNRV: NRV = {
      id: `nrv-skill-${Date.now()}`,
      problemDescription: `Skill invoked: ${skillId}`,
      sourceID: 'cognitive-shell',
      inputType: 'Voice',
      temporalContext: new Date(),
      severity: 'Low',
      suggestedSolutionType: 'skill-execution',
      status: 'Resolved'
    };
    setCurrentNRVs(prev => [...prev, newNRV]);
  };

  const handleAdaptationTriggered = (adaptation: unknown) => {
    const adaptationData = adaptation as Adaptation;
    console.log('Adaptation triggered:', adaptationData);
    setShellStatus('processing');

    setTimeout(() => {
      setShellStatus('idle');
    }, 2000);
  };

  const getEdgeColor = () => {
    switch (shellStatus) {
      case 'processing': return '#3B82F6';
      case 'listening': return '#14B8A6';
      case 'error': return '#EF4444';
      default: return '#10B981';
    }
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showNetworkSelector, setShowNetworkSelector] = useState(false);
  const [currentNetwork, setCurrentNetwork] = useState<NetworkType | null>(null);

  const openCognitiveShell = () => {
    setActivePanels(prev =>
      prev.includes('cognitive-shell')
        ? prev
        : [...prev, 'cognitive-shell']
    );
    setMenuOpen(false);
  };

  const openCortexBuilder = () => {
    setIsCortexBuilderOpen(true);
  };

  const openApiKeyManager = () => {
    setIsApiKeyManagerOpen(true);
  };

  const openUSDCPurchase = () => {
    setIsUSDCPurchaseOpen(true);
  };

  const toggleNetworkPanel = () => {
    setActivePanels(prev =>
      prev.includes('network-status')
        ? prev.filter(id => id !== 'network-status')
        : [...prev, 'network-status']
    );
    setMenuOpen(false);
  };

  const toggleAgentPanel = () => {
    setActivePanels(prev =>
      prev.includes('agent-manager')
        ? prev.filter(id => id !== 'agent-manager')
        : [...prev, 'agent-manager']
    );
    setMenuOpen(false);
  };

  const handleQRScan = () => {
    setShowQRScanner(true);
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden">
      <EdgeColoring color={getEdgeColor()} intensity={shellStatus !== 'idle' ? 0.8 : 0.3} />

      {/* Burger Menu Navigation - positioned to avoid time metrics */}
      <div className="absolute top-20 right-4 z-50">
        <BurgerMenu
          isOpen={menuOpen}
          onToggle={() => setMenuOpen(!menuOpen)}
          showNetworkSelector={showNetworkSelector}
          setShowNetworkSelector={setShowNetworkSelector}
          currentNetwork={currentNetwork}
          setCurrentNetwork={setCurrentNetwork}
        >
          <MenuItem onClick={() => { navigate('/manager/badges'); setMenuOpen(false); }} icon="🏆">
            Badges
          </MenuItem>
          <MenuItem onClick={() => { navigate('/manager/skills'); setMenuOpen(false); }} icon="⚡">
            Skills
          </MenuItem>
          <MenuItem onClick={() => { navigate('/manager/udc'); setMenuOpen(false); }} icon="🔐">
            UDC
          </MenuItem>
          <MenuItem onClick={() => { navigate('/manager/wallet'); setMenuOpen(false); }} icon="💰">
            Wallet
          </MenuItem>
          <MenuItem onClick={handleQRScan} icon="📱">
            QR Scanner
          </MenuItem>
          <MenuItem onClick={openCognitiveShell} icon="🧠">
            Cognitive Shell
          </MenuItem>
          <MenuItem onClick={openCortexBuilder} icon="🎯">
            CORTEX Builder
          </MenuItem>
          <MenuItem onClick={openApiKeyManager} icon="🔑">
            API Keys
          </MenuItem>
          <MenuItem onClick={openUSDCPurchase} icon="💰">
            Buy NRN Tokens
          </MenuItem>
          <MenuItem onClick={toggleNetworkPanel} icon="🌐">
            Network Status
          </MenuItem>
          <MenuItem onClick={() => { setShowNetworkSelector?.(true); setMenuOpen(false); }} icon="🔗">
            Network Selection
          </MenuItem>
          <MenuItem onClick={toggleAgentPanel} icon="🤖">
            Agent Management
          </MenuItem>
        </BurgerMenu>
      </div>
      
      <main ref={shellRef} className="relative w-full h-screen" role="main">
        <KnirvShell
          status={shellStatus}
          nrnBalance={nrnBalance}
          onScreenshotCapture={handleScreenshotCapture}
          cognitiveMode={cognitiveMode}
          onSubmitError={handleSubmitError}
          onSubmitContext={handleSubmitContext}
          onSubmitIdea={handleSubmitIdea}
        />

        <VoiceControl
          isActive={isVoiceActive}
          onVoiceCommand={handleVoiceCommand}
          onToggle={setIsVoiceActive}
          cognitiveMode={cognitiveMode}
        />

        <NRVVisualization
          nrvs={currentNRVs}
          onNRVSelect={setSelectedNRV}
          onNRVMapping={handleNRVMapping}
          onNRVClose={handleNRVClose}
          onAnalyze={handleAnalyze}
        />

        {/* Sliding Panels */}
        <SlidingPanel
          id="network-status"
          isOpen={activePanels.includes('network-status')}
          onClose={() => closePanel('network-status')}
          title="Network Status"
          side="right"
        >
          <NetworkStatus connections={networkConnections} />
        </SlidingPanel>

        <SlidingPanel
          id="agent-manager"
          isOpen={activePanels.includes('agent-manager')}
          onClose={() => closePanel('agent-manager')}
          title="Agent Management"
          side="left"
        >
          <AgentManager
            agents={availableAgents}
            nrvs={currentNRVs}
            selectedNRV={selectedNRV}
            onAgentAssignment={handleAgentAssignment}
            nrnBalance={nrnBalance}
          />
        </SlidingPanel>

        <SlidingPanel
          id="cognitive-shell"
          isOpen={activePanels.includes('cognitive-shell')}
          onClose={() => closePanel('cognitive-shell')}
          title="Cognitive Shell"
          side="right"
        >
          <CognitiveShellInterface
            onStateChange={handleCognitiveStateChange}
            onSkillInvoked={handleSkillInvoked}
            onAdaptationTriggered={handleAdaptationTriggered}
          />
        </SlidingPanel>

        <SlidingPanel
          id="fabric-algorithm"
          isOpen={activePanels.includes('fabric-algorithm')}
          onClose={() => closePanel('fabric-algorithm')}
          title="Fabric Algorithm"
          side="right"
        >
          <FabricAlgorithm
            status={shellStatus}
            nrvCount={currentNRVs.length}
          />
        </SlidingPanel>

        {/* CORTEX Builder Modal */}
        <CortexBuilder
          isOpen={isCortexBuilderOpen}
          onClose={() => setIsCortexBuilderOpen(false)}
        />

        {/* API Key Manager Modal */}
        <ApiKeyManager
          isOpen={isApiKeyManagerOpen}
          onClose={() => setIsApiKeyManagerOpen(false)}
        />

        {/* USDC to NRN Purchase Modal */}
        {isUSDCPurchaseOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="relative">
              <button
                onClick={() => setIsUSDCPurchaseOpen(false)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 z-10"
              >
                ×
              </button>
              <USDCToNRNPurchase
                onPurchaseComplete={(result) => {
                  console.log('Purchase completed:', result);
                  // Update NRN balance if needed
                  setNrnBalance(prev => prev + parseFloat(result.nrnAmount));
                }}
                onError={(error) => {
                  console.error('Purchase error:', error);
                  // Could show a toast notification here
                }}
              />
            </div>
          </div>
        )}

        {/* Voice Status Indicator */}
        {isVoiceActive && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
            <div className="bg-teal-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-pulse">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                <span>Voice Active</span>
                {cognitiveMode && <span className="text-xs opacity-75">(Cognitive)</span>}
              </div>
            </div>
          </div>
        )}

        {/* Status Indicator - Shows Cognitive Mode when active, otherwise shows shell status */}
        <div className="absolute bottom-4 left-4 z-40">
          {cognitiveMode ? (
            <div className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full text-xs font-medium shadow-lg">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                <span>Cognitive Mode</span>
              </div>
            </div>
          ) : (
            <div className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
              shellStatus === 'idle' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
              shellStatus === 'processing' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
              shellStatus === 'listening' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' :
              'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {shellStatus.charAt(0).toUpperCase() + shellStatus.slice(1)}
            </div>
          )}
        </div>
      </main>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4 border border-gray-600">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">QR Code Scanner</h3>
              <button
                onClick={() => setShowQRScanner(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="aspect-square bg-gray-700 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <QrCode size={48} className="text-gray-400 mx-auto mb-2" />
                <p className="text-gray-400">QR Scanner Component</p>
                <p className="text-gray-500 text-sm mt-1">Camera access required</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Sequence */}
      <OnboardingSequence
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={() => setShowOnboarding(false)}
      />
    </div>
  );
};

// Agent Profile Component
const AgentProfile = () => {
  const navigate = useNavigate();
  const { agentId } = useParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);

  // Mock agent data - in real app this would come from API
  const agent = {
    id: agentId,
    name: agentId === 'codet5-alpha' ? 'CodeT5-Alpha' :
          agentId === 'seal-beta' ? 'SEAL-Beta' :
          agentId === 'lora-gamma' ? 'LoRA-Gamma' : 'Unknown Agent',
    type: agentId === 'codet5-alpha' ? 'KNIRV-CORTEX' :
          agentId === 'seal-beta' ? 'KNIRVANA' :
          agentId === 'lora-gamma' ? 'DVE' : 'Unknown',
    status: agentId === 'codet5-alpha' ? 'active' :
            agentId === 'seal-beta' ? 'active' :
            agentId === 'lora-gamma' ? 'idle' : 'offline',
    performance: agentId === 'codet5-alpha' ? 94 :
                 agentId === 'seal-beta' ? 87 :
                 agentId === 'lora-gamma' ? 91 : 78,
    tasks: agentId === 'codet5-alpha' ? 12 :
           agentId === 'seal-beta' ? 8 :
           agentId === 'lora-gamma' ? 0 : 0,
    lastActive: agentId === 'codet5-alpha' ? '2 min ago' :
                agentId === 'seal-beta' ? '5 min ago' :
                agentId === 'lora-gamma' ? '1 hour ago' : '3 hours ago',
    specialization: agentId === 'codet5-alpha' ? ['code-generation', 'optimization'] :
                    agentId === 'seal-beta' ? ['learning', 'adaptation'] :
                    agentId === 'lora-gamma' ? ['fine-tuning', 'model-adaptation'] : ['unknown'],
    nrnCost: agentId === 'codet5-alpha' ? 85 :
             agentId === 'seal-beta' ? 90 :
             agentId === 'lora-gamma' ? 120 : 100,
    description: agentId === 'codet5-alpha' ? 'Advanced code generation and optimization agent powered by CodeT5 architecture.' :
                 agentId === 'seal-beta' ? 'Self-evolving adaptive learning agent with continuous improvement capabilities.' :
                 agentId === 'lora-gamma' ? 'Low-rank adaptation specialist for fine-tuning large language models.' : 'Unknown agent type.',
    capabilities: agentId === 'codet5-alpha' ? ['Code Generation', 'Bug Detection', 'Performance Optimization', 'Documentation'] :
                  agentId === 'seal-beta' ? ['Adaptive Learning', 'Pattern Recognition', 'Behavior Modeling', 'Prediction'] :
                  agentId === 'lora-gamma' ? ['Model Fine-tuning', 'Parameter Optimization', 'Transfer Learning', 'Efficiency'] : ['Unknown'],
    metrics: {
      uptime: agentId === 'codet5-alpha' ? '99.2%' :
              agentId === 'seal-beta' ? '98.7%' :
              agentId === 'lora-gamma' ? '95.1%' : '89.3%',
      accuracy: agentId === 'codet5-alpha' ? '94.8%' :
                agentId === 'seal-beta' ? '92.3%' :
                agentId === 'lora-gamma' ? '96.7%' : '78.2%',
      responseTime: agentId === 'codet5-alpha' ? '1.2s' :
                    agentId === 'seal-beta' ? '0.8s' :
                    agentId === 'lora-gamma' ? '2.1s' : '3.4s',
      totalTasks: agentId === 'codet5-alpha' ? 1247 :
                  agentId === 'seal-beta' ? 892 :
                  agentId === 'lora-gamma' ? 634 : 234
    }
  };

  const handleQRScan = () => {
    setShowQRScanner(true);
    setMenuOpen(false);
  };



  return (
    <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden">
      {/* Burger Menu Navigation */}
      <div className="absolute top-4 right-4 z-50">
        <BurgerMenu isOpen={menuOpen} onToggle={() => setMenuOpen(!menuOpen)}>
          <MenuItem onClick={() => { navigate('/manager/badges'); setMenuOpen(false); }} icon="🏆">
            Badges
          </MenuItem>
          <MenuItem onClick={() => { navigate('/manager/skills'); setMenuOpen(false); }} icon="⚡">
            Skills
          </MenuItem>
          <MenuItem onClick={() => { navigate('/manager/udc'); setMenuOpen(false); }} icon="🔐">
            UDC
          </MenuItem>
          <MenuItem onClick={() => { navigate('/manager/wallet'); setMenuOpen(false); }} icon="💰">
            Wallet
          </MenuItem>
          <MenuItem onClick={handleQRScan} icon="📱">
            QR Scanner
          </MenuItem>
          <MenuItem onClick={() => { navigate('/'); setMenuOpen(false); }} icon="🏠">
            Input Interface
          </MenuItem>
        </BurgerMenu>
      </div>

      <div className="max-w-6xl mx-auto p-4 pb-24 overflow-y-auto h-screen">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center space-x-4 mb-6">
            <button
              onClick={() => navigate('/')}
              className="bg-gray-800/80 hover:bg-gray-700/80 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-200 font-medium border border-gray-600/50"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">{agent.name}</h1>
              <p className="text-gray-400">{agent.type} Agent Profile</p>
            </div>
          </div>

          {/* Status Card */}
          <div className="bg-gray-800/80 border border-gray-600/50 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`w-4 h-4 rounded-full ${
                  agent.status === 'active' ? 'bg-green-400 animate-pulse' :
                  agent.status === 'idle' ? 'bg-yellow-400' : 'bg-red-400'
                }`}></div>
                <h2 className="text-xl font-semibold text-white">Status: {agent.status}</h2>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-white">{agent.nrnCost} NRN/hour</p>
                <p className="text-gray-400 text-sm">Operating cost</p>
              </div>
            </div>
            <p className="text-gray-300 mb-4">{agent.description}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{agent.tasks}</div>
                <div className="text-gray-400 text-sm">Active Tasks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{agent.performance}%</div>
                <div className="text-gray-400 text-sm">Performance</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{agent.metrics.uptime}</div>
                <div className="text-gray-400 text-sm">Uptime</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-cyan-400">{agent.metrics.totalTasks}</div>
                <div className="text-gray-400 text-sm">Total Tasks</div>
              </div>
            </div>
          </div>

          {/* Capabilities */}
          <div className="bg-gray-800/80 border border-gray-600/50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Capabilities</h3>
            <div className="grid grid-cols-2 gap-3">
              {agent.capabilities.map((capability, index) => (
                <div key={index} className="bg-gray-700/50 border border-gray-600/30 rounded-lg p-3">
                  <p className="text-white font-medium">{capability}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-gray-800/80 border border-gray-600/50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Performance Metrics</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Accuracy</span>
                <span className="text-white font-semibold">{agent.metrics.accuracy}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Response Time</span>
                <span className="text-white font-semibold">{agent.metrics.responseTime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Last Active</span>
                <span className="text-white font-semibold">{agent.lastActive}</span>
              </div>
            </div>
          </div>

          {/* Specializations */}
          <div className="bg-gray-800/80 border border-gray-600/50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Specializations</h3>
            <div className="flex flex-wrap gap-2">
              {agent.specialization?.map((spec, index) => (
                <span key={index} className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full text-sm">
                  {spec}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4 border border-gray-600">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">QR Code Scanner</h3>
              <button
                onClick={() => setShowQRScanner(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="aspect-square bg-gray-700 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <QrCode size={48} className="text-gray-400 mx-auto mb-2" />
                <p className="text-gray-400">QR Scanner Component</p>
                <p className="text-gray-500 text-sm mt-1">Camera access required</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Manager Interface Wrapper
const ManagerInterface = () => {
  const navigate = useNavigate();

  // Redirect to skills page by default
  React.useEffect(() => {
    if (window.location.pathname === '/manager' || window.location.pathname === '/manager/') {
      navigate('/manager/skills', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-900 text-white relative">
      <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="text-white">Loading...</div></div>}>
        <Routes>
          <Route path="/skills" element={<Skills />} />
          <Route path="/udc" element={<UDC />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/badges" element={<Badges />} />
          <Route path="/capabilities" element={<CapabilitiesBadges />} />
          <Route path="/properties" element={<PropertiesBadges />} />
          <Route path="/model-creation" element={<ModelCreation />} />
          <Route path="/agent/:agentId" element={<AgentProfile />} />
        </Routes>
      </Suspense>
    </div>
  );
};

// Main App Component
function App() {
  useEffect(() => {
    // Initialize Sentry for error monitoring
    initSentry();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/*" element={<ReceiverInterface />} />
        <Route path="/manager/*" element={<ManagerInterface />} />
      </Routes>
    </Router>
  );
}

export default App;
