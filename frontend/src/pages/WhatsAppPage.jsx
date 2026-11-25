import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  Sparkles, 
  Send, 
  Plus, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck,
  Bot,
  Zap,
  Phone,
  Copy,
  Check,
  Plug,
  Save
} from 'lucide-react';
import AgentOnboardingBanner from '../components/AgentOnboardingBanner';

export default function WhatsAppPage({ onNavigate = () => {} }) {
  const [activeTab, setActiveTab] = useState('rules');

  // Account State
  const [accountStatus, setAccountStatus] = useState(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // Rules State
  const [rules, setRules] = useState([]);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newReply, setNewReply] = useState('');

  // Webhook State (Editable)
  const [callbackUrl, setCallbackUrl] = useState('/api/webhooks/whatsapp');
  const [verifyToken, setVerifyToken] = useState('agentflow_v3_whatsapp_token');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Test Message / Simulator State
  const [testPhone, setTestPhone] = useState('+15551234567');
  const [testName, setTestName] = useState('Test Contact');
  const [testMessage, setTestMessage] = useState('Hello! What services are available?');
  const [isTestingMsg, setIsTestingMsg] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Direct Outbound Message State
  const [directPhone, setDirectPhone] = useState('');
  const [directText, setDirectText] = useState('');
  const [isSendingDirect, setIsSendingDirect] = useState(false);

  // Messages State
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const fetchStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch('/api/platform/whatsapp/status');
      if (res.ok) {
        const data = await res.json();
        setAccountStatus(data);
      }
    } catch (e) {
      console.error('Failed to load WhatsApp status', e);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const fetchRules = async () => {
    setIsLoadingRules(true);
    try {
      const res = await fetch('/api/platform/whatsapp/rules');
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingRules(false);
    }
  };

  const fetchMessages = async () => {
    setIsLoadingMessages(true);
    try {
      const res = await fetch('/api/platform/whatsapp/messages');
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchRules();
    fetchMessages();
  }, []);

  const handleAddRule = async (e) => {
    e?.preventDefault();
    if (!newKeyword.trim() || !newReply.trim()) return;

    try {
      const res = await fetch('/api/platform/whatsapp/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `WhatsApp Auto-reply for ${newKeyword.trim().toUpperCase()}`,
          keyword: newKeyword.trim().toUpperCase(),
          response_template: newReply.trim(),
          response_message: newReply.trim(),
          is_active: 1
        })
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: `Auto-reply for '${newKeyword.toUpperCase()}' registered!` });
        setNewKeyword('');
        setNewReply('');
        setShowAddRule(false);
        fetchRules();
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: 'Failed to create auto-reply rule.' });
    }
  };

  const handleDeleteRule = async (id, ruleName) => {
    if (!window.confirm(`Are you sure you want to permanently delete rule: "${ruleName || id}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/platform/whatsapp/rules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRules(prev => prev.filter(r => r.id !== id));
        setStatusMessage({ type: 'success', text: `Rule '${ruleName || id}' permanently deleted.` });
        fetchRules();
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to delete rule.' });
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: e.message || 'Delete error' });
    }
  };

  const handleSaveWebhookConfig = async () => {
    try {
      const res = await fetch('/api/platform/connections/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          WHATSAPP_CALLBACK_URL: callbackUrl,
          WHATSAPP_VERIFY_TOKEN: verifyToken
        })
      });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Webhook configuration saved successfully!' });
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: 'Failed to save webhook settings.' });
    }
  };

  const handleSimulate = async (e) => {
    e?.preventDefault();
    if (!testMessage.trim()) return;

    setIsTestingMsg(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/platform/whatsapp/simulate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_phone: testPhone,
          sender_name: testName,
          message_text: testMessage
        })
      });

      if (res.ok) {
        const data = await res.json();
        setTestResult(data);
        fetchMessages();
      }
    } catch (e) {
      setTestResult({ matched: false, reply_text: e.message });
    } finally {
      setIsTestingMsg(false);
    }
  };

  const handleSendDirect = async (e) => {
    e?.preventDefault();
    if (!directPhone.trim() || !directText.trim()) return;

    setIsSendingDirect(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/platform/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_phone: directPhone,
          message_text: directText
        })
      });

      const data = await res.json();
      if (data.status === 'success') {
        setStatusMessage({ type: 'success', text: `Message dispatched to ${directPhone}!` });
        setDirectText('');
        fetchMessages();
      } else {
        setStatusMessage({ type: 'error', text: data.message || 'Failed to send WhatsApp message.' });
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: e.message || 'Send error' });
    } finally {
      setIsSendingDirect(false);
    }
  };

  const isConfigured = accountStatus?.configured;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-cyan-950/40 border border-white/10 shadow-2xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <MessageCircle className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-white">
              WhatsApp <span className="text-emerald-400">Business Cloud Agent</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Cloud API v19.0
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Intelligent keyword auto-replies, 24/7 client assistant, and verified conversation logging.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap bg-slate-900/80 p-1.5 rounded-2xl border border-white/10 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'account'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            1. Account
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'rules'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            2. Auto-Replies ({rules.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('webhook')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'webhook'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            3. Webhook Setup
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('messages')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'messages'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            4. Messages &amp; Test ({messages.length})
          </button>
        </div>
      </div>

      {/* Pre-flight Onboarding Banner */}
      {!isConfigured && (
        <AgentOnboardingBanner
          agentName="WhatsApp Agent"
          requiredIntegration="WhatsApp Business Cloud API"
          isConfigured={false}
          description="Connect your Meta WhatsApp Business App (Phone Number ID + Access Token) to enable real 24/7 automated messaging."
          onOpenConnections={() => onNavigate('connections')}
        />
      )}

      {statusMessage && (
        <div className={`p-4 rounded-2xl flex items-center gap-2.5 text-xs font-medium border ${
          statusMessage.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* TAB 1: ACCOUNT CONNECTION */}
      {activeTab === 'account' && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h2 className="text-sm font-semibold text-white">WhatsApp Cloud API Account Status</h2>
              <p className="text-xs text-slate-400">Meta Developer credentials for your business phone number</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
              isConfigured 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                : 'bg-slate-800 text-slate-400 border-white/10'
            }`}>
              {isConfigured ? 'Connected' : 'Not Connected'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-1">
              <span className="text-[10px] uppercase font-mono text-slate-500">Phone Number ID</span>
              <p className="text-sm font-mono text-white">{accountStatus?.phone_id || 'Not configured'}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-1">
              <span className="text-[10px] uppercase font-mono text-slate-500">Access Token Status</span>
              <p className="text-sm font-mono text-white">
                {accountStatus?.configured ? 'Active (Saved in SQLite)' : 'Missing Access Token'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-400">
              Configure or update WhatsApp credentials in Connections &amp; Setup.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('connections')}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all flex items-center gap-1.5"
            >
              <Plug className="w-3.5 h-3.5" />
              <span>Configure in Connections</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: AUTO-REPLY RULES */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Keyword Auto-Reply Rules</h2>
              <p className="text-xs text-slate-400">When an incoming WhatsApp message matches a keyword, the system replies instantly</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddRule(!showAddRule)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Keyword Rule</span>
            </button>
          </div>

          {showAddRule && (
            <form onSubmit={handleAddRule} className="glass-panel p-5 rounded-2xl border border-emerald-500/30 space-y-3 bg-emerald-950/10">
              <h3 className="text-xs font-semibold text-white">New WhatsApp Keyword Rule</h3>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Trigger Keyword</label>
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="PORTFOLIO, INFO, PRICING, HELP"
                  required
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Auto-Response Message</label>
                <textarea
                  value={newReply}
                  onChange={(e) => setNewReply(e.target.value)}
                  placeholder="Hello! Thanks for your message. Here are our services..."
                  rows={3}
                  required
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddRule(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                >
                  Save Rule
                </button>
              </div>
            </form>
          )}

          {/* Rules List */}
          {isLoadingRules ? (
            <div className="p-8 text-center text-slate-400">Loading rules...</div>
          ) : rules.length === 0 ? (
            <div className="glass-panel p-8 text-center text-slate-400 rounded-2xl border border-white/10 space-y-2">
              <Bot className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-xs">No active automation rules. Click &quot;Add Keyword Rule&quot; to configure your first auto-reply.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map((rule) => (
                <div key={rule.id} className="glass-panel p-4 rounded-2xl border border-white/10 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {rule.keyword}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Fired {rule.trigger_count || 0} times
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 pt-2 leading-relaxed whitespace-pre-wrap">
                      {rule.response_message || rule.response_template}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Active</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(rule.id, rule.name || rule.keyword)}
                      className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors p-1"
                      title="Permanently delete this rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WEBHOOK CONFIGURATION */}
      {activeTab === 'webhook' && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>WhatsApp Cloud API Webhook Configuration</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Configure these exact values in your Meta for Developers App Dashboard under <strong>WhatsApp &gt; Configuration</strong>.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Callback URL (Webhook Endpoint)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={callbackUrl}
                  onChange={(e) => setCallbackUrl(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-cyan-300 font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(callbackUrl);
                    setCopiedUrl(true);
                    setTimeout(() => setCopiedUrl(false), 2000);
                  }}
                  className="px-3 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 flex items-center gap-1.5"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Verify Token</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-emerald-300 font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(verifyToken);
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2000);
                  }}
                  className="px-3 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 flex items-center gap-1.5"
                >
                  {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveWebhookConfig}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Webhook Settings</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Meta Developer Setup Guide</h4>
            <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>Log in to <strong>developers.facebook.com</strong> &gt; Select your App.</li>
              <li>In the left sidebar, click <strong>WhatsApp &gt; Configuration</strong>.</li>
              <li>Click <strong>Edit</strong> next to Callback URL.</li>
              <li>Enter your Callback URL and Verify Token, then click <strong>Verify and Save</strong>.</li>
              <li>Under Webhook fields, click <strong>Manage</strong> and subscribe to <strong>messages</strong>.</li>
            </ol>
          </div>
        </div>
      )}

      {/* TAB 4: MESSAGES & TEST SIMULATOR */}
      {activeTab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Offline Test Simulator & Direct Send */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Test Simulator */}
            <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-semibold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <span>Dry-Run Auto-Reply Tester</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/10">
                  Local Test
                </span>
              </div>

              <form onSubmit={handleSimulate} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Incoming Message Text</label>
                  <input
                    type="text"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="E.g. Send PORTFOLIO details"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isTestingMsg}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isTestingMsg ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Test Incoming Keyword</span>
                </button>
              </form>

              {testResult && (
                <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                  testResult.matched 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}>
                  <div className="font-semibold">{testResult.matched ? 'Keyword Matched!' : 'No Rule Matched'}</div>
                  {testResult.reply_text && <p className="text-[11px] text-slate-300 whitespace-pre-wrap">{testResult.reply_text}</p>}
                </div>
              )}
            </div>

            {/* Direct Send */}
            <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
              <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-cyan-400" />
                <span>Send Direct WhatsApp Message</span>
              </h3>
              <form onSubmit={handleSendDirect} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Recipient Phone (+E.164)</label>
                  <input
                    type="tel"
                    placeholder="+1234567890"
                    value={directPhone}
                    onChange={(e) => setDirectPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Message</label>
                  <textarea
                    rows={2}
                    value={directText}
                    onChange={(e) => setDirectText(e.target.value)}
                    placeholder="Hello from AgentFlow..."
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSendingDirect || !directPhone.trim()}
                  className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md flex items-center justify-center gap-2"
                >
                  {isSendingDirect ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Dispatch WhatsApp Message</span>
                </button>
              </form>
            </div>

          </div>

          {/* Conversation History */}
          <div className="lg:col-span-7 space-y-4">
            <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3 min-h-[420px]">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-semibold text-white">Live Conversation Logs</span>
                <span className="text-[10px] text-slate-400">{messages.length} messages</span>
              </div>

              {isLoadingMessages ? (
                <div className="p-8 text-center text-slate-400 text-xs">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs space-y-1">
                  <Bot className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                  <p>No messages recorded yet.</p>
                  <p className="text-[10px] text-slate-600">Test an incoming message or connect your Meta webhook to view logs.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {messages.map((msg) => (
                    <div key={msg.id} className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-emerald-400">
                            {msg.direction === 'inbound' ? `From: ${msg.sender_phone || msg.contact_phone}` : `To: ${msg.recipient_phone || msg.contact_phone}`}
                          </span>
                          {msg.is_simulation ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              SIMULATED DRY-RUN
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              GENUINE WEBHOOK
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 text-[10px]">{msg.timestamp}</span>
                      </div>
                      <p className="text-slate-200 whitespace-pre-wrap">{msg.message_text || msg.message_body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
