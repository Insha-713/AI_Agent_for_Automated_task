import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Mail, 
  Send, 
  Sun, 
  Moon, 
  HelpCircle,
  Activity
} from 'lucide-react';

export default function TopStatusBar({ 
  dryRun = false, 
  onToggleDryRun = () => {}, 
  onOpenIntegrations = () => {},
  onOpenTour = () => {},
  isDark = true,
  toggleTheme = () => {}
}) {
  const [health, setHealth] = useState({ active_model: 'Detecting...', status: 'checking' });
  const [integrationsStatus, setIntegrationsStatus] = useState({
    gmail: false,
    telegram: false,
    loading: true
  });

  const fetchStatus = async () => {
    try {
      const hRes = await fetch('/api/health');
      if (hRes.ok) {
        const hData = await hRes.json();
        setHealth(hData);
      }
    } catch (e) {
      setHealth({ active_model: 'Offline', status: 'error' });
    }

    try {
      const iRes = await fetch('/api/integrations/status');
      if (iRes.ok) {
        const iData = await iRes.json();
        const services = iData.services || [];
        const gmailSvc = services.find(s => s.service === 'gmail_smtp' || s.service === 'gmail');
        const telegramSvc = services.find(s => s.service === 'telegram');
        setIntegrationsStatus({
          gmail: gmailSvc ? gmailSvc.status === 'connected' : false,
          telegram: telegramSvc ? telegramSvc.status === 'connected' : false,
          loading: false
        });
      }
    } catch (e) {
      setIntegrationsStatus(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const isBackendHealthy = health.status === 'healthy';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-white/10 glass-panel bg-white/90 dark:bg-slate-950/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-13 py-2 flex items-center justify-between gap-4">
        
        {/* Left: Backend & Model Status Pills */}
        <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto py-0.5">
          {/* Backend Status */}
          <div 
            onClick={onOpenIntegrations}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
            title="FastAPI Backend Health"
          >
            <span className={`w-2 h-2 rounded-full ${isBackendHealthy ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
            <span className="font-medium hidden sm:inline">Backend:</span>
            <span className={isBackendHealthy ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-rose-600 dark:text-rose-300 font-semibold'}>
              {isBackendHealthy ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* AI Model Name */}
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-800 dark:text-cyan-300 font-mono"
            title={`Active LLM: ${health.active_model}`}
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="truncate max-w-[120px] sm:max-w-[160px] font-semibold">{health.active_model}</span>
          </div>

          {/* Telegram Status */}
          <button
            type="button"
            onClick={onOpenIntegrations}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 transition-colors"
            title="Telegram Bot - Click to configure"
          >
            <Send className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span className="hidden md:inline">Telegram:</span>
            <span className={`w-1.5 h-1.5 rounded-full ${integrationsStatus.telegram ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
              {integrationsStatus.telegram ? 'Ready' : 'Standby'}
            </span>
          </button>
        </div>

        {/* Right: Simulation Mode Toggle, Help, and Theme */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
          {/* Real vs Simulation Mode Toggle */}
          <button
            type="button"
            onClick={onToggleDryRun}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              dryRun
                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
                : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
            }`}
            title="Toggle between Real Execution and Simulation Dry Run"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${dryRun ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span>{dryRun ? 'SIMULATION' : 'REAL RUN'}</span>
          </button>

          {/* Tour Modal Trigger */}
          <button
            type="button"
            onClick={onOpenTour}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Interactive Welcome Tour"
          >
            <HelpCircle className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="hidden sm:inline font-medium">Tour</span>
          </button>

          {/* Dark / Light Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Toggle Dark / Light Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-600" />}
          </button>
        </div>

      </div>
    </header>
  );
}
