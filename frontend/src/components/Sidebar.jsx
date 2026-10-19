import React, { useState } from 'react';
import { 
  Bot, 
  Sparkles, 
  Layers, 
  BarChart3, 
  Calendar, 
  History, 
  FileSpreadsheet, 
  Settings, 
  ShieldCheck, 
  Activity, 
  Newspaper,
  ChevronLeft,
  ChevronRight,
  HelpCircle
} from 'lucide-react';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  onOpenTour,
  collapsed = false,
  onToggleCollapse = () => {}
}) {

  const navItems = [
    { id: 'workflows', label: 'Create Workflow', icon: Sparkles, badge: 'Main', description: 'Natural Language Builder' },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, description: 'Overview & Metrics' },
    { id: 'history', label: 'My Workflows', icon: History, description: 'Saved & Re-run History' },
    { id: 'schedules', label: 'Schedules', icon: Calendar, badge: 'Auto', description: 'APScheduler Timers' },
    { id: 'reports', label: 'Reports & Excel', icon: FileSpreadsheet, description: 'Data & KPI Analytics' },
    { id: 'monitoring', label: 'Monitoring', icon: Activity, description: 'Uptime Sentinel' },
    { id: 'news', label: 'Live AI News', icon: Newspaper, description: 'RSS Headliners' },
    { id: 'settings', label: 'Integrations', icon: Settings, badge: 'Setup', description: 'Gmail & Bot Credentials' },
  ];

  return (
    <aside 
      className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-2xl border-r border-white/10 transition-all duration-300 ease-in-out ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
        <div 
          onClick={() => setActiveTab('workflows')}
          className="flex items-center gap-3 cursor-pointer overflow-hidden group"
        >
          <div className="relative flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 shadow-glow-cyan">
            <Bot className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </span>
          </div>

          {!collapsed && (
            <div className="min-w-0 transition-opacity duration-200">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold font-display tracking-tight text-white">Agent<span className="text-cyan-400">Flow</span></span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">v2.0</span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">100% Local AI Assistant</p>
            </div>
          )}
        </div>

        {/* Collapse Toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/20 via-cyan-500/10 to-violet-500/20 text-cyan-300 border border-cyan-500/30 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between text-left truncate">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold tracking-wider uppercase ${
                      item.badge === 'Main' 
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                        : 'bg-white/5 text-slate-400 border border-white/5'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info & Help */}
      <div className="p-3 border-t border-white/10 space-y-2">
        <button
          type="button"
          onClick={onOpenTour}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition-colors"
          title="How AgentFlow Works"
        >
          <HelpCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          {!collapsed && <span className="truncate">How it works</span>}
        </button>

        {!collapsed && (
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-[10px] text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="leading-tight">Sandboxed to <code className="text-cyan-300 font-mono">workspace/</code></span>
          </div>
        )}
      </div>
    </aside>
  );
}
