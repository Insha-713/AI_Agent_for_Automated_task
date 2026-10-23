import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Check, 
  X, 
  Mail, 
  FileText, 
  Send,
  AlertTriangle, 
  RotateCw,
  Clock,
  Sparkles
} from 'lucide-react';
import { getApiUrl } from '../api/config';

export default function ApprovalCard({ approval, onResolve, dryRun = false }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(null);
  const [resolvedDecision, setResolvedDecision] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const apprId = approval?.approval_id || approval?.id;
  const timerRef = useRef(null);

  // Reset local state whenever approval identity changes
  useEffect(() => {
    setResolvedDecision(null);
    setSubmitError(null);
    setIsSubmitting(false);
    setSubmittingAction(null);
    setElapsedSeconds(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [apprId]);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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

      if (decision === 'approve') {
        // Start elapsed timer for calm progress display
        setElapsedSeconds(0);
        timerRef.current = setInterval(() => {
          setElapsedSeconds((prev) => prev + 1);
        }, 1000);
      }

      if (onResolve) {
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

  // 1. CALM PROGRESS STATE AFTER DECISION
  if (resolvedDecision) {
    if (resolvedDecision === 'approve') {
      const actionText = isEmail 
        ? "Sending email..." 
        : isTelegram 
        ? "Sending Telegram message..." 
        : isFileWrite 
        ? "Saving file..." 
        : "Executing action...";

      return (
        <div
          id="human-approval-card"
          className="w-full p-4 sm:p-5 rounded-2xl border border-sky-500/40 bg-slate-900/95 shadow-xl my-3 animate-in fade-in duration-200"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex-shrink-0">
                <RotateCw className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <span className="text-sm font-semibold text-white">
                  Approved. {actionText}
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Resumed execution. The pipeline will advance automatically once this step finishes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center px-3 py-1 rounded-lg bg-sky-950/60 border border-sky-500/30 text-sky-300 text-xs font-mono">
              <Clock className="w-3.5 h-3.5" />
              <span>Elapsed: {elapsedSeconds}s</span>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div
          id="human-approval-card"
          className="w-full p-4 sm:p-5 rounded-2xl border border-slate-700 bg-slate-900/90 shadow-lg my-3 animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800 text-slate-400 border border-slate-700 flex-shrink-0">
              <X className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-200">
                Rejected. The remaining steps were cancelled.
              </span>
              <p className="text-xs text-slate-400 mt-0.5">
                The run was halted at this step as requested.
              </p>
            </div>
          </div>
        </div>
      );
    }
  }

  // 2. CANONICAL SINGLE APPROVAL CARD (PRE-DECISION)
  return (
    <div
      id="human-approval-card"
      className="w-full p-5 sm:p-6 rounded-2xl border border-sky-500/30 bg-slate-900/95 shadow-xl my-4 text-slate-100"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30 flex-shrink-0">
            {isEmail ? <Mail className="w-5 h-5" /> : isTelegram ? <Send className="w-5 h-5" /> : isFileWrite ? <FileText className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
              {isEmail ? 'Approval Required: Send Email' : isTelegram ? 'Approval Required: Send Telegram' : isFileWrite ? 'Approval Required: Save File' : 'Human Approval Required'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Please review the parameters below and decide whether to approve or reject this action.
            </p>
          </div>
        </div>

        {dryRun && (
          <span className="self-start sm:self-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30">
            Dry Run Mode
          </span>
        )}
      </div>

      {/* Submission Error Alert */}
      {submitError && (
        <div className="mt-3.5 p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
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

      {/* Content Details: Receiver, Subject, Full Body */}
      <div className="my-4 p-4 rounded-xl bg-black/40 border border-white/10 space-y-3.5 text-xs">
        {isEmail && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-white/5">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Recipient (To)</span>
                <span className="text-white font-mono font-medium truncate block">
                  {params.to_email || params.receiver || 'inshaf713@gmail.com'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-white/5">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Subject</span>
                <span className="text-white font-medium truncate block">
                  {params.subject || 'No subject'}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                Full Message Body
              </span>
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-white/5 text-slate-200 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto font-mono text-[11px] custom-scrollbar">
                {params.body || params.body_preview || '(Empty email body)'}
              </div>
            </div>
          </>
        )}

        {isFileWrite && (
          <>
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Target File</span>
              <span className="text-cyan-300 font-mono font-medium block">
                {params.filename ? (params.filename.startsWith('workspace') ? params.filename : `workspace/${params.filename}`) : 'workspace/output.txt'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                Content to Save
              </span>
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-white/5 text-emerald-300 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto font-mono text-[11px] custom-scrollbar">
                {params.content || '(Empty content)'}
              </div>
            </div>
          </>
        )}

        {isTelegram && (
          <>
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Target Chat ID</span>
              <span className="text-cyan-300 font-mono font-medium block">
                {params.chat_id || 'Default Chat ID from Integrations'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                Message Text
              </span>
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-white/5 text-slate-200 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto font-mono text-[11px] custom-scrollbar">
                {params.message || '(Empty message)'}
              </div>
            </div>
          </>
        )}

        {!isEmail && !isFileWrite && !isTelegram && (
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Parameters</span>
            <pre className="p-3 rounded-lg bg-slate-950/80 border border-white/5 text-cyan-200 font-mono text-[11px] max-h-48 overflow-y-auto">
              {JSON.stringify(params, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Approve and Reject Buttons */}
      <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
        <button
          type="button"
          id="reject-approval-btn"
          onClick={() => handleDecision('reject')}
          disabled={isSubmitting}
          className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 hover:text-white border border-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting && submittingAction === 'reject' ? (
            <RotateCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <X className="w-3.5 h-3.5 text-rose-400" />
          )}
          <span>Reject</span>
        </button>

        <button
          type="button"
          id="approve-approval-btn"
          onClick={() => handleDecision('approve')}
          disabled={isSubmitting}
          className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-cyan-600/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting && submittingAction === 'approve' ? (
            <RotateCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          <span>Approve</span>
        </button>
      </div>
    </div>
  );
}
