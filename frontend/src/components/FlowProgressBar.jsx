import React from 'react';
import { Check, Sparkles, Layers, Play, CheckCircle2 } from 'lucide-react';

const STEPS = [
  {
    num: 1,
    title: '1. Describe',
    titleHi: 'विवरण दें',
    help: 'Tell the agent what to do, by typing or voice. / टाइप या बोलकर बताएं।',
    icon: Sparkles
  },
  {
    num: 2,
    title: '2. Review Plan',
    titleHi: 'प्लान देखें',
    help: 'Inspect steps, tool parameters & inputs needed. / तैयार प्लान की जांच करें।',
    icon: Layers
  },
  {
    num: 3,
    title: '3. Run',
    titleHi: 'निष्पादन',
    help: 'Watch live execution & authorize approvals. / लाइव काम देखें व स्वीकृति दें।',
    icon: Play
  },
  {
    num: 4,
    title: '4. Results',
    titleHi: 'परिणाम',
    help: 'View summary, outputs & download files. / परिणाम देखें व फ़ाइल डाउनलोड करें।',
    icon: CheckCircle2
  }
];

export default function FlowProgressBar({ activeStep = 1, isRunning = false, hasResult = false }) {
  return (
    <div className="w-full glass-panel rounded-3xl p-4 sm:p-5 border border-white/10 shadow-xl space-y-3">
      {/* 4 Steps Horizontal Stepper */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 relative">
        {STEPS.map((step) => {
          const isCurrent = activeStep === step.num;
          const isCompleted = activeStep > step.num || (step.num === 4 && hasResult);
          const Icon = step.icon;

          return (
            <div
              key={step.num}
              className={`p-3 rounded-2xl border transition-all flex flex-col justify-between ${
                isCurrent
                  ? 'bg-gradient-to-br from-cyan-500/20 via-cyan-500/10 to-violet-500/20 border-cyan-400/80 ring-2 ring-cyan-400/30 shadow-glow-cyan'
                  : isCompleted
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-white/[0.02] border-white/5 opacity-60'
              }`}
            >
              {/* Step Header */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCompleted
                      ? 'bg-emerald-500 text-black shadow-glow-emerald'
                      : isCurrent
                      ? 'bg-cyan-500 text-black shadow-glow-cyan animate-pulse'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : step.num}
                  </div>
                  <span className={`text-xs font-bold ${isCurrent ? 'text-cyan-300' : isCompleted ? 'text-emerald-300' : 'text-slate-300'}`}>
                    {step.title}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                  {step.titleHi}
                </span>
              </div>

              {/* Subtitle / Help text */}
              <p className={`text-[11px] leading-tight mt-1 ${isCurrent ? 'text-slate-200 font-medium' : 'text-slate-400'}`}>
                {step.help}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
