import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldAlert, 
  Check, 
  X, 
  Mail, 
  FileWarning, 
  FileText, 
  Send,
  AlertTriangle, 
  ArrowRight,
  Eye,
  CheckCircle2,
  XCircle
} from 'lucide-react';

export default function ApprovalCard({ approval, onResolve, dryRun = false }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolvedDecision, setResolvedDecision] = useState(null);

  if (!approval) return null;

  const handleDecision = async (decision) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const resp = await fetch(`/api/approvals/${approval.approval_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision })
      });

      if (resp.ok) {
        setResolvedDecision(decision);
        if (onResolve) {
          onResolve(approval.approval_id, decision);
        }
      }
    } catch (err) {
      console.error('Failed to resolve approval:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEmail = approval.tool === 'send_email' || approval.action_type === 'send_email';
  const isTelegram = approval.tool === 'send_telegram_message' || approval.action_type === 'send_telegram';
  const isFileWrite = approval.tool === 'save_file' || approval.action_type === 'overwrite_file';

  const params = approval.parameters || approval.args || {};

  return (
    <div
      className="w-full p-6 sm:p-7 rounded-3xl border-2 border-amber-400 bg-gradient-to-br from-amber-950/80 via-slate-900 to-slate-950 shadow-2xl shadow-amber-500/20 relative overflow-hidden my-4"
    >
      {/* Top pulsing gradient bar */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-rose-500 to-amber-400 animate-pulse" />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-amber-500/20">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-glow-amber">
            {isEmail ? <Mail className="w-6 h-6" /> : isTelegram ? <Send className="w-6 h-6" /> : isFileWrite ? <FileText className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-display">
                Action Paused: Human Approval Required
              </h3>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500 text-black font-extrabold uppercase tracking-widest animate-pulse">
                AWAITING YOU
              </span>
            </div>
            <p className="text-xs text-amber-200/80 mt-0.5">
              AgentFlow requires your explicit permission before executing this sensitive action.
            </p>
          </div>
        </div>

        {/* Simulation / Real mode badge */}
        <div className="self-start sm:self-center">
          <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
            dryRun
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          }`}>
            {dryRun ? 'Simulation Mode (Dry Run)' : 'Real Production Execution'}
          </span>
        </div>
      </div>

      {/* Main Details Box */}
      <div className="my-5 p-4 sm:p-5 rounded-2xl bg-black/60 border border-white/10 space-y-4">
        {/* Tool Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-300">Tool:</span>
            <code className="px-2 py-0.5 rounded bg-white/10 text-cyan-300 font-mono font-bold">
              {approval.tool || approval.action_type}
            </code>
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
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Receiver (To)</span>
                <span className="text-white font-mono font-medium text-xs truncate block mt-0.5">
                  {params.receiver || params.to_email || 'inshaf713@gmail.com'}
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

            {/* Content Preview */}
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
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Telegram Chat</span>
              <span className="text-cyan-300 font-mono font-bold text-xs mt-0.5 block">
                Chat ID: {params.chat_id || 'Default Chat ID from .env'}
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
      </div>

      {/* Decision Buttons (Large and prominent) */}
      {resolvedDecision ? (
        <div className="pt-2 flex items-center justify-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
          {resolvedDecision === 'approve' ? (
            <span className="text-emerald-400 font-bold text-sm flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Action Approved! Resuming workflow execution...
            </span>
          ) : (
            <span className="text-rose-400 font-bold text-sm flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-400" />
              Action Rejected. Cancelling remaining steps...
            </span>
          )}
        </div>
      ) : (
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => handleDecision('reject')}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white border border-rose-500/40 text-sm font-bold flex items-center justify-center gap-2 transition-all"
          >
            <X className="w-4 h-4" />
            <span>Reject / Cancel Action</span>
          </button>

          <button
            type="button"
            onClick={() => handleDecision('approve')}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/30 transition-all hover:scale-[1.02]"
          >
            {isSubmitting ? (
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
