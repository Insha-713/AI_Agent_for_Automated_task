import React from 'react';
import { AlertCircle, ArrowRight, Plug, CheckCircle2 } from 'lucide-react';

export default function AgentOnboardingBanner({
  agentName = "This agent",
  requiredIntegration = "an integration",
  isConfigured = false,
  description = "",
  onOpenConnections = () => {}
}) {
  if (isConfigured) return null;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 shadow-lg backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex-shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5" />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              Setup Required: Connect {requiredIntegration}
            </h4>
            <p className="text-xs text-amber-200/80 mt-0.5">
              {description || `${agentName} requires a verified ${requiredIntegration} connection to publish, automate, or sync in production.`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenConnections}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition-all flex-shrink-0"
        >
          <Plug className="w-3.5 h-3.5" />
          <span>Open Connections & Setup</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
