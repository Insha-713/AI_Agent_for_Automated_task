import React, { useState, useEffect } from 'react';
import { 
  PhoneCall, 
  Sparkles, 
  PhoneIncoming, 
  ShieldCheck, 
  Clock, 
  RefreshCw, 
  Copy, 
  Check, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquare, 
  Zap,
  Send,
  Eye,
  EyeOff,
  Plug,
  Save,
  Trash2,
  FileText,
  Volume2,
  ArrowRight
} from 'lucide-react';
import AgentOnboardingBanner from '../components/AgentOnboardingBanner';

export default function CallingPage({ onNavigate = () => {} }) {
  const [activeTab, setActiveTab] = useState('incoming');

  // Incoming Calls State
  const [incomingCalls, setIncomingCalls] = useState([]);
  const [isLoadingCalls, setIsLoadingCalls] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);

  // Telephony & Config State
  const [telephonyConfig, setTelephonyConfig] = useState(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // Voice Assistant Settings State
  const [greetingMessage, setGreetingMessage] = useState(
    'Hello! Insha abhi busy hain. Aap humein bata dijiye kya kaam hai? Main aapka message un tak pahuncha dungi.'
  );
  const [voiceInstructions, setVoiceInstructions] = useState('');
  const [voiceLanguage, setVoiceLanguage] = useState('hi-IN');
  const [telegramAlerts, setTelegramAlerts] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Simulator State
  const [simPhone, setSimPhone] = useState('+919876543210');
  const [simSpeech, setSimSpeech] = useState('Hello, main Insha se project ke baare mein baat karna chahta hoon.');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState(null);

  const [statusMessage, setStatusMessage] = useState(null);

  const showToast = (text, isErr = false) => {
    setStatusMessage({ type: isErr ? 'error' : 'success', text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchIncomingCalls = async () => {
    setIsLoadingCalls(true);
    try {
      const res = await fetch('/api/platform/calls/incoming');
      if (res.ok) {
        const data = await res.json();
        setIncomingCalls(data.calls || []);
      }
    } catch (e) {
      console.error('Failed to load incoming calls', e);
    } finally {
      setIsLoadingCalls(false);
    }
  };

  const fetchConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const res = await fetch('/api/platform/calls/incoming-config');
      if (res.ok) {
        const data = await res.json();
        setTelephonyConfig(data);
        if (data.greeting_message) setGreetingMessage(data.greeting_message);
        if (data.instructions) setVoiceInstructions(data.instructions);
        if (data.language) setVoiceLanguage(data.language);
        if (data.telegram_alerts !== undefined) setTelegramAlerts(data.telegram_alerts);
      }
    } catch (e) {
      console.error('Failed to load telephony configuration', e);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetchIncomingCalls();
    fetchConfig();
  }, []);

  const handleSaveVoiceSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/platform/calls/incoming-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          greeting_message: greetingMessage,
          instructions: voiceInstructions,
          language: voiceLanguage,
          telegram_alerts: telegramAlerts
        })
      });

      if (res.ok) {
        showToast('Voice Assistant settings updated successfully!');
        fetchConfig();
      } else {
        showToast('Failed to update voice settings.', true);
      }
    } catch (e) {
      showToast(e.message || 'Error updating settings', true);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSimulateTurn = async (e) => {
    e?.preventDefault();
    if (!simSpeech.trim()) return;

    setIsSimulating(true);
    setSimResult(null);
    try {
      const res = await fetch('/api/platform/calls/incoming/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_phone: simPhone,
          speech_input: simSpeech,
          history: []
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSimResult(data);
        fetchIncomingCalls();
      } else {
        showToast('Simulation failed.', true);
      }
    } catch (e) {
      setSimResult({ error: e.message });
    } finally {
      setIsSimulating(false);
    }
  };

  const isConfigured = telephonyConfig?.credentials?.exotel_configured;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-950/40 via-slate-900/60 to-orange-950/40 border border-white/10 shadow-2xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <PhoneIncoming className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-white">
              AI Voice Calling <span className="text-amber-400">Exotel Incoming Assistant</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Exotel Voice &amp; LLM
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Automated AI receptionist that answers incoming phone calls forwarded from your Airtel mobile number or dialed directly, conducts polite Hindi/Hinglish conversations, takes messages, and dispatches instant Telegram alerts.
          </p>
        </div>

        {/* 4 Focused Tabs (Incoming Only) */}
        <div className="flex flex-wrap bg-slate-900/80 p-1.5 rounded-2xl border border-white/10 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('incoming')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'incoming'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PhoneIncoming className="w-3.5 h-3.5" />
            <span>Incoming Calls ({incomingCalls.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('setup')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'setup'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Exotel Setup &amp; Webhook
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('assistant')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'assistant'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Voice Prompt &amp; Greeting
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'simulator'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Offline Simulator</span>
          </button>
        </div>
      </div>

      {/* Pre-flight Onboarding Banner */}
      {!isConfigured && (
        <AgentOnboardingBanner
          agentName="AI Calling Agent"
          requiredIntegration="Exotel Telephony"
          isConfigured={false}
          description="Connect your Exotel Account (API Key, API Token, Account SID & trial ExoPhone) to activate live incoming calls."
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

      {/* TAB 1: INCOMING CALLS & TRANSCRIPTS */}
      {activeTab === 'incoming' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Incoming Call Logs</h2>
              <p className="text-xs text-slate-400">All inbound phone calls with caller ID, duration, AI summaries, and transcripts</p>
            </div>
            <button
              type="button"
              onClick={fetchIncomingCalls}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCalls ? 'animate-spin' : ''}`} />
              <span>Refresh Calls</span>
            </button>
          </div>

          {isLoadingCalls ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading incoming call records...</div>
          ) : incomingCalls.length === 0 ? (
            <div className="glass-panel p-12 text-center text-slate-400 rounded-3xl border border-white/10 space-y-2">
              <PhoneCall className="w-8 h-8 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-white">No incoming calls yet</h3>
              <p className="text-xs max-w-md mx-auto text-slate-500">
                When someone calls your Exotel virtual number (or your forwarded Airtel phone), AgentFlow answers in Hinglish, captures their message, and logs the call here.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('simulator')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 inline-flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Run Test in Offline Simulator</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Calls Table */}
              <div className={`${selectedCall ? 'lg:col-span-6' : 'lg:col-span-12'} space-y-3`}>
                <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 border-b border-white/10 text-slate-400 text-[11px] uppercase font-mono">
                      <tr>
                        <th className="p-3">Caller Number</th>
                        <th className="p-3">Caller Name</th>
                        <th className="p-3">Duration</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Time</th>
                        <th className="p-3 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {incomingCalls.map((call) => (
                        <tr 
                          key={call.id}
                          onClick={() => setSelectedCall(call)}
                          className={`hover:bg-white/5 cursor-pointer transition-colors ${
                            selectedCall?.id === call.id ? 'bg-amber-500/10' : ''
                          }`}
                        >
                          <td className="p-3 font-mono font-medium text-white">
                            <div className="flex items-center gap-2">
                              <span>{call.recipient_phone || 'Unknown'}</span>
                              {call.call_sid?.startsWith('sim_') ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  SIMULATOR
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  EXOTEL CALL
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-slate-300">
                            {call.caller_name || 'Not provided'}
                          </td>
                          <td className="p-3 text-slate-300">
                            {call.duration_seconds || 0}s
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              call.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : call.status === 'missed'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-slate-800 text-slate-400 border-white/10'
                            }`}>
                              {call.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400 text-[11px]">
                            {call.created_at ? call.created_at.slice(0, 16).replace('T', ' ') : 'Just now'}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              className="text-amber-400 hover:underline text-xs"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Call Details Drawer */}
              {selectedCall && (
                <div className="lg:col-span-6 space-y-4">
                  <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <div>
                        <h3 className="text-xs font-semibold text-white">Call Details &amp; Summary</h3>
                        <p className="text-[10px] text-slate-400 font-mono">Call SID: {selectedCall.call_sid || selectedCall.id}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCall(null)}
                        className="text-slate-400 hover:text-white text-xs"
                      >
                        Close
                      </button>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-white/10">
                        <span className="text-[10px] text-slate-500 uppercase font-mono block">Caller Name</span>
                        <span className="text-white font-medium">{selectedCall.caller_name || 'Not provided'}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-white/10">
                        <span className="text-[10px] text-slate-500 uppercase font-mono block">Reason for Calling</span>
                        <span className="text-white font-medium">{selectedCall.reason_for_calling || selectedCall.outcome || 'General Inquiry'}</span>
                      </div>
                    </div>

                    {/* AI Summary */}
                    {selectedCall.summary && (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                        <strong className="text-white block mb-0.5">AI Conversation Summary:</strong>
                        {selectedCall.summary}
                      </div>
                    )}

                    {/* Full Message */}
                    {selectedCall.full_message && selectedCall.full_message !== selectedCall.summary && (
                      <div className="p-3 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-300">
                        <strong className="text-white block mb-0.5">Caller&apos;s Message:</strong>
                        {selectedCall.full_message}
                      </div>
                    )}

                    {/* Call Recording */}
                    {selectedCall.recording_url && (
                      <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-cyan-300">
                          <Volume2 className="w-4 h-4 text-cyan-400" />
                          <span>Call Audio Recording Available</span>
                        </div>
                        <a
                          href={selectedCall.recording_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Listen</span>
                        </a>
                      </div>
                    )}

                    {/* Turn-by-Turn Transcript */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Turn-by-Turn Transcript
                      </span>
                      <div className="p-3 rounded-xl bg-slate-900 border border-white/10 space-y-2.5 max-h-64 overflow-y-auto">
                        {(() => {
                          try {
                            const turns = typeof selectedCall.transcript === 'string' 
                              ? JSON.parse(selectedCall.transcript) 
                              : selectedCall.transcript;
                            if (Array.isArray(turns)) {
                              return turns.map((t, idx) => (
                                <div 
                                  key={idx} 
                                  className={`p-2 rounded-lg text-xs leading-relaxed ${
                                    t.role === 'assistant' 
                                      ? 'bg-amber-500/10 border border-amber-500/20 text-amber-100 ml-4' 
                                      : 'bg-slate-800 border border-white/5 text-slate-200 mr-4'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                                    <strong className="capitalize">{t.role === 'assistant' ? 'AI Receptionist' : 'Caller'}</strong>
                                    <span>{t.timestamp || ''}</span>
                                  </div>
                                  <p>{t.text}</p>
                                </div>
                              ));
                            }
                            return <p className="text-xs text-slate-400 whitespace-pre-wrap">{selectedCall.transcript}</p>;
                          } catch (e) {
                            return <p className="text-xs text-slate-400 whitespace-pre-wrap">{selectedCall.transcript || 'No transcript text available'}</p>;
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EXOTEL TELEPHONY & WEBHOOK SETUP */}
      {activeTab === 'setup' && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Exotel Telephony &amp; Webhook Setup</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure your Exotel virtual number (ExoPhone), call flow applets, and webhooks to activate AI call handling
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
              isConfigured 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                : 'bg-slate-800 text-slate-400 border-white/10'
            }`}>
              {isConfigured ? 'Exotel Connected' : 'Credentials Missing'}
            </span>
          </div>

          {/* Config Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-1">
              <span className="text-[10px] uppercase font-mono text-slate-500">Virtual Number (ExoPhone)</span>
              <p className="text-sm font-mono text-white">{telephonyConfig?.phone_number || 'Not configured'}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-1">
              <span className="text-[10px] uppercase font-mono text-slate-500">Exotel Account SID</span>
              <p className="text-sm font-mono text-white">{telephonyConfig?.account_sid || 'Not configured'}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-1">
              <span className="text-[10px] uppercase font-mono text-slate-500">Telegram Notifications</span>
              <p className="text-sm font-mono text-white">
                {telephonyConfig?.credentials?.telegram_notifications_configured ? 'Enabled (Instant Alerts)' : 'Disabled'}
              </p>
            </div>
          </div>

          {/* Webhook Endpoints */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Your Live Exotel Webhook Endpoints</h4>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Incoming Call / Passthru Webhook URL (Exotel Passthru Applet)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={telephonyConfig?.webhook_url || '/api/webhooks/voice/exotel/incoming'}
                  className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-cyan-300 font-mono"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(telephonyConfig?.webhook_url || '/api/webhooks/voice/exotel/incoming', 'incoming')}
                  className="px-3 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 flex items-center gap-1.5"
                >
                  {copiedKey === 'incoming' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'incoming' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                End-of-Call / Status Callback Webhook URL (For Recordings &amp; Telegram Alerts)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={telephonyConfig?.status_callback_url || '/api/webhooks/voice/exotel/status'}
                  className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-cyan-300 font-mono"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(telephonyConfig?.status_callback_url || '/api/webhooks/voice/exotel/status', 'status')}
                  className="px-3 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 flex items-center gap-1.5"
                >
                  {copiedKey === 'status' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'status' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Exotel Dashboard Setup Guide */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Exotel Dashboard Call Flow Setup</h4>
            <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
              {telephonyConfig?.exotel_flow_guide?.map((step, idx) => (
                <li key={idx}>{step}</li>
              )) || (
                <>
                  <li>Log in to your Exotel Dashboard at https://my.exotel.com.</li>
                  <li>Navigate to App Bazaar -&gt; Create Flow.</li>
                  <li>Add a Passthru Applet set to HTTP POST pointing to your Incoming Call Webhook URL.</li>
                  <li>Under Passthru Success branch, attach a Play or Record Applet to greet caller and record message.</li>
                  <li>Set the Status Callback URL to the Status Callback Webhook URL.</li>
                  <li>Save the Flow and assign your trial ExoPhone to it.</li>
                </>
              )}
            </ol>
          </div>

          {/* Airtel Forwarding Guide */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
            <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Airtel Call Forwarding Setup (From Your Mobile)</h4>
            <p className="text-xs text-slate-400">
              To route calls from your personal Airtel SIM to your Exotel AI receptionist when you cannot answer, dial these USSD codes on your phone keypad:
            </p>
            <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside font-mono">
              {telephonyConfig?.airtel_forwarding_guide?.slice(1).map((step, idx) => (
                <li key={idx}>{step}</li>
              )) || (
                <>
                  <li>When Unanswered (25s): *61*{telephonyConfig?.phone_number || '&lt;Your-ExoPhone&gt;'}*11*25#</li>
                  <li>When Busy: *67*{telephonyConfig?.phone_number || '&lt;Your-ExoPhone&gt;'}#</li>
                  <li>When Unreachable: *62*{telephonyConfig?.phone_number || '&lt;Your-ExoPhone&gt;'}#</li>
                  <li>All Conditional Forwarding: *004*{telephonyConfig?.phone_number || '&lt;Your-ExoPhone&gt;'}#</li>
                  <li>Cancel All Forwarding: ##004#</li>
                </>
              )}
            </ul>
          </div>

          {/* Free Trial Restrictions Notice */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">Exotel Free Trial Limitations &amp; PIN Requirements</h4>
            <ul className="text-xs text-amber-200/90 space-y-1 list-disc list-inside">
              <li>Free trial accounts provide a shared virtual number (ExoPhone) with demo credits valid for 15 days.</li>
              <li><strong>Your Registered Number:</strong> Calls placed from your registered mobile number route directly to your flow without restrictions.</li>
              <li><strong>External / Unknown Callers:</strong> Exotel trial requires callers from unregistered numbers to enter your 4-digit Account PIN before routing.</li>
              <li>No paid plan or credit card upgrade is required for evaluation.</li>
            </ul>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => onNavigate('connections')}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5"
            >
              <Plug className="w-3.5 h-3.5" />
              <span>Configure Exotel Credentials in Connections</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: VOICE PROMPT & GREETING */}
      {activeTab === 'assistant' && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Voice Receptionist Prompt &amp; Hindi/Hinglish Personality</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Customize your AI receptionist&apos;s spoken greeting, language, conversation rules, and Telegram alert settings
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Initial Spoken Greeting (Plays immediately upon call connect)
              </label>
              <textarea
                rows={2}
                value={greetingMessage}
                onChange={(e) => setGreetingMessage(e.target.value)}
                placeholder="Hello! Insha abhi busy hain. Aap humein bata dijiye kya kaam hai? Main aapka message un tak pahuncha dungi."
                className="w-full px-3 py-2.5 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-amber-500 resize-none"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Rule: Starts conversation politely in conversational Hinglish. Never says &quot;Namaste&quot;.
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Custom System Instructions &amp; Persona Boundaries
              </label>
              <textarea
                rows={5}
                value={voiceInstructions}
                onChange={(e) => setVoiceInstructions(e.target.value)}
                placeholder="You are Insha's AI assistant. Speak politely in natural Hinglish. Keep spoken replies under 2 sentences. Collect caller name, purpose, callback number, and message. Never make promises on Insha's behalf..."
                className="w-full px-3 py-2.5 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Voice Recognition &amp; TTS Language</label>
                <select
                  value={voiceLanguage}
                  onChange={(e) => setVoiceLanguage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="hi-IN">Hindi (India) - Polly.Aditi (Female)</option>
                  <option value="en-IN">English (India) - Polly.Aditi (Female)</option>
                  <option value="en-US">English (US) - Polly.Joanna</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-white/10 mt-4 sm:mt-0">
                <div>
                  <span className="text-xs font-medium text-white block">Telegram Call Alerts</span>
                  <span className="text-[10px] text-slate-400">Send caller info &amp; AI summary on call completion</span>
                </div>
                <input
                  type="checkbox"
                  checked={telegramAlerts}
                  onChange={(e) => setTelegramAlerts(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveVoiceSettings}
                disabled={isSavingSettings}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition-all"
              >
                {isSavingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Voice Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: OFFLINE DIAGNOSTIC SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-semibold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Offline Voice Turn Simulator</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/10 font-mono">
                  Test Tool
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Test caller speech turns and verify AI spoken responses in Hindi/Hinglish without initiating a real phone call.
              </p>

              <form onSubmit={handleSimulateTurn} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Caller Phone Number</label>
                  <input
                    type="tel"
                    value={simPhone}
                    onChange={(e) => setSimPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Simulated Caller Speech (Hindi / Hinglish / English)</label>
                  <textarea
                    rows={3}
                    value={simSpeech}
                    onChange={(e) => setSimSpeech(e.target.value)}
                    placeholder="Hello, main Insha se project ke baare mein baat karna chahta hoon."
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSimulating}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isSimulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Simulate Spoken Turn</span>
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
            <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3 min-h-[340px]">
              <span className="text-xs font-semibold text-white block pb-2 border-b border-white/10">
                Generated Spoken Response &amp; AI Analysis
              </span>

              {simResult ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block mb-1">
                      AI Spoken Reply (TTS Audio)
                    </span>
                    <p className="text-white text-xs leading-relaxed font-sans">
                      &quot;{simResult.ai_reply || simResult.response_text || 'Acknowledged.'}&quot;
                    </p>
                  </div>

                  {simResult.summary && (
                    <div className="p-3 rounded-xl bg-slate-900 border border-white/10 space-y-1.5 text-xs">
                      <span className="text-[10px] font-mono text-slate-400 block uppercase">Extracted Details:</span>
                      <p className="text-slate-300"><strong>Caller Name:</strong> {simResult.summary.caller_name || 'Not provided'}</p>
                      <p className="text-slate-300"><strong>Reason:</strong> {simResult.summary.reason_for_calling || 'General'}</p>
                      <p className="text-slate-300"><strong>Summary:</strong> {simResult.summary.summary || 'N/A'}</p>
                    </div>
                  )}

                  {simResult.twiml && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-slate-500">VoiceXML / TwiML Payload:</span>
                      <pre className="p-3 rounded-xl bg-slate-950 border border-white/10 text-[10px] text-cyan-300 font-mono overflow-x-auto max-h-40">
                        {simResult.twiml}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-500 text-xs space-y-1">
                  <MessageSquare className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                  <p>No simulation run yet.</p>
                  <p className="text-[10px] text-slate-600">Enter a test caller question on the left and click Simulate Spoken Turn.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
