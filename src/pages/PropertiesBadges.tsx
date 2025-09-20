import React, { useState, useEffect } from 'react';
import { Settings, Award, Lightbulb, TrendingUp, Users, Star, Zap, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { personalKNIRVGRAPHService } from '../services/PersonalKNIRVGRAPHService';

interface PropertyBadge {
  id: string;
  name: string;
  description: string;
  category: string;
  feasibilityScore: number;
  marketPotential: string;
  targetAudience: string;
  timeframe: string;
  resources: string;
  inspiration: string;
  earnedAt: Date;
  status: 'active' | 'developing' | 'completed';
}

interface PropertyNodeData {
  description?: string;
  category?: string;
  feasibilityScore?: number;
  marketPotential?: string;
  context?: { marketSize?: string; targetAudience?: string; timeframe?: string; resources?: string; inspiration?: string };
  targetAudience?: string;
  timeframe?: string;
  resources?: string;
  inspiration?: string;
  timestamp?: string | number;
  status?: string;
}

const PropertiesBadges: React.FC = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<PropertyBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      const graph = await personalKNIRVGRAPHService.getCurrentGraph();
      if (graph) {
        const propertyNodes = graph.nodes
          .filter(n => n.type === 'property')
          .map(node => {
                  const data = node.data as PropertyNodeData;
                  const normalizeStatus = (s: unknown): PropertyBadge['status'] => {
                    const raw = (s ?? '').toString();
                    const lower = raw.toLowerCase();
                    if (lower === 'active' || lower === 'developing' || lower === 'completed') return lower as PropertyBadge['status'];
                    if (lower.includes('develop') || lower.includes('in-progress') || lower.includes('building')) return 'developing';
                    if (lower.includes('complete') || lower.includes('done')) return 'completed';
                    return 'active';
                  };

                  return {
                    id: node.id,
                    name: node.label,
                    description: data.description || '',
                    category: data.category || 'general',
                    feasibilityScore: data.feasibilityScore ?? 0,
                    marketPotential: data.marketPotential || '',
                    targetAudience: data.targetAudience || '',
                    timeframe: data.timeframe || '',
                    resources: data.resources || '',
                    inspiration: data.inspiration || '',
                    earnedAt: new Date(data.timestamp || Date.now()),
                    status: normalizeStatus(data.status)
                  };
          });

        setProperties(propertyNodes);
      }
    } catch (error) {
      console.error('Failed to load properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: 'all', name: 'All Properties', count: properties.length },
    { id: 'innovation', name: 'Innovation', count: properties.filter(p => p.category === 'innovation').length },
    { id: 'business', name: 'Business', count: properties.filter(p => p.category === 'business').length },
    { id: 'technology', name: 'Technology', count: properties.filter(p => p.category === 'technology').length },
    { id: 'social', name: 'Social Impact', count: properties.filter(p => p.category === 'social').length },
    { id: 'creative', name: 'Creative', count: properties.filter(p => p.category === 'creative').length }
  ];

  const filteredProperties = selectedCategory === 'all' 
    ? properties 
    : properties.filter(p => p.category === selectedCategory);

  const getFeasibilityColor = (score: number) => {
    if (score >= 0.8) return 'text-green-400 bg-green-400/10';
    if (score >= 0.6) return 'text-yellow-400 bg-yellow-400/10';
    if (score >= 0.4) return 'text-orange-400 bg-orange-400/10';
    return 'text-red-400 bg-red-400/10';
  };

  const getFeasibilityStars = (score: number) => {
    const stars = Math.round(score * 5);
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < stars ? 'text-yellow-400 fill-current' : 'text-gray-600'}`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading properties badges...</p>
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
            <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center">
              <Settings className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Properties Badges</h1>
              <p className="text-gray-400">Ideas, innovations, and creative contributions</p>
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
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                }`}
              >
                {category.name} ({category.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Properties Grid */}
      <div className="max-w-6xl mx-auto p-6">
        {filteredProperties.length === 0 ? (
          <div className="text-center py-12">
            <Lightbulb className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Properties Badges Yet</h3>
            <p className="text-gray-400 mb-6">
              Start earning properties badges by submitting ideas through the central interface.
            </p>
            <p className="text-sm text-gray-500">
              Each idea submission creates a property badge with feasibility analysis.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProperties.map((property) => (
              <div
                key={property.id}
                className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 hover:bg-gray-800/70 transition-all"
              >
                {/* Badge Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center">
                      <Award className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{property.name}</h3>
                      <p className="text-xs text-gray-400 capitalize">{property.category}</p>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs ${getFeasibilityColor(property.feasibilityScore)}`}>
                    {Math.round(property.feasibilityScore * 100)}%
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                  {property.description}
                </p>

                {/* Feasibility Rating */}
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-xs text-gray-400">Feasibility:</span>
                  <div className="flex space-x-1">
                    {getFeasibilityStars(property.feasibilityScore)}
                  </div>
                </div>

                {/* Market Potential */}
                <div className="flex items-center space-x-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-gray-400">Market:</span>
                  <span className="text-xs text-green-400">{property.marketPotential}</span>
                </div>

                {/* Target Audience */}
                <div className="flex items-center space-x-2 mb-3">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-gray-400">Audience:</span>
                  <span className="text-xs text-blue-400">{property.targetAudience}</span>
                </div>

                {/* Timeframe */}
                <div className="flex items-center space-x-2 mb-4">
                  <span className="text-xs text-gray-400">Timeline:</span>
                  <span className="text-xs text-purple-400">{property.timeframe}</span>
                </div>

                {/* Inspiration */}
                {property.inspiration && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 italic">
                      "{property.inspiration}"
                    </p>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
                  <div className="text-xs text-gray-400 capitalize">
                    {property.status}
                  </div>
                  <div className="text-xs text-gray-500">
                    {property.earnedAt.toLocaleDateString()}
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
          <button
            onClick={() => navigate('/manager/capabilities')}
            className="flex flex-col items-center space-y-1 text-gray-400 hover:text-blue-400 transition-colors"
          >
            <Database className="w-6 h-6" />
            <span className="text-xs">Capabilities</span>
          </button>
          <button className="flex flex-col items-center space-y-1 text-yellow-400">
            <Settings className="w-6 h-6" />
            <span className="text-xs">Properties</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PropertiesBadges;
