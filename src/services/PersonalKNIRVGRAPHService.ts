/**
 * Personal KNIRVGRAPH Service
 * Manages individual user's graph instance with error mapping and visualization
 */

import { FactualitySlice, createFactualitySlice } from '../slices/factualitySlice';
import { FeasibilityReport, createFeasibilitySlice } from '../slices/feasibilitySlice';

interface ErrorNodeData {
  errorId: string;
  errorType: string;
  description: string;
  context: Record<string, unknown>;
  timestamp: number;
}

interface SkillNodeData {
  skillId: string;
  skillName: string;
  description: string;
  category: string;
  proficiency: number;
}

interface CapabilityNodeData {
  capabilityId: string;
  capabilityName: string;
  description: string;
  mcpServerInfo: Record<string, unknown>;
  category: string;
  timestamp: number;
}

// Allow node data to optionally include slice objects
type NodeWithSlices = NodeData & {
  factualitySlice?: FactualitySlice;
  capabilitySlice?: FactualitySlice;
  feasibilitySlice?: FeasibilityReport;
};

interface PropertyNodeData {
  propertyId: string;
  propertyName: string;
  description: string;
  feasibilityReport: {
    exists: boolean;
    similarProjects: string[];
    feasibilityScore: number;
    marketAnalysis: Record<string, unknown>;
  };
  collaborators: string[];
  timestamp: number;
}

interface ConnectionNodeData {
  connectionType: string;
  strength: number;
}

interface AgentNodeData {
  agentId: string;
  agentType: string;
  capabilities: string[];
}

type NodeData = ErrorNodeData | SkillNodeData | CapabilityNodeData | PropertyNodeData | ConnectionNodeData | AgentNodeData;

interface EdgeData {
  connectionType: string;
  weight: number;
  metadata?: Record<string, unknown>;
}

import { rxdbService } from './RxDBService';

export interface GraphNode {
  id: string;
  type: 'error' | 'skill' | 'capability' | 'property' | 'connection' | 'agent';
  label: string;
  position: { x: number; y: number; z: number };
  data: NodeData | NodeWithSlices;
  connections: string[]; // IDs of connected nodes
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'error_to_skill' | 'context_to_capability' | 'idea_to_property' | 'skill_chain' | 'agent_connection' | 'collaboration';
  weight: number;
  data: EdgeData;
}

export interface PersonalGraph {
  id: string;
  userId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    createdAt: number;
    lastModified: number;
    version: number;
    complexity: number;
  };
}


export class PersonalKNIRVGRAPHService {
  private currentGraph: PersonalGraph | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize RxDB if not already done
      if (!rxdbService.isDatabaseInitialized()) {
        await rxdbService.initialize();
      }

      this.isInitialized = true;
      console.log('Personal KNIRVGRAPH service initialized');
    } catch (error) {
      console.error('Failed to initialize Personal KNIRVGRAPH service:', error);
    }
  }

  // Create a new personal graph
  async createPersonalGraph(userId: string): Promise<PersonalGraph> {
    const graph: PersonalGraph = {
      id: `graph_${userId}_${Date.now()}`,
      userId,
      nodes: [],
      edges: [],
      metadata: {
        createdAt: Date.now(),
        lastModified: Date.now(),
        version: 1,
        complexity: 0
      }
    };

  this.currentGraph = graph;

  // Store in RxDB
  await this.saveGraphToDatabase(graph);

  return graph;
  }

  // Load user's personal graph
  async loadPersonalGraph(userId: string): Promise<PersonalGraph | null> {
    try {
      if (!this.isInitialized) await this.initialize();

      const db = rxdbService.getDatabase();

      // Try to find an existing graph for the user
      const existing = await db.graphs.findOne({ selector: { userId } }).exec();
      if (existing) {
        try {
          const parsedNodes = (existing.nodes || []) as GraphNode[];
          const parsedEdges = (existing.edges || []) as GraphEdge[];
          const graph: PersonalGraph = {
            id: existing.id,
            userId: existing.userId,
            nodes: parsedNodes,
            edges: parsedEdges,
                    metadata: (existing.metadata as PersonalGraph['metadata']) || {
              createdAt: Date.now(),
              lastModified: Date.now(),
              version: 1,
              complexity: 0
            }
          };

          this.currentGraph = graph;
          return graph;
        } catch (err) {
          console.error('Failed parsing existing graph, creating new one:', err);
        }
      }

      // Create a new graph if none exists
      const graph = await this.createPersonalGraph(userId);
      return graph;
    } catch (error) {
      console.error('Failed to load personal graph:', error);
      return null;
    }
  }

  // Add error node to graph - Competitive process for SkillNode creation
  async addErrorNode(errorData: {
    errorId: string;
    errorType: string;
    description: string;
    context: Record<string, unknown>;
    timestamp: number;
    factualitySlice?: FactualitySlice;
  }): Promise<GraphNode> {
    if (!this.currentGraph) throw new Error('No active graph');

    // Generate factuality slice if not provided
    const factualitySlice = errorData.factualitySlice ||
      createFactualitySlice(errorData.description, errorData.context);

    const errorNodeData: ErrorNodeData = {
      errorId: errorData.errorId,
      errorType: errorData.errorType,
      description: errorData.description,
      context: errorData.context,
      timestamp: errorData.timestamp
    };

    const node: GraphNode = {
      id: `error_${errorData.errorId}`,
      type: 'error',
      label: errorData.description,
      position: this.calculateNodePosition(),
      data: { ...errorNodeData, factualitySlice } as NodeWithSlices,
      connections: []
    };

    this.currentGraph.nodes.push(node);

    // Attempt to find related skills automatically
    await this.findRelatedSkills(node);

    // Update graph
    await this.updateGraph();

    console.log(`Added error node with factuality slice (confidence: ${factualitySlice.response.confidence})`);
    return node;
  }

  // Add context node to graph - Creates CapabilityNodes from MCP server information
  async addContextNode(contextData: {
    contextId: string;
    contextName: string;
    description: string;
    mcpServerInfo: Record<string, unknown>;
    category: string;
    timestamp: number;
    capabilitySlice?: FactualitySlice;
  }): Promise<GraphNode> {
    if (!this.currentGraph) throw new Error('No active graph');

    // Generate capability slice if not provided (using factuality slice for technical context)
    const capabilitySlice = contextData.capabilitySlice ||
      createFactualitySlice(
        `${contextData.contextName}: ${contextData.description}`,
        {
          mcpServerInfo: contextData.mcpServerInfo,
          category: contextData.category,
          type: 'capability_context'
        }
      );

    const capabilityData: CapabilityNodeData = {
      capabilityId: contextData.contextId,
      capabilityName: contextData.contextName,
      description: contextData.description,
      mcpServerInfo: contextData.mcpServerInfo,
      category: contextData.category,
      timestamp: contextData.timestamp
    };

    const node: GraphNode = {
      id: `capability_${contextData.contextId}`,
      type: 'capability',
      label: contextData.contextName,
      position: this.calculateNodePosition(),
      data: { ...capabilityData, capabilitySlice } as NodeWithSlices,
      connections: []
    };

    this.currentGraph.nodes.push(node);

    // Find related capabilities and create connections
    await this.findRelatedCapabilities(node);

    // Update graph
    await this.updateGraph();

    console.log(`Added capability node with factuality slice (confidence: ${capabilitySlice.response.confidence})`);
    return node;
  }

  // Add idea node to graph - Collaborative process for PropertyNode creation
  async addIdeaNode(ideaData: {
    ideaId: string;
    ideaName: string;
    description: string;
    timestamp: number;
    feasibilitySlice?: FeasibilityReport;
  }): Promise<GraphNode> {
    if (!this.currentGraph) throw new Error('No active graph');

    // Get existing property nodes for similarity comparison
    const existingProperties = this.currentGraph.nodes
      .filter(n => n.type === 'property')
      .map(n => ({
        id: n.id,
        text: `${n.label} ${(n.data as PropertyNodeData).description}`,
        source: 'local'
      }));

    // Generate enhanced feasibility slice if not provided
    const feasibilitySlice = ideaData.feasibilitySlice ||
      createFeasibilitySlice(ideaData.ideaName, ideaData.description, existingProperties);

    // Generate legacy feasibility report for backward compatibility
    const feasibilityReport = await this.generateFeasibilityReport(ideaData);

    const propertyData: PropertyNodeData = {
      propertyId: ideaData.ideaId,
      propertyName: ideaData.ideaName,
      description: ideaData.description,
      feasibilityReport,
      collaborators: [this.currentGraph.userId], // Start with current user
      timestamp: ideaData.timestamp
    };

    const node: GraphNode = {
      id: `property_${ideaData.ideaId}`,
      type: 'property',
      label: ideaData.ideaName,
      position: this.calculateNodePosition(),
      data: { ...propertyData, feasibilitySlice } as NodeWithSlices,
      connections: []
    };

    this.currentGraph.nodes.push(node);

    // Find potential collaborators and similar ideas
    await this.findCollaborationOpportunities(node);

    // Update graph
    await this.updateGraph();

    console.log(`Added idea node with feasibility slice (score: ${feasibilitySlice.feasibilityScore}%, exists: ${feasibilitySlice.exists})`);
    return node;
  }

  // Add skill node to graph
  async addSkillNode(skillData: {
    skillId: string;
    skillName: string;
    description: string;
    category: string;
    proficiency: number;
  }): Promise<GraphNode> {
    if (!this.currentGraph) throw new Error('No active graph');

    const node: GraphNode = {
      id: `skill_${skillData.skillId}`,
      type: 'skill',
      label: skillData.skillName,
      position: this.calculateNodePosition(),
      data: skillData,
      connections: []
    };

    this.currentGraph.nodes.push(node);
    await this.updateGraph();

    return node;
  }

  // Add capability node to graph - Direct capability minting
  async addCapabilityNode(capabilityData: {
    capabilityId: string;
    name: string;
    description: string;
    capabilityType: string;
    mcpServerUrl: string;
    schema: string;
    locationHints: string[];
    gasFeeNRN: number;
    status: string;
  }): Promise<GraphNode> {
    if (!this.currentGraph) throw new Error('No active graph');

    const node: GraphNode = {
      id: `capability_${capabilityData.capabilityId}`,
      type: 'capability',
      label: capabilityData.name,
      position: this.calculateNodePosition(),
      data: capabilityData,
      connections: []
    };

    this.currentGraph.nodes.push(node);
    await this.updateGraph();

    return node;
  }

  // Export current graph for external use (e.g., KNIRVANA merging)
  async exportGraph(): Promise<PersonalGraph> {
    if (!this.currentGraph) {
      throw new Error('No active graph to export');
    }

    return {
      nodes: this.currentGraph.nodes.map(node => ({
        id: node.id,
        type: node.type,
        label: node.label,
        position: node.position,
        data: node.data,
        connections: node.connections
      })),
      edges: this.currentGraph.edges || []
    };
  }

  // Create connection between nodes
  async createConnection(sourceId: string, targetId: string, type: GraphEdge['type'], weight = 1): Promise<GraphEdge> {
    if (!this.currentGraph) throw new Error('No active graph');

    const edge: GraphEdge = {
      id: `edge_${sourceId}_${targetId}`,
      source: sourceId,
      target: targetId,
      type,
      weight,
      data: {
        connectionType: type,
        weight: weight
      }
    };

    this.currentGraph.edges.push(edge);

    // Update node connections
    const sourceNode = this.currentGraph.nodes.find(n => n.id === sourceId);
    const targetNode = this.currentGraph.nodes.find(n => n.id === targetId);

    if (sourceNode && !sourceNode.connections.includes(targetId)) {
      sourceNode.connections.push(targetId);
    }
    if (targetNode && !targetNode.connections.includes(sourceId)) {
      targetNode.connections.push(sourceId);
    }

    await this.updateGraph();

    return edge;
  }

  // Find skills related to an error
  private async findRelatedSkills(errorNode: GraphNode): Promise<void> {
    // Simple pattern matching for demo
    const errorText = (errorNode.data as ErrorNodeData).description.toLowerCase();
    const skillMappings = [
      { pattern: /type.*error/i, skill: 'TypeScript' },
      { pattern: /import.*error/i, skill: 'Module Management' },
      { pattern: /network.*error/i, skill: 'Network Programming' },
      { pattern: /async.*error/i, skill: 'Asynchronous Programming' }
    ];

    for (const mapping of skillMappings) {
      if (mapping.pattern.test(errorText)) {
        // Create skill node if it doesn't exist
        const existingSkill = this.currentGraph?.nodes.find(
          n => n.type === 'skill' && 'skillName' in n.data && n.data.skillName === mapping.skill
        );

        if (!existingSkill) {
          await this.addSkillNode({
            skillId: `skill_${mapping.skill.toLowerCase().replace(/\s+/g, '_')}`,
            skillName: mapping.skill,
            description: `Skill related to ${mapping.skill}`,
            category: 'programming',
            proficiency: 0.5
          });
        }

        // Create connection
        const skillNode = this.currentGraph?.nodes.find(
          n => n.type === 'skill' && 'skillName' in n.data && (n.data as SkillNodeData).skillName === mapping.skill
        );

        if (skillNode) {
          await this.createConnection(errorNode.id, skillNode.id, 'error_to_skill');
        }
      }
    }
  }

  // Helper method to find related capabilities for context nodes
  private async findRelatedCapabilities(capabilityNode: GraphNode): Promise<void> {
    const existingCapabilities = this.currentGraph?.nodes.filter(n => n.type === 'capability') || [];

    for (const existingCapability of existingCapabilities) {
      if ('category' in existingCapability.data && 'category' in capabilityNode.data) {
        const similarity = this.calculateSimilarity(
          existingCapability.data.category as string,
          capabilityNode.data.category as string
        );
        if (similarity > 0.6) {
          await this.createConnection(capabilityNode.id, existingCapability.id, 'context_to_capability');
        }
      }
    }
  }

  // Helper method to find collaboration opportunities for idea nodes
  private async findCollaborationOpportunities(propertyNode: GraphNode): Promise<void> {
    const existingProperties = this.currentGraph?.nodes.filter(n => n.type === 'property') || [];

    for (const existingProperty of existingProperties) {
      if ('description' in existingProperty.data && 'description' in propertyNode.data) {
        const similarity = this.calculateSimilarity(
          existingProperty.data.description as string,
          propertyNode.data.description as string
        );
        if (similarity > 0.4) {
          await this.createConnection(propertyNode.id, existingProperty.id, 'collaboration');
        }
      }
    }
  }

  // Generate feasibility report for ideas using real analysis
  private async generateFeasibilityReport(ideaData: {
    ideaId: string;
    ideaName: string;
    description: string;
  }): Promise<PropertyNodeData['feasibilityReport']> {
    try {
      // Use the real feasibility slice implementation
      const { createFeasibilitySlice } = await import('../slices/feasibilitySlice');

      // Get existing ideas from the current graph for similarity analysis
      const existingIdeas = this.currentGraph?.nodes
        .filter(node => node.type === 'property')
        .map(node => ({
          title: node.data.propertyName || node.data.title || 'Unknown',
          description: node.data.description || ''
        })) || [];

      // Create feasibility slice with real analysis
      const feasibilitySlice = createFeasibilitySlice(
        ideaData.ideaName,
        ideaData.description,
        existingIdeas
      );

      // Extract data from the feasibility slice
      const report = feasibilitySlice.report;

      return {
        exists: report.exists,
        similarProjects: report.similar.map(s => s.title),
        feasibilityScore: report.feasibilityScore,
        marketAnalysis: {
          marketSize: report.marketAnalysis.marketSize,
          competition: report.marketAnalysis.competitionLevel === 'low' ? 10 :
                      report.marketAnalysis.competitionLevel === 'medium' ? 30 : 50,
          trendScore: report.marketAnalysis.trendScore
        }
      };
    } catch (error) {
      console.error('Failed to generate feasibility report:', error);

      // Fallback to basic analysis if feasibility slice fails
      const basicExists = existingIdeas.some(idea =>
        idea.title.toLowerCase().includes(ideaData.ideaName.toLowerCase()) ||
        ideaData.ideaName.toLowerCase().includes(idea.title.toLowerCase())
      );

      return {
        exists: basicExists,
        similarProjects: basicExists ?
          existingIdeas
            .filter(idea => idea.title.toLowerCase().includes(ideaData.ideaName.toLowerCase()))
            .map(idea => idea.title)
            .slice(0, 3) : [],
        feasibilityScore: basicExists ? 40 : 75, // Lower score if similar exists
        marketAnalysis: {
          marketSize: 100000, // Conservative estimate
          competition: basicExists ? 40 : 20,
          trendScore: 5.0 // Neutral trend
        }
      };
    }
  }

  // Calculate similarity between two strings (simple implementation)
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    return intersection.length / union.length;
  }

  // Calculate node position (simple algorithm)
  private calculateNodePosition(): { x: number; y: number; z: number } {
    if (!this.currentGraph) return { x: 0, y: 0, z: 0 };

    const nodeCount = this.currentGraph.nodes.length;
    const angle = (nodeCount * 137.5) * (Math.PI / 180); // Golden angle
    const radius = Math.sqrt(nodeCount) * 50;

    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      z: nodeCount * 10
    };
  }

  // Update graph and save to database
  private async updateGraph(): Promise<void> {
    if (!this.currentGraph) return;

    this.currentGraph.metadata.lastModified = Date.now();
    this.currentGraph.metadata.complexity = this.currentGraph.nodes.length + this.currentGraph.edges.length;

    await this.saveGraphToDatabase(this.currentGraph);
  }

  // Save graph to RxDB
  private async saveGraphToDatabase(graph: PersonalGraph): Promise<void> {
    try {
      const db = rxdbService.getDatabase();

      // Upsert graph into graphs collection
      await db.graphs.upsert({
        id: graph.id,
        type: 'graph',
        userId: graph.userId,
        nodes: graph.nodes,
        edges: graph.edges,
        metadata: graph.metadata,
        timestamp: Date.now()
      });

      console.log('Graph saved to database (graphs collection)');
    } catch (error) {
      console.error('Failed to save graph to database:', error);
    }
  }

  // Get current graph
  getCurrentGraph(): PersonalGraph | null {
    return this.currentGraph;
  }

  // Export graph data for visualization
  exportGraphData(): { nodes: GraphNode[]; edges: GraphEdge[] } | null {
    if (!this.currentGraph) return null;

    return {
      nodes: this.currentGraph.nodes,
      edges: this.currentGraph.edges
    };
  }

  // Export complete graph as JSON
  async exportGraphAsJSON(): Promise<string | null> {
    if (!this.currentGraph) return null;

    const exportData = {
      graph: this.currentGraph,
      exportedAt: new Date().toISOString(),
      version: '1.0',
      sliceAnalysis: this.exportGraphWithSlices()?.sliceAnalysis
    };

    return JSON.stringify(exportData, null, 2);
  }

  // Import graph from JSON
  async importGraphFromJSON(jsonData: string): Promise<boolean> {
    try {
      const importData = JSON.parse(jsonData);

      if (!importData.graph || !importData.graph.id) {
        throw new Error('Invalid graph data format');
      }

      const graph = importData.graph as PersonalGraph;

      // Validate graph structure
      if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
        throw new Error('Invalid graph structure');
      }

      // Update metadata
      graph.metadata.lastModified = Date.now();
      graph.metadata.version = (graph.metadata.version || 0) + 1;

      this.currentGraph = graph;
      await this.saveGraphToDatabase(graph);

      console.log(`Imported graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges`);
      return true;
    } catch (error) {
      console.error('Failed to import graph:', error);
      return false;
    }
  }

  // Get all graphs for a user
  async getAllUserGraphs(userId: string): Promise<PersonalGraph[]> {
    try {
      const db = rxdbService.getDatabase();
      const graphDocs = await db.graphs.find({ selector: { userId } }).exec();

      return graphDocs.map(doc => ({
        id: doc.id,
        userId: doc.userId,
        nodes: doc.nodes as GraphNode[],
        edges: doc.edges as GraphEdge[],
        metadata: doc.metadata as PersonalGraph['metadata']
      }));
    } catch (error) {
      console.error('Failed to get user graphs:', error);
      return [];
    }
  }

  // Reset graph
  async resetGraph(): Promise<void> {
    if (this.currentGraph) {
      this.currentGraph.nodes = [];
      this.currentGraph.edges = [];
      await this.updateGraph();
    }
  }

  // Get graph statistics with slice analysis
  getGraphStats(): {
    nodeCount: number;
    edgeCount: number;
    complexity: number;
    nodeTypes: Record<string, number>;
    sliceStats: {
      factualitySlices: number;
      feasibilitySlices: number;
      avgFactualityConfidence: number;
      avgFeasibilityScore: number;
    };
  } | null {
    if (!this.currentGraph) return null;

    const nodeTypes: Record<string, number> = {};
    let factualitySlices = 0;
    let feasibilitySlices = 0;
    let totalFactualityConfidence = 0;
    let totalFeasibilityScore = 0;

    this.currentGraph.nodes.forEach(node => {
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;

      const nodeData = node.data as NodeWithSlices;
      if (nodeData.factualitySlice) {
        factualitySlices++;
        totalFactualityConfidence += nodeData.factualitySlice.response.confidence;
      }
      if (nodeData.capabilitySlice) {
        factualitySlices++;
        totalFactualityConfidence += nodeData.capabilitySlice.response.confidence;
      }
      if (nodeData.feasibilitySlice) {
        feasibilitySlices++;
        totalFeasibilityScore += nodeData.feasibilitySlice.feasibilityScore;
      }
    });

    return {
      nodeCount: this.currentGraph.nodes.length,
      edgeCount: this.currentGraph.edges.length,
      complexity: this.currentGraph.metadata.complexity,
      nodeTypes,
      sliceStats: {
        factualitySlices,
        feasibilitySlices,
        avgFactualityConfidence: factualitySlices > 0 ? totalFactualityConfidence / factualitySlices : 0,
        avgFeasibilityScore: feasibilitySlices > 0 ? totalFeasibilityScore / feasibilitySlices : 0
      }
    };
  }

  // Export graph with slices for analysis
  exportGraphWithSlices(): {
    graph: PersonalGraph;
    sliceAnalysis: {
      errorNodes: Array<{ id: string; factualitySlice?: FactualitySlice }>;
      capabilityNodes: Array<{ id: string; capabilitySlice?: FactualitySlice }>;
      propertyNodes: Array<{ id: string; feasibilitySlice?: FeasibilityReport }>;
    };
  } | null {
    if (!this.currentGraph) return null;

    const errorNodes = this.currentGraph.nodes
      .filter(n => n.type === 'error')
      .map(n => ({
        id: n.id,
        factualitySlice: (n.data as NodeWithSlices).factualitySlice
      }));

    const capabilityNodes = this.currentGraph.nodes
      .filter(n => n.type === 'capability')
      .map(n => ({
        id: n.id,
        capabilitySlice: (n.data as NodeWithSlices).capabilitySlice
      }));

    const propertyNodes = this.currentGraph.nodes
      .filter(n => n.type === 'property')
      .map(n => ({
        id: n.id,
        feasibilitySlice: (n.data as NodeWithSlices).feasibilitySlice
      }));

    return {
      graph: this.currentGraph,
      sliceAnalysis: {
        errorNodes,
        capabilityNodes,
        propertyNodes
      }
    };
  }

  // Get slice summary for a specific node
  getNodeSliceSummary(nodeId: string): {
    nodeType: string;
    factualitySlice?: {
      confidence: number;
      citationCount: number;
      evidenceQuality: number;
    };
    feasibilitySlice?: {
      feasibilityScore: number;
      exists: boolean;
      similarProjectCount: number;
      technicalComplexity: string;
    };
  } | null {
    if (!this.currentGraph) return null;

    const node = this.currentGraph.nodes.find(n => n.id === nodeId);
    if (!node) return null;

    const nodeData = node.data as NodeWithSlices;
    const result: ReturnType<typeof this.getNodeSliceSummary> = {
      nodeType: node.type
    };

    if (nodeData.factualitySlice) {
      result.factualitySlice = {
        confidence: nodeData.factualitySlice.response.confidence,
        citationCount: nodeData.factualitySlice.citations.length,
        evidenceQuality: nodeData.factualitySlice.response.evidence_quality_score || 0
      };
    }

    if (nodeData.capabilitySlice) {
      result.factualitySlice = {
        confidence: nodeData.capabilitySlice.response.confidence,
        citationCount: nodeData.capabilitySlice.citations.length,
        evidenceQuality: nodeData.capabilitySlice.response.evidence_quality_score || 0
      };
    }

    if (nodeData.feasibilitySlice) {
      result.feasibilitySlice = {
        feasibilityScore: nodeData.feasibilitySlice.feasibilityScore,
        exists: nodeData.feasibilitySlice.exists,
        similarProjectCount: nodeData.feasibilitySlice.similar.length,
        technicalComplexity: nodeData.feasibilitySlice.technicalComplexity
      };
    }

    return result;
  }
}

// Export singleton instance
export const personalKNIRVGRAPHService = new PersonalKNIRVGRAPHService();
