import React, { useState, useEffect } from 'react';
import { 
  Instagram, 
  Sparkles, 
  MessageSquare, 
  Send, 
  Plus, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  ShieldCheck,
  Bot,
  Zap,
  Check,
  Copy,
  Plug,
  Save
} from 'lucide-react';
import AgentOnboardingBanner from '../components/AgentOnboardingBanner';

export default function InstagramPage({ onNavigate = () => {} }) {
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
  const [newLink, setNewLink] = useState('');

  // Webhook State (Editable)
  const [callbackUrl, setCallbackUrl] = useState('/api/webhooks/instagram');
  const [verifyToken, setVerifyToken] = useState('agentflow_v3_instagram_token');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Simulator State
  const [simUsername, setSimUsername] = useState('user_test_runner');
  const [simComment, setSimComment] = useState('Please send me the GUIDE resource!');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState(null);

  // Interactions State
  const [interactions, setInteractions] = useState([]);
  const [isLoadingInteractions, setIsLoadingInteractions] = useState(false);
  
  const [statusMessage, setStatusMessage] = useState(null);

  const fetchStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch('/api/platform/instagram/status');
      if (res.ok) {
        const data = await res.json();
        setAccountStatus(data);
      }
    } catch (e) {
      console.error('Failed to load Instagram status', e);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const fetchRules = async () => {
    setIsLoadingRules(true);
    try {
      const res = await fetch('/api/platform/instagram/rules');
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch (e) {
      console.error('Failed to load rules', e);
    } finally {
      setIsLoadingRules(false);
    }
  };

  const fetchInteractions = async () => {
    setIsLoadingInteractions(true);
    try {
      const res = await fetch('/api/platform/instagram/interactions');
      if (res.ok) {
        const data = await res.json();
        setInteractions(data.interactions || []);
      }
    } catch (e) {
      console.error('Failed to load interactions', e);
    } finally {
      setIsLoadingInteractions(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchRules();
    fetchInteractions();
  }, []);

  const handleAddRule = async (e) => {
    e?.preventDefault();
    if (!newKeyword.trim() || !newReply.trim()) return;

    try {
      const res = await fetch('/api/platform/instagram/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Auto Reply for ${newKeyword.trim().toUpperCase()}`,
          keyword: newKeyword.trim().toUpperCase(),
          reply_template: newReply.trim(),
          response_message: newReply.trim(),
          resource_link: newLink.trim() || null,
          resource_url: newLink.trim() || null,
          is_active: 1
        })
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: `Rule for '${newKeyword.toUpperCase()}' registered!` });
        setNewKeyword('');
        setNewReply('');
        setNewLink('');
        setShowAddRule(false);
        fetchRules();
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: 'Failed to create rule.' });
    }
  };

  const handleDeleteRule = async (id, ruleName) => {
    if (!window.confirm(`Are you sure you want to permanently delete rule: "${ruleName || id}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/platform/instagram/rules/${id}`, { method: 'DELETE' });
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
          INSTAGRAM_CALLBACK_URL: callbackUrl,
          INSTAGRAM_WEBHOOK_VERIFY_TOKEN: verifyToken,
          META_VERIFY_TOKEN: verifyToken
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
    if (!simComment.trim()) return;

    setIsSimulating(true);
    setSimResult(null);
    try {
      const res = await fetch('/api/platform/instagram/simulate-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commenter_username: simUsername,
          comment_text: simComment,
          post_id: 'test_post_preview'
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSimResult(data);
        fetchInteractions();
      }
    } catch (e) {
      setSimResult({ matched: false, error: e.message });
    } finally {
      setIsSimulating(false);
    }
  };

  const isConfigured = accountStatus?.configured;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-pink-950/40 via-slate-900/60 to-purple-950/40 border border-white/10 shadow-2xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
              <Instagram className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-white">
              Instagram <span className="text-pink-400">Comment-to-DM Agent</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-pink-500/20 text-pink-300 border border-pink-500/30">
              Meta Graph v19.0
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Automatically detect keywords in post comments, deliver resource links via DM, and record verified interaction logs.
          </p>
        </div>

        {/* 4 Clean Tabs */}
        <div className="flex flex-wrap bg-slate-900/80 p-1.5 rounded-2xl border border-white/10 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'account'
                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-sm'
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
                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            2. Comment Rules ({rules.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('webhook')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'webhook'
                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            3. Webhook Setup
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'activity'
                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            4. Activity &amp; Simulator
          </button>
        </div>
      </div>

      {/* Pre-flight Onboarding Banner */}
      {!isConfigured && (
        <AgentOnboardingBanner
          agentName="Instagram Agent"
          requiredIntegration="Instagram / Meta Graph API"
          isConfigured={false}
          description="Connect your Meta Professional account (Account ID + Access Token) to enable real live Comment-to-DM triggers."
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

      {/* SECTION 1: ACCOUNT CONNECTION */}
      {activeTab === 'account' && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h2 className="text-sm font-semibold text-white">Meta / Instagram Account Status</h2>
              <p className="text-xs text-slate-400">Verified connection credentials for your Instagram Professional account</p>
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
              <span className="text-[10px] uppercase font-mono text-slate-500">Connected Account ID</span>
              <p className="text-sm font-mono text-white">{accountStatus?.account_id || 'Not configured'}</p>
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
              Credentials are centrally managed in Connections &amp; Setup.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('connections')}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-pink-500 hover:bg-pink-400 text-slate-950 transition-all flex items-center gap-1.5"
            >
              <Plug className="w-3.5 h-3.5" />
              <span>Configure in Connections</span>
            </button>
          </div>
        </div>
      )}

      {/* SECTION 2: COMMENT-TO-DM RULES */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Keyword Trigger Rules</h2>
              <p className="text-xs text-slate-400">When users comment with this keyword, the agent immediately sends a direct message</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddRule(!showAddRule)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-pink-500 hover:bg-pink-400 text-slate-950 flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Keyword Rule</span>
            </button>
          </div>

          {showAddRule && (
            <form onSubmit={handleAddRule} className="glass-panel p-5 rounded-2xl border border-pink-500/30 space-y-3 bg-pink-950/10">
              <h3 className="text-xs font-semibold text-white">New Comment-to-DM Automation Rule</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Trigger Keyword (e.g. GUIDE)</label>
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="GUIDE, RESUME, CODE"
                    required
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono uppercase focus:outline-none focus:border-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Optional Resource URL</label>
                  <input
                    type="url"
                    value={newLink}
                    onChange={(e) => setNewLink(e.target.value)}
                    placeholder="https://yourdomain.com/resource"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">DM Response Message</label>
                <textarea
                  value={newReply}
                  onChange={(e) => setNewReply(e.target.value)}
                  placeholder="Hey there! Thanks for reaching out. Here is the link you requested:"
                  rows={2}
                  required
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-pink-500 resize-none"
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
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-pink-500 hover:bg-pink-400 text-slate-950"
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
              <p className="text-xs">No active automation rules. Click &quot;Add Keyword Rule&quot; to configure your first trigger.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map((rule) => (
                <div key={rule.id} className="glass-panel p-4 rounded-2xl border border-white/10 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                        {rule.keyword}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Fired {rule.trigger_count || 0} times
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 pt-2 leading-relaxed">
                      {rule.response_message || rule.reply_template}
                    </p>

                    {rule.resource_url && (
                      <a
                        href={rule.resource_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-pink-400 hover:underline flex items-center gap-1 pt-1 truncate"
                      >
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{rule.resource_url}</span>
                      </a>
                    )}
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

      {/* SECTION 3: WEBHOOK SETUP */}
      {activeTab === 'webhook' && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-pink-400" />
              <span>Meta Graph API Webhook Configuration</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Configure these exact values in your Meta for Developers App Dashboard under <strong>Webhooks &gt; Instagram</strong>.
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
                  className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-pink-300 font-mono"
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
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-pink-500 hover:bg-pink-400 text-slate-950 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Webhook Settings</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Step-by-Step Meta Dashboard Setup</h4>
            <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>Open your app at <strong>developers.facebook.com</strong> &gt; App Dashboard.</li>
              <li>Under <strong>Webhooks</strong>, select the <strong>Instagram</strong> object.</li>
              <li>Click <strong>Edit Subscription</strong> and paste the Callback URL and Verify Token from above.</li>
              <li>Subscribe to the <strong>comments</strong> field.</li>
              <li>Click <strong>Verify and Save</strong>.</li>
            </ol>
          </div>
        </div>
      )}

      {/* SECTION 4: ACTIVITY LOGS & SIMULATOR */}
      {activeTab === 'activity' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Simulator Tool */}
          <div className="lg:col-span-5 space-y-4">
            <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-semibold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-pink-400" />
                  <span>Dry-Run Comment Simulator</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/10">
                  Local Test
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Test matching logic safely without publishing to live Instagram feeds.
              </p>

              <form onSubmit={handleSimulate} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Simulated Username</label>
                  <input
                    type="text"
                    value={simUsername}
                    onChange={(e) => setSimUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Comment Text</label>
                  <input
                    type="text"
                    value={simComment}
                    onChange={(e) => setSimComment(e.target.value)}
                    placeholder="E.g. Send me the GUIDE!"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSimulating}
                  className="w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isSimulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Simulate Incoming Comment</span>
                </button>
              </form>

              {simResult && (
                <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                  simResult.matched 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}>
                  <div className="font-semibold">{simResult.matched ? 'Rule Matched!' : 'No Rule Matched'}</div>
                  {simResult.reply_text && <p className="text-[11px] text-slate-300 whitespace-pre-wrap">{simResult.reply_text}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Activity Logs */}
          <div className="lg:col-span-7 space-y-4">
            <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3 min-h-[360px]">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-semibold text-white">Live Activity &amp; DM Delivery Logs</span>
                <span className="text-[10px] text-slate-400">{interactions.length} interactions logged</span>
              </div>

              {isLoadingInteractions ? (
                <div className="p-8 text-center text-slate-400 text-xs">Loading activity logs...</div>
              ) : interactions.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs space-y-1">
                  <Bot className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                  <p>No activity recorded yet.</p>
                  <p className="text-[10px] text-slate-600">Simulate a comment or connect your live webhook to record interactions.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {interactions.map((int) => (
                    <div key={int.id} className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-pink-300">@{int.commenter_username || int.username}</span>
                          {int.is_simulation ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              SIMULATED DRY-RUN
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              GENUINE WEBHOOK
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 text-[10px]">{int.timestamp}</span>
                      </div>
                      <p className="text-slate-300 italic">&quot;{int.comment_text || int.content}&quot;</p>
                      <div className="p-2 rounded-lg bg-white/5 text-[11px] text-slate-200">
                        <strong className="text-emerald-400">DM Sent:</strong> {int.response_sent || 'Automated response delivered'}
                      </div>
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
