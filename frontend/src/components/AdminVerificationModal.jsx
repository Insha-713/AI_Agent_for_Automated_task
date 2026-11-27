import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, 
  Key, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  X, 
  Loader2,
  Server
} from 'lucide-react';

/**
 * AdminVerificationModal
 * Reusable modal for authenticating remote administrative operations
 * (saving credentials, disconnecting integrations, database sanitization).
 *
 * Security Requirements:
 * - Held ONLY in transient component memory.
 * - Never stored in localStorage, sessionStorage, cookies, or logs.
 * - Masked password input with toggleable visibility.
 * - Supports cancel and retry on verification failure.
 */
export default function AdminVerificationModal({
  isOpen,
  isSubmitting = false,
  errorMessage = '',
  actionDescription = 'Administrative Action',
  onSubmit = () => {},
  onCancel = () => {}
}) {
  const [adminKey, setAdminKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const inputRef = useRef(null);

  // Focus input and reset local fields whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setAdminKey('');
      setShowKey(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!adminKey.trim() || isSubmitting) return;
    onSubmit(adminKey.trim());
  };

  const handleClose = () => {
    setAdminKey('');
    setShowKey(false);
    onCancel();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-modal-title"
    >
      <div 
        className="relative w-full max-w-md bg-[#0c1220] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-cyan-500" />

        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors disabled:opacity-50"
          aria-label="Cancel verification"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 id="admin-modal-title" className="text-base font-semibold text-white flex items-center gap-2">
              Remote Admin Verification
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Administrative mutations on this remote deployment require verification using your <code className="text-cyan-400 bg-cyan-950/40 px-1 py-0.5 rounded font-mono text-[11px]">AGENTFLOW_ADMIN_KEY</code>.
            </p>
          </div>
        </div>

        {/* Action Context Banner */}
        <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-2.5 text-xs text-slate-300">
          <Server className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="truncate">
            <span className="text-slate-400">Target Operation: </span>
            <span className="font-medium text-slate-200">{actionDescription}</span>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold block mb-0.5">Verification Denied</span>
              {errorMessage}
            </div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Admin Key</span>
              <span className="text-[11px] text-slate-400 font-normal">Render Env Variable</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                ref={inputRef}
                type={showKey ? 'text' : 'password'}
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter AGENTFLOW_ADMIN_KEY..."
                disabled={isSubmitting}
                autoComplete="off"
                spellCheck="false"
                className="w-full pl-9 pr-10 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                aria-label={showKey ? 'Mask admin key' : 'Show admin key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400 leading-normal">
              Held strictly in temporary memory for this operation. Never saved to disk, cookies, or browser storage.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !adminKey.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <Key className="w-3.5 h-3.5" />
                  <span>Authorize &amp; Proceed</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
