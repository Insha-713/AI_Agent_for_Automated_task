import React, { useState } from 'react';
import { 
  Clock, 
  Newspaper, 
  Search, 
  Globe, 
  Compass, 
  FileText, 
  Folder, 
  Mail, 
  Send, 
  CloudRain,
  CheckCircle2, 
  AlertCircle, 
  Clock3, 
  ShieldAlert, 
  Sparkles, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  RotateCw,
  HelpCircle,
  FileCheck,
  AlertTriangle,
  Check,
  X
} from 'lucide-react';

const TOOL_ICONS = {
  get_datetime: Clock,
  get_latest_news: Newspaper,
  multi_search: Search,
  web_search: Search,
  fetch_page: Globe,
  search_sources: Compass,
  save_file: FileText,
  read_file: Folder,
  list_files: Folder,
  send_email: Mail,
  send_telegram_message: Send,
  get_weather: CloudRain,
  check_website_health: Globe,
};

const getHowToFixHint = (step) => {
  const tool = step.tool;
  const err = (step.error || '').toLowerCase();

  if (tool === 'send_email') {
    if (err.includes('password') || err.includes('auth')) {
      return 'Gmail App Password failed. Generate a 16-character Google App Password and update it in Integrations.';
    }
    return 'Ensure EMAIL_USER and EMAIL_PASS are set in your environment or Integrations page.';
  }
  if (tool === 'send_telegram_message') {
    return 'Ensure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are configured in Integrations.';
  }
  if (tool === 'get_latest_news' && (err.includes('no recent') || step.status === 'no_data')) {
    return 'Google News RSS returned no articles for the chosen window. Try broadening the topic query.';
  }
  if (step.requires_approval) {
    return 'This step is paused awaiting human approval. Click "Approve & Continue" on the card below to proceed.';
  }
  return 'Check parameters in the expanded view or verify backend logs.';
};

export default function WorkflowGraph({ 
  steps = [], 
  activeStepId = null, 
  selectedStepId = null,
  pendingApproval = null,
  onResolveApproval = null,
  onSelectStep = () => {},
  onOpenIntegrations = () => {}
}) {
  const [expandedStepIds, setExpandedStepIds] = useState({});
  const [submittingDecision, setSubmittingDecision] = useState(null);

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

          // Node indicator status color
          let nodeBg = 'bg-slate-800 border-white/20 text-slate-400';
          let borderClass = 'border-white/10 bg-slate-900/60';
          let glowPulse = '';

          if (isWaitingApproval) {
            nodeBg = 'bg-amber-500 text-black border-amber-300 shadow-lg shadow-amber-500/40 animate-pulse';
            borderClass = 'border-amber-400/70 bg-amber-950/30 ring-1 ring-amber-400/50 shadow-lg shadow-amber-500/10';
            glowPulse = 'animate-pulse';
          } else if (isRunning) {
            nodeBg = 'bg-cyan-500 text-black border-cyan-300 shadow-glow-cyan animate-pulse';
            borderClass = 'border-cyan-400/80 bg-cyan-950/30 ring-1 ring-cyan-400/50 shadow-glow-cyan';
            glowPulse = 'animate-pulse';
          } else if (isCompleted) {
            nodeBg = 'bg-emerald-500 text-black border-emerald-300 shadow-glow-emerald';
            borderClass = 'border-emerald-500/40 bg-emerald-950/20';
          } else if (isFailed) {
            nodeBg = 'bg-rose-500 text-white border-rose-300';
            borderClass = 'border-rose-500/60 bg-rose-950/30';
          } else if (isNoData) {
            nodeBg = 'bg-amber-600 text-white border-amber-400';
            borderClass = 'border-amber-500/50 bg-amber-950/30';
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
                  <ShieldAlert className="w-3.5 h-3.5" />
                ) : isFailed ? (
                  <AlertCircle className="w-3.5 h-3.5" />
                ) : (
                  <span className="text-[10px] font-bold font-mono">{index + 1}</span>
                )}
              </div>

              {/* Step Card Container */}
              <div 
                onClick={() => onSelectStep(step)}
                className={`p-4 sm:p-5 rounded-2xl border backdrop-blur-md cursor-pointer transition-all duration-200 hover:border-cyan-500/40 ${borderClass}`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-cyan-300 flex-shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                          Step {index + 1}
                        </span>
                        {step.duration && (
                          <span className="text-[10px] font-mono text-slate-400">
                            &bull; {step.duration}s
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">
                        {plainTitle}
                      </h4>
                    </div>
                  </div>

                  {/* Status Badge & Expand Toggle */}
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {/* Status badge */}
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      isWaitingApproval ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                      isRunning ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' :
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
                      className="text-cyan-400 hover:underline text-[10px] font-semibold whitespace-nowrap ml-2"
                    >
                      View Details
                    </button>
                  </div>
                )}

                {/* Pending Approval In-Step Action Card */}
                {isWaitingApproval && (
                  <div className="mt-3 p-4 rounded-xl bg-amber-950/70 border-2 border-amber-400 text-xs space-y-3 shadow-lg shadow-amber-500/10 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-300 animate-pulse flex-shrink-0" />
                        <span className="font-bold text-amber-200 uppercase tracking-wide text-xs">
                          Action Paused: Human Approval Required
                        </span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-black font-extrabold uppercase tracking-widest animate-pulse">
                        AWAITING YOU
                      </span>
                    </div>

                    <p className="text-slate-300 text-xs">
                      AgentFlow requires your permission before executing <code className="text-cyan-300 font-mono px-1 rounded bg-black/40">{step.tool}</code>.
                    </p>

                    {/* Preview key target */}
                    {step.tool === 'send_email' && (
                      <div className="p-2.5 rounded-lg bg-black/50 border border-white/10 text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-medium">To:</span>
                          <span className="text-white font-mono font-bold truncate">
                            {pendingApproval?.parameters?.to_email || pendingApproval?.parameters?.receiver || step.params?.to_email || step.params?.receiver || 'inshaf713@gmail.com'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-medium">Subject:</span>
                          <span className="text-slate-200 truncate font-medium">
                            {pendingApproval?.parameters?.subject || step.params?.subject || 'Weather Report'}
                          </span>
                        </div>
                      </div>
                    )}

                    {step.tool === 'save_file' && (
                      <div className="p-2 rounded-lg bg-black/50 border border-white/10 text-xs">
                        <span className="text-slate-400 font-medium">Target: </span>
                        <span className="text-cyan-300 font-mono font-bold">
                          {pendingApproval?.parameters?.filename || step.params?.filename || 'workspace/output.txt'}
                        </span>
                      </div>
                    )}

                    {step.tool === 'send_telegram_message' && (
                      <div className="p-2 rounded-lg bg-black/50 border border-white/10 text-xs">
                        <span className="text-slate-400 font-medium">Telegram Chat: </span>
                        <span className="text-cyan-300 font-mono font-bold">
                          {pendingApproval?.parameters?.chat_id || step.params?.chat_id || 'Default Chat'}
                        </span>
                      </div>
                    )}

                    {/* Single Approval Card Rule: Informative status banner directing user to the dedicated card above */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-amber-500/20 text-amber-200">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        <span className="font-semibold text-amber-300">Awaiting Human Approval</span>
                      </div>
                      <span className="text-[11px] text-amber-200/80 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                        Review parameters &amp; choose Approve or Reject in the card above 👆
                      </span>
                    </div>
                  </div>
                )}

                {/* Failed Step "How to Fix" Callout */}
                {(isFailed || isNoData) && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-rose-300">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      <span>{step.error || 'Execution encountered an issue.'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1">
                      <span className="text-amber-300">💡 Hint: {getHowToFixHint(step)}</span>
                      {step.tool.includes('email') || step.tool.includes('telegram') ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onOpenIntegrations(); }}
                          className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-cyan-300 font-semibold text-[10px] ml-2 whitespace-nowrap"
                        >
                          Open Integrations
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Expanded Accordion: Full Inputs & Outputs */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-3 animate-in fade-in duration-150">
                    {/* Tool Parameters */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Input Parameters
                      </span>
                      <pre className="p-2.5 rounded-xl bg-slate-950 border border-white/10 font-mono text-[11px] text-cyan-200 overflow-x-auto custom-scrollbar">
                        {JSON.stringify(step.params || step.parameters || {}, null, 2)}
                      </pre>
                    </div>

                    {/* Step Output */}
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

                    {/* Technical Metadata */}
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
