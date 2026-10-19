import React, { useState } from 'react';
import { 
  Sparkles, 
  Layers, 
  ShieldCheck, 
  Zap, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  X,
  FileCheck,
  Send,
  Lock
} from 'lucide-react';

const TOUR_STEPS = [
  {
    step: 1,
    title: '1. Describe in Plain Language',
    subtitle: 'टाइप या बोलकर बताएं',
    icon: Sparkles,
    accent: 'from-cyan-500 to-blue-600',
    description: 'Type or speak your goal in plain English, Hindi, or Hinglish. For example: "Send me Lucknow weather by email" or "Fetch latest AI news and save to workspace/news.txt". No manual flowcharting needed.',
    highlight: 'Speech-to-Text & Hindi support built-in.'
  },
  {
    step: 2,
    title: '2. Smart Planning & Questions',
    subtitle: 'प्लान निर्माण व इनपुट जांच',
    icon: Layers,
    accent: 'from-violet-500 to-purple-600',
    description: 'The AI extracts your goal, schedules, and tools. If any details are missing (like city, email, or schedule time), the Questions panel asks you ONE question at a time with quick-reply buttons.',
    highlight: 'Sensitive keys & tokens are masked with *** and never sent in prompts.'
  },
  {
    step: 3,
    title: '3. Human-in-the-Loop Approval',
    subtitle: 'मानवीय स्वीकृति व सुरक्षा',
    icon: ShieldCheck,
    accent: 'from-amber-500 to-orange-600',
    description: 'You are always in control! Whenever a step sends an email, messages Telegram, or writes a file, AgentFlow stops and shows a clear Approval Card with real recipients and body text. You decide with Approve or Reject.',
    highlight: 'Zero unauthorized actions. Simulation mode available.'
  },
  {
    step: 4,
    title: '4. Instant Results & Downloads',
    subtitle: 'लाइव परिणाम व फ़ाइल डाउनलोड',
    icon: Zap,
    accent: 'from-emerald-500 to-teal-600',
    description: 'Watch live step progression on the visual timeline. Once complete, inspect verified headlines with dates, weather cards, and download generated workspace files with one click.',
    highlight: '100% private local inference. Sandboxed to workspace/.'
  }
];

export default function WelcomeTourModal({ isOpen, onClose }) {
  const [currentIdx, setCurrentIdx] = useState(0);

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentIdx];
  const Icon = currentStep.icon;
  const isLast = currentIdx === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem('agentflow_tour_seen', 'true');
      onClose();
    } else {
      setCurrentIdx(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(prev => prev - 1);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('agentflow_tour_seen', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg p-6 sm:p-7 rounded-3xl bg-slate-900 border border-white/10 shadow-2xl relative overflow-hidden flex flex-col justify-between">
        
        {/* Top Glow bar */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${currentStep.accent}`} />

        {/* Close button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          title="Close guide"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          {/* Step pill */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-cyan-300">
              Quick Guide • Step {currentIdx + 1} of 4
            </span>
          </div>

          {/* Icon & Title */}
          <div className="flex items-start gap-4 mb-4">
            <div className={`p-3 rounded-2xl bg-gradient-to-tr ${currentStep.accent} text-white shadow-lg`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-display">
                {currentStep.title}
              </h3>
              <p className="text-xs text-cyan-400 font-medium">
                {currentStep.subtitle}
              </p>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
            {currentStep.description}
          </p>

          {/* Feature Highlight Callout */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-400 flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="text-slate-300 font-medium">{currentStep.highlight}</span>
          </div>
        </div>

        {/* Stepper Dots & Navigation Buttons */}
        <div className="pt-6 mt-4 border-t border-white/10 flex items-center justify-between">
          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((s, idx) => (
              <button
                key={s.step}
                type="button"
                onClick={() => setCurrentIdx(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === currentIdx ? 'w-6 bg-cyan-400' : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
                title={`Go to step ${s.step}`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {currentIdx > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-1.5"
            >
              <span>{isLast ? "Let's Build!" : 'Next Step'}</span>
              {isLast ? <Check className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
