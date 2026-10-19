import React from 'react';
import { Calendar, BarChart3, Settings, ShieldAlert, Sparkles } from 'lucide-react';

export default function PlaceholderPage({ title, stage, description, icon: Icon = Sparkles }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <div className="glass-panel rounded-3xl p-12 border border-white/10 max-w-lg mx-auto shadow-2xl space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto shadow-glow-cyan">
          <Icon className="w-8 h-8" />
        </div>
        <div className="inline-block px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold uppercase tracking-wider">
          Scheduled for {stage}
        </div>
        <h2 className="text-2xl font-bold font-display text-white">{title}</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
