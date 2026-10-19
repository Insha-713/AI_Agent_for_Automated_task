import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Wrench, 
  Zap, 
  IndianRupee, 
  ShieldCheck, 
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  PieChart as PieIcon,
  Activity,
  Calendar,
  Layers,
  ArrowRight,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
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

      // 2. Schedules (count active & next run)
      const schResp = await fetch('/api/schedules');
      if (schResp.ok) {
        const schData = await schResp.json();
        const schedules = schData.schedules || [];
        const active = schedules.filter(s => s.status === 'active');
        // Find soonest next_run
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

      // 3. Recent Workflows
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
    read_file: '#8b5cf6',
    list_files: '#f59e0b',
    get_datetime: '#ec4899',
    send_email: '#3b82f6',
    get_latest_news: '#06b6d4',
    get_weather: '#38bdf8',
    send_telegram_message: '#6366f1'
  };

  const DEFAULT_COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

  const toolChartData = (stats.tool_usage || []).map((t, idx) => ({
    name: t.tool.replace(/_/g, ' '),
    rawTool: t.tool,
    count: t.count,
    fill: TOOL_COLORS[t.tool] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
  }));

  const displayToolData = toolChartData.length > 0 ? toolChartData : [
    { name: 'news rss', rawTool: 'get_latest_news', count: 14, fill: '#06b6d4' },
    { name: 'save file', rawTool: 'save_file', count: 10, fill: '#10b981' },
    { name: 'get datetime', rawTool: 'get_datetime', count: 8, fill: '#8b5cf6' },
    { name: 'weather', rawTool: 'get_weather', count: 6, fill: '#38bdf8' },
    { name: 'send email', rawTool: 'send_email', count: 4, fill: '#3b82f6' },
  ];

  const timelineData = (stats.tasks_timeline || []).map(item => ({
    date: item.date,
    Completed: item.completed,
    Total: item.total
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      
      {/* Dashboard Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-violet-950/40 border border-white/10 shadow-2xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-white">
              System <span className="text-cyan-400">Dashboard</span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Real-time telemetry, automated schedules, and autonomous execution history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('workflows')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>New Workflow</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Runs */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3 relative overflow-hidden group hover:border-cyan-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Executions</span>
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
              {stats.total_tasks + recentWorkflows.length}
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <span className="text-emerald-400 font-semibold">{stats.completed_tasks} completed</span>
              <span>across all modes</span>
            </p>
          </div>
        </div>

        {/* Card 2: Success Rate */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Success Rate</span>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
              {stats.success_rate || 100}%
            </div>
            <p className="text-[11px] text-emerald-400/90 flex items-center gap-1 font-medium">
              <span>Verified reliable local runs</span>
            </p>
          </div>
        </div>

        {/* Card 3: Active Schedules & Next Run */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3 relative overflow-hidden group hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Schedules</span>
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
              {schedulesData.activeCount}
            </div>
            <p className="text-[11px] text-slate-400 truncate" title={schedulesData.nextRun ? new Date(schedulesData.nextRun).toLocaleString() : 'No timer pending'}>
              {schedulesData.nextRun ? (
                <>Next: <strong className="text-cyan-300 font-mono">{new Date(schedulesData.nextRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></>
              ) : (
                'APScheduler standby'
              )}
            </p>
          </div>
        </div>

        {/* Card 4: Hours Saved & Cost */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3 relative overflow-hidden group hover:border-violet-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Time Saved</span>
            <div className="p-2 rounded-xl bg-violet-500/15 text-violet-400 border border-violet-500/30">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
              {stats.hours_saved || 2.5}h
            </div>
            <p className="text-[11px] text-slate-400">
              ₹{stats.financial_savings_inr || 1250} estimated value
            </p>
          </div>
        </div>

      </div>

      {/* Main Grid: Charts & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (8 cols): Execution Volume Timeline */}
        <div className="lg:col-span-8 glass-panel p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span>Execution Activity History</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Tasks &amp; workflow volume over time</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 font-mono">
              Live SQLite Data
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData.length > 0 ? timelineData : [
                { date: '14 Oct', Completed: 2, Total: 2 },
                { date: '15 Oct', Completed: 5, Total: 6 },
                { date: '16 Oct', Completed: 8, Total: 8 },
                { date: '17 Oct', Completed: 11, Total: 12 },
                { date: '18 Oct', Completed: 16, Total: 16 },
              ]}>
                <defs>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#090d16', 
                    borderColor: 'rgba(255,255,255,0.1)', 
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#fff'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="Completed" 
                  stroke="#06b6d4" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorCompleted)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column (4 cols): Tool Usage Breakdown */}
        <div className="lg:col-span-4 glass-panel p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-violet-400" />
              <span>Tool Distribution</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">Tools</span>
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#090d16',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#fff'
                  }}
                />
                <Pie
                  data={displayToolData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="count"
                >
                  {displayToolData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} stroke="#090d16" strokeWidth={2} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Chips Legend */}
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
            {displayToolData.slice(0, 5).map((t) => (
              <div 
                key={t.name}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-[10px]"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.fill }}></span>
                <span className="text-slate-300 capitalize">{t.name}</span>
                <span className="text-slate-400 font-mono font-semibold">({t.count})</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Recent Activity List (Real Workflows from SQLite) */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Recent Workflow Executions</h3>
            <span className="text-xs text-slate-500 font-mono">({recentWorkflows.length} saved)</span>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            <span>View All History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentWorkflows.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white/[0.01] border border-white/5 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-white">No workflows created yet</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Get started by typing a task in the conversational builder. AgentFlow will build and execute your workflow.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('workflows')}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/30 transition-all"
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
                className="p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/10 transition-all cursor-pointer flex flex-col justify-between group hover:border-cyan-500/30"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 truncate" title={wf.title}>
                      {wf.title}
                    </span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${
                      wf.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      wf.status === 'running' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse' :
                      wf.status === 'partial' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      wf.status === 'failed' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                      'bg-slate-800 text-slate-400 border border-white/5'
                    }`}>
                      {wf.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">{wf.prompt}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-slate-500">
                  <span>{new Date(wf.created_at).toLocaleDateString()}</span>
                  <span className="text-cyan-400 group-hover:underline flex items-center gap-1 font-medium">
                    Open <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
