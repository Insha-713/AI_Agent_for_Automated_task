import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cpu, 
  Search, 
  FileText, 
  Folder, 
  Clock, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Copy, 
  Check, 
  Terminal, 
  ChevronDown, 
  ChevronUp,
  Sparkles,
  Zap,
  ListOrdered,
  Newspaper,
  BookOpen,
  MessageSquare,
  Video,
  Globe,
  Compass,
  Layers,
  SearchCheck
} from 'lucide-react';
import ApprovalCard from './ApprovalCard';
import PlannerChecklist from './PlannerChecklist';

function TypingText({ text, speed = 10 }) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    if (!text) {
      setDisplayed('');
      return;
    }
    const stepSize = text.length > 600 ? 15 : text.length > 250 ? 6 : 2;
    let index = 0;
    const interval = setInterval(() => {
      index += stepSize;
      if (index >= text.length) {
        setDisplayed(text);
        clearInterval(interval);
      } else {
        setDisplayed(text.slice(0, index));
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span className="whitespace-pre-wrap leading-relaxed">
      {displayed}
      {displayed.length < text.length && (
        <span className="inline-block w-1.5 h-4 ml-1 bg-cyan-400 animate-pulse align-middle" />
      )}
    </span>
  );
}

function parseNewsItems(text) {
  if (!text || typeof text !== 'string' || !text.includes('Published:')) return null;
  const items = [];
  const blocks = text.split(/\[\d+\]\s+/).filter(Boolean);
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const title = lines[0];
    let published = '';
    let link = '';
    let domain = '';
    for (const line of lines) {
      if (line.toLowerCase().startsWith('published:')) {
        published = line.replace(/published:\s*/i, '').trim();
      } else if (line.toLowerCase().startsWith('domain:')) {
        domain = line.replace(/domain:\s*/i, '').trim();
      } else if (line.toLowerCase().startsWith('source link:') || line.toLowerCase().startsWith('url:')) {
        link = line.replace(/(?:source link|url):\s*/i, '').trim();
      }
    }
    if (title && (published || link)) {
      items.push({ title, published: published || 'Recent', link, domain });
    }
  }
  return items.length > 0 ? items : null;
}

const getSourceIconMeta = (sourceId) => {
  switch (sourceId) {
    case 'google_news':
      return { icon: Newspaper, label: 'Google News', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
    case 'duckduckgo':
      return { icon: Search, label: 'DuckDuckGo', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' };
    case 'hackernews':
      return { icon: Terminal, label: 'HackerNews', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' };
    case 'reddit':
      return { icon: MessageSquare, label: 'Reddit', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' };
    case 'wikipedia':
      return { icon: BookOpen, label: 'Wikipedia', color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30' };
    case 'arxiv':
      return { icon: FileText, label: 'arXiv', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
    case 'youtube':
      return { icon: Video, label: 'YouTube', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' };
    default:
      return { icon: Globe, label: sourceId || 'Web', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' };
  }
};

export default function AgentBrain({ 
  steps = [], 
  isRunning = false, 
  finalAnswer = '', 
  sources = [], 
  duration = 0,
  taskStatus = 'pending',
  planItems = [],
  pendingApproval = null,
  onResolveApproval = null,
  researchProgress = null,
  isDeepResearch = false
}) {
  const [copied, setCopied] = useState(false);
  const [expandedResults, setExpandedResults] = useState({});

  const toggleExpand = (idx) => {
    setExpandedResults(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Find latest research_progress from steps if not passed directly
  const activeResearch = researchProgress || (() => {
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].type === 'research_progress') return steps[i];
    }
    return null;
  })();

  const getToolMeta = (toolName) => {
    switch (toolName) {
      case 'multi_search':
        return { icon: Search, label: 'Multi-Search (Parallel DDG)', color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10' };
      case 'fetch_page':
        return { icon: FileText, label: 'Deep Article Reader (Trafilatura)', color: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10' };
      case 'search_sources':
        return { icon: Globe, label: 'Specialized Sources Search', color: 'text-fuchsia-400', border: 'border-fuchsia-500/30', bg: 'bg-fuchsia-500/10' };
      case 'get_latest_news':
        return { icon: Newspaper, label: 'Google News (Live RSS)', color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10' };
      case 'web_search':
        return { icon: Search, label: 'Web Search', color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10' };
      case 'save_file':
        return { icon: FileText, label: 'Save File', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' };
      case 'read_file':
        return { icon: FileText, label: 'Read File', color: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/10' };
      case 'list_files':
        return { icon: Folder, label: 'List Workspace', color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10' };
      case 'get_datetime':
        return { icon: Clock, label: 'Date & Time (IST)', color: 'text-sky-400', border: 'border-sky-500/30', bg: 'bg-sky-500/10' };
      case 'send_email':
        return { icon: Mail, label: 'Send Email', color: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10' };
      default:
        return { icon: Zap, label: toolName || 'Tool Call', color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10' };
    }
  };

  if (!steps.length && !isRunning) {
    return (
      <div className="glass-panel rounded-2xl p-10 text-center border border-white/5 flex flex-col items-center justify-center min-h-[340px]">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4 text-cyan-400 shadow-glow-cyan">
          <Cpu className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-slate-200 font-display">Live Agent Brain Idle</h3>
        <p className="text-sm text-slate-400 max-w-md mt-1">
          Type or speak a task above. You'll see the agent's multi-source research plan, live tool calls, full-page reads, and verified answer stream here.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      
      {/* Header bar */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Cpu className="w-4 h-4" />
            {isRunning && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-wide text-white font-display uppercase">Live Agent Brain</h2>
              {isRunning ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                  DEEP RESEARCHING & EXECUTING
                </span>
              ) : taskStatus === 'completed' ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> VERIFIED & COMPLETED
                </span>
              ) : taskStatus === 'failed' ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> FAILED
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-400">Multi-source verification engine & cognitive timeline</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          {duration > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{duration}s</span>
            </div>
          )}
          <div className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5">
            <span>{steps.length} {steps.length === 1 ? 'step' : 'steps'}</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="p-6 space-y-4 max-h-[620px] overflow-y-auto">
        
        {/* Dynamic Execution Plan Checklist */}
        {planItems && planItems.length > 0 && (
          <PlannerChecklist planItems={planItems} />
        )}

        {/* Human-in-the-loop Approval Card */}
        {pendingApproval && (
          <ApprovalCard approval={pendingApproval} onResolve={onResolveApproval} />
        )}

        {/* LIVE RESEARCH PROGRESS VIEW */}
        {activeResearch && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 sm:p-5 border border-cyan-500/30 bg-gradient-to-br from-slate-900/90 via-cyan-950/20 to-slate-900/90 shadow-glow-cyan space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display">
                    Multi-Source Research Progress
                  </h3>
                  <p className="text-[11px] text-slate-400">Real-time parallel retrieval & article analysis</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{activeResearch.pages_read_count || 0} Pages Read</span>
                </span>
              </div>
            </div>

            {/* 1. Planned Queries */}
            {activeResearch.queries && activeResearch.queries.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Planned Search Queries ({activeResearch.queries.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activeResearch.queries.map((q, qidx) => (
                    <span 
                      key={qidx}
                      className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-cyan-200/90 font-mono flex items-center gap-1.5"
                    >
                      <Search className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span>{q}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Sources Searched with Icons & Badges */}
            {activeResearch.sources_searched && activeResearch.sources_searched.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Sources Searched
                </span>
                <div className="flex flex-wrap gap-2">
                  {activeResearch.sources_searched.map((src, sidx) => {
                    const meta = getSourceIconMeta(src.id);
                    const SIcon = meta.icon;
                    return (
                      <div 
                        key={sidx}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${meta.bg} ${meta.border} text-xs font-medium ${meta.color}`}
                      >
                        <SIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{src.name || meta.label}</span>
                        {src.count !== undefined && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 font-mono font-bold">
                            {src.count}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Pages Read with Domains & Dates */}
            {activeResearch.pages_read && activeResearch.pages_read.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Full Web Articles Read & Parsed
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeResearch.pages_read.map((page, pidx) => (
                    <div 
                      key={pidx}
                      className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs space-y-1 hover:border-cyan-500/30 transition-all"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-slate-200 truncate" title={page.title}>{page.title || page.domain}</span>
                        <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 shrink-0">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-mono text-cyan-300/80">{page.domain}</span>
                        <span className="flex items-center gap-1 text-amber-300/90">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{page.date || 'Recent'}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Live Steps Sequence */}
        <AnimatePresence initial={false}>
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const isGlowing = isLast && isRunning;
            const stype = step.type;

            // Skip raw research_progress event from rendering in raw step cards (already rendered in header card)
            if (stype === 'research_progress') return null;

            // 1. Tool Call Card
            if (stype === 'tool_call') {
              const meta = getToolMeta(step.tool);
              const Icon = meta.icon;
              return (
                <motion.div
                  key={`step-${idx}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`glass-card rounded-xl p-4 border transition-all ${
                    isGlowing ? 'border-cyan-400/80 shadow-glow-cyan bg-cyan-950/20' : meta.border
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${meta.bg} ${meta.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white tracking-wide">{meta.label}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono">
                            {step.tool}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">Autonomous Tool Invocation</p>
                      </div>
                    </div>
                    {isGlowing && (
                      <span className="text-[11px] text-cyan-400 font-medium flex items-center gap-1.5 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-cyan-400"></span> Executing...
                      </span>
                    )}
                  </div>

                  {step.args && Object.keys(step.args).length > 0 && (
                    <div className="mt-3 bg-black/40 rounded-lg p-2.5 text-xs font-mono text-cyan-200/90 border border-white/5 overflow-x-auto">
                      <pre className="text-[11px] leading-relaxed whitespace-pre-wrap">
                        {JSON.stringify(step.args, null, 2)}
                      </pre>
                    </div>
                  )}
                </motion.div>
              );
            }

            // 2. Tool Result Card
            if (stype === 'tool_result') {
              const meta = getToolMeta(step.tool);
              const Icon = meta.icon;
              const isExpanded = expandedResults[idx];
              const rawResult = step.result || step.content || '';
              const isLong = rawResult.length > 250;
              const displayResult = isExpanded || !isLong ? rawResult : rawResult.slice(0, 250) + '...';
              const newsItems = parseNewsItems(rawResult);

              return (
                <motion.div
                  key={`step-${idx}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="glass-card rounded-xl p-4 border border-white/10 bg-slate-900/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Result from <span className="font-mono text-white">{step.tool}</span></span>
                    </div>
                    {isLong && !newsItems && (
                      <button
                        onClick={() => toggleExpand(idx)}
                        className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                      >
                        {isExpanded ? <>Show Less <ChevronUp className="w-3 h-3" /></> : <>Show Full <ChevronDown className="w-3 h-3" /></>}
                      </button>
                    )}
                  </div>

                  {newsItems ? (
                    <div className="space-y-2 mt-2 max-h-72 overflow-y-auto pr-1">
                      {newsItems.map((nItem, nIdx) => (
                        <div key={nIdx} className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5 hover:border-amber-500/30 transition-all">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs font-semibold text-slate-100 leading-snug">{nItem.title}</h4>
                            {nItem.link && (
                              <a
                                href={nItem.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:text-cyan-300 p-1 shrink-0"
                                title="Open source article"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            {nItem.domain && <span className="text-slate-400 font-mono">{nItem.domain}</span>}
                            <span className="flex items-center gap-1 text-amber-300 font-mono">
                              <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>{nItem.published}</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-black/30 rounded-lg p-3 text-xs text-slate-300 font-mono border border-white/5 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                      {displayResult}
                    </div>
                  )}
                </motion.div>
              );
            }

            // 3. Thinking / Plan Card
            if (stype === 'thought') {
              const content = step.content || '';
              const isPlan = content.toLowerCase().includes('plan:');

              return (
                <motion.div
                  key={`step-${idx}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`glass-card rounded-xl p-4 border transition-all ${
                    isGlowing 
                      ? 'border-violet-400/80 shadow-glow-violet bg-violet-950/20' 
                      : 'border-violet-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-violet-500/20 text-violet-300">
                        {isPlan ? <ListOrdered className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                      </div>
                      <span className="text-xs font-semibold tracking-wide text-violet-300">
                        {isPlan ? 'Strategic Plan' : 'Agent Reasoning'}
                      </span>
                    </div>
                    {isGlowing && (
                      <span className="text-[11px] text-violet-400 font-medium flex items-center gap-1.5 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-violet-400"></span> Reasoning...
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap pl-1 border-l-2 border-violet-500/30">
                    {content}
                  </div>
                </motion.div>
              );
            }

            // 4. Start / Init Card
            if (stype === 'start') {
              return (
                <motion.div
                  key={`step-${idx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-xs text-cyan-400/90 py-1.5 px-3 rounded-lg bg-cyan-500/5 border border-cyan-500/15"
                >
                  <Zap className="w-3.5 h-3.5 flex-shrink-0 text-cyan-400" />
                  <span>{step.message || `Connected to local model ${step.model}`}</span>
                </motion.div>
              );
            }

            // 5. Error Card
            if (stype === 'error') {
              return (
                <motion.div
                  key={`step-${idx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-xl p-4 border border-rose-500/40 bg-rose-950/20 text-rose-200 text-xs flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-rose-300">Agent Exception: </span>
                    {step.error || step.message}
                  </div>
                </motion.div>
              );
            }

            return null;
          })}
        </AnimatePresence>

        {/* Live Pulse Indicator when running */}
        {isRunning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-2 py-3 text-xs text-cyan-400/80 font-medium"
          >
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></div>
            <span>AgentFlow is analyzing multi-source evidence and formulating response...</span>
          </motion.div>
        )}
      </div>

      {/* FINAL ANSWER BANNER */}
      {finalAnswer && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-t border-white/10 p-6 bg-gradient-to-b from-slate-900/60 to-slate-950/90"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white font-display tracking-tight">Final Synthesized Answer</h3>
            </div>
            <button
              onClick={() => copyToClipboard(finalAnswer)}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
              title="Copy answer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Answer'}</span>
            </button>
          </div>

          <div className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed font-sans bg-black/30 p-4 rounded-xl border border-white/5">
            <TypingText text={finalAnswer} />
          </div>

          {/* SOURCES WITH FRESHNESS BADGES */}
          {sources && sources.length > 0 && (
            <div className="mt-5 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                  <SearchCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Verified Sources & Freshness ({sources.length})</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  Real-time timestamps from live web & RSS
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {sources.map((src, sidx) => {
                  const isObj = typeof src === 'object' && src !== null;
                  const url = isObj ? src.url : src;
                  const title = isObj ? src.title : url;
                  const domain = isObj ? src.domain : (url.split('/')[2] || 'web');
                  const date = isObj ? src.date : null;
                  const freshness = isObj ? src.freshness : 'Recent';

                  // Badge color scheme
                  let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
                  if (freshness === 'Today') {
                    badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-glow-emerald';
                  } else if (freshness === 'This week') {
                    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
                  }

                  return (
                    <a
                      key={`source-${sidx}`}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-black/40 hover:bg-white/5 border border-white/10 hover:border-cyan-500/40 transition-all flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1.5 mb-1">
                          <h4 className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 line-clamp-2 transition-colors">
                            {title}
                          </h4>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 shrink-0 mt-0.5" />
                        </div>
                        <p className="text-[11px] font-mono text-cyan-300/80 truncate mb-2">
                          {domain}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[10px] pt-2 border-t border-white/5">
                        <span className={`px-2 py-0.5 rounded-full font-bold border ${badgeColor}`}>
                          {freshness || 'Older'}
                        </span>
                        {date && date !== 'Recent' && (
                          <span className="text-slate-400 flex items-center gap-1 font-mono">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{date}</span>
                          </span>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}

    </div>
  );
}
