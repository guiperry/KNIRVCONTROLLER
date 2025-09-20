import React, { useState, useEffect } from 'react';
import { Award, Zap, Settings, Database, ArrowRight, Star, Trophy, Medal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { personalKNIRVGRAPHService } from '../services/PersonalKNIRVGRAPHService';

interface BadgeStats {
  skills: number;
  capabilities: number;
  properties: number;
  total: number;
}

interface BadgeCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  count: number;
  color: string;
  route: string;
}

const Badges: React.FC = () => {
  const navigate = useNavigate();
  const [badgeStats, setBadgeStats] = useState<BadgeStats>({
    skills: 0,
    capabilities: 0,
    properties: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    loadBadgeStats();
  }, []);

  const loadBadgeStats = async () => {
    try {
      const graph = await personalKNIRVGRAPHService.getCurrentGraph();
      if (graph) {
        const skillNodes = graph.nodes.filter(n => n.type === 'skill').length;
        const capabilityNodes = graph.nodes.filter(n => n.type === 'capability').length;
        const propertyNodes = graph.nodes.filter(n => n.type === 'property').length;
        
        setBadgeStats({
          skills: skillNodes,
          capabilities: capabilityNodes,
          properties: propertyNodes,
          total: skillNodes + capabilityNodes + propertyNodes
        });
      }
    } catch (error) {
      console.error('Failed to load badge stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const badgeCategories: BadgeCategory[] = [
    {
      id: 'skills',
      name: 'Skills Badges',
      description: 'Earned through error resolution and problem-solving achievements',
      icon: <Zap className="w-8 h-8" />,
      count: badgeStats.skills,
      color: 'from-red-500 to-red-600',
      route: '/manager/skills'
    },
    {
      id: 'capabilities',
      name: 'Capabilities Badges',
      description: 'Earned through context submission and MCP server integration',
      icon: <Database className="w-8 h-8" />,
      count: badgeStats.capabilities,
      color: 'from-blue-500 to-blue-600',
      route: '/manager/capabilities'
    },
    {
      id: 'properties',
      name: 'Properties Badges',
      description: 'Earned through idea submission and innovation contributions',
      icon: <Settings className="w-8 h-8" />,
      count: badgeStats.properties,
      color: 'from-yellow-500 to-yellow-600',
      route: '/manager/properties'
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading badges...</p>
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
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Award className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Badges</h1>
              <p className="text-gray-400">Your achievements and earned credentials</p>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4 text-center">
              <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{badgeStats.total}</div>
              <div className="text-sm text-gray-400">Total Badges</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 text-center">
              <Zap className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{badgeStats.skills}</div>
              <div className="text-sm text-gray-400">Skills</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 text-center">
              <Database className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{badgeStats.capabilities}</div>
              <div className="text-sm text-gray-400">Capabilities</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 text-center">
              <Settings className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{badgeStats.properties}</div>
              <div className="text-sm text-gray-400">Properties</div>
            </div>
          </div>
        </div>
      </div>

      {/* Badge Categories */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Badge Categories</h2>
            <p className="text-gray-400 mb-6">
              Explore your earned badges across different categories. Each badge represents a milestone in your KNIRV journey.
            </p>
          </div>

          <div className="grid gap-6">
            {badgeCategories.map((category) => (
              <div
                key={category.id}
                onClick={() => navigate(category.route)}
                className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 hover:bg-gray-800/70 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-16 h-16 bg-gradient-to-r ${category.color} rounded-xl flex items-center justify-center text-white`}>
                      {category.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-white mb-2">{category.name}</h3>
                      <p className="text-gray-400 text-sm mb-3">{category.description}</p>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <Medal className="w-4 h-4 text-yellow-400" />
                          <span className="text-white font-semibold">{category.count} badges</span>
                        </div>
                        {category.count > 0 && (
                          <div className="flex items-center space-x-1">
                            {[...Array(Math.min(5, category.count))].map((_, i) => (
                              <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                            ))}
                            {category.count > 5 && (
                              <span className="text-yellow-400 text-sm">+{category.count - 5}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            ))}
          </div>

          {/* Getting Started */}
          {badgeStats.total === 0 && (
            <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl p-6 mt-8">
              <div className="text-center">
                <Award className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Start Earning Badges!</h3>
                <p className="text-gray-400 mb-4">
                  Begin your KNIRV journey by submitting errors, context, and ideas through the central interface.
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Go to Training Interface
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Badges;
