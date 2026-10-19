import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  Clock, 
  Eye, 
  EyeOff, 
  Send, 
  Key, 
  Mail, 
  MapPin, 
  Bot, 
  ShieldCheck,
  Check,
  RotateCcw
} from 'lucide-react';
import VoiceInputButton from './VoiceInputButton';

export default function QuestionsPanel({
  session = null,
  onAnswer = () => {},
  onReset = () => {},
  isSubmitting = false
}) {
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const currentQuestion = session?.current_question;
  const isComplete = session?.is_complete || (!currentQuestion && session?.status === 'ready');
  const total = session?.total_questions || 0;
  const answered = session?.answered_count || 0;
  const currentIndex = (session?.current_question_index || 0) + 1;
  const progressPercent = total > 0 ? Math.round((answered / total) * 100) : (isComplete ? 100 : 0);

  // Clear answer field when question changes
  useEffect(() => {
    setCurrentAnswer('');
    setShowPassword(false);
  }, [currentQuestion?.id]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!currentAnswer.trim() || isSubmitting) return;
    onAnswer(currentQuestion?.field, currentAnswer.trim());
    setCurrentAnswer('');
  };

  const handleQuickReply = (val) => {
    if (isSubmitting) return;
    onAnswer(currentQuestion?.field, val);
  };

  const handleVoiceInput = (text) => {
    setCurrentAnswer((prev) => (prev ? `${prev} ${text}` : text));
  };

  if (!session) {
    return (
      <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center min-h-[300px]">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3">
          <HelpCircle className="w-6 h-6" />
        </div>
        <h4 className="text-base font-semibold text-slate-200 mb-1">Conversational Builder</h4>
        <p className="text-xs text-slate-400 max-w-xs">
          Describe any task on the left in English, Hindi, or Urdu. The AI will inspect your requirements and ask for missing inputs here.
        </p>
      </div>
    );
  }

  // All questions completed state
  if (isComplete) {
    return (
      <div className="glass-panel p-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/10 flex flex-col justify-between min-h-[340px] animate-fadeIn">
        <div>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-emerald-500/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-emerald-300">Requirements Complete!</h4>
                <p className="text-[11px] text-slate-400">All required inputs have been verified</p>
              </div>
            </div>
            <button
              onClick={onReset}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
              title="Reset questions"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          <div className="space-y-3 mb-4">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-1 font-mono">Verified Goal</span>
              <p className="text-sm text-slate-200 font-medium">{session.goal || session.prompt}</p>
            </div>

            {session.trigger && (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" /> Trigger Schedule:
                </span>
                <span className="text-cyan-300 font-semibold font-mono">
                  {session.trigger.time_display || 'Manual Execution'}
                </span>
              </div>
            )}

            {session.known_inputs && Object.keys(session.known_inputs).length > 0 && (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-2 font-mono">Collected Inputs</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(session.known_inputs).map(([k, v]) => (
                    <div key={k} className="bg-black/30 px-2.5 py-1.5 rounded-lg border border-white/5">
                      <span className="text-slate-500 block text-[10px] uppercase font-mono">{k.replace('_', ' ')}</span>
                      <span className="text-slate-200 truncate block font-medium">
                        {k.includes('password') || k.includes('token') ? '••••••••' : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-emerald-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Ready to build workflow plan
          </span>
          <span className="text-[11px] font-mono bg-emerald-500/20 px-2 py-0.5 rounded-full text-emerald-300">
            {answered} / {total || answered} Verified
          </span>
        </div>
      </div>
    );
  }

  // Active question state
  return (
    <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between min-h-[380px] shadow-xl relative overflow-hidden">
      {/* Top Background Glow Accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-violet-500 to-emerald-500 opacity-80" />

      <div>
        {/* Panel Header & Progress Indicator */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">
              {currentIndex}
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                Question {currentIndex} of {total}
              </h4>
              <p className="text-[11px] text-slate-400">
                {answered} of {total} answered
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded-full">
            {progressPercent}% Complete
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800/80 rounded-full h-1.5 mb-5 overflow-hidden border border-white/5">
          <div 
            className="bg-gradient-to-r from-cyan-400 to-violet-500 h-1.5 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Current Question Text */}
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-100 leading-snug mb-1.5">
            {currentQuestion?.question}
          </h3>
          {currentQuestion?.help_text && (
            <p className="text-xs text-slate-400 leading-relaxed">
              {currentQuestion.help_text}
            </p>
          )}
        </div>

        {/* Quick Reply Chips (if provided) */}
        {currentQuestion?.quick_replies && currentQuestion.quick_replies.length > 0 && (
          <div className="mb-5">
            <span className="text-[11px] text-slate-400 block mb-2 font-mono">Suggested quick replies:</span>
            <div className="flex flex-wrap gap-1.5">
              {currentQuestion.quick_replies.map((replyText, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleQuickReply(replyText)}
                  className="px-3 py-1.5 rounded-xl text-xs bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-200 border border-white/10 hover:border-cyan-500/30 text-slate-300 transition-all active:scale-95"
                >
                  {replyText}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative flex items-center">
            <input
              type={currentQuestion?.is_secret && !showPassword ? 'password' : (currentQuestion?.input_type === 'time' ? 'text' : currentQuestion?.input_type || 'text')}
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder={currentQuestion?.placeholder || 'Type your answer...'}
              disabled={isSubmitting}
              autoFocus
              className="w-full bg-slate-900/80 border border-white/15 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition-all pr-24"
            />

            {/* Secret Toggle Icon */}
            {currentQuestion?.is_secret && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-12 text-slate-400 hover:text-slate-200 p-1"
                title={showPassword ? 'Hide secret' : 'Show secret'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}

            {/* Microphone Voice Button */}
            <div className="absolute right-2 flex items-center">
              <VoiceInputButton 
                onTranscript={handleVoiceInput} 
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-slate-500">
              {currentQuestion?.is_secret ? '🔒 Secret is encrypted and never logged' : 'Answer typed or spoken in EN/HI/UR'}
            </p>
            <button
              type="submit"
              disabled={!currentAnswer.trim() || isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <span>Submit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1 text-slate-400">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          The AI will automatically build the workflow once all inputs are answered.
        </span>
      </div>
    </div>
  );
}
