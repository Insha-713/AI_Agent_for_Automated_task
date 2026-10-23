import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Check, 
  X, 
  Mail, 
  FileText, 
  Send,
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  HelpCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { getApiUrl } from '../api/config';

export default function ApprovalCard({ approval, onResolve, dryRun = false }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(null);
  const [resolvedDecision, setResolvedDecision] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const apprId = approval?.approval_id || approval?.id;

  // Reset local state whenever approval identity changes so buttons are always responsive
  useEffect(() => {
    setResolvedDecision(null);
    setSubmitError(null);
    setIsSubmitting(false);
    setSubmittingAction(null);
  }, [apprId]);

  if (!approval) return null;

  const isEmail = approval.tool === 'send_email' || approval.action_type === 'send_email';
  const isTelegram = approval.tool === 'send_telegram_message' || approval.action_type === 'send_telegram';
  const isFileWrite = approval.tool === 'save_file' || approval.action_type === 'overwrite_file';

  const params = approval.parameters || approval.args || {};

  const handleDecision = async (decision) => {
    if (isSubmitting || resolvedDecision) return;
    setIsSubmitting(true);
    setSubmittingAction(decision);
    setSubmitError(null);

    try {
      if (!apprId) {
        throw new Error("Missing approval ID.");
      }

      const approvalUrl = getApiUrl(`/api/approvals/${apprId}`);
      const resp = await fetch(approvalUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision })
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        const reason = errData.detail || resp.statusText || 'Unknown server error';
        throw new Error(`HTTP ${resp.status}: ${reason}`);
      }

      const resData = await resp.json().catch(() => ({}));
      setResolvedDecision(decision);
      if (onResolve) {
        // Pass decision, approval ID, flag indicating it has already been submitted, and result payload
        onResolve(decision, apprId, true, resData);
      }
    } catch (err) {
      console.error('Failed to resolve approval:', err);
      setSubmitError(err.message || 'Error communicating with server');
    } finally {
      setIsSubmitting(false);
      setSubmittingAction(null);
    }
  };

  return (
    <div
      id="human-approval-card"
      className="w-full p-5 sm:p-7 rounded-3xl border-2 border-amber-400 bg-gradient-to-br from-amber-950/90 via-slate-900 to-slate-950 shadow-2xl shadow-amber-500/20 relative overflow-hidden my-4 animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Top pulsing animated gradient bar */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-rose-500 to-amber-400 animate-pulse" />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-amber-500/20">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-glow-amber flex-shrink-0">
            {isEmail ? <Mail className="w-6 h-6" /> : isTelegram ? <Send className="w-6 h-6" /> : isFileWrite ? <FileText className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-display">
                Action Paused: Human Approval Required
              </h3>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-400 text-black font-extrabold uppercase tracking-widest animate-pulse">
                AWAITING YOU
              </span>
            </div>
            <p className="text-xs text-amber-200/80 mt-0.5">
              AgentFlow requires your explicit confirmation before executing this sensitive action.
            </p>
          </div>
        </div>

        {/* Execution Mode Badge */}
        <div className="self-start sm:self-center flex-shrink-0">
          <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
            dryRun
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          }`}>
            {dryRun ? 'Simulation Mode (Dry Run)' : 'Real Production Execution'}
          </span>
        </div>
      </div>

      {/* Submission Error Alert */}
      {submitError && (
        <div className="mt-4 p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span className="flex-1 font-medium">{submitError}</span>
          <button
            type="button"
            onClick={() => setSubmitError(null)}
            className="text-rose-400 hover:text-white text-xs underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Details Box */}
      <div className="my-5 p-4 sm:p-5 rounded-2xl bg-black/60 border border-white/10 space-y-4">
        {/* Tool Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-300">Tool:</span>
            <code className="px-2 py-0.5 rounded bg-white/10 text-cyan-300 font-mono font-bold">
              {approval.tool || approval.action_type || 'Unknown Tool'}
            </code>
            {approval.step_id && (
              <span className="font-mono text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                [{approval.step_id}]
              </span>
            )}
          </div>
          {approval.details && (
            <span className="text-slate-400 italic text-[11px]">
              {approval.details}
            </span>
          )}
        </div>

        {/* Specific Email Details */}
        {isEmail && (
          <div className="space-y-3 pt-2 border-t border-white/10 font-sans">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-white/5">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Recipient (To)</span>
                <span className="text-white font-mono font-bold text-xs truncate block mt-0.5">
                  {params.to_email || params.receiver || 'inshaf713@gmail.com'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-white/5">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Subject</span>
                <span className="text-white font-semibold text-xs truncate block mt-0.5">
                  {params.subject || 'No subject'}
                </span>
              </div>
            </div>

            {/* Email Body Preview */}
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Rendered Message Body:
              </span>
              <div className="p-4 rounded-xl bg-slate-950 border border-white/10 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto font-mono custom-scrollbar">
                {params.body || params.body_preview || '(Empty email body)'}
              </div>
            </div>
          </div>
        )}

        {/* Specific File Overwrite Details */}
        {isFileWrite && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="p-3 rounded-xl bg-slate-900 border border-white/5 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Target File</span>
              <span className="text-cyan-300 font-mono font-bold text-xs mt-0.5 block">
                {params.filename ? (params.filename.startsWith('workspace') ? params.filename : `workspace/${params.filename}`) : 'workspace/output.txt'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Content to Write / Save:
              </span>
              <div className="p-4 rounded-xl bg-slate-950 border border-white/10 text-xs text-emerald-300 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto font-mono custom-scrollbar">
                {params.content || '(Empty content)'}
              </div>
            </div>
          </div>
        )}

        {/* Specific Telegram Details */}
        {isTelegram && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="p-3 rounded-xl bg-slate-900 border border-white/5 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Telegram Target</span>
              <span className="text-cyan-300 font-mono font-bold text-xs mt-0.5 block">
                Chat ID: {params.chat_id || 'Default Chat ID from Integrations'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Message Text:
              </span>
              <div className="p-4 rounded-xl bg-slate-950 border border-white/10 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto font-mono custom-scrollbar">
                {params.message || '(Empty message)'}
              </div>
            </div>
          </div>
        )}

        {/* Fallback for other tools */}
        {!isEmail && !isFileWrite && !isTelegram && (
          <div className="space-y-2 pt-2 border-t border-white/10">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Parameters:
            </span>
            <pre className="p-3 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-cyan-200 max-h-48 overflow-y-auto custom-scrollbar">
              {JSON.stringify(params, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Decision Buttons & State Container */}
      {resolvedDecision ? (
        <div className="pt-2 flex items-center justify-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 animate-in fade-in duration-150">
          {resolvedDecision === 'approve' ? (
            <span className="text-emerald-400 font-bold text-sm flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span>Action Approved! Resuming workflow execution...</span>
            </span>
          ) : (
            <span className="text-rose-400 font-bold text-sm flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <span>Action Rejected. Workflow execution cancelled.</span>
            </span>
          )}
        </div>
      ) : (
        <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4">
          {/* Reject Button */}
          <button
            type="button"
            id="reject-approval-btn"
            onClick={() => handleDecision('reject')}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 active:bg-rose-500/40 text-rose-300 hover:text-white border border-rose-500/40 text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isSubmitting && submittingAction === 'reject' ? (
              <div className="w-4 h-4 border-2 border-rose-300 border-t-transparent rounded-full animate-spin" />
            ) : (
              <X className="w-4 h-4" />
            )}
            <span>Reject / Cancel Action</span>
          </button>

          {/* Approve Button */}
          <button
            type="button"
            id="approve-approval-btn"
            onClick={() => handleDecision('approve')}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 active:scale-[0.99] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/30 transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && submittingAction === 'approve' ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>Approve &amp; Continue Run</span>
          </button>
        </div>
      )}
    </div>
  );
}
