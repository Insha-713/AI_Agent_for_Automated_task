import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Sparkles, 
  Send, 
  Inbox, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  FileText, 
  Copy, 
  Check, 
  RefreshCw,
  Tag,
  Briefcase,
  AlertTriangle,
  Flame,
  Layers,
  Trash2,
  ExternalLink,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import AgentOnboardingBanner from '../components/AgentOnboardingBanner';

export default function EmailAgentPage() {
  const [activeTab, setActiveTab] = useState('inbox');
  const [connectionStatus, setConnectionStatus] = useState(null);

  // Live Inbox State
  const [inboxEmails, setInboxEmails] = useState([]);
  const [isLoadingInbox, setIsLoadingInbox] = useState(false);
  const [inboxNotice, setInboxNotice] = useState(null);
  const [selectedInboxEmail, setSelectedInboxEmail] = useState(null);

  // Categorizer State
  const [categorizedResults, setCategorizedResults] = useState(null);
  const [isCategorizing, setIsCategorizing] = useState(false);

  // Briefing State
  const [briefing, setBriefing] = useState(null);
  const [isBriefing, setIsBriefing] = useState(false);

  // Reply Drafter State
  const [replyFrom, setReplyFrom] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [replyTone, setReplyTone] = useState('professional');
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftResult, setDraftResult] = useState(null);
  const [copiedReply, setCopiedReply] = useState(false);

  // Outbound Tasks State
  const [tasks, setTasks] = useState([]);
  const [statusMessage, setStatusMessage] = useState(null);

  // Fetch connection status
  const checkConnection = async () => {
    try {
      const res = await fetch('/api/platform/connections');
      if (res.ok) {
        const data = await res.json();
        const emailService = (data.categories || [])
          .flatMap(c => c.services)
          .find(s => s.id === 'email');
        if (emailService) {
          setConnectionStatus(emailService.status);
        }
      }
    } catch (e) {
      console.error('Failed to check email connection:', e);
    }
  };

  const fetchInbox = async () => {
    setIsLoadingInbox(true);
    setInboxNotice(null);
    try {
      const res = await fetch('/api/platform/email/inbox');
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'not_configured') {
          setInboxNotice({
            type: 'warning',
            text: data.message || 'Email service is not configured. Connect your account in Connections & Setup to fetch live mail.'
          });
          setInboxEmails([]);
        } else if (data.status === 'error') {
          setInboxNotice({
            type: 'error',
            text: data.message || 'Failed to connect to email inbox server.'
          });
          setInboxEmails([]);
        } else {
          setInboxEmails(data.emails || []);
          if (data.emails && data.emails.length > 0) {
            setInboxNotice({
              type: 'success',
              text: data.message || `Loaded ${data.emails.length} live emails from inbox.`
            });
          } else {
            setInboxNotice({
              type: 'info',
              text: 'Inbox checked: No unread or recent messages found.'
            });
          }
        }
      }
    } catch (e) {
      setInboxNotice({ type: 'error', text: 'Network error connecting to email inbox.' });
    } finally {
      setIsLoadingInbox(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/platform/email/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    checkConnection();
    fetchInbox();
    fetchTasks();
  }, []);

  const selectEmailForReply = (email) => {
    setSelectedInboxEmail(email);
    setReplyFrom(email.sender || '');
    setReplySubject(email.subject ? (email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`) : '');
    setReplyBody(email.body || email.snippet || '');
    setActiveTab('reply');
    setStatusMessage({
      type: 'info',
      text: `Loaded email from '${email.sender}' into Reply Drafter.`
    });
  };

  const handleCategorize = async () => {
    if (inboxEmails.length === 0) {
      setStatusMessage({ type: 'error', text: 'No inbox emails available to classify. Sync inbox first.' });
      return;
    }
    setIsCategorizing(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/platform/email/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: inboxEmails })
      });

      if (res.ok) {
        const data = await res.json();
        setCategorizedResults(data);
        setActiveTab('categorizer');
      } else {
        setStatusMessage({ type: 'error', text: 'Categorization request failed.' });
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: e.message || 'Categorization error' });
    } finally {
      setIsCategorizing(false);
    }
  };

  const handleGenerateBriefing = async () => {
    if (inboxEmails.length === 0) {
      setStatusMessage({ type: 'error', text: 'No inbox emails available to summarize. Sync inbox first.' });
      return;
    }
    setIsBriefing(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/platform/email/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: inboxEmails })
      });

      if (res.ok) {
        const data = await res.json();
        setBriefing(data.briefing);
      } else {
        setStatusMessage({ type: 'error', text: 'Executive briefing generation failed.' });
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: e.message || 'Briefing error' });
    } finally {
      setIsBriefing(false);
    }
  };

  const handleDraftReply = async (e) => {
    e?.preventDefault();
    if (!replyBody.trim()) {
      setStatusMessage({ type: 'error', text: 'Please provide incoming email text to reply to.' });
      return;
    }

    setIsDrafting(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/platform/email/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_from: replyFrom || 'Sender',
          subject: replySubject || 'Reply',
          body: replyBody,
          tone: replyTone
        })
      });

      if (res.ok) {
        const data = await res.json();
        setDraftResult(data.draft_reply);
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to draft AI response.' });
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: e.message || 'Reply drafting failed' });
    } finally {
      setIsDrafting(false);
    }
  };

  const handleQueueDraft = async () => {
    if (!draftResult) return;
    setStatusMessage(null);
    try {
      const res = await fetch('/api/platform/email/queue-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_email: replyFrom,
          subject: draftResult.subject,
          body: draftResult.reply_body
        })
      });
      if (res.ok) {
        setStatusMessage({
          type: 'success',
          text: `Queued email to '${replyFrom}' with mandatory human approval gate requirement!`
        });
        fetchTasks();
        setActiveTab('queue');
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to queue email.' });
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: e.message || 'Queue error' });
    }
  };

  const handleSendQueuedEmail = async (taskId) => {
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/platform/email/tasks/${taskId}/send`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setStatusMessage({
          type: 'success',
          text: `Email delivered successfully! (${data.message_id || 'Sent via configured provider'})`
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to send email. Check credentials in Connections & Setup.'
        });
      }
      fetchTasks();
    } catch (e) {
      setStatusMessage({ type: 'error', text: e.message || 'Send error' });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      
      {/* Onboarding Banner if email is not configured */}
      <AgentOnboardingBanner 
        serviceId="email" 
        agentName="Email Automation Agent" 
      />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-950/40 via-slate-900/60 to-indigo-950/40 border border-white/10 shadow-2xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Mail className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-white">
              Email Automation <span className="text-sky-400">Agent</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
              IMAP, SMTP & REST APIs
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Real inbox reading, AI classification, daily briefings, and smart reply drafting with strict approval gates.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap bg-slate-900/80 p-1.5 rounded-2xl border border-white/10 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('inbox')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'inbox'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Live Inbox ({inboxEmails.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categorizer')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'categorizer'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Categorizer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('briefing')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'briefing'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Morning Briefing
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reply')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'reply'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Reply Drafter
          </button>
          <button
            type="button"
            onClick={() => {
              fetchTasks();
              setActiveTab('queue');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'queue'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Queue & Outbound ({tasks.length})
          </button>
        </div>
      </div>

      {/* Notice & Status Messages */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl flex items-center gap-2.5 text-xs font-medium border ${
          statusMessage.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : statusMessage.type === 'error'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {inboxNotice && activeTab === 'inbox' && (
        <div className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs border ${
          inboxNotice.type === 'warning'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            : inboxNotice.type === 'error'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
        }`}>
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{inboxNotice.text}</span>
          </div>
          {inboxNotice.type === 'warning' && (
            <a
              href="#/connections"
              className="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-medium flex items-center gap-1"
            >
              <span>Setup Email</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Tab 0: Live Inbox */}
      {activeTab === 'inbox' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Inbox className="w-4 h-4 text-sky-400" />
              <span>Real Inbox Messages</span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchInbox}
                disabled={isLoadingInbox}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 flex items-center gap-1.5 border border-white/10 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isLoadingInbox ? 'animate-spin' : ''}`} />
                <span>{isLoadingInbox ? 'Fetching Inbox...' : 'Sync Live Inbox'}</span>
              </button>
              {inboxEmails.length > 0 && (
                <button
                  type="button"
                  onClick={handleCategorize}
                  disabled={isCategorizing}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-medium border border-sky-500/40 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Classify All</span>
                </button>
              )}
            </div>
          </div>

          {inboxEmails.length === 0 ? (
            <div className="p-16 rounded-2xl glass-panel border border-white/10 text-center space-y-3">
              <Mail className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-300">No Emails in Inbox</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {connectionStatus === 'connected' 
                  ? 'Your connected email account has no recent messages or unread emails.'
                  : 'Connect your IMAP or Gmail account in Connections & Setup to fetch live email threads.'}
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <a
                  href="#/connections"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-xs font-semibold shadow-lg shadow-sky-500/20"
                >
                  <span>Open Connections & Setup</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    selectEmailForReply({
                      sender: 'hiring-lead@techinnovations.io',
                      subject: 'Interview Invitation: Senior AI Automation Engineer',
                      body: 'Hello,\n\nWe were highly impressed with your autonomous multi-agent portfolio and would like to invite you for a 30-minute introductory architecture discussion with our engineering leads this Thursday at 3 PM IST or Friday at 11 AM IST.\n\nPlease let us know if either slot works for you.\n\nBest regards,\nEngineering Talent Team'
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>Load Demo Email Context</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {inboxEmails.map((mail, idx) => (
                <div
                  key={mail.id || idx}
                  className="p-4 rounded-2xl glass-panel border border-white/10 hover:border-sky-500/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">{mail.sender}</span>
                      {mail.date && (
                        <span className="text-[10px] text-slate-400 font-mono">({mail.date})</span>
                      )}
                    </div>
                    <div className="text-xs font-medium text-sky-300">{mail.subject || '(No Subject)'}</div>
                    <p className="text-xs text-slate-400 line-clamp-2">{mail.snippet || mail.body}</p>
                  </div>
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      type="button"
                      onClick={() => selectEmailForReply(mail)}
                      className="px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-medium border border-sky-500/40 flex items-center gap-1.5 transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Draft AI Reply</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 1: Categorizer */}
      {activeTab === 'categorizer' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Tag className="w-4 h-4 text-sky-400" />
              <span>AI Email Categorizer & Intent Tagging</span>
            </h2>
            <button
              type="button"
              onClick={handleCategorize}
              disabled={isCategorizing || inboxEmails.length === 0}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-sky-500/20 transition-all disabled:opacity-50"
            >
              {isCategorizing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{isCategorizing ? 'Classifying...' : 'Classify Inbox Messages'}</span>
            </button>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-white/10 min-h-[360px] space-y-4">
            {categorizedResults ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">Classification Breakdown</span>
                  <span className="text-xs text-sky-300 font-mono">{categorizedResults.total} emails processed</span>
                </div>
                {categorizedResults.categorized.map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate max-w-[240px]">{item.email.sender}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase ${
                        item.category === 'urgent'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : item.category === 'recruiter_and_career'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      }`}>
                        {item.category.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-sky-200 font-medium">{item.email.subject}</div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{item.email.body || item.email.snippet}</p>
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => selectEmailForReply(item.email)}
                        className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
                      >
                        <span>Draft Reply</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-24 text-center text-slate-500 text-xs space-y-2">
                <Layers className="w-8 h-8 mx-auto text-slate-600" />
                <p>Click "Classify Inbox Messages" to analyze incoming mail with LLM intent recognition.</p>
                {inboxEmails.length === 0 && (
                  <p className="text-slate-500 text-[11px]">Sync your inbox on the Live Inbox tab first.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Briefing */}
      {activeTab === 'briefing' && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" />
                <span>Daily Morning Executive Briefing</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Summarizes high-priority incoming communications, critical deadlines, and action items.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateBriefing}
              disabled={isBriefing || inboxEmails.length === 0}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-sky-500/20 disabled:opacity-50"
            >
              {isBriefing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{isBriefing ? 'Compiling...' : "Generate Today's Briefing"}</span>
            </button>
          </div>

          {briefing ? (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 space-y-2">
                <span className="text-[10px] font-semibold text-sky-300 uppercase tracking-wider font-mono">Executive Summary</span>
                <p className="text-xs text-white leading-relaxed">{briefing.summary}</p>
              </div>

              {briefing.action_items && briefing.action_items.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">Urgent Action Items</span>
                  <ul className="space-y-1.5">
                    {briefing.action_items.map((it, i) => (
                      <li key={i} className="text-xs text-rose-300 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center text-slate-500 text-xs space-y-2">
              <FileText className="w-8 h-8 mx-auto text-slate-600" />
              <p>Click "Generate Today's Briefing" to compile a concise daily summary of high-priority emails.</p>
              {inboxEmails.length === 0 && (
                <p className="text-slate-500 text-[11px]">Sync your inbox on the Live Inbox tab first.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Reply Drafter */}
      {activeTab === 'reply' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  <span>Configure Reply Drafter</span>
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setReplyFrom('hiring-lead@techinnovations.io');
                    setReplySubject('Interview Invitation: Senior AI Automation Engineer');
                    setReplyBody('Hello,\n\nWe reviewed your autonomous agent repository and were impressed with your multi-agent architecture. We would like to invite you for a 30-minute introductory architecture discussion with our engineering leads this Thursday at 3 PM IST or Friday at 11 AM IST.\n\nPlease confirm if either time works for you.\n\nBest regards,\nEngineering Talent Team');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-[11px] text-sky-300 flex items-center gap-1 transition-all"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Load Demo Email</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">To / Sender Email</label>
                  <input
                    type="text"
                    value={replyFrom}
                    onChange={(e) => setReplyFrom(e.target.value)}
                    placeholder="e.g. client@company.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Reply Tone</label>
                  <select
                    value={replyTone}
                    onChange={(e) => setReplyTone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white"
                  >
                    <option value="professional">Professional</option>
                    <option value="friendly">Warm & Friendly</option>
                    <option value="concise">Concise & Direct</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Subject</label>
                <input
                  type="text"
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  placeholder="e.g. Re: Project Collaboration"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Incoming Email Context / Instructions</label>
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={4}
                  placeholder="Paste the incoming message or specify what you want the AI to reply..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <button
                type="button"
                onClick={handleDraftReply}
                disabled={isDrafting || !replyBody.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDrafting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Draft Intelligent Email Response</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 min-h-[400px] flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">AI Drafted Reply</span>
                  {draftResult && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(draftResult.reply_body);
                        setCopiedReply(true);
                        setTimeout(() => setCopiedReply(false), 2000);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300 hover:text-white flex items-center gap-1.5"
                    >
                      {copiedReply ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-sky-400" />}
                      <span>{copiedReply ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>

                {draftResult ? (
                  <div className="pt-4 space-y-4">
                    <div className="text-xs text-slate-400">
                      Subject: <strong className="text-white">{draftResult.subject}</strong>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                      {draftResult.reply_body}
                    </div>

                    <div className="pt-3 border-t border-white/10 flex justify-end">
                      <button
                        type="button"
                        onClick={handleQueueDraft}
                        className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-sky-500/20 transition-all flex items-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        <span>Queue for Outbound Delivery (Approval Gate)</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-24 text-center text-slate-500 text-xs space-y-2">
                    <Mail className="w-8 h-8 mx-auto text-slate-600" />
                    <p>Select an incoming email from the Live Inbox tab or fill the form on the left to draft an accurate, professional reply.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Outbound Queue & Real Provider Delivery */}
      {activeTab === 'queue' && (
        <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-sky-400" />
                <span>Outbound Email Tasks & Delivery Gates</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Emails queued by agents with mandatory human-in-the-loop approval gates before provider dispatch.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchTasks}
              className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
              <span>Refresh Queue</span>
            </button>
          </div>

          {tasks.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No outbound emails currently queued. Draft an email reply or trigger a workflow to populate this queue.
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="p-4 rounded-xl bg-slate-900/60 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-sky-500/30 transition-all">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${
                        task.status === 'sent'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : task.status === 'failed'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {task.status || 'pending_approval'}
                      </span>
                      <span className="text-xs font-semibold text-white">{task.subject || 'No Subject'}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      To: <span className="text-slate-200 font-mono">{task.to_email || task.recipient_email}</span>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-2">
                      {task.body}
                    </p>
                    {task.error_message && (
                      <p className="text-[11px] text-rose-400 font-mono">
                        Error: {task.error_message}
                      </p>
                    )}
                    {task.message_id && (
                      <p className="text-[11px] text-emerald-400 font-mono">
                        Message ID: {task.message_id}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {task.status !== 'sent' && (
                      <button
                        type="button"
                        onClick={() => handleSendQueuedEmail(task.id)}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-sky-500/20 flex items-center gap-1.5 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Approve & Send Now</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
