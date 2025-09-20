/**
 * Integration tests for the complete capture flow
 * Tests the end-to-end flow from UI submission to database persistence
 */

import { personalKNIRVGRAPHService } from '../services/PersonalKNIRVGRAPHService';
import { rxdbService } from '../services/RxDBService';
import { createFactualitySlice } from '../slices/factualitySlice';
import { createFeasibilitySlice } from '../slices/feasibilitySlice';

// Mock API server endpoints
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Capture Flow Integration Tests', () => {
  beforeEach(async () => {
    // Reset services
    await rxdbService.initialize();
    await personalKNIRVGRAPHService.loadPersonalGraph('test-user');
    
    // Reset fetch mock
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, node: { id: 'test-node' } })
    });
  });

  afterEach(async () => {
    // Clean up
    await personalKNIRVGRAPHService.resetGraph();
    await rxdbService.destroy();
  });

  describe('Error Submission Flow', () => {
    it('should create error node with factuality slice', async () => {
      const errorData = {
        errorId: 'test-error-1',
        errorType: 'runtime' as const,
        description: 'Test runtime error with stack trace',
        context: {
          stackTrace: 'Error: Test error\n  at test.js:10:5',
          logs: 'ERROR: Runtime exception occurred',
          environment: 'Node.js 18.0.0'
        },
        timestamp: Date.now()
      };

      // Test factuality slice creation
      const factualitySlice = createFactualitySlice(errorData.description, errorData.context);
      
      expect(factualitySlice.response.confidence).toBeGreaterThan(0);
      expect(factualitySlice.citations.length).toBeGreaterThan(0);
      expect(factualitySlice.provenance.generatedBy).toBe('factuality-slice-enhanced');

      // Test node creation
      const node = await personalKNIRVGRAPHService.addErrorNode({
        ...errorData,
        factualitySlice
      });

      expect(node.type).toBe('error');
      expect(node.id).toBe(`error_${errorData.errorId}`);
      expect(node.data).toHaveProperty('factualitySlice');

      // Verify persistence
      const graph = personalKNIRVGRAPHService.getCurrentGraph();
      expect(graph?.nodes).toHaveLength(1);
      expect(graph?.nodes[0].id).toBe(node.id);
    });

    it('should extract technical evidence from error context', async () => {
      const errorContext = {
        stackTrace: 'TypeError: Cannot read property "length" of undefined\n  at processArray (utils.js:42:15)',
        logs: 'ERROR 2025-01-19T10:30:45.123Z [ProcessingService] Failed to process array',
        errorCode: 'ERR_UNDEFINED_PROPERTY'
      };

      const factualitySlice = createFactualitySlice('Array processing error', errorContext);

      // Should identify technical evidence
      const technicalCitations = factualitySlice.citations.filter(c => 
        c.source === 'logs' || c.source === 'stacktrace'
      );
      expect(technicalCitations.length).toBeGreaterThan(0);

      // Should have high confidence for technical errors
      expect(factualitySlice.response.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('Context Submission Flow', () => {
    it('should create capability node with context slice', async () => {
      const contextData = {
        contextId: 'test-context-1',
        contextName: 'Database MCP Server',
        description: 'PostgreSQL database integration server',
        mcpServerInfo: {
          serverType: 'database',
          serverUrl: 'postgresql://localhost:5432/testdb',
          capabilities: ['query', 'transaction', 'schema']
        },
        category: 'integration' as const,
        timestamp: Date.now()
      };

      // Test capability slice creation
      const capabilitySlice = createFactualitySlice(
        `${contextData.contextName}: ${contextData.description}`,
        { mcpServerInfo: contextData.mcpServerInfo, category: contextData.category }
      );

      expect(capabilitySlice.response.confidence).toBeGreaterThan(0);
      expect(capabilitySlice.citations.length).toBeGreaterThan(0);

      // Test node creation
      const node = await personalKNIRVGRAPHService.addContextNode({
        ...contextData,
        capabilitySlice
      });

      expect(node.type).toBe('capability');
      expect(node.id).toBe(`capability_${contextData.contextId}`);
      expect(node.data).toHaveProperty('capabilitySlice');

      // Verify persistence
      const graph = personalKNIRVGRAPHService.getCurrentGraph();
      expect(graph?.nodes).toHaveLength(1);
      expect(graph?.nodes[0].id).toBe(node.id);
    });
  });

  describe('Idea Submission Flow', () => {
    it('should create property node with feasibility slice', async () => {
      const ideaData = {
        ideaId: 'test-idea-1',
        ideaName: 'AI-Powered Code Review Tool',
        description: 'Automated code review system using machine learning to detect bugs and suggest improvements',
        timestamp: Date.now()
      };

      // Test feasibility slice creation
      const existingIdeas = [
        { id: 'existing-1', text: 'Code analysis tool for JavaScript', source: 'local' },
        { id: 'existing-2', text: 'Static code analyzer with ML', source: 'local' }
      ];

      const feasibilitySlice = createFeasibilitySlice(
        ideaData.ideaName,
        ideaData.description,
        existingIdeas
      );

      expect(feasibilitySlice.feasibilityScore).toBeGreaterThanOrEqual(0);
      expect(feasibilitySlice.feasibilityScore).toBeLessThanOrEqual(100);
      expect(feasibilitySlice.marketAnalysis).toBeDefined();
      expect(feasibilitySlice.technicalComplexity).toMatch(/^(low|medium|high|extreme)$/);

      // Test node creation
      const node = await personalKNIRVGRAPHService.addIdeaNode({
        ...ideaData,
        feasibilitySlice
      });

      expect(node.type).toBe('property');
      expect(node.id).toBe(`property_${ideaData.ideaId}`);
      expect(node.data).toHaveProperty('feasibilitySlice');

      // Verify persistence
      const graph = personalKNIRVGRAPHService.getCurrentGraph();
      expect(graph?.nodes).toHaveLength(1);
      expect(graph?.nodes[0].id).toBe(node.id);
    });

    it('should detect similar existing ideas', async () => {
      const existingIdeas = [
        { id: 'similar-1', text: 'AI code review assistant for developers', source: 'local' },
        { id: 'different-1', text: 'Weather forecasting application', source: 'local' }
      ];

      const feasibilitySlice = createFeasibilitySlice(
        'AI Code Review Tool',
        'Automated code review using artificial intelligence',
        existingIdeas
      );

      // Should detect similarity with first idea
      expect(feasibilitySlice.similar.length).toBeGreaterThan(0);
      const topSimilar = feasibilitySlice.similar[0];
      expect(topSimilar.id).toBe('similar-1');
      expect(topSimilar.score).toBeGreaterThan(0.3);

      // Should affect feasibility score if very similar
      if (topSimilar.score > 0.7) {
        expect(feasibilitySlice.exists).toBe(true);
        expect(feasibilitySlice.feasibilityScore).toBeLessThan(50);
      }
    });
  });

  describe('Graph Statistics and Analysis', () => {
    it('should provide comprehensive graph statistics with slice analysis', async () => {
      // Add multiple nodes with slices
      await personalKNIRVGRAPHService.addErrorNode({
        errorId: 'error-1',
        errorType: 'runtime',
        description: 'Test error',
        context: {},
        timestamp: Date.now()
      });

      await personalKNIRVGRAPHService.addContextNode({
        contextId: 'context-1',
        contextName: 'Test Context',
        description: 'Test context',
        mcpServerInfo: {},
        category: 'integration',
        timestamp: Date.now()
      });

      await personalKNIRVGRAPHService.addIdeaNode({
        ideaId: 'idea-1',
        ideaName: 'Test Idea',
        description: 'Test idea',
        timestamp: Date.now()
      });

      const stats = personalKNIRVGRAPHService.getGraphStats();
      
      expect(stats).toBeDefined();
      expect(stats!.nodeCount).toBe(3);
      expect(stats!.nodeTypes.error).toBe(1);
      expect(stats!.nodeTypes.capability).toBe(1);
      expect(stats!.nodeTypes.property).toBe(1);
      
      // Check slice statistics
      expect(stats!.sliceStats.factualitySlices).toBeGreaterThan(0);
      expect(stats!.sliceStats.feasibilitySlices).toBeGreaterThan(0);
      expect(stats!.sliceStats.avgFactualityConfidence).toBeGreaterThan(0);
      expect(stats!.sliceStats.avgFeasibilityScore).toBeGreaterThan(0);
    });

    it('should export graph with slice analysis', async () => {
      await personalKNIRVGRAPHService.addErrorNode({
        errorId: 'error-1',
        errorType: 'runtime',
        description: 'Test error',
        context: {},
        timestamp: Date.now()
      });

      const exportData = personalKNIRVGRAPHService.exportGraphWithSlices();
      
      expect(exportData).toBeDefined();
      expect(exportData!.graph.nodes).toHaveLength(1);
      expect(exportData!.sliceAnalysis.errorNodes).toHaveLength(1);
      expect(exportData!.sliceAnalysis.errorNodes[0].factualitySlice).toBeDefined();
    });
  });

  describe('API Integration', () => {
    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error'
      });

      const errorData = {
        errorId: 'test-error-api',
        errorType: 'runtime' as const,
        description: 'Test API error handling',
        context: {},
        timestamp: Date.now()
      };

      // Should still create node locally even if API fails
      const node = await personalKNIRVGRAPHService.addErrorNode(errorData);
      expect(node).toBeDefined();
      expect(node.type).toBe('error');
    });
  });
});
