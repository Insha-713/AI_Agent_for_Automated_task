import React, { useState, useEffect } from 'react';
import { 
  Newspaper, 
  Send, 
  RefreshCw, 
  Sparkles, 
  ExternalLink, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Bot, 
  Clock, 
  Filter,
  Copy,
  Check,
  Zap
} from 'lucide-react';

const PRESET_TOPICS = [
  { label: 'AI in India', value: 'AI artificial intelligence India developments' },
  { label: 'Global GenAI & LLMs', value: 'Generative AI LLM open source developments' },
  { label: 'Tech Startups India', value: 'Tech startups funding India technology' },
  { label: 'AI Developer Jobs', value: 'AI engineer machine learning jobs hiring India' }
];

export default function NewsPage() {
  const [topic, setTopic] = useState('AI artificial intelligence India developments');
  const [includeArxiv, setIncludeArxiv] = useState(true);
  const [digest, setDigest] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDelivering, setIsDelivering] = useState(false);
  const [deliveryResult, setDeliveryResult] = useState(null);
  const [customChatId, setCustomChatId] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchDigest = async (topicOverride) => {
    const selectedTopic = topicOverride || topic;
    setIsLoading(true);
    setDeliveryResult(null);
    try {
      const url = `/api/news/digest?topic=${encodeURIComponent(selectedTopic)}&include_arxiv=${includeArxiv}&max_stories=6`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDigest(data);
      }
    } catch (err) {
      console.warn('Failed to fetch digest:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDigest();
  }, []);

  const handleSendToTelegram = async () => {
    if (!digest || !digest.markdown_digest) return;
    setIsDelivering(true);
    setDeliveryResult(null);

    try {
      const res = await fetch('/api/news/deliver-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: digest.markdown_digest,
          chat_id: customChatId.trim() || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setDeliveryResult(data);
      } else {
        setDeliveryResult({ success: false, result: 'Failed to deliver to Telegram.' });
      }
    } catch (err) {
      setDeliveryResult({ success: false, result: `Network error: ${err.message}` });
    } finally {
      setIsDelivering(false);
    }
  };

  const handleCopyMarkdown = () => {
    if (!digest) return;
    navigator.clipboard.writeText(digest.markdown_digest);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScheduleDaily = async () => {
    try {
      const resp = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Daily AI News Telegram Delivery',
          prompt: `Generate daily AI news digest on '${topic}' and send to Telegram`,
          frequency: 'daily',
          timezone: 'Asia/Kolkata',
          hour: 8,
          minute: 0
        })
      });
      if (resp.ok) {
        alert('Daily 8:00 AM IST news schedule created successfully! View in Schedules tab.');
      }
    } catch (e) {
      alert('Failed to schedule daily digest.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-violet-950/40 border border-white/10 shadow-2xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Newspaper className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-white">
              AI News & <span className="text-cyan-400">Telegram Bot</span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Real-time news from Google News RSS & arXiv with semantic duplicate removal and 1-click delivery to Telegram.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleScheduleDaily}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition-all flex items-center gap-2"
          >
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Schedule Daily (8 AM IST)</span>
          </button>
        </div>
      </div>

      {/* Filter & Topic Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span>Presets:</span>
            </span>
            {PRESET_TOPICS.map((pt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setTopic(pt.value);
                  fetchDigest(pt.value);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                  topic === pt.value
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
                    : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeArxiv}
                onChange={(e) => setIncludeArxiv(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-cyan-500 cursor-pointer"
              />
              <span>Include arXiv AI Papers</span>
            </label>

            <button
              type="button"
              onClick={() => fetchDigest()}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors"
              title="Refresh news digest"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Digest Stats Ribbon */}
      {digest && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass-panel p-3.5 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Date (IST)</span>
            <span className="text-xs font-bold text-slate-200 mt-1 block truncate">{digest.date}</span>
          </div>

          <div className="glass-panel p-3.5 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Articles Ingested</span>
            <span className="text-base font-extrabold text-cyan-400 mt-0.5 block">{digest.total_ingested}</span>
          </div>

          <div className="glass-panel p-3.5 rounded-2xl border border-emerald-500/20 text-center bg-emerald-950/10">
            <span className="text-[10px] text-emerald-300/80 uppercase tracking-wider font-semibold block">Duplicates Removed</span>
            <span className="text-base font-extrabold text-emerald-400 mt-0.5 block">
              {digest.duplicates_removed} Merged
            </span>
          </div>

          <div className="glass-panel p-3.5 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Verified Stories</span>
            <span className="text-base font-extrabold text-white mt-0.5 block">{digest.stories_count}</span>
          </div>
        </div>
      )}

      {/* Main Content Grid: Stories & Telegram Station */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Verified Stories List (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Verified Top Stories</span>
            </h2>
            <span className="text-xs text-slate-400">Zero Hallucinations</span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              Ingesting and deduplicating live news feeds...
            </div>
          ) : !digest || !digest.stories || digest.stories.length === 0 ? (
            <div className="p-8 text-center glass-panel rounded-2xl border border-white/10 text-xs text-slate-400">
              No recent news found for this topic. Try another preset above.
            </div>
          ) : (
            digest.stories.map((story, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl glass-panel border border-white/10 hover:border-cyan-500/30 transition-all space-y-2 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xs sm:text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors leading-snug">
                    {story.title}
                  </h3>
                  <a
                    href={story.link}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-300 transition-colors flex-shrink-0"
                    title="Open original source"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {story.summary && (
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                    {story.summary}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 pt-1 border-t border-white/5">
                  <span className="font-mono text-cyan-400/90">{story.domain}</span>
                  <span>•</span>
                  <span>📅 {story.published}</span>
                  <span className="px-2 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Live Verified
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Telegram Delivery Panel (1 col) */}
        <div className="space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4 sticky top-24">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Telegram Delivery</h3>
              </div>
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1"
                title="Copy markdown text"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Push this curated digest directly to your personal chat or Telegram broadcast channel.
            </p>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Custom Chat ID (Optional)
              </label>
              <input
                type="text"
                value={customChatId}
                onChange={(e) => setCustomChatId(e.target.value)}
                placeholder="Defaults to TELEGRAM_CHAT_ID in .env"
                className="w-full px-3 py-2 rounded-xl bg-slate-950/60 border border-white/10 font-mono text-xs text-slate-200 outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Find your Chat ID with <code className="text-slate-300">@userinfobot</code> on Telegram.
              </span>
            </div>

            <button
              type="button"
              onClick={handleSendToTelegram}
              disabled={isDelivering || !digest}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50"
            >
              {isDelivering ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Delivering to Telegram...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Digest to Telegram</span>
                </>
              )}
            </button>

            {/* Delivery Result Alert */}
            {deliveryResult && (
              <div className={`p-3 rounded-xl text-xs space-y-1 border ${
                deliveryResult.mock
                  ? 'bg-violet-950/50 border-violet-500/30 text-violet-200'
                  : deliveryResult.success
                  ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-950/50 border-rose-500/30 text-rose-200'
              }`}>
                <div className="flex items-center gap-1.5 font-semibold">
                  {deliveryResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                  <span>{deliveryResult.mock ? 'Simulation Mode' : deliveryResult.success ? 'Delivered' : 'Delivery Failed'}</span>
                </div>
                <p className="text-[11px] leading-tight opacity-90 whitespace-pre-wrap">{deliveryResult.result}</p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
