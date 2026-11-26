import React, { useState, useEffect } from 'react';
import { cleanAuthorUrnInput, isValidAuthorUrn } from '../utils/authorUrn';
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
  { id: 'social_media', label: 'Social Media', desc: 'LinkedIn' },
  { id: 'messaging', label: 'Messaging', desc: 'Telegram' },
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
  const [detectingMember, setDetectingMember] = useState(false);
  const [showMemberHelp, setShowMemberHelp] = useState(false);
  const [memberDetectionResult, setMemberDetectionResult] = useState(null);

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
                initial.EXOTEL_EXOPHONE = sVal.exophone || sVal.phone_number || '';
                initial.EXOTEL_ACCOUNT_SID = sVal.account_sid || '';
                initial.EXOTEL_API_KEY = sVal.api_key || '';
                initial.EXOTEL_API_TOKEN = sVal.masked_api_token || sVal.masked_auth_token || '';
                initial.EXOTEL_SUBDOMAIN = sVal.subdomain || 'api.exotel.com';
                initial.EXOTEL_APP_ID = sVal.app_id || '';
                initial.INCOMING_VOICE_WEBHOOK_URL = sVal.webhook_url || '/api/webhooks/voice/exotel/incoming';
                initial.VOICE_GREETING_MESSAGE = sVal.greeting_message || 'Hello! Insha abhi busy hain. Aap humein bata dijiye kya kaam hai? Main aapka message un tak pahuncha dungi.';
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

  const handleAutoDetectLinkedInMember = async () => {
    setDetectingMember(true);
    setMemberDetectionResult(null);
    try {
      const res = await fetch('/api/platform/linkedin/detect-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: formValues.LINKEDIN_ACCESS_TOKEN || '' })
      });
      const data = await res.json();
      setMemberDetectionResult(data);
      if (data.success && data.author_urn) {
        const cleaned = cleanAuthorUrnInput(data.author_urn);
        handleInputChange('LINKEDIN_AUTHOR_URN', cleaned);
        showToast(`Discovered member '${data.name}' (${cleaned})!`);
      } else {
        setShowMemberHelp(true);
        if (data.status === 'scope_restricted') {
          showToast('Token verified with w_member_social; auto-detect needs OpenID Connect.', true);
        } else {
          showToast(data.message || 'Auto-detection failed', true);
        }
      }
    } catch (e) {
      showToast(e.message || 'Auto-detection error', true);
    } finally {
      setDetectingMember(false);
    }
  };

  const toggleShowSecret = (fieldKey) => {
    setShowSecret(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const isMaskedSecret = (val) => {
    if (!val) return false;
    const s = String(val);
    return s.includes('•') || s.includes('\u2022') || s.startsWith('••••');
  };

  const handleSaveCredentials = async (serviceId, keysToSave) => {
    setIsSaving(prev => ({ ...prev, [serviceId]: true }));
    try {
      const payload = {};
      keysToSave.forEach(k => {
        const val = formValues[k];
        if (val !== undefined && val !== null && !isMaskedSecret(val)) {
          payload[k] = String(val).trim();
        }
      });

      // Special validation and sanitization for LinkedIn Author URN
      if (serviceId === 'linkedin' && payload.LINKEDIN_AUTHOR_URN) {
        const cleaned = cleanAuthorUrnInput(payload.LINKEDIN_AUTHOR_URN);
        payload.LINKEDIN_AUTHOR_URN = cleaned;
        handleInputChange('LINKEDIN_AUTHOR_URN', cleaned);

        const u = cleaned.toLowerCase();
        if (u.includes('linkedin.com') || u.includes('http://') || u.includes('https://') || u.includes('/in/')) {
          showToast('Invalid Author URN: Public profile URLs cannot be used. Enter your numeric Member ID (e.g. urn:li:person:1116653996).', true);
          setShowMemberHelp(true);
          setIsSaving(prev => ({ ...prev, [serviceId]: false }));
          return;
        }

        if (!isValidAuthorUrn(cleaned)) {
          showToast(`Invalid Author URN format: "${cleaned}". Must match "^urn:li:(person|organization):[0-9]+$" with numeric ID.`, true);
          setShowMemberHelp(true);
          setIsSaving(prev => ({ ...prev, [serviceId]: false }));
          return;
        }
      }

      const res = await fetch('/api/platform/connections/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const resData = await res.json().catch(() => ({}));
        const savedUrn = resData.cleaned_author_urn || payload.LINKEDIN_AUTHOR_URN;
        if (savedUrn && serviceId === 'linkedin') {
          handleInputChange('LINKEDIN_AUTHOR_URN', savedUrn);
          showToast(`Saved LinkedIn credentials (Author URN: ${savedUrn})`);
        } else {
          showToast(`Saved credentials for ${serviceId.toUpperCase()}`);
        }
        await fetchConnections();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.detail || 'Failed to save credentials', true);
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
      } else if (serviceId === 'calling') {
        payload.api_key = formValues.EXOTEL_API_KEY;
        payload.api_token = formValues.EXOTEL_API_TOKEN;
        payload.account_sid = formValues.EXOTEL_ACCOUNT_SID;
        payload.phone_number = formValues.EXOTEL_EXOPHONE;
        payload.subdomain = formValues.EXOTEL_SUBDOMAIN;
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
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-slate-400">
                            Author URN (Member ID)
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleAutoDetectLinkedInMember}
                              disabled={detectingMember}
                              className="text-[10px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 disabled:opacity-40 transition-colors"
                            >
                              <Sparkles className={`w-3 h-3 ${detectingMember ? 'animate-spin' : ''}`} />
                              <span>{detectingMember ? 'Detecting...' : 'Auto-Detect via API'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowMemberHelp(!showMemberHelp)}
                              className="text-[10px] text-cyan-400 hover:text-cyan-300 underline"
                            >
                              {showMemberHelp ? 'Hide Help' : 'How to find ID?'}
                            </button>
                          </div>
                        </div>

                        <input
                          type="text"
                          placeholder="e.g. 1116653996 or urn:li:person:1116653996"
                          value={formValues.LINKEDIN_AUTHOR_URN || ''}
                          onChange={(e) => handleInputChange('LINKEDIN_AUTHOR_URN', e.target.value)}
                          onBlur={(e) => {
                            const cleaned = cleanAuthorUrnInput(e.target.value);
                            if (cleaned && cleaned !== e.target.value) {
                              handleInputChange('LINKEDIN_AUTHOR_URN', cleaned);
                            }
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            const pasted = e.clipboardData.getData('text');
                            const cleaned = cleanAuthorUrnInput(pasted);
                            handleInputChange('LINKEDIN_AUTHOR_URN', cleaned);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border font-mono focus:outline-none transition-colors ${
                            (formValues.LINKEDIN_AUTHOR_URN || '').toLowerCase().includes('linkedin.com') || (formValues.LINKEDIN_AUTHOR_URN || '').toLowerCase().includes('/in/')
                              ? 'border-rose-500 text-rose-200'
                              : 'border-white/10 text-white focus:border-blue-500'
                          }`}
                        />

                        {/* Real-time Validation & Cleaned Preview Badge */}
                        {(() => {
                          const val = (formValues.LINKEDIN_AUTHOR_URN || '').trim();
                          const valLower = val.toLowerCase();
                          if (!val) {
                            return (
                              <p className="text-[10px] text-slate-400 mt-1">
                                Enter your numeric Member ID or <code className="text-cyan-300">urn:li:person:&lt;id&gt;</code>. Plain text only (HTML and markdown are automatically stripped).
                              </p>
                            );
                          }
                          if (valLower.includes('http://') || valLower.includes('https://') || valLower.includes('linkedin.com') || valLower.includes('/in/')) {
                            return (
                              <div className="mt-1.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] flex items-start gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-rose-400" />
                                <div>
                                  <strong>Invalid Author URN:</strong> Public profile URLs (<code className="text-rose-200">https://www.linkedin.com/in/...</code>) cannot be used as an Author URN. Click <strong>"How to find ID?"</strong> above to find your internal numeric Member ID.
                                </div>
                              </div>
                            );
                          }

                          const cleaned = cleanAuthorUrnInput(val);
                          const isValid = isValidAuthorUrn(cleaned);
                          const hadFormatting = cleaned !== val;

                          if (isValid) {
                            return (
                              <div className="mt-1.5 space-y-0.5">
                                <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-mono">
                                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                                  <span>Cleaned Author URN to save: <strong className="text-white bg-slate-800 px-1.5 py-0.5 rounded border border-white/10">{cleaned}</strong></span>
                                </p>
                                {hadFormatting && (
                                  <p className="text-[10px] text-amber-300 font-mono">
                                    ✓ Accidental markdown formatting and HTML entities stripped safely.
                                  </p>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div className="mt-1.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] flex items-start gap-1.5 font-mono">
                              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-rose-400" />
                              <div>
                                <span>Cleaned: <strong className="text-white">{cleaned || val}</strong></span>
                                <span className="block text-[10px] text-slate-400 mt-0.5">Must match pattern: ^urn:li:(person|organization):[0-9]+$ (numeric ID required)</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Expandable Member ID Help Guide */}
                        {showMemberHelp && (
                          <div className="mt-2.5 p-3 rounded-xl bg-slate-950/80 border border-cyan-500/20 text-[11px] text-slate-300 space-y-2.5">
                            <div className="flex items-center justify-between font-semibold text-cyan-300 text-xs">
                              <span className="flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" />
                                2 Ways to Get Your LinkedIn Member ID
                              </span>
                              <button 
                                type="button"
                                onClick={() => setShowMemberHelp(false)} 
                                className="text-slate-400 hover:text-white text-[10px]"
                              >
                                ✕
                              </button>
                            </div>

                            <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-1">
                              <p className="font-medium text-white text-[11px]">
                                ⚡ Option 1: Find ID in Page Source (Takes 30 Seconds, No Portal Setup)
                              </p>
                              <ol className="list-decimal list-inside text-slate-300 space-y-0.5 pl-1 text-[10px]">
                                <li>Open your LinkedIn profile in your browser (<code className="text-cyan-300">linkedin.com/in/...</code>).</li>
                                <li>Right-click anywhere on the page and click <strong>View Page Source</strong> (or press <kbd className="bg-black/50 px-1 rounded">Ctrl+U</kbd>).</li>
                                <li>Press <kbd className="bg-black/50 px-1 rounded">Ctrl+F</kbd> and search for: <code className="text-amber-300">urn:li:member:</code></li>
                                <li>Copy the digits (e.g. <code className="text-emerald-300 font-mono">123456789</code>) and paste them into the box above.</li>
                              </ol>
                            </div>

                            <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-1">
                              <p className="font-medium text-white text-[11px]">
                                🔑 Option 2: Auto-Detect via OpenID Connect Product
                              </p>
                              <ol className="list-decimal list-inside text-slate-300 space-y-0.5 pl-1 text-[10px]">
                                <li>Go to <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">LinkedIn Developer Portal</a> ➔ Select your App ➔ <strong>Products</strong> tab.</li>
                                <li>Add the free product: <strong>"Sign In with LinkedIn using OpenID Connect"</strong> (instant 1-click access).</li>
                                <li>In <strong>OAuth 2.0 Tools</strong>, generate a token with <code className="text-cyan-300">openid</code>, <code className="text-cyan-300">profile</code>, and <code className="text-cyan-300">w_member_social</code>.</li>
                                <li>Paste the token below and click <strong>Auto-Detect via API</strong>.</li>
                              </ol>
                            </div>
                          </div>
                        )}
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
                          <h3 className="text-sm font-semibold text-white">AI Calling / Telephony (Exotel Incoming Voice)</h3>
                          <p className="text-[11px] text-slate-400">Autonomous incoming voice receptionist with speech recognition</p>
                        </div>
                      </div>
                      {renderStatusBadge(connectionsData.communication.calling.status, connectionsData.communication.calling.configured)}
                    </div>

                    <p className="text-xs text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5">
                      {connectionsData.communication.calling.instructions}
                    </p>

                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">Exotel Virtual Number (ExoPhone)</label>
                          <input
                            type="text"
                            placeholder="09513886363 or +919513886363"
                            value={formValues.EXOTEL_EXOPHONE || ''}
                            onChange={(e) => handleInputChange('EXOTEL_EXOPHONE', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-amber-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">Exotel Account SID</label>
                          <input
                            type="text"
                            placeholder="your_account_sid"
                            value={formValues.EXOTEL_ACCOUNT_SID || ''}
                            onChange={(e) => handleInputChange('EXOTEL_ACCOUNT_SID', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">Exotel API Key</label>
                          <input
                            type="text"
                            placeholder="Your Exotel API Key"
                            value={formValues.EXOTEL_API_KEY || ''}
                            onChange={(e) => handleInputChange('EXOTEL_API_KEY', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-medium text-slate-400">Exotel API Token</label>
                            <button
                              type="button"
                              onClick={() => toggleShowSecret('exotel_token')}
                              className="text-[10px] text-amber-400 hover:underline flex items-center gap-1"
                            >
                              {showSecret.exotel_token ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              <span>{showSecret.exotel_token ? 'Hide' : 'Show'}</span>
                            </button>
                          </div>
                          <input
                            type={showSecret.exotel_token ? 'text' : 'password'}
                            placeholder="Your Exotel API Token"
                            value={formValues.EXOTEL_API_TOKEN || ''}
                            onChange={(e) => handleInputChange('EXOTEL_API_TOKEN', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">Exotel Subdomain / Cluster</label>
                          <input
                            type="text"
                            placeholder="api.exotel.com or api.in.exotel.com"
                            value={formValues.EXOTEL_SUBDOMAIN || ''}
                            onChange={(e) => handleInputChange('EXOTEL_SUBDOMAIN', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">Call Flow / App ID (Optional)</label>
                          <input
                            type="text"
                            placeholder="Optional (e.g. 123456)"
                            value={formValues.EXOTEL_APP_ID || ''}
                            onChange={(e) => handleInputChange('EXOTEL_APP_ID', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">Default Spoken Greeting (Hinglish)</label>
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
                            onClick={() => handleSaveCredentials('calling', ['EXOTEL_EXOPHONE', 'EXOTEL_ACCOUNT_SID', 'EXOTEL_API_KEY', 'EXOTEL_API_TOKEN', 'EXOTEL_SUBDOMAIN', 'EXOTEL_APP_ID', 'VOICE_GREETING_MESSAGE'])}
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
