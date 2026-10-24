import React, { useState, useEffect, useRef } from 'react';
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
  RotateCcw,
  Upload,
  FileText,
  AlertCircle,
  FolderOpen,
  Loader2,
  FileCheck,
  Paperclip,
  X
} from 'lucide-react';
import { getApiUrl } from '../api/config';
import VoiceInputButton from './VoiceInputButton';

export default function QuestionsPanel({
  session = null,
  onAnswer = () => {},
  onReset = () => {},
  isSubmitting = false
}) {
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // File Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [existingFiles, setExistingFiles] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const fileInputRef = useRef(null);

  const currentQuestion = session?.current_question;
  const isComplete = session?.is_complete || (!currentQuestion && session?.status === 'ready');
  const total = session?.total_questions || 0;
  const answered = session?.answered_count || 0;
  const currentIndex = (session?.current_question_index || 0) + 1;
  const progressPercent = total > 0 ? Math.round((answered / total) * 100) : (isComplete ? 100 : 0);

  const isFileQuestion = Boolean(
    currentQuestion?.input_type === 'file' ||
    currentQuestion?.field === 'resume_filename' ||
    currentQuestion?.field === 'file' ||
    (currentQuestion?.question && /upload|resume file|document|pdf|docx/i.test(currentQuestion.question))
  );

  const fetchExistingWorkspaceFiles = async () => {
    try {
      setIsLoadingFiles(true);
      const res = await fetch(getApiUrl('/api/workspace/files'));
      if (res.ok) {
        const data = await res.json();
        const allFiles = data.files || [];
        const relevant = allFiles.filter(f => 
          /\.(pdf|docx|doc|txt)$/i.test(f.name)
        );
        setExistingFiles(relevant);
      }
    } catch (e) {
      console.warn('Failed to load workspace files for questions panel:', e);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Clear answer field when question changes, load files if file question
  useEffect(() => {
    setCurrentAnswer('');
    setShowPassword(false);
    setUploadError('');
    setUploadSuccess(null);
    setShowManualInput(false);
    if (isFileQuestion) {
      fetchExistingWorkspaceFiles();
    }
  }, [currentQuestion?.id, isFileQuestion]);

  const uploadFile = async (file) => {
    if (!file) return;

    // 1. Validate file extension
    const ext = file.name.split('.').pop().toLowerCase();
    const allowed = ['pdf', 'docx', 'doc', 'txt'];
    if (!allowed.includes(ext)) {
      setUploadError(`Invalid file format ".${ext}". Please choose a PDF or DOCX document.`);
      return;
    }

    // 2. Validate file size (15MB limit)
    if (file.size > 15 * 1024 * 1024) {
      setUploadError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 15 MB.`);
      return;
    }

    setIsUploading(true);
    setUploadError('');
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(getApiUrl('/api/workspace/upload'), {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUploadSuccess({
          filename: data.filename,
          size_kb: data.size_kb,
          message: data.message || `File "${data.filename}" saved to workspace.`
        });
        setCurrentAnswer(data.filename);
        await fetchExistingWorkspaceFiles();
      } else {
        setUploadError(data.detail || 'Failed to upload document.');
      }
    } catch (err) {
      setUploadError('Network error uploading file: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleChooseFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleSelectExisting = (filename) => {
    setCurrentAnswer(filename);
    setUploadSuccess({
      filename: filename,
      size_kb: null,
      message: `Selected existing workspace document: "${filename}"`
    });
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const answerToSubmit = (currentAnswer || uploadSuccess?.filename || '').trim();
    if (!answerToSubmit || isSubmitting) return;
    onAnswer(currentQuestion?.field, answerToSubmit);
    setCurrentAnswer('');
    setUploadSuccess(null);
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

        {/* ============================================================== */}
        {/* SPECIALIZED FILE UPLOADER UI (When question is for file/resume) */}
        {/* ============================================================== */}
        {isFileQuestion ? (
          <div className="space-y-3.5 mb-5">
            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.docx,.doc,.txt"
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading || isSubmitting}
            />

            {/* Choose File Button & Drag-and-Drop Card */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) uploadFile(file);
              }}
              className={`p-5 rounded-2xl border-2 border-dashed transition-all text-center flex flex-col items-center justify-center gap-2.5 ${
                isDragging 
                  ? 'border-cyan-400 bg-cyan-950/40 shadow-glow-cyan' 
                  : 'border-cyan-500/30 hover:border-cyan-400/60 bg-cyan-950/20 hover:bg-cyan-950/30'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center justify-center shadow-inner">
                {isUploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                ) : (
                  <Upload className="w-6 h-6 text-cyan-400" />
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleChooseFileClick}
                  disabled={isUploading || isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 flex items-center gap-2 mx-auto transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploading ? 'Uploading Document...' : 'Choose Resume File'}</span>
                </button>
                <p className="text-[11px] text-slate-400 mt-2">
                  Opens file picker. Accepts <strong className="text-slate-200">PDF</strong> and <strong className="text-slate-200">DOCX</strong> up to 15 MB.
                </p>
              </div>
            </div>

            {/* Upload Error Alert */}
            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span className="flex-1 font-medium">{uploadError}</span>
                <button type="button" onClick={() => setUploadError('')} className="text-rose-400 hover:text-white">&times;</button>
              </div>
            )}

            {/* Upload Success Alert & Confirmation */}
            {uploadSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs space-y-2.5 animate-fadeIn">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>File Ready: <strong className="font-mono text-white">{uploadSuccess.filename}</strong></span>
                  {uploadSuccess.size_kb && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                      {uploadSuccess.size_kb} KB
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Use "{uploadSuccess.filename}" & Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Existing Workspace Files List */}
            {existingFiles.length > 0 && (
              <div className="pt-2 border-t border-white/5 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                    <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                    Or select an existing workspace document:
                  </span>
                  <span className="text-[10px] text-slate-500">{existingFiles.length} found</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                  {existingFiles.map((f, idx) => {
                    const isSelected = currentAnswer === f.name;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectExisting(f.name)}
                        className={`p-2 rounded-xl text-left border text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected 
                            ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200 shadow-sm shadow-cyan-500/20' 
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate min-w-0">
                          <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                          <span className="truncate font-mono text-[11px] block">{f.name}</span>
                        </div>
                        {isSelected ? (
                          <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        ) : (
                          <span className="text-[9.5px] text-slate-500 flex-shrink-0">{f.size_kb} KB</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Manual Text Input Fallback Toggle */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowManualInput(!showManualInput)}
                className="text-[10.5px] text-slate-400 hover:text-cyan-300 underline transition-colors"
              >
                {showManualInput ? 'Hide manual filename input' : 'or enter filename manually'}
              </button>
            </div>
          </div>
        ) : (
          /* Quick Reply Chips (for non-file questions) */
          currentQuestion?.quick_replies && currentQuestion.quick_replies.length > 0 && (
            <div className="mb-5">
              <span className="text-[11px] text-slate-400 block mb-2 font-mono">Suggested quick replies:</span>
              <div className="flex flex-wrap gap-1.5">
                {currentQuestion.quick_replies.map((replyText, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleQuickReply(replyText)}
                    className="px-3 py-1.5 rounded-xl text-xs bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-200 border border-white/10 hover:border-cyan-500/30 text-slate-300 transition-all active:scale-95 cursor-pointer"
                  >
                    {replyText}
                  </button>
                ))}
              </div>
            </div>
          )
        )}

        {/* Input Form (Rendered for standard questions OR when manual input is toggled on file questions) */}
        {(!isFileQuestion || showManualInput) && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative flex items-center">
              <input
                type={currentQuestion?.is_secret && !showPassword ? 'password' : (currentQuestion?.input_type === 'time' ? 'text' : currentQuestion?.input_type || 'text')}
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder={currentQuestion?.placeholder || 'Type your answer...'}
                disabled={isSubmitting || isUploading}
                autoFocus={!isFileQuestion}
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
                  disabled={isSubmitting || isUploading}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-slate-500">
                {currentQuestion?.is_secret ? '🔒 Secret is encrypted and never logged' : 'Answer typed or spoken in EN/HI/UR'}
              </p>
              <button
                type="submit"
                disabled={!currentAnswer.trim() || isSubmitting || isUploading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
              >
                <span>Submit</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}
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
