import React, { useState, useEffect } from 'react';
import { 
  Plug, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Check, 
  RefreshCw, 
  ExternalLink, 
  Key, 
  ShieldCheck, 
  Clock, 
  Server, 
  Mail, 
  Instagram, 
  MessageCircle, 
  PhoneCall, 
  Linkedin, 
  Github, 
  Search, 
  Cpu,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const PROVIDER_ICONS = {
  llm_core: Cpu,
  email_service: Mail,
  instagram_meta: Instagram,
  whatsapp_business: MessageCircle,
  telephony_calling: PhoneCall,
  linkedin_oauth: Linkedin,
  github_integration: Github,
  web_search: Search
};

export default function IntegrationsHubPage({ onNavigate = () => {} }) {
  const [integrations, setIntegrations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState({});
  const [testingId, setTestingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const fetchIntegrations = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/platform/integrations/status');
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleTestConnection = async (providerId) => {
    setTestingId(providerId);
    try {
      const res = await fetch('/api/platform/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: providerId })
      });

      if (res.ok) {
        const result = await res.json();
        setTestResults(prev => ({ ...prev, [providerId]: result }));
      }
    } catch (e) {
      setTestResults(prev => ({
        ...prev,
        [providerId]: { status: 'error', details: e.message || 'Connection test failed' }
      }));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-blue-950/40 border border-white/10 shadow-2xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Plug className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-white">
              Central <span className="text-cyan-400">Integrations Hub</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              8 Provider Adapters
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Real-time connection telemetry, health checks, and API credential diagnostics across the multi-agent ecosystem.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('help')}
            className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 mt-1 font-medium"
          >
            <span>Learn how to use this feature</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <button
          type="button"
          onClick={fetchIntegrations}
          className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh All</span>
        </button>
      </div>

      {/* 8 Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((item) => {
          const Icon = PROVIDER_ICONS[item.id] || Server;
          const testRes = testResults[item.id];
          const isTesting = testingId === item.id;
          const isExpanded = expandedId === item.id;

          return (
            <div 
              key={item.id} 
              className={`p-5 rounded-2xl bg-slate-900/60 border transition-all space-y-4 ${
                item.is_configured 
                  ? 'border-white/10 hover:border-cyan-500/40' 
                  : 'border-white/5 hover:border-amber-500/30'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${
                    item.is_configured 
                      ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' 
                      : 'bg-white/5 text-slate-400 border-white/10'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>{item.name}</span>
                    </h3>
                    <span className="text-[10px] font-mono uppercase text-slate-400">
                      {item.category}
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase border ${
                  item.is_configured
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}>
                  {item.status}
                </span>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-300 leading-relaxed">
                {item.description}
              </p>

              {/* Required Keys Checklist */}
              {item.required_keys && item.required_keys.length > 0 && (
                <div className="space-y-1 text-[11px]">
                  <span className="text-slate-400 font-medium">Environment Keys:</span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {item.required_keys.map((k, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-white/10 font-mono text-[10px]">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Test Result Box */}
              {testRes && (
                <div className={`p-3 rounded-xl border text-xs space-y-1.5 font-mono ${
                  testRes.status === 'ok'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : testRes.status === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider">{testRes.status}:</span>
                    {testRes.latency_ms && <span>{testRes.latency_ms} ms</span>}
                  </div>
                  <div className="text-[11px] font-sans text-slate-200">{testRes.details}</div>
                  {testRes.advice && (
                    <div className="text-[10px] text-amber-200 italic font-sans pt-1 border-t border-white/5">
                      Advice: {testRes.advice}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <span>{isExpanded ? 'Hide Guide' : 'Setup Guide'}</span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleTestConnection(item.id)}
                  disabled={isTesting}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                </button>
              </div>

              {/* Expanded Guide */}
              {isExpanded && (
                <div className="pt-3 border-t border-white/5 text-xs text-slate-300 space-y-2">
                  <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-1.5 font-mono text-[11px]">
                    <div className="text-cyan-300 font-semibold font-sans">Configuration Steps:</div>
                    <div>1. Obtain credentials from provider portal.</div>
                    <div>2. Add keys to host environment (.env).</div>
                    <div>3. Click "Test Connection" to verify latency.</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
