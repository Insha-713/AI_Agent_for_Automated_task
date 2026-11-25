import React, { useState, useEffect } from 'react';
import { 
  Plug, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink, 
  Key, 
  ShieldCheck, 
  Mail, 
  Instagram, 
  MessageCircle, 
  PhoneCall, 
  Linkedin, 
  Cpu, 
  Send,
  Eye,
  EyeOff,
  Trash2,
  Save,
  Check,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Database,
  ArrowRight
} from 'lucide-react';

const CATEGORY_TABS = [
  { id: 'all', label: 'All Connections' },
  { id: 'social_media', label: 'Social Media', desc: 'LinkedIn, Instagram' },
  { id: 'messaging', label: 'Messaging', desc: 'WhatsApp, Telegram' },
  { id: 'communication', label: 'Communication', desc: 'Email, AI Calling' },
  { id: 'ai_providers', label: 'AI Providers', desc: 'LLM, Image Engine' }
];

export default function ConnectionsPage({ onNavigate = () => {} }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [connectionsData, setConnectionsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Per-service editable form state
  const [formValues, setFormValues] = useState({});
  const [showSecret, setShowSecret] = useState({});
  const [testResults, setTestResults] = useState({});
  const [isTesting, setIsTesting] = useState({});
  const [isSaving, setIsSaving] = useState({});
  const [expandedCards, setExpandedCards] = useState({});
  const [toastMessage, setToastMessage] = useState(null);
  const [isPurging, setIsPurging] = useState(false);

  const showToast = (msg, isErr = false) => {
    setToastMessage({ text: msg, isErr });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchConnections = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/platform/connections');
      if (res.ok) {
        const data = await res.json();
        setConnectionsData(data.connections || {});
        
        // Initialize editable form values from fetched data
        const initial = {};
        const expanded = {};
        if (data.connections) {
          Object.entries(data.connections).forEach(([catKey, services]) => {
            Object.entries(services).forEach(([sKey, sVal]) => {
              expanded[sKey] = true; // Expanded by default for direct visibility
              initial[`${sKey}_token`] = '';
              if (sKey === 'linkedin') {
                initial.LINKEDIN_AUTHOR_URN = sVal.author_urn || '';
                initial.LINKEDIN_CLIENT_ID = sVal.client_id || '';
                initial.LINKEDIN_ACCESS_TOKEN = sVal.masked_access_token || '';
              } else if (sKey === 'instagram') {
                initial.INSTAGRAM_ACCOUNT_ID = sVal.account_id || '';
                initial.META_APP_ID = sVal.app_id || '';
                initial.INSTAGRAM_ACCESS_TOKEN = sVal.masked_access_token || '';
                initial.INSTAGRAM_CALLBACK_URL = sVal.callback_url || '/api/webhooks/instagram';
                initial.INSTAGRAM_WEBHOOK_VERIFY_TOKEN = sVal.verify_token || 'agentflow_v3_instagram_token';
              } else if (sKey === 'whatsapp') {
                initial.WHATSAPP_PHONE_NUMBER_ID = sVal.phone_number_id || '';
                initial.WHATSAPP_WABA_ID = sVal.waba_id || '';
                initial.WHATSAPP_ACCESS_TOKEN = sVal.masked_access_token || '';
                initial.WHATSAPP_CALLBACK_URL = sVal.callback_url || '/api/webhooks/whatsapp';
                initial.WHATSAPP_VERIFY_TOKEN = sVal.verify_token || 'agentflow_v3_whatsapp_token';
              } else if (sKey === 'telegram') {
                initial.TELEGRAM_CHAT_ID = sVal.chat_id || '';
                initial.TELEGRAM_BOT_TOKEN = sVal.masked_bot_token || '';
              } else if (sKey === 'email') {
                initial.EMAIL_PROVIDER = sVal.provider || 'smtp';
                initial.EMAIL_USER = sVal.email_user || '';
                initial.EMAIL_PASS = sVal.masked_password || '';
                initial.SMTP_HOST = sVal.smtp_host || 'smtp.gmail.com';
                initial.SMTP_PORT = sVal.smtp_port || '587';
                initial.IMAP_HOST = sVal.imap_host || 'imap.gmail.com';
                initial.IMAP_PORT = sVal.imap_port || '993';
                initial.RESEND_API_KEY = sVal.masked_resend_key || '';
                initial.BREVO_API_KEY = sVal.masked_brevo_key || '';
              } else if (sKey === 'calling') {
                initial.TWILIO_PHONE_NUMBER = sVal.phone_number || '';
                initial.TWILIO_ACCOUNT_SID = sVal.account_sid || '';
                initial.TWILIO_AUTH_TOKEN = sVal.masked_auth_token || '';
                initial.INCOMING_VOICE_WEBHOOK_URL = sVal.webhook_url || '/api/webhooks/voice/incoming';
                initial.VOICE_GREETING_MESSAGE = sVal.greeting_message || '';
              } else if (sKey === 'llm') {
                initial.LLM_PROVIDER = sVal.provider || 'ollama';
                initial.LLM_MODEL = sVal.model || 'qwen2.5:latest';
                initial.OLLAMA_BASE_URL = sVal.ollama_url || 'http://127.0.0.1:11434';
                initial.GROQ_API_KEY = sVal.masked_groq_key || '';
                initial.GEMINI_API_KEY = sVal.masked_gemini_key || '';
                initial.OPENAI_API_KEY = sVal.masked_openai_key || '';
              } else if (sKey === 'image_gen') {
                initial.IMAGE_GEN_PROVIDER = sVal.provider || 'pollinations';
                initial.HUGGINGFACE_API_KEY = sVal.masked_hf_key || '';
                initial.STABILITY_API_KEY = sVal.masked_stability_key || '';
              }
            });
          });
        }
        setFormValues(initial);
        setExpandedCards(expanded);
      }
    } catch (e) {
      console.error('Failed to load connections', e);
      showToast('Error loading connections summary', true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleInputChange = (key, val) => {
    setFormValues(prev => ({ ...prev, [key]: val }));
  };

  const toggleShowSecret = (fieldKey) => {
    setShowSecret(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const handleSaveCredentials = async (serviceId, keysToSave) => {
    setIsSaving(prev => ({ ...prev, [serviceId]: true }));
    try {
      const payload = {};
      keysToSave.forEach(k => {
        const val = formValues[k];
        if (val !== undefined && val !== null && !String(val).startsWith('••••')) {
          payload[k] = val;
        }
      });

      const res = await fetch('/api/platform/connections/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(`Saved credentials for ${serviceId.toUpperCase()}`);
        await fetchConnections();
      } else {
        showToast('Failed to save credentials', true);
      }
    } catch (e) {
      showToast(e.message || 'Error saving credentials', true);
    } finally {
      setIsSaving(prev => ({ ...prev, [serviceId]: false }));
    }
  };

  const handleTestConnection = async (serviceId) => {
    setIsTesting(prev => ({ ...prev, [serviceId]: true }));
    setTestResults(prev => ({ ...prev, [serviceId]: null }));
    try {
      const payload = { service_id: serviceId };
      if (serviceId === 'linkedin') {
        payload.token = formValues.LINKEDIN_ACCESS_TOKEN;
        payload.author_urn = formValues.LINKEDIN_AUTHOR_URN;
      } else if (serviceId === 'instagram') {
        payload.token = formValues.INSTAGRAM_ACCESS_TOKEN;
        payload.account_id = formValues.INSTAGRAM_ACCOUNT_ID;
      } else if (serviceId === 'whatsapp') {
        payload.token = formValues.WHATSAPP_ACCESS_TOKEN;
        payload.phone_id = formValues.WHATSAPP_PHONE_NUMBER_ID;
      } else if (serviceId === 'calling') {
        payload.account_sid = formValues.TWILIO_ACCOUNT_SID;
        payload.auth_token = formValues.TWILIO_AUTH_TOKEN;
        payload.phone_number = formValues.TWILIO_PHONE_NUMBER;
      } else if (serviceId === 'email') {
        payload.provider = formValues.EMAIL_PROVIDER || 'smtp';
      } else if (serviceId === 'telegram') {
        payload.token = formValues.TELEGRAM_BOT_TOKEN;
      } else if (serviceId === 'llm') {
        payload.provider = formValues.LLM_PROVIDER || 'ollama';
        if (payload.provider === 'groq') payload.api_key = formValues.GROQ_API_KEY;
        if (payload.provider === 'gemini') payload.api_key = formValues.GEMINI_API_KEY;
        if (payload.provider === 'openai') payload.api_key = formValues.OPENAI_API_KEY;
      }

      const res = await fetch('/api/platform/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setTestResults(prev => ({ ...prev, [serviceId]: data }));
      if (data.success) {
        showToast(`Connection to ${serviceId.toUpperCase()} verified!`);
      } else {
        showToast(data.message || 'Connection test failed', true);
      }
    } catch (e) {
      setTestResults(prev => ({
        ...prev,
        [serviceId]: { success: false, message: e.message || 'Connection test failed' }
      }));
      showToast('Connection test error', true);
    } finally {
      setIsTesting(prev => ({ ...prev, [serviceId]: false }));
    }
  };

  const handleDisconnect = async (serviceId) => {
    if (!window.confirm(`Are you sure you want to disconnect ${serviceId.toUpperCase()} and remove its credentials?`)) {
      return;
    }
    try {
      const res = await fetch('/api/platform/connections/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: serviceId })
      });
      if (res.ok) {
        showToast(`Disconnected ${serviceId.toUpperCase()}`);
        setTestResults(prev => ({ ...prev, [serviceId]: null }));
        await fetchConnections();
      }
    } catch (e) {
      showToast('Failed to disconnect', true);
    }
  };

  const handlePurgeDemoData = async () => {
    if (!window.confirm("Purge all demo/test call records, mock WhatsApp messages, and fake interactions to start with a 100% clean slate?")) {
      return;
    }
    setIsPurging(true);
    try {
      const res = await fetch('/api/platform/data/clear-demo', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        showToast("Database sanitized! All test calls and mock data permanently cleared.");
        await fetchConnections();
      }
    } catch (e) {
      showToast("Purge failed: " + e.message, true);
    } finally {
      setIsPurging(false);
    }
  };

  // Helper to render status badge
  const renderStatusBadge = (status, configured) => {
    if (status === 'connected' || configured) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Connected</span>
        </span>
      );
    }
    if (status === 'configuration_required') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>Config Required</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/15 text-slate-300 border border-slate-500/30">
        <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
        <span>Not Connected</span>
      </span>
    );
  };

  // Filter items by category
  const categoriesToShow = activeCategory === 'all' 
    ? ['social_media', 'messaging', 'communication', 'ai_providers']
    : [activeCategory];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border text-xs font-medium shadow-2xl backdrop-blur-md transition-all ${
          toastMessage.isErr 
            ? 'bg-rose-950/90 border-rose-500/40 text-rose-200' 
            : 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
        }`}>
          {toastMessage.text}
        </div>
      )}

      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-blue-950/40 border border-white/10 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Plug className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold font-display text-white">
                Connections &amp; <span className="text-cyan-400">Setup Wizard</span>
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Centralized v4.1
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Configure credentials once. All specialized agents automatically inherit and verify connections across Social Media, Messaging, Communication, and AI Providers.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchConnections}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
            <button
              type="button"
              onClick={handlePurgeDemoData}
              disabled={isPurging}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all"
              title="Purges all test calls, mock chats, and hardcoded repos"
            >
              <Database className="w-3.5 h-3.5 text-rose-400" />
              <span>{isPurging ? 'Purging...' : 'Clean Test Data'}</span>
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-white/10">
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeCategory === tab.id
                  ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Categories and Integration Cards */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
          <p className="text-xs">Loading integration adapters &amp; verified statuses...</p>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* ============================================================== */}
          {/* 1. SOCIAL MEDIA */}
          {/* ============================================================== */}
          {categoriesToShow.includes('social_media') && connectionsData?.social_media && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 font-display">
                  1. Social Media Integrations
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* LinkedIn Card */}
                {connectionsData.social_media.linkedin && (
                  <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          <Linkedin className="w-5 h-5" />
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-white">LinkedIn Official API</h3>
                          <p className="text-[11px] text-slate-400">Thought leadership publishing &amp; automated post creator</p>
                        </div>
                      </div>
                      {renderStatusBadge(connectionsData.social_media.linkedin.status, connectionsData.social_media.linkedin.configured)}
                    </div>

                    <p className="text-xs text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5">
                      {connectionsData.social_media.linkedin.instructions}
                    </p>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Author URN (Person or Organization)
                        </label>
                        <input
                          type="text"
                          placeholder="urn:li:person:abcdef123 or urn:li:organization:987654"
                          value={formValues.LINKEDIN_AUTHOR_URN || ''}
                          onChange={(e) => handleInputChange('LINKEDIN_AUTHOR_URN', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-slate-400">
                            LinkedIn Access Token (with w_member_social scope)
                          </label>
                          <button
                            type="button"
                            onClick={() => toggleShowSecret('linkedin_token')}
                            className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                          >
                            {showSecret.linkedin_token ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{showSecret.linkedin_token ? 'Hide' : 'Show'}</span>
                          </button>
                        </div>
                        <input
                          type={showSecret.linkedin_token ? 'text' : 'password'}
                          placeholder="AQV..."
                          value={formValues.LINKEDIN_ACCESS_TOKEN || ''}
                          onChange={(e) => handleInputChange('LINKEDIN_ACCESS_TOKEN', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      {/* Test Result Message */}
                      {testResults.linkedin && (
                        <div className={`p-2.5 rounded-xl text-[11px] font-medium border ${
                          testResults.linkedin.success 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}>
                          {testResults.linkedin.message}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <button
                          type="button"
                          onClick={() => handleDisconnect('linkedin')}
                          className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Clear</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTestConnection('linkedin')}
                            disabled={isTesting.linkedin}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 transition-all flex items-center gap-1.5"
                          >
                            {isTesting.linkedin && <RefreshCw className="w-3 h-3 animate-spin" />}
                            <span>Test Connection</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveCredentials('linkedin', ['LINKEDIN_AUTHOR_URN', 'LINKEDIN_ACCESS_TOKEN'])}
                            disabled={isSaving.linkedin}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-slate-950 transition-all flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Instagram Card */}
                {connectionsData.social_media.instagram && (
                  <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="p-2.5 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
                          <Instagram className="w-5 h-5" />
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-white">Instagram / Meta Graph API</h3>
                          <p className="text-[11px] text-slate-400">Automated Comment-to-DM responder &amp; media engine</p>
                        </div>
                      </div>
                      {renderStatusBadge(connectionsData.social_media.instagram.status, connectionsData.social_media.instagram.configured)}
                    </div>

                    <p className="text-xs text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5">
                      {connectionsData.social_media.instagram.instructions}
                    </p>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Instagram Professional Account ID
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 17841400000000000"
                          value={formValues.INSTAGRAM_ACCOUNT_ID || ''}
                          onChange={(e) => handleInputChange('INSTAGRAM_ACCOUNT_ID', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-pink-500"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-slate-400">
                            Meta User/Page Access Token
                          </label>
                          <button
                            type="button"
                            onClick={() => toggleShowSecret('instagram_token')}
                            className="text-[10px] text-pink-400 hover:underline flex items-center gap-1"
                          >
                            {showSecret.instagram_token ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{showSecret.instagram_token ? 'Hide' : 'Show'}</span>
                          </button>
                        </div>
                        <input
                          type={showSecret.instagram_token ? 'text' : 'password'}
                          placeholder="EAA..."
                          value={formValues.INSTAGRAM_ACCESS_TOKEN || ''}
                          onChange={(e) => handleInputChange('INSTAGRAM_ACCESS_TOKEN', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-pink-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-medium text-slate-400 mb-1">Callback URL</label>
                          <input
                            type="text"
                            value={formValues.INSTAGRAM_CALLBACK_URL || '/api/webhooks/instagram'}
                            onChange={(e) => handleInputChange('INSTAGRAM_CALLBACK_URL', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg text-[11px] bg-slate-900 border border-white/10 text-slate-300 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-400 mb-1">Verify Token</label>
                          <input
                            type="text"
                            value={formValues.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || 'agentflow_v3_instagram_token'}
                            onChange={(e) => handleInputChange('INSTAGRAM_WEBHOOK_VERIFY_TOKEN', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg text-[11px] bg-slate-900 border border-white/10 text-slate-300 font-mono"
                          />
                        </div>
                      </div>

                      {/* Test Result Message */}
                      {testResults.instagram && (
                        <div className={`p-2.5 rounded-xl text-[11px] font-medium border ${
                          testResults.instagram.success 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}>
                          {testResults.instagram.message}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <button
                          type="button"
                          onClick={() => handleDisconnect('instagram')}
                          className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Clear</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTestConnection('instagram')}
                            disabled={isTesting.instagram}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 border border-pink-500/30 transition-all flex items-center gap-1.5"
                          >
                            {isTesting.instagram && <RefreshCw className="w-3 h-3 animate-spin" />}
                            <span>Test Connection</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveCredentials('instagram', ['INSTAGRAM_ACCOUNT_ID', 'INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_CALLBACK_URL', 'INSTAGRAM_WEBHOOK_VERIFY_TOKEN'])}
                            disabled={isSaving.instagram}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-pink-500 hover:bg-pink-400 text-slate-950 transition-all flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* 2. MESSAGING */}
          {/* ============================================================== */}
          {categoriesToShow.includes('messaging') && connectionsData?.messaging && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 font-display">
                  2. Messaging Integrations
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* WhatsApp Card */}
                {connectionsData.messaging.whatsapp && (
                  <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <MessageCircle className="w-5 h-5" />
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-white">WhatsApp Business Cloud API</h3>
                          <p className="text-[11px] text-slate-400">24/7 keyword auto-responder &amp; verified delivery</p>
                        </div>
                      </div>
                      {renderStatusBadge(connectionsData.messaging.whatsapp.status, connectionsData.messaging.whatsapp.configured)}
                    </div>

                    <p className="text-xs text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5">
                      {connectionsData.messaging.whatsapp.instructions}
                    </p>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          WhatsApp Phone Number ID
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 104592039485721"
                          value={formValues.WHATSAPP_PHONE_NUMBER_ID || ''}
                          onChange={(e) => handleInputChange('WHATSAPP_PHONE_NUMBER_ID', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-slate-400">
                            System Access Token
                          </label>
                          <button
                            type="button"
                            onClick={() => toggleShowSecret('whatsapp_token')}
                            className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            {showSecret.whatsapp_token ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{showSecret.whatsapp_token ? 'Hide' : 'Show'}</span>
                          </button>
                        </div>
                        <input
                          type={showSecret.whatsapp_token ? 'text' : 'password'}
                          placeholder="EAA..."
                          value={formValues.WHATSAPP_ACCESS_TOKEN || ''}
                          onChange={(e) => handleInputChange('WHATSAPP_ACCESS_TOKEN', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-medium text-slate-400 mb-1">Callback URL</label>
                          <input
                            type="text"
                            value={formValues.WHATSAPP_CALLBACK_URL || '/api/webhooks/whatsapp'}
                            onChange={(e) => handleInputChange('WHATSAPP_CALLBACK_URL', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg text-[11px] bg-slate-900 border border-white/10 text-slate-300 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-400 mb-1">Verify Token</label>
                          <input
                            type="text"
                            value={formValues.WHATSAPP_VERIFY_TOKEN || 'agentflow_v3_whatsapp_token'}
                            onChange={(e) => handleInputChange('WHATSAPP_VERIFY_TOKEN', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg text-[11px] bg-slate-900 border border-white/10 text-slate-300 font-mono"
                          />
                        </div>
                      </div>

                      {/* Test Result Message */}
                      {testResults.whatsapp && (
                        <div className={`p-2.5 rounded-xl text-[11px] font-medium border ${
                          testResults.whatsapp.success 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}>
                          {testResults.whatsapp.message}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <button
                          type="button"
                          onClick={() => handleDisconnect('whatsapp')}
                          className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Clear</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTestConnection('whatsapp')}
                            disabled={isTesting.whatsapp}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all flex items-center gap-1.5"
                          >
                            {isTesting.whatsapp && <RefreshCw className="w-3 h-3 animate-spin" />}
                            <span>Test Connection</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveCredentials('whatsapp', ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_CALLBACK_URL', 'WHATSAPP_VERIFY_TOKEN'])}
                            disabled={isSaving.whatsapp}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Telegram Card */}
                {connectionsData.messaging.telegram && (
                  <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                          <Send className="w-5 h-5" />
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-white">Telegram Bot Alerts</h3>
                          <p className="text-[11px] text-slate-400">High-priority call summaries, job matches &amp; system alerts</p>
                        </div>
                      </div>
                      {renderStatusBadge(connectionsData.messaging.telegram.status, connectionsData.messaging.telegram.configured)}
                    </div>

                    <p className="text-xs text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5">
                      {connectionsData.messaging.telegram.instructions}
                    </p>

                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-slate-400">
                            Telegram Bot Token
                          </label>
                          <button
                            type="button"
                            onClick={() => toggleShowSecret('telegram_token')}
                            className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
                          >
                            {showSecret.telegram_token ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{showSecret.telegram_token ? 'Hide' : 'Show'}</span>
                          </button>
                        </div>
                        <input
                          type={showSecret.telegram_token ? 'text' : 'password'}
                          placeholder="123456789:AA..."
                          value={formValues.TELEGRAM_BOT_TOKEN || ''}
                          onChange={(e) => handleInputChange('TELEGRAM_BOT_TOKEN', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Telegram Chat ID
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 12345678"
                          value={formValues.TELEGRAM_CHAT_ID || ''}
                          onChange={(e) => handleInputChange('TELEGRAM_CHAT_ID', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      {/* Test Result Message */}
                      {testResults.telegram && (
                        <div className={`p-2.5 rounded-xl text-[11px] font-medium border ${
                          testResults.telegram.success 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}>
                          {testResults.telegram.message}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <button
                          type="button"
                          onClick={() => handleDisconnect('telegram')}
                          className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Clear</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTestConnection('telegram')}
                            disabled={isTesting.telegram}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition-all flex items-center gap-1.5"
                          >
                            {isTesting.telegram && <RefreshCw className="w-3 h-3 animate-spin" />}
                            <span>Test Connection</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveCredentials('telegram', ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'])}
                            disabled={isSaving.telegram}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* 3. COMMUNICATION */}
          {/* ============================================================== */}
          {categoriesToShow.includes('communication') && connectionsData?.communication && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 font-display">
                  3. Communication &amp; Telephony Integrations
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Email Integration Card */}
                {connectionsData.communication.email && (
                  <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="p-2.5 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
                          <Mail className="w-5 h-5" />
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-white">Email (Gmail / SMTP / IMAP / Resend / Brevo)</h3>
                          <p className="text-[11px] text-slate-400">Live inbox reading, AI draft replies &amp; email delivery</p>
                        </div>
                      </div>
                      {renderStatusBadge(connectionsData.communication.email.status, connectionsData.communication.email.configured)}
                    </div>

                    <p className="text-xs text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5">
                      {connectionsData.communication.email.instructions}
                    </p>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">Provider Engine</label>
                        <select
                          value={formValues.EMAIL_PROVIDER || 'smtp'}
                          onChange={(e) => handleInputChange('EMAIL_PROVIDER', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                        >
                          <option value="smtp">Gmail / Custom SMTP &amp; IMAP</option>
                          <option value="resend">Resend API</option>
                          <option value="brevo">Brevo API</option>
                        </select>
                      </div>

                      {formValues.EMAIL_PROVIDER === 'smtp' ? (
                        <>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-400 mb-1">Email Address</label>
                            <input
                              type="email"
                              placeholder="you@gmail.com"
                              value={formValues.EMAIL_USER || ''}
                              onChange={(e) => handleInputChange('EMAIL_USER', e.target.value)}
                              className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-medium text-slate-400">Google App Password (16 chars)</label>
                              <button
                                type="button"
                                onClick={() => toggleShowSecret('email_pass')}
                                className="text-[10px] text-violet-400 hover:underline flex items-center gap-1"
                              >
                                {showSecret.email_pass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                <span>{showSecret.email_pass ? 'Hide' : 'Show'}</span>
                              </button>
                            </div>
                            <input
                              type={showSecret.email_pass ? 'text' : 'password'}
                              placeholder="abcd efgh ijkl mnop"
                              value={formValues.EMAIL_PASS || ''}
                              onChange={(e) => handleInputChange('EMAIL_PASS', e.target.value)}
                              className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-violet-500"
                            />
                          </div>
                        </>
                      ) : formValues.EMAIL_PROVIDER === 'resend' ? (
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">Resend API Key</label>
                          <input
                            type="password"
                            placeholder="re_..."
                            value={formValues.RESEND_API_KEY || ''}
                            onChange={(e) => handleInputChange('RESEND_API_KEY', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-violet-500"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">Brevo API Key</label>
                          <input
                            type="password"
                            placeholder="xkeysib-..."
                            value={formValues.BREVO_API_KEY || ''}
                            onChange={(e) => handleInputChange('BREVO_API_KEY', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-violet-500"
                          />
                        </div>
                      )}

                      {/* Test Result Message */}
                      {testResults.email && (
                        <div className={`p-2.5 rounded-xl text-[11px] font-medium border ${
                          testResults.email.success 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}>
                          {testResults.email.message}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <button
                          type="button"
                          onClick={() => handleDisconnect('email')}
                          className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Clear</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTestConnection('email')}
                            disabled={isTesting.email}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/30 transition-all flex items-center gap-1.5"
                          >
                            {isTesting.email && <RefreshCw className="w-3 h-3 animate-spin" />}
                            <span>Test Connection</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveCredentials('email', ['EMAIL_PROVIDER', 'EMAIL_USER', 'EMAIL_PASS', 'RESEND_API_KEY', 'BREVO_API_KEY'])}
                            disabled={isSaving.email}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-violet-500 hover:bg-violet-400 text-slate-950 transition-all flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Calling / Telephony Card */}
                {connectionsData.communication.calling && (
                  <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          <PhoneCall className="w-5 h-5" />
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-white">AI Calling / Telephony (Twilio Incoming Voice)</h3>
                          <p className="text-[11px] text-slate-400">Autonomous incoming voice receptionist with speech recognition</p>
                        </div>
                      </div>
                      {renderStatusBadge(connectionsData.communication.calling.status, connectionsData.communication.calling.configured)}
                    </div>

                    <p className="text-xs text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5">
                      {connectionsData.communication.calling.instructions}
                    </p>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">Twilio Phone Number</label>
                          <input
                            type="text"
                            placeholder="+1234567890"
                            value={formValues.TWILIO_PHONE_NUMBER || ''}
                            onChange={(e) => handleInputChange('TWILIO_PHONE_NUMBER', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">Twilio Account SID</label>
                          <input
                            type="text"
                            placeholder="AC..."
                            value={formValues.TWILIO_ACCOUNT_SID || ''}
                            onChange={(e) => handleInputChange('TWILIO_ACCOUNT_SID', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-slate-400">Twilio Auth Token</label>
                          <button
                            type="button"
                            onClick={() => toggleShowSecret('twilio_token')}
                            className="text-[10px] text-amber-400 hover:underline flex items-center gap-1"
                          >
                            {showSecret.twilio_token ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{showSecret.twilio_token ? 'Hide' : 'Show'}</span>
                          </button>
                        </div>
                        <input
                          type={showSecret.twilio_token ? 'text' : 'password'}
                          placeholder="Your Twilio Auth Token"
                          value={formValues.TWILIO_AUTH_TOKEN || ''}
                          onChange={(e) => handleInputChange('TWILIO_AUTH_TOKEN', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">Voice Greeting Message</label>
                        <textarea
                          rows={2}
                          value={formValues.VOICE_GREETING_MESSAGE || ''}
                          onChange={(e) => handleInputChange('VOICE_GREETING_MESSAGE', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-amber-500 resize-none"
                        />
                      </div>

                      {/* Test Result Message */}
                      {testResults.calling && (
                        <div className={`p-2.5 rounded-xl text-[11px] font-medium border ${
                          testResults.calling.success 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}>
                          {testResults.calling.message}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <button
                          type="button"
                          onClick={() => handleDisconnect('calling')}
                          className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Clear</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTestConnection('calling')}
                            disabled={isTesting.calling}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1.5"
                          >
                            {isTesting.calling && <RefreshCw className="w-3 h-3 animate-spin" />}
                            <span>Test Connection</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveCredentials('calling', ['TWILIO_PHONE_NUMBER', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'VOICE_GREETING_MESSAGE'])}
                            disabled={isSaving.calling}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* 4. AI PROVIDERS */}
          {/* ============================================================== */}
          {categoriesToShow.includes('ai_providers') && connectionsData?.ai_providers && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 font-display">
                  4. AI Providers (LLM &amp; Visual Generation)
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* LLM Card */}
                {connectionsData.ai_providers.llm && (
                  <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                          <Cpu className="w-5 h-5" />
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-white">LLM Intelligence Engine</h3>
                          <p className="text-[11px] text-slate-400">Powers ReAct agent, voice turns, summaries &amp; post drafting</p>
                        </div>
                      </div>
                      {renderStatusBadge('connected', true)}
                    </div>

                    <p className="text-xs text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5">
                      {connectionsData.ai_providers.llm.instructions}
                    </p>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">Active LLM Provider</label>
                        <select
                          value={formValues.LLM_PROVIDER || 'ollama'}
                          onChange={(e) => handleInputChange('LLM_PROVIDER', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
                        >
                          <option value="ollama">Ollama (Local / Privacy-First / Free)</option>
                          <option value="groq">Groq (Ultra High Speed Cloud)</option>
                          <option value="gemini">Google Gemini (Multimodal Cloud)</option>
                          <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                        </select>
                      </div>

                      {formValues.LLM_PROVIDER === 'ollama' ? (
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">Ollama Base URL</label>
                          <input
                            type="text"
                            value={formValues.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'}
                            onChange={(e) => handleInputChange('OLLAMA_BASE_URL', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      ) : formValues.LLM_PROVIDER === 'groq' ? (
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">Groq API Key</label>
                          <input
                            type="password"
                            placeholder="gsk_..."
                            value={formValues.GROQ_API_KEY || ''}
                            onChange={(e) => handleInputChange('GROQ_API_KEY', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      ) : formValues.LLM_PROVIDER === 'gemini' ? (
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">Google Gemini API Key</label>
                          <input
                            type="password"
                            placeholder="AIza..."
                            value={formValues.GEMINI_API_KEY || ''}
                            onChange={(e) => handleInputChange('GEMINI_API_KEY', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">OpenAI API Key</label>
                          <input
                            type="password"
                            placeholder="sk-proj-..."
                            value={formValues.OPENAI_API_KEY || ''}
                            onChange={(e) => handleInputChange('OPENAI_API_KEY', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      )}

                      {/* Test Result Message */}
                      {testResults.llm && (
                        <div className={`p-2.5 rounded-xl text-[11px] font-medium border ${
                          testResults.llm.success 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}>
                          {testResults.llm.message}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[11px] text-slate-400 font-mono">Engine: {formValues.LLM_PROVIDER || 'ollama'}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTestConnection('llm')}
                            disabled={isTesting.llm}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition-all flex items-center gap-1.5"
                          >
                            {isTesting.llm && <RefreshCw className="w-3 h-3 animate-spin" />}
                            <span>Test Model</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveCredentials('llm', ['LLM_PROVIDER', 'OLLAMA_BASE_URL', 'GROQ_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY'])}
                            disabled={isSaving.llm}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Image Generation Engine Card */}
                {connectionsData.ai_providers.image_gen && (
                  <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          <ImageIcon className="w-5 h-5" />
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-white">AI Image &amp; Carousel Generator</h3>
                          <p className="text-[11px] text-slate-400">Authentic image creation for LinkedIn posts &amp; multi-slide carousels</p>
                        </div>
                      </div>
                      {renderStatusBadge('connected', true)}
                    </div>

                    <p className="text-xs text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5">
                      {connectionsData.ai_providers.image_gen.instructions}
                    </p>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">Primary Image Model</label>
                        <select
                          value={formValues.IMAGE_GEN_PROVIDER || 'pollinations'}
                          onChange={(e) => handleInputChange('IMAGE_GEN_PROVIDER', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                        >
                          <option value="pollinations">Pollinations.ai (Free High-Res FLUX / SDXL, No Key Required)</option>
                          <option value="huggingface">Hugging Face Inference API</option>
                          <option value="stability">Stability AI / Stable Diffusion</option>
                        </select>
                      </div>

                      {formValues.IMAGE_GEN_PROVIDER === 'huggingface' && (
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">Hugging Face User Access Token</label>
                          <input
                            type="password"
                            placeholder="hf_..."
                            value={formValues.HUGGINGFACE_API_KEY || ''}
                            onChange={(e) => handleInputChange('HUGGINGFACE_API_KEY', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      )}

                      {formValues.IMAGE_GEN_PROVIDER === 'stability' && (
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">Stability AI API Key</label>
                          <input
                            type="password"
                            placeholder="sk-..."
                            value={formValues.STABILITY_API_KEY || ''}
                            onChange={(e) => handleInputChange('STABILITY_API_KEY', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      )}

                      {/* Test Result Message */}
                      {testResults.image_gen && (
                        <div className={`p-2.5 rounded-xl text-[11px] font-medium border ${
                          testResults.image_gen.success 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}>
                          {testResults.image_gen.message}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[11px] text-purple-300 font-mono">Format: 1:1, 16:9, 4:5 PNG</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTestConnection('image_gen')}
                            disabled={isTesting.image_gen}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 transition-all flex items-center gap-1.5"
                          >
                            {isTesting.image_gen && <RefreshCw className="w-3 h-3 animate-spin" />}
                            <span>Test Engine</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveCredentials('image_gen', ['IMAGE_GEN_PROVIDER', 'HUGGINGFACE_API_KEY', 'STABILITY_API_KEY'])}
                            disabled={isSaving.image_gen}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-500 hover:bg-purple-400 text-slate-950 transition-all flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
