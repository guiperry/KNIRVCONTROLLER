import * as React from 'react';
import { useState } from 'react';
import { X, AlertTriangle, FileText, Lightbulb } from 'lucide-react';

interface BaseSubmissionData {
  title: string;
  description: string;
}

interface ErrorSubmissionData extends BaseSubmissionData {
  errorType: 'runtime' | 'compilation' | 'logic' | 'performance' | 'security' | 'user-interface' | 'network' | 'database' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  stackTrace?: string;
  logs?: string;
  steps?: string;
  environment?: string;
  attachments?: File[];
}

interface ContextSubmissionData extends BaseSubmissionData {
  mcpServerType: 'filesystem' | 'database' | 'api' | 'tool' | 'service' | 'other';
  category: 'integration' | 'automation' | 'data-processing' | 'communication' | 'monitoring' | 'other';
  serverUrl?: string;
  configuration?: string;
  capabilities?: string[];
  // Enhanced capability fields for minting
  capabilityType?: string;
  schema?: string;
  locationHints?: string[];
  gasFeeNRN?: number;
}

interface IdeaSubmissionData extends BaseSubmissionData {
  category: 'product' | 'feature' | 'improvement' | 'research' | 'business' | 'technical' | 'other';
  targetAudience?: string;
  marketSize?: 'small' | 'medium' | 'large' | 'global';
  timeframe?: 'immediate' | 'short-term' | 'medium-term' | 'long-term';
  resources?: string;
  inspiration?: string;
}

type SubmissionType = 'error' | 'context' | 'idea';
type SubmissionData = ErrorSubmissionData | ContextSubmissionData | IdeaSubmissionData;

interface SubmissionModalProps {
  isOpen: boolean;
  type: SubmissionType;
  onClose: () => void;
  onSubmit: (data: SubmissionData) => Promise<void>;
}

export const SubmissionModal: React.FC<SubmissionModalProps> = ({
  isOpen,
  type,
  onClose,
  onSubmit
}) => {
  const [formData, setFormData] = useState<Partial<SubmissionData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'error': return <AlertTriangle className="w-6 h-6 text-red-400" />;
      case 'context': return <FileText className="w-6 h-6 text-blue-400" />;
      case 'idea': return <Lightbulb className="w-6 h-6 text-yellow-400" />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'error': return 'Submit Error for Skill Training';
      case 'context': return 'Submit Context for Capability Mapping';
      case 'idea': return 'Submit Idea for Property Development';
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title?.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description?.trim()) {
      newErrors.description = 'Description is required';
    }

    if (type === 'error') {
      const errorData = formData as ErrorSubmissionData;
      if (!errorData.errorType) {
        newErrors.errorType = 'Error type is required';
      }
      if (!errorData.severity) {
        newErrors.severity = 'Severity is required';
      }
    }

    if (type === 'context') {
      const contextData = formData as ContextSubmissionData;
      if (!contextData.mcpServerType) {
        newErrors.mcpServerType = 'MCP server type is required';
      }
      if (!contextData.category) {
        newErrors.category = 'Category is required';
      }
    }

    if (type === 'idea') {
      const ideaData = formData as IdeaSubmissionData;
      if (!ideaData.category) {
        newErrors.category = 'Category is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData as SubmissionData);
      onClose();
      setFormData({});
      setErrors({});
    } catch (error) {
      console.error('Submission failed:', error);
      setErrors({ submit: 'Failed to submit. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const renderErrorForm = () => {
    const errorData = formData as ErrorSubmissionData;
    return (
      <>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Error Type *
            </label>
            <select
              value={errorData.errorType || ''}
              onChange={(e) => updateFormData('errorType', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select error type</option>
              <option value="runtime">Runtime Error</option>
              <option value="compilation">Compilation Error</option>
              <option value="logic">Logic Error</option>
              <option value="performance">Performance Issue</option>
              <option value="security">Security Vulnerability</option>
              <option value="user-interface">UI/UX Issue</option>
              <option value="network">Network Error</option>
              <option value="database">Database Error</option>
              <option value="other">Other</option>
            </select>
            {errors.errorType && <p className="text-red-400 text-sm mt-1">{errors.errorType}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Severity *
            </label>
            <select
              value={errorData.severity || ''}
              onChange={(e) => updateFormData('severity', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select severity</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            {errors.severity && <p className="text-red-400 text-sm mt-1">{errors.severity}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Stack Trace
          </label>
          <textarea
            value={errorData.stackTrace || ''}
            onChange={(e) => updateFormData('stackTrace', e.target.value)}
            placeholder="Paste stack trace here..."
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 h-24 font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Logs
          </label>
          <textarea
            value={errorData.logs || ''}
            onChange={(e) => updateFormData('logs', e.target.value)}
            placeholder="Relevant log entries..."
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 h-24 font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Steps to Reproduce
          </label>
          <textarea
            value={errorData.steps || ''}
            onChange={(e) => updateFormData('steps', e.target.value)}
            placeholder="1. Step one&#10;2. Step two&#10;3. Error occurs"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 h-20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Environment
          </label>
          <input
            type="text"
            value={errorData.environment || ''}
            onChange={(e) => updateFormData('environment', e.target.value)}
            placeholder="OS, browser, version, etc."
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </>
    );
  };

  const renderContextForm = () => {
    const contextData = formData as ContextSubmissionData;
    return (
      <>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              MCP Server Type *
            </label>
            <select
              value={contextData.mcpServerType || ''}
              onChange={(e) => updateFormData('mcpServerType', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select server type</option>
              <option value="filesystem">Filesystem</option>
              <option value="database">Database</option>
              <option value="api">API Service</option>
              <option value="tool">Development Tool</option>
              <option value="service">External Service</option>
              <option value="other">Other</option>
            </select>
            {errors.mcpServerType && <p className="text-red-400 text-sm mt-1">{errors.mcpServerType}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Category *
            </label>
            <select
              value={contextData.category || ''}
              onChange={(e) => updateFormData('category', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select category</option>
              <option value="integration">Integration</option>
              <option value="automation">Automation</option>
              <option value="data-processing">Data Processing</option>
              <option value="communication">Communication</option>
              <option value="monitoring">Monitoring</option>
              <option value="other">Other</option>
            </select>
            {errors.category && <p className="text-red-400 text-sm mt-1">{errors.category}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            MCP Server URL *
          </label>
          <input
            type="url"
            value={contextData.serverUrl || ''}
            onChange={(e) => updateFormData('serverUrl', e.target.value)}
            placeholder="https://mcp-server.example.com"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">URL of the MCP server to connect to for this capability</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Capability Type
            </label>
            <input
              type="text"
              value={contextData.capabilityType || ''}
              onChange={(e) => updateFormData('capabilityType', e.target.value)}
              placeholder="e.g., file-operations, data-analysis"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Gas Fee (NRN)
            </label>
            <input
              type="number"
              value={contextData.gasFeeNRN || ''}
              onChange={(e) => updateFormData('gasFeeNRN', parseFloat(e.target.value) || 0)}
              placeholder="0.1"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Capability Schema
          </label>
          <textarea
            value={contextData.schema || ''}
            onChange={(e) => updateFormData('schema', e.target.value)}
            placeholder="JSON schema defining the capability interface..."
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 h-24 font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Location Hints
          </label>
          <input
            type="text"
            value={contextData.locationHints?.join(', ') || ''}
            onChange={(e) => updateFormData('locationHints', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            placeholder="local, cloud, edge (comma-separated)"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Configuration
          </label>
          <textarea
            value={contextData.configuration || ''}
            onChange={(e) => updateFormData('configuration', e.target.value)}
            placeholder="Configuration details, API keys, connection strings..."
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 h-24"
          />
        </div>
      </>
    );
  };

  const renderIdeaForm = () => {
    const ideaData = formData as IdeaSubmissionData;
    return (
      <>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Category *
            </label>
            <select
              value={ideaData.category || ''}
              onChange={(e) => updateFormData('category', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select category</option>
              <option value="product">Product</option>
              <option value="feature">Feature</option>
              <option value="improvement">Improvement</option>
              <option value="research">Research</option>
              <option value="business">Business</option>
              <option value="technical">Technical</option>
              <option value="other">Other</option>
            </select>
            {errors.category && <p className="text-red-400 text-sm mt-1">{errors.category}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Market Size
            </label>
            <select
              value={ideaData.marketSize || ''}
              onChange={(e) => updateFormData('marketSize', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select market size</option>
              <option value="small">Small/Niche</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="global">Global</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Target Audience
          </label>
          <input
            type="text"
            value={ideaData.targetAudience || ''}
            onChange={(e) => updateFormData('targetAudience', e.target.value)}
            placeholder="Who would use this?"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Timeframe
            </label>
            <select
              value={ideaData.timeframe || ''}
              onChange={(e) => updateFormData('timeframe', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select timeframe</option>
              <option value="immediate">Immediate (1-3 months)</option>
              <option value="short-term">Short-term (3-6 months)</option>
              <option value="medium-term">Medium-term (6-12 months)</option>
              <option value="long-term">Long-term (1+ years)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Resources Needed
            </label>
            <input
              type="text"
              value={ideaData.resources || ''}
              onChange={(e) => updateFormData('resources', e.target.value)}
              placeholder="Team size, budget, tools..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Inspiration/References
          </label>
          <textarea
            value={ideaData.inspiration || ''}
            onChange={(e) => updateFormData('inspiration', e.target.value)}
            placeholder="Similar products, research papers, articles..."
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 h-20"
          />
        </div>
      </>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            {getIcon()}
            <h2 className="text-xl font-bold text-white">{getTitle()}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Common Fields */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) => updateFormData('title', e.target.value)}
              placeholder={`Brief ${type} title`}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
            />
            {errors.title && <p className="text-red-400 text-sm mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description *
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => updateFormData('description', e.target.value)}
              placeholder={`Detailed description of the ${type}`}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 h-24"
            />
            {errors.description && <p className="text-red-400 text-sm mt-1">{errors.description}</p>}
          </div>

          {/* Type-specific Fields */}
          {type === 'error' && renderErrorForm()}
          {type === 'context' && renderContextForm()}
          {type === 'idea' && renderIdeaForm()}

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm">{errors.submit}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {isSubmitting ? 'Submitting...' : `Submit ${type.charAt(0).toUpperCase() + type.slice(1)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export type { SubmissionData, ErrorSubmissionData, ContextSubmissionData, IdeaSubmissionData };
