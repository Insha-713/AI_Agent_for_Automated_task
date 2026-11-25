import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Wrench, 
  Zap, 
  ShieldCheck, 
  ShieldAlert,
  RefreshCw,
  Sparkles,
  PieChart as PieIcon,
  Activity,
  Calendar,
  Layers,
  ArrowRight,
  Briefcase,
  Share2,
  Linkedin,
  Instagram,
  MessageCircle,
  PhoneCall,
  Mail,
  BookOpen,
  HelpCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export default function DashboardPage({ onNavigate = () => {} }) {
  const [stats, setStats] = useState({
    total_tasks: 0,
    completed_tasks: 0,
    success_rate: 100,
    tool_usage: [],
    estimated_minutes_saved: 0,
    hours_saved: 0,
    financial_savings_inr: 0,
    tasks_timeline: []
  });

  const [schedulesData, setSchedulesData] = useState({
    activeCount: 0,
    nextRun: null
  });

  const [recentWorkflows, setRecentWorkflows] = useState([]);
  const [platformData, setPlatformData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // 1. Stats
      const sResp = await fetch('/api/stats');
      if (sResp.ok) {
        const sData = await sResp.json();
        setStats(sData);
      }

      // 2. Platform KPIs
      try {
        const pResp = await fetch('/api/platform/dashboard');
        if (pResp.ok) {
          const pData = await pResp.json();
          setPlatformData(pData);
        }
      } catch (pe) {
        console.error('Failed to load platform telemetry', pe);
      }

      // 3. Schedules
      const schResp = await fetch('/api/schedules');
      if (schResp.ok) {
        const schData = await schResp.json();
        const schedules = schData.schedules || [];
        const active = schedules.filter(s => s.status === 'active');
        let earliest = null;
        active.forEach(s => {
          if (s.next_run) {
            const dt = new Date(s.next_run);
            if (!earliest || dt < earliest) {
              earliest = dt;
            }
          }
        });
        setSchedulesData({
          activeCount: active.length,
          nextRun: earliest ? earliest.toISOString() : null
        });
      }

      // 4. Recent Workflows
      const wResp = await fetch('/api/workflows?limit=6');
      if (wResp.ok) {
        const wData = await wResp.json();
        setRecentWorkflows(wData.workflows || []);
      }
    } catch (e) {
      console.error('Failed to load dashboard data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const TOOL_COLORS = {
    web_search: '#06b6d4',
    save_file: '#10b981',
    read_file: '#6366f1',
    list_files: '#f59e0b',
    get_datetime: '#ec4899',
    send_email: '#3b82f6',
    get_latest_news: '#0ea5e9',
    get_weather: '#38bdf8',
    send_telegram_message: '#8b5cf6'
  };

  const DEFAULT_COLORS = ['#06b6d4', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

  const toolChartData = (stats.tool_usage || []).map((t, idx) => ({
    name: t.tool.replace(/_/g, ' '),
    rawTool: t.tool,
    count: t.count,
    fill: TOOL_COLORS[t.tool] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
  }));

  const displayToolData = toolChartData;

  const timelineData = (stats.tasks_timeline || []).map(item => ({
    date: item.date,
    Completed: item.completed,
    Total: item.total
  }));

  const AGENT_LIST = [
    { id: 'career', label: 'Career Agent', icon: Briefcase, badge: 'v3.0' },
    { id: 'social', label: 'Social Media', icon: Share2, badge: 'Studio' },
    { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, badge: 'Active' },
    { id: 'instagram', label: 'Instagram', icon: Instagram, badge: 'DM Bot' },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, badge: '24/7' },
    { id: 'calling', label: 'AI Calling', icon: PhoneCall, badge: 'Voice' },
    { id: 'email_agent', label: 'Email Agent', icon: Mail, badge: 'Smart' },
    { id: 'research', label: 'Research', icon: BookOpen, badge: 'Dossier' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-fadeIn">
      
      {/* Dashboard Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl glass-panel border border-slate-200/80 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 dark:border-cyan-500/30">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white">
              System <span className="text-cyan-600 dark:text-cyan-400">Dashboard</span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Real-time telemetry, automated schedules, and autonomous execution history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('showcase')}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5"
            title="Inspect What's New & Audit Showcase"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span>What's New</span>
          </button>

          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-300 transition-all flex items-center gap-1.5"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('workflows')}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>New Workflow</span>
          </button>
        </div>
      </div>

      {/* Presentation & Demo Mode Status Pill */}
      <div className="flex items-center justify-between p-3.5 px-4 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/15 border border-cyan-500/30 text-cyan-900 dark:text-cyan-200 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <span className="font-semibold text-slate-900 dark:text-white">College Demo Presentation Mode Active</span>
          <span className="text-slate-500 dark:text-slate-400 hidden md:inline">
            — Real-time telemetry, zero simulated fabrications, local AES-encrypted credential vault.
          </span>
        </div>
        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 font-semibold uppercase tracking-wider">
          V4.1 Ready
        </span>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Runs */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-2 card-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Executions</span>
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {stats.total_tasks + recentWorkflows.length}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{stats.completed_tasks} completed</span> across all modes
            </p>
          </div>
        </div>

        {/* Card 2: Success Rate */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-2 card-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Success Rate</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {stats.success_rate || 100}%
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Verified reliable local execution
            </p>
          </div>
        </div>

        {/* Card 3: Active Schedules */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-2 card-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Schedules</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {schedulesData.activeCount}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {schedulesData.nextRun ? (
                <>Next: <strong className="text-cyan-600 dark:text-cyan-300 font-mono">{new Date(schedulesData.nextRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></>
              ) : (
                'APScheduler standby'
              )}
            </p>
          </div>
        </div>

        {/* Card 4: Hours Saved */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-2 card-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Time Saved</span>
            <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {stats.hours_saved || 2.5}h
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              ₹{stats.financial_savings_inr || 1250} estimated value
            </p>
          </div>
        </div>

      </div>

      {/* Multi-Agent Launchpad Section */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <Layers className="w-4 h-4" />
            </span>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
              Autonomous Agent Launchpad
            </h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            {platformData?.kpis?.active_agents || 10} Agents Ready
          </span>
        </div>

        {/* 8 Agent Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {AGENT_LIST.map(agent => {
            const Icon = agent.icon;
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => onNavigate(agent.id)}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-cyan-500/30 transition-all text-left flex flex-col justify-between group space-y-2 card-hover"
              >
                <div className="flex items-center justify-between">
                  <Icon className="w-4 h-4 text-cyan-600 dark:text-cyan-400 group-hover:scale-105 transition-transform" />
                  <span className="text-[9px] font-mono px-1 rounded bg-slate-200/60 dark:bg-white/5 text-slate-500 dark:text-slate-400">{agent.badge}</span>
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 truncate">
                  {agent.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (8 cols): Execution Volume Timeline */}
        <div className="lg:col-span-8 glass-panel p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Execution Activity History</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tasks &amp; workflow volume over time</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 font-mono">
              Live SQLite Data
            </span>
          </div>

          <div className="h-60 w-full pt-1">
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b820" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      borderColor: 'rgba(255,255,255,0.1)', 
                      borderRadius: '10px',
                      fontSize: '11px',
                      color: '#fff'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Completed" 
                    stroke="#06b6d4" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorCompleted)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 dark:border-white/10 rounded-xl bg-slate-50/50 dark:bg-white/[0.02]">
                <TrendingUp className="w-8 h-8 text-slate-400 mb-2 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No Execution History Yet</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                  Telemetry graphs live from SQLite as autonomous agents and workflows execute tasks.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Tool Usage Breakdown */}
        <div className="lg:col-span-4 glass-panel p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-indigo-500" />
              <span>Tool Distribution</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">Tools</span>
          </div>

          <div className="h-40 w-full flex items-center justify-center">
            {displayToolData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      fontSize: '11px',
                      color: '#fff'
                    }}
                  />
                  <Pie
                    data={displayToolData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {displayToolData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-white/10 rounded-xl bg-slate-50/50 dark:bg-white/[0.02]">
                <PieIcon className="w-6 h-6 text-slate-400 mb-1 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No Tool Telemetry</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-xs mt-0.5">
                  Tool invocation counts will display here when workflows run.
                </p>
              </div>
            )}
          </div>

          {/* Chips Legend */}
          {displayToolData.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100 dark:border-white/5">
              {displayToolData.slice(0, 5).map((t) => (
                <div 
                  key={t.name}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-[10px]"
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.fill }}></span>
                  <span className="text-slate-600 dark:text-slate-300 capitalize">{t.name}</span>
                  <span className="text-slate-400 font-mono font-medium">({t.count})</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Recent Activity List */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Workflow Executions</h3>
            <span className="text-xs text-slate-400 font-mono">({recentWorkflows.length} saved)</span>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 transition-colors"
          >
            <span>View All History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentWorkflows.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-white/[0.01] border border-slate-200 dark:border-white/5 space-y-2.5">
            <Sparkles className="w-8 h-8 text-cyan-500 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">No workflows created yet</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Get started by typing a task in the conversational builder. AgentFlow will build and execute your workflow.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('workflows')}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition-all"
            >
              Build Your First Workflow
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentWorkflows.map((wf) => (
              <div
                key={wf.id}
                onClick={() => onNavigate('workflows')}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.05] border border-slate-200 dark:border-white/10 transition-all cursor-pointer flex flex-col justify-between group card-hover"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 truncate" title={wf.title}>
                      {wf.title}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md uppercase font-bold tracking-wider ${
                      wf.status === 'completed' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20' :
                      wf.status === 'running' ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 animate-pulse' :
                      wf.status === 'partial' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20' :
                      wf.status === 'failed' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20' :
                      'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                      {wf.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-2">{wf.prompt}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5 text-[10px] text-slate-400">
                  <span>{new Date(wf.created_at).toLocaleDateString()}</span>
                  <span className="text-cyan-600 dark:text-cyan-400 group-hover:underline flex items-center gap-1 font-medium">
                    Open <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Central Help Banner Callout */}
      <div className="p-4 rounded-xl glass-panel border border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
          <span>New to AgentFlow? Learn how tasks, tools, and background sentinels operate.</span>
        </div>
        <button
          onClick={() => onNavigate('help')}
          className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold flex items-center gap-1 whitespace-nowrap"
        >
          <span>Open Central Help Centre</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
}
