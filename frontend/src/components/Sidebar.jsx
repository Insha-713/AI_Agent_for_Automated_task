import React from 'react';
import { 
  Bot, 
  Sparkles, 
  Briefcase, 
  BarChart3, 
  Calendar, 
  History, 
  Settings, 
  ShieldCheck, 
  Activity, 
  Newspaper,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Linkedin,
  PhoneCall,
  Mail,
  BookOpen,
  Brain,
  Sliders,
  Plug
} from 'lucide-react';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  onOpenTour,
  collapsed = false,
  onToggleCollapse = () => {}
}) {

  const navSections = [
    {
      title: 'CORE PLATFORM',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: BarChart3, description: 'Overview & Metrics' },
        { id: 'workflows', label: 'Tasks / AI Agent', icon: Sparkles, badge: 'Agent', description: 'Task & Workflow Builder' },
        { id: 'news', label: 'News Intelligence', icon: Newspaper, description: 'RSS & arXiv Digests' },
        { id: 'schedules', label: 'Schedules', icon: Calendar, badge: 'Auto', description: 'Daily & Hourly Sentinels' },
        { id: 'monitoring', label: 'Monitoring', icon: Activity, description: 'Uptime Sentinel' },
        { id: 'integrations', label: 'Integrations', icon: Plug, badge: 'Hub', description: 'Centralized API Hub' },
        { id: 'history', label: 'History', icon: History, description: 'Execution Log' },
        { id: 'showcase', label: 'System Showcase', icon: ShieldCheck, badge: 'Verified', description: 'Live Diagnostics' },
        { id: 'help', label: 'Help Centre', icon: HelpCircle, badge: 'Docs', description: 'Guides & Troubleshooting' },
        { id: 'settings', label: 'Settings', icon: Settings, description: 'LLMs & Environment' },
      ]
    },
    {
      title: 'SPECIALIZED AGENTS',
      items: [
        { id: 'career', label: 'Career Agent', icon: Briefcase, badge: 'v3.0', description: 'Jobs & Applications' },
        { id: 'linkedin', label: 'LinkedIn Agent', icon: Linkedin, badge: 'Growth', description: 'Thought Leadership' },
        { id: 'calling', label: 'AI Calling', icon: PhoneCall, badge: 'Voice', description: 'Exotel Voice' },
        { id: 'email_agent', label: 'Email Agent', icon: Mail, badge: 'Inbox', description: 'Smart Drafter' },
        { id: 'research', label: 'Research & Content', icon: BookOpen, badge: 'Dossier', description: 'Fact Synthesis' },
      ]
    },
    {
      title: 'MEMORY & RULES',
      items: [
        { id: 'rules', label: 'Automation Rules', icon: Sliders, badge: 'Rules', description: 'WHEN/THEN Logic' },
        { id: 'memory', label: 'Central Memory', icon: Brain, badge: 'Shared', description: 'Cross-Agent Context' },
      ]
    }
  ];

  return (
    <aside 
      className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white dark:bg-slate-950/95 border-r border-slate-200 dark:border-white/10 transition-all duration-200 ease-in-out ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-white/10">
        <div 
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-3 cursor-pointer overflow-hidden group"
        >
          <div className="relative flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-600 text-white shadow-sm">
            <Bot className="w-4 h-4 group-hover:scale-105 transition-transform" />
          </div>

          {!collapsed && (
            <div className="min-w-0 transition-opacity duration-150">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white font-display">
                  Agent<span className="text-cyan-600 dark:text-cyan-400">Flow</span>
                </span>
                <span className="text-[9px] px-1 py-0.2 rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 font-mono font-semibold">
                  v3.0
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Autonomous AI Platform</p>
            </div>
          )}
        </div>

        {/* Collapse Toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Navigation List Organized by Sections */}
      <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto custom-scrollbar">
        {navSections.map((sec, secIdx) => (
          <div key={sec.title || secIdx} className="space-y-0.5">
            {!collapsed && (
              <div className="px-2.5 pt-1 pb-1 text-[9px] font-mono font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                {sec.title}
              </div>
            )}
            
            <div className="space-y-0.5">
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id || (item.id === 'connections' && activeTab === 'integrations');
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all group ${
                      isActive
                        ? 'bg-cyan-600/10 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-600/20 dark:border-cyan-500/30 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${
                      isActive 
                        ? 'text-cyan-600 dark:text-cyan-400' 
                        : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                    }`} />
                    
                    {!collapsed && (
                      <div className="flex-1 flex items-center justify-between text-left truncate">
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium tracking-wider uppercase font-mono ${
                            item.badge === 'Docs' || item.badge === 'Verified'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                              : item.badge === 'Agent' || item.badge === 'Auto'
                              ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20'
                              : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer Info & Central Help Centre Link */}
      <div className="p-2.5 border-t border-slate-200 dark:border-white/10 space-y-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('help')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl border text-xs transition-colors ${
            activeTab === 'help'
              ? 'bg-cyan-600/10 text-cyan-700 dark:text-cyan-300 border-cyan-600/30'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
          }`}
          title="Central Help Centre & Documentation"
        >
          <HelpCircle className="w-4 h-4 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
          {!collapsed && <span className="truncate font-medium">Help Centre</span>}
        </button>

        {!collapsed && (
          <div className="px-2.5 py-1 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span className="truncate">Local Sandbox</span>
            <code className="text-cyan-700 dark:text-cyan-400 font-mono text-[9px]">workspace/</code>
          </div>
        )}
      </div>
    </aside>
  );
}
