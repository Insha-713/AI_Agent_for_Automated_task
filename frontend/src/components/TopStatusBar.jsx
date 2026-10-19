import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Mail, 
  Send, 
  ShieldCheck, 
  ShieldAlert, 
  Activity, 
  HelpCircle, 
  Sun, 
  Moon, 
  ExternalLink,
  Zap,
  CheckCircle2,
  AlertCircle
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
    <header className="sticky top-0 z-40 w-full border-b border-white/10 glass-panel bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        
        {/* Left: Backend & Model Status Pills */}
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto py-1">
          {/* Backend Status */}
          <div 
            onClick={onOpenIntegrations}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-slate-300 cursor-pointer transition-colors"
            title="FastAPI Backend Health"
          >
            <span className={`w-2 h-2 rounded-full ${isBackendHealthy ? 'bg-emerald-400 shadow-glow-emerald' : 'bg-rose-400 animate-pulse'}`} />
            <span className="font-medium hidden sm:inline">Backend:</span>
            <span className={isBackendHealthy ? 'text-emerald-300 font-semibold' : 'text-rose-300'}>
              {isBackendHealthy ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* AI Model Name */}
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 font-mono"
            title={`Active Local LLM: ${health.active_model}`}
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="truncate max-w-[120px] sm:max-w-[160px] font-semibold">{health.active_model}</span>
          </div>

          {/* Gmail Status */}
          <button
            type="button"
            onClick={onOpenIntegrations}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-slate-300 transition-colors"
            title="Gmail SMTP/IMAP - Click to configure"
          >
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Gmail:</span>
            <span className={`w-2 h-2 rounded-full ${integrationsStatus.gmail ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              {integrationsStatus.gmail ? 'Ready' : 'Not set'}
            </span>
          </button>

          {/* Telegram Status */}
          <button
            type="button"
            onClick={onOpenIntegrations}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-slate-300 transition-colors"
            title="Telegram Bot - Click to configure"
          >
            <Send className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Telegram:</span>
            <span className={`w-2 h-2 rounded-full ${integrationsStatus.telegram ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              {integrationsStatus.telegram ? 'Ready' : 'Not set'}
            </span>
          </button>
        </div>

        {/* Right: Simulation Mode Toggle, Help Tour, and Theme */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Real vs Simulation Mode Toggle */}
          <button
            type="button"
            onClick={onToggleDryRun}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              dryRun
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-sm'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-sm'
            }`}
            title="Click to toggle between Real Execution and Simulation Dry Run"
          >
            <span className={`w-2 h-2 rounded-full ${dryRun ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span>{dryRun ? 'SIMULATION' : 'REAL RUN'}</span>
          </button>

          {/* Help Tour Button */}
          <button
            type="button"
            onClick={onOpenTour}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition-colors"
            title="How AgentFlow Works / Interactive Tour"
          >
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline font-medium">How it works</span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors"
            title="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-cyan-300" />}
          </button>
        </div>

      </div>
    </header>
  );
}
