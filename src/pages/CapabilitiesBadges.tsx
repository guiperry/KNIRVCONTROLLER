import React, { useState, useEffect } from 'react';
import { Database, Award, Server, Link, CheckCircle, Clock, AlertCircle, Zap, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { personalKNIRVGRAPHService } from '../services/PersonalKNIRVGRAPHService';

interface CapabilityBadge {
  id: string;
  name: string;
  description: string;
  capabilityType: string;
  mcpServerUrl: string;
  schema: string;
  locationHints: string[];
  gasFeeNRN: number;
  status: 'active' | 'pending' | 'inactive';
  earnedAt: Date;
  category: string;
}

// Node data shape for capability nodes stored in the personal graph
interface CapabilityNodeData {
  description?: string;
  capabilityType?: string;
  CapabilityType?: string;
  mcpServerUrl?: string;
  MCPServerURL?: string;
  schema?: string;
  Schema?: string;
  locationHints?: string[];
  LocationHints?: string[];
  gasFeeNRN?: number;
  Metadata?: { gas_fee_nrn?: number; category?: string };
  status?: string;
  Status?: string;
  CreatedAt?: string | number;
  category?: string;
}

const CapabilitiesBadges: React.FC = () => {
  const navigate = useNavigate();
  const [capabilities, setCapabilities] = useState<CapabilityBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    loadCapabilities();
  }, []);

  const loadCapabilities = async () => {
    try {
      const graph = await personalKNIRVGRAPHService.getCurrentGraph();
      if (graph) {
        const capabilityNodes = graph.nodes
          .filter(n => n.type === 'capability')
          .map(node => {
            const data = node.data as CapabilityNodeData;
            // Normalize status to the exact union type required by CapabilityBadge
            const normalizeStatus = (s: unknown): CapabilityBadge['status'] => {
              const raw = (s ?? '').toString();
              const lower = raw.toLowerCase();
              if (lower === 'active' || lower === 'pending' || lower === 'inactive') return lower as CapabilityBadge['status'];
              if (lower.includes('pending') || lower.includes('processing')) return 'pending';
              if (lower.includes('inactive') || lower.includes('disabled') || lower.includes('archived')) return 'inactive';
              return 'active';
            };

            return {
              id: node.id,
              name: node.label,
              description: data.description || '',
              capabilityType: data.capabilityType || 'unknown',
              mcpServerUrl: data.mcpServerUrl || '',
              schema: data.schema || '{}',
              locationHints: data.locationHints || [],
              gasFeeNRN: data.gasFeeNRN ?? 0.1,
              status: normalizeStatus(data.status),
              earnedAt: new Date(data.CreatedAt || Date.now()),
              category: data.category || 'integration'
            };
          });

        setCapabilities(capabilityNodes);
      }
    } catch (error) {
      console.error('Failed to load capabilities:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: 'all', name: 'All Capabilities', count: capabilities.length },
    { id: 'integration', name: 'Integration', count: capabilities.filter(c => c.category === 'integration').length },
    { id: 'automation', name: 'Automation', count: capabilities.filter(c => c.category === 'automation').length },
    { id: 'data-processing', name: 'Data Processing', count: capabilities.filter(c => c.category === 'data-processing').length },
    { id: 'communication', name: 'Communication', count: capabilities.filter(c => c.category === 'communication').length },
    { id: 'monitoring', name: 'Monitoring', count: capabilities.filter(c => c.category === 'monitoring').length }
  ];

  const filteredCapabilities = selectedCategory === 'all' 
    ? capabilities 
    : capabilities.filter(c => c.category === selectedCategory);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-400" />;
      case 'inactive':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return <CheckCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'pending':
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'inactive':
        return 'text-red-400 bg-red-400/10 border-red-400/20';
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading capabilities badges...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Burger Menu Navigation */}
      <div className="absolute top-4 right-4 z-50">
        <div className="relative">
          {/* Burger Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="bg-gray-800/80 hover:bg-gray-700/80 text-white p-3 rounded-lg shadow-lg transition-all duration-200 border border-gray-600/50 backdrop-blur-sm"
            aria-label="Navigation menu"
          >
            <div className="w-5 h-5 flex flex-col justify-center items-center">
              <div className={`w-5 h-0.5 bg-white transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-1' : ''}`}></div>
              <div className={`w-5 h-0.5 bg-white transition-all duration-300 mt-1 ${menuOpen ? 'opacity-0' : ''}`}></div>
              <div className={`w-5 h-0.5 bg-white transition-all duration-300 mt-1 ${menuOpen ? '-rotate-45 -translate-y-1' : ''}`}></div>
            </div>
          </button>

          {/* Menu Dropdown */}
          {menuOpen && (
            <div className="absolute top-full right-0 mt-2 bg-gray-800/90 backdrop-blur-sm border border-gray-600/50 rounded-lg shadow-xl min-w-48 z-50">
              <div className="p-2 space-y-1">
                <button
                  onClick={() => { navigate('/manager/badges'); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-md text-white hover:bg-gray-700/80 transition-all duration-200 flex items-center space-x-2"
                >
                  <span>🏆</span>
                  <span>Badges</span>
                </button>
                <button
                  onClick={() => { navigate('/manager/skills'); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-md text-white hover:bg-gray-700/80 transition-all duration-200 flex items-center space-x-2"
                >
                  <span>⚡</span>
                  <span>Skills</span>
                </button>
                <button
                  onClick={() => { navigate('/manager/udc'); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-md text-white hover:bg-gray-700/80 transition-all duration-200 flex items-center space-x-2"
                >
                  <span>🔐</span>
                  <span>UDC</span>
                </button>
                <button
                  onClick={() => { navigate('/manager/wallet'); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-md text-white hover:bg-gray-700/80 transition-all duration-200 flex items-center space-x-2"
                >
                  <span>💰</span>
                  <span>Wallet</span>
                </button>
                <button
                  onClick={() => { navigate('/'); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-md text-white hover:bg-gray-700/80 transition-all duration-200 flex items-center space-x-2"
                >
                  <span>🏠</span>
                  <span>Input Interface</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-700/50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Database className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Capabilities Badges</h1>
              <p className="text-gray-400">MCP server integrations and context-driven capabilities</p>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                }`}
              >
                {category.name} ({category.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Capabilities Grid */}
      <div className="max-w-6xl mx-auto p-6">
        {filteredCapabilities.length === 0 ? (
          <div className="text-center py-12">
            <Database className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Capabilities Badges Yet</h3>
            <p className="text-gray-400 mb-6">
              Start earning capabilities badges by submitting context through the central interface.
            </p>
            <p className="text-sm text-gray-500">
              Context submissions with MCP server URLs automatically mint capability badges.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCapabilities.map((capability) => (
              <div
                key={capability.id}
                className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 hover:bg-gray-800/70 transition-all"
              >
                {/* Badge Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <Award className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{capability.name}</h3>
                      <p className="text-xs text-gray-400 capitalize">{capability.capabilityType}</p>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs border ${getStatusColor(capability.status)}`}>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(capability.status)}
                      <span className="capitalize">{capability.status}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                  {capability.description}
                </p>

                {/* MCP Server */}
                {capability.mcpServerUrl && (
                  <div className="flex items-center space-x-2 mb-3">
                    <Server className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-gray-400 truncate">
                      {capability.mcpServerUrl}
                    </span>
                  </div>
                )}

                {/* Location Hints */}
                {capability.locationHints.length > 0 && (
                  <div className="flex items-center space-x-2 mb-3">
                    <Link className="w-4 h-4 text-green-400" />
                    <div className="flex flex-wrap gap-1">
                      {capability.locationHints.map((hint, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-green-400/10 text-green-400 text-xs rounded"
                        >
                          {hint}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
                  <div className="text-xs text-gray-400">
                    Gas: {capability.gasFeeNRN} NRN
                  </div>
                  <div className="text-xs text-gray-500">
                    {capability.earnedAt.toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700/50 p-4">
        <div className="flex justify-center space-x-8">
          <button
            onClick={() => navigate('/manager/skills')}
            className="flex flex-col items-center space-y-1 text-gray-400 hover:text-red-400 transition-colors"
          >
            <Zap className="w-6 h-6" />
            <span className="text-xs">Skills</span>
          </button>
          <button className="flex flex-col items-center space-y-1 text-blue-400">
            <Database className="w-6 h-6" />
            <span className="text-xs">Capabilities</span>
          </button>
          <button
            onClick={() => navigate('/manager/properties')}
            className="flex flex-col items-center space-y-1 text-gray-400 hover:text-yellow-400 transition-colors"
          >
            <Settings className="w-6 h-6" />
            <span className="text-xs">Properties</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CapabilitiesBadges;
