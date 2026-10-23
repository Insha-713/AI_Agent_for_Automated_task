import React, { useState } from 'react';
import { 
  CheckCircle2, 
  RotateCw, 
  AlertCircle, 
  Clock, 
  Mail, 
  FileText, 
  Send, 
  Search, 
  Newspaper, 
  Globe, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Layers,
  HelpCircle,
  AlertTriangle,
  Calendar,
  Database,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

const TOOL_ICONS = {
  get_weather: Sparkles,
  get_latest_news: Newspaper,
  multi_search: Search,
  fetch_page: Globe,
  send_email: Mail,
  save_file: FileText,
  send_telegram_message: Send,
  get_datetime: Calendar,
  read_important_emails: Mail,
  analyze_tabular_data: Database,
};

const TOOL_ESTIMATES = {
  get_weather: 'about 1 to 2 seconds',
  send_email: 'about 2 to 5 seconds',
  send_telegram_message: 'about 1 to 3 seconds',
  save_file: 'about 1 to 2 seconds',
  multi_search: 'about 3 to 6 seconds',
  get_latest_news: 'about 2 to 4 seconds',
  fetch_page: 'about 2 to 5 seconds',
  get_datetime: 'under 1 second',
  read_important_emails: 'about 2 to 4 seconds',
  analyze_tabular_data: 'about 2 to 4 seconds'
};

const getHowToFixHint = (step) => {
  if (step.tool === 'send_email') {
    return 'Verify EMAIL_PROVIDER or configure Brevo / Resend in Integrations settings.';
  }
  if (step.tool === 'send_telegram_message') {
    return 'Verify TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Integrations settings.';
  }
  if (step.tool === 'multi_search' || step.tool === 'search_sources') {
    return 'Check your internet connection. Search uses DuckDuckGo.';
  }
  if (step.tool === 'get_latest_news') {
    return 'Google News RSS returned no articles. Try broadening the topic query.';
  }
  return 'Review parameters in the expanded view or check activity logs.';
};

export default function WorkflowGraph({ 
  steps = [], 
  activeStepId = null, 
  selectedStepId = null,
  pendingApproval = null,
  onResolveApproval = null,
  onRetryStep = () => {},
  onSelectStep = () => {},
  onOpenIntegrations = () => {}
}) {
  const [expandedStepIds, setExpandedStepIds] = useState({});

  const toggleExpand = (e, sid) => {
    e.stopPropagation();
    setExpandedStepIds(prev => ({ ...prev, [sid]: !prev[sid] }));
  };

  if (!steps || steps.length === 0) {
    return (
      <div className="p-8 text-center border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center mx-auto mb-3">
          <Layers className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-white">Visual Step Timeline</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Type or speak a task in the box above to generate an automated visual step graph.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full py-2 space-y-4">
      {/* Header Info */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Workflow Execution Pipeline ({steps.length} Steps)</span>
          </span>
        </div>
        <span className="text-[11px] text-slate-500">
          Click any card to inspect inputs &amp; outputs
        </span>
      </div>

      {/* Vertical Timeline Container */}
      <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-3 sm:before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-white/10">
        {steps.map((step, index) => {
          const Icon = TOOL_ICONS[step.tool] || Sparkles;
          const isWaitingApproval = step.status === 'waiting_approval' || (step.requires_approval && activeStepId === step.id);
          const isRunning = (activeStepId === step.id || step.status === 'running') && !isWaitingApproval;
          const isCompleted = step.status === 'completed' || step.status === 'done';
          const isFailed = step.status === 'failed';
          const isNoData = step.status === 'no_data';
          const isExpanded = !!expandedStepIds[step.id];

          // Neutral status styling: Blue/Grey for running and waiting, Red ONLY for failed
          let nodeBg = 'bg-slate-800 border-white/20 text-slate-400';
          let borderClass = 'border-white/10 bg-slate-900/60';

          if (isWaitingApproval) {
            nodeBg = 'bg-slate-700 text-sky-300 border-sky-400';
            borderClass = 'border-sky-500/30 bg-slate-900/80';
          } else if (isRunning) {
            nodeBg = 'bg-sky-500 text-slate-950 border-sky-300 shadow-md shadow-sky-500/20';
            borderClass = 'border-sky-500/50 bg-slate-900/90 ring-1 ring-sky-500/30';
          } else if (isCompleted) {
            nodeBg = 'bg-emerald-500 text-slate-950 border-emerald-300';
            borderClass = 'border-emerald-500/30 bg-slate-900/80';
          } else if (isFailed) {
            nodeBg = 'bg-rose-500 text-white border-rose-300';
            borderClass = 'border-rose-500/50 bg-rose-950/20';
          } else if (isNoData) {
            nodeBg = 'bg-amber-600 text-white border-amber-400';
            borderClass = 'border-amber-500/40 bg-slate-900/80';
          }

          // Plain language human-friendly label fallback
          const plainTitle = step.name || (
            step.tool === 'get_weather' ? `Fetch Weather for ${step.params?.city || 'City'}` :
            step.tool === 'get_latest_news' ? `Fetch Latest News on ${step.params?.topic || 'Topic'}` :
            step.tool === 'get_datetime' ? 'Check Current IST Time' :
            step.tool === 'save_file' ? `Save Findings to ${step.params?.filename || 'File'}` :
            step.tool === 'send_email' ? `Send Email to ${step.params?.to_email || 'Recipient'}` :
            step.tool
          );

          const estTime = TOOL_ESTIMATES[step.tool] || 'about 3 to 8 seconds';

          return (
            <div key={step.id || index} className="relative group">
              {/* Timeline Node Dot */}
              <div 
                className={`absolute -left-6 sm:-left-8 top-4 -translate-x-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${nodeBg} z-10`}
              >
                {isRunning ? (
                  <RotateCw className="w-3 h-3 animate-spin" />
                ) : isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : isWaitingApproval ? (
                  <ShieldCheck className="w-3.5 h-3.5" />
                ) : isFailed ? (
                  <AlertCircle className="w-3.5 h-3.5" />
                ) : (
                  <span className="text-[10px] font-bold font-mono">{index + 1}</span>
                )}
              </div>

              {/* Step Card Container */}
              <div 
                onClick={() => onSelectStep(step)}
                className={`p-4 sm:p-5 rounded-2xl border backdrop-blur-md cursor-pointer transition-all duration-200 hover:border-sky-500/40 ${borderClass}`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-sky-300 flex-shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-sky-400 font-bold uppercase tracking-wider">
                          Step {index + 1}
                        </span>
                        {step.duration && (
                          <span className="text-[10px] font-mono text-slate-400">
                            &bull; {step.duration}s
                          </span>
                        )}
                        {isRunning && (
                          <span className="text-[10px] font-mono text-slate-400">
                            &bull; Est: {estTime}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-white truncate group-hover:text-sky-300 transition-colors">
                        {plainTitle}
                      </h4>
                    </div>
                  </div>

                  {/* Status Badge & Expand Toggle */}
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {/* Status badge: Calm neutral styles */}
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      isWaitingApproval ? 'bg-sky-500/10 text-sky-300 border border-sky-500/30' :
                      isRunning ? 'bg-sky-500/20 text-sky-200 border border-sky-500/40' :
                      isCompleted ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                      isFailed ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                      isNoData ? 'bg-amber-600/20 text-amber-300 border border-amber-600/40' :
                      'bg-slate-800 text-slate-400 border border-white/10'
                    }`}>
                      {isRunning && <RotateCw className="w-2.5 h-2.5 animate-spin" />}
                      <span>
                        {isWaitingApproval ? 'Needs Approval' :
                         isRunning ? 'Running...' :
                         isCompleted ? 'Done' :
                         isFailed ? 'Failed' :
                         isNoData ? 'No Data' :
                         'Waiting'}
                      </span>
                    </span>

                    {/* Expand Button */}
                    <button
                      type="button"
                      onClick={(e) => toggleExpand(e, step.id)}
                      className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                      title={isExpanded ? "Collapse details" : "Expand full details"}
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* 1-Line Result Preview (When available) */}
                {step.result_preview && !isExpanded && (
                  <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                    <span className="truncate max-w-[85%] font-mono text-[11px] text-slate-300">
                      &gt; {step.result_preview}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => toggleExpand(e, step.id)}
                      className="text-sky-400 hover:underline text-[10px] font-semibold whitespace-nowrap ml-2"
                    >
                      View Details
                    </button>
                  </div>
                )}

                {/* Failed Step "How to Fix" Callout & Retry Step Button */}
                {(isFailed || isNoData) && (
                  <div className="mt-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-semibold text-rose-300">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      <span>{step.error || 'Execution encountered an issue.'}</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Hint: {getHowToFixHint(step)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetryStep(step.id);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow transition-colors"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Retry failed step</span>
                      </button>

                      {(step.tool.includes('email') || step.tool.includes('telegram')) && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onOpenIntegrations(); }}
                          className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 text-xs transition-colors"
                        >
                          Open Integrations
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Expanded Accordion: Full Inputs & Outputs */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-3 animate-in fade-in duration-150">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Input Parameters
                      </span>
                      <pre className="p-2.5 rounded-xl bg-slate-950 border border-white/10 font-mono text-[11px] text-cyan-200 overflow-x-auto custom-scrollbar">
                        {JSON.stringify(step.params || step.parameters || {}, null, 2)}
                      </pre>
                    </div>

                    {step.result && (
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Step Output
                        </span>
                        <pre className="p-2.5 rounded-xl bg-slate-950 border border-white/10 font-mono text-[11px] text-emerald-300 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">
                          {typeof step.result === 'object' ? JSON.stringify(step.result, null, 2) : String(step.result)}
                        </pre>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span>Tool: <code className="text-slate-400">{step.tool}</code></span>
                      <span>Output Key: <code className="text-slate-400">{step.output_key}</code></span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
