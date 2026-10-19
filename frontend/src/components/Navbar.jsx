import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  History, 
  Calendar, 
  BarChart3, 
  Settings, 
  Sparkles, 
  ShieldCheck, 
  Cpu,
  Moon,
  Sun,
  Layers,
  Newspaper,
  FileSpreadsheet,
  Activity
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const [health, setHealth] = useState({ active_model: 'Detecting...', status: 'checking' });
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Fetch backend health and active local model
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(() => setHealth({ active_model: 'Offline', status: 'error' }));
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const navItems = [
    { id: 'tasks', label: 'Run Task', icon: Sparkles },
    { id: 'workflows', label: 'Workflows', icon: Layers, badge: 'n8n' },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet, badge: 'Excel' },
    { id: 'monitoring', label: 'Monitoring', icon: Activity, badge: 'Uptime' },
    { id: 'news', label: 'AI News', icon: Newspaper, badge: 'Live' },
    { id: 'history', label: 'History', icon: History },
    { id: 'schedules', label: 'Schedules', icon: Calendar },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 glass-panel">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 shadow-glow-cyan">
            <Bot className="w-6 h-6 text-white" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold font-display tracking-tight text-white">Agent<span className="text-cyan-400">Flow</span></span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">100% Local</span>
            </div>
            <p className="text-[11px] text-slate-400 -mt-0.5 hidden sm:block">Private AI Assistant for Repetitive Digital Work</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-cyan-300 border border-cyan-500/30 shadow-glow-cyan'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 hidden md:inline-block">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Model status pill & theme toggle */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-white/10 text-xs text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">LLM:</span>
            <span className="text-cyan-300 font-mono font-medium">{health.active_model}</span>
            <span className={`w-2 h-2 rounded-full ${health.status === 'healthy' ? 'bg-emerald-400 shadow-glow-emerald' : 'bg-amber-400 animate-pulse'}`} />
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors"
            title="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-cyan-300" />}
          </button>
        </div>

      </div>
    </header>
  );
}
