import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, ListOrdered, Sparkles, Clock } from 'lucide-react';

export default function PlannerChecklist({ planItems = [] }) {
  if (!planItems || planItems.length === 0) return null;

  const completedCount = planItems.filter(i => i.status === 'completed').length;
  const progressPercent = Math.round((completedCount / planItems.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl border border-violet-500/30 bg-violet-950/20 backdrop-blur-md space-y-3"
    >
      {/* Header and Progress Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-500/20 text-violet-300">
            <ListOrdered className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white font-display uppercase tracking-wider">
              Execution Plan Checklist
            </h4>
            <p className="text-[11px] text-slate-400">
              {completedCount} of {planItems.length} steps completed ({progressPercent}%)
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold text-violet-400">
          {progressPercent}%
        </span>
      </div>

      {/* Progress Bar Line */}
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Checklist items */}
      <div className="space-y-2 pt-1">
        {planItems.map((item, idx) => {
          const isDone = item.status === 'completed';
          const isInProgress = item.status === 'in_progress';

          return (
            <div
              key={`plan-item-${item.id || idx}`}
              className={`flex items-start gap-2.5 text-xs p-2 rounded-lg transition-all ${
                isDone
                  ? 'bg-emerald-500/10 text-slate-300'
                  : isInProgress
                  ? 'bg-cyan-500/10 border border-cyan-500/30 text-white shadow-glow-cyan'
                  : 'text-slate-400 bg-white/[0.02]'
              }`}
            >
              <div className="mt-0.5 flex-shrink-0">
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : isInProgress ? (
                  <div className="relative flex items-center justify-center w-4 h-4">
                    <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
                  </div>
                ) : (
                  <Circle className="w-4 h-4 text-slate-600" />
                )}
              </div>

              <div className="flex-1 leading-snug">
                <span className={`font-medium ${isDone ? 'line-through text-slate-400' : ''}`}>
                  {item.text}
                </span>
                {isInProgress && (
                  <span className="ml-2 text-[10px] text-cyan-300 font-semibold uppercase tracking-wider">
                    In Progress
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
