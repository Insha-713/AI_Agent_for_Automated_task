import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Plus, 
  Play, 
  Pause, 
  Trash2, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  X,
  Zap,
  ArrowRight,
  Edit3,
  Globe2,
  AlertTriangle,
  HelpCircle
} from 'lucide-react';

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST • UTC+5:30)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'America/New_York (EST • UTC-5)' },
  { value: 'Europe/London', label: 'Europe/London (GMT • UTC+0)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST • UTC+4)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT • UTC+8)' }
];

const DAYS_OF_WEEK = [
  { value: 'mon', label: 'Monday' },
  { value: 'tue', label: 'Tuesday' },
  { value: 'wed', label: 'Wednesday' },
  { value: 'thu', label: 'Thursday' },
  { value: 'fri', label: 'Friday' },
  { value: 'sat', label: 'Saturday' },
  { value: 'sun', label: 'Sunday' }
];

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  // Form state
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [frequency, setFrequency] = useState('daily'); // hourly, daily, weekly, cron, interval_1m
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [cronExpression, setCronExpression] = useState('0 8 * * *');
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [dayOfWeek, setDayOfWeek] = useState('mon');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSchedules = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch('/api/schedules');
      if (resp.ok) {
        const data = await resp.json();
        setSchedules(data.schedules || []);
      }
    } catch (e) {
      console.error('Failed to load schedules', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const showToast = (type, text) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 4000);
  };

  const handleOpenCreateModal = () => {
    setEditingScheduleId(null);
    setName('');
    setPrompt('');
    setFrequency('daily');
    setTimezone('Asia/Kolkata');
    setCronExpression('0 8 * * *');
    setHour(8);
    setMinute(0);
    setDayOfWeek('mon');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (s) => {
    setEditingScheduleId(s.id);
    setName(s.name);
    setPrompt(s.prompt);
    setFrequency(s.frequency || 'daily');
    setTimezone(s.timezone || 'Asia/Kolkata');
    setCronExpression(s.cron_expression || '0 8 * * *');
    setHour(8);
    setMinute(0);
    setDayOfWeek('mon');
    setIsModalOpen(true);
  };

  const handleSubmitSchedule = async (e) => {
    e.preventDefault();
    if (!name.trim() || !prompt.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        prompt: prompt.trim(),
        frequency: frequency,
        timezone: timezone,
        cron_expression: cronExpression.trim(),
        hour: parseInt(hour, 10),
        minute: parseInt(minute, 10),
        day_of_week: dayOfWeek
      };

      const url = editingScheduleId ? `/api/schedules/${editingScheduleId}` : '/api/schedules';
      const method = editingScheduleId ? 'PUT' : 'POST';

      const resp = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (resp.ok) {
        showToast('success', `${editingScheduleId ? 'Updated' : 'Created'} recurring schedule: "${name}"`);
        setIsModalOpen(false);
        await fetchSchedules();
      } else {
        const err = await resp.json();
        showToast('error', err.detail || 'Failed to save schedule.');
      }
    } catch (err) {
      showToast('error', 'Network error saving schedule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePause = async (schedule) => {
    const isPaused = schedule.status === 'paused';
    const endpoint = isPaused ? `/api/schedules/${schedule.id}/resume` : `/api/schedules/${schedule.id}/pause`;
    
    try {
      const resp = await fetch(endpoint, { method: 'POST' });
      if (resp.ok) {
        showToast('success', `${isPaused ? 'Resumed' : 'Paused'} "${schedule.name}"`);
        await fetchSchedules();
      }
    } catch (err) {
      showToast('error', 'Action failed.');
    }
  };

  const handleDelete = async (schedule) => {
    if (!window.confirm(`Delete recurring schedule "${schedule.name}"?`)) return;

    try {
      const resp = await fetch(`/api/schedules/${schedule.id}`, { method: 'DELETE' });
      if (resp.ok) {
        showToast('success', `Deleted "${schedule.name}"`);
        await fetchSchedules();
      }
    } catch (err) {
      showToast('error', 'Failed to delete schedule.');
    }
  };

  const handleRunNow = async (schedule) => {
    try {
      const resp = await fetch(`/api/schedules/${schedule.id}/run-now`, { method: 'POST' });
      if (resp.ok) {
        showToast('success', `Triggered immediate execution of "${schedule.name}". Check History in a moment.`);
      }
    } catch (err) {
      showToast('error', 'Failed to trigger scheduled run.');
    }
  };

  const formatFrequency = (freq, s = {}) => {
    switch (freq) {
      case 'hourly': return 'Hourly (Every 1 Hour)';
      case 'daily': return `Daily at ${String(s.hour ?? 8).padStart(2, '0')}:${String(s.minute ?? 0).padStart(2, '0')} (${s.timezone || 'IST'})`;
      case 'weekly': return `Weekly on ${s.day_of_week || 'Mon'} (${s.timezone || 'IST'})`;
      case 'cron':
      case 'custom': return `Custom Cron: ${s.cron_expression || 'Custom'} (${s.timezone || 'IST'})`;
      case 'daily_8am': return 'Daily at 8:00 AM IST';
      case 'daily_9pm': return 'Daily at 9:00 PM IST';
      case 'interval_60m': return 'Every 60 Minutes (Hourly)';
      case 'interval_6h': return 'Every 6 Hours';
      case 'interval_1m': return 'Every 1 Minute (Demo Mode)';
      default: return freq;
    }
  };

  const templates = [
    {
      name: "Daily Morning AI News Brief",
      prompt: "Search for top 3 AI, technology, and startup developments in India today. Summarize each with key points and save to workspace/daily_ai_brief.txt.",
      frequency: "daily",
      timezone: "Asia/Kolkata",
      hour: 8,
      minute: 0
    },
    {
      name: "Weekly Remote Jobs Digest",
      prompt: "Search for new remote developer jobs in India posted this week. Summarize salary ranges and roles into workspace/jobs_digest.txt.",
      frequency: "weekly",
      timezone: "Asia/Kolkata",
      day_of_week: "mon",
      hour: 9,
      minute: 0
    },
    {
      name: "Hourly Workspace & Time Audit",
      prompt: "Check date and time in India (IST), list all files in workspace/, and record a timestamped audit log to workspace/audit_log.txt.",
      frequency: "hourly",
      timezone: "Asia/Kolkata"
    },
    {
      name: "Weekday Business Monitor (Custom Cron)",
      prompt: "Audit workspace contracts and run health check on current tasks.",
      frequency: "cron",
      cronExpression: "0 9 * * 1-5",
      timezone: "Asia/Kolkata"
    }
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-medium mb-2">
            <Clock className="w-3.5 h-3.5" />
            <span>APScheduler Persistent Background Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-white">
            Scheduled Tasks
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Keep your agent working on schedules: hourly audits, daily digests, weekly reports, or custom cron jobs with timezone precision.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchSchedules}
            className="p-2 rounded-xl glass-card border border-white/10 text-slate-400 hover:text-white transition-colors"
            title="Refresh schedules"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-glow-cyan transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Schedule</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {actionMessage && (
        <div className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 border shadow-lg animate-fade-in ${
          actionMessage.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200' 
            : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
        }`}>
          {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Quick Templates Strip */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>1-Click Scheduled Templates:</span>
          </span>
          <span className="text-[11px] text-slate-500">Persistent across restarts</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {templates.map((tmpl, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setName(tmpl.name);
                setPrompt(tmpl.prompt);
                setFrequency(tmpl.frequency);
                setTimezone(tmpl.timezone || 'Asia/Kolkata');
                if (tmpl.cronExpression) setCronExpression(tmpl.cronExpression);
                if (tmpl.hour !== undefined) setHour(tmpl.hour);
                if (tmpl.minute !== undefined) setMinute(tmpl.minute);
                if (tmpl.day_of_week) setDayOfWeek(tmpl.day_of_week);
                setIsModalOpen(true);
              }}
              className="text-left p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 transition-all group"
            >
              <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 block truncate">
                {tmpl.name}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                {tmpl.frequency.toUpperCase()} • {tmpl.timezone}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Schedules List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-xs">Loading active schedules...</div>
      ) : schedules.length === 0 ? (
        <div className="p-12 text-center glass-panel rounded-2xl border border-white/10 space-y-3">
          <Calendar className="w-12 h-12 text-slate-500 mx-auto opacity-40" />
          <h3 className="text-sm font-semibold text-slate-300">No recurring tasks configured</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Click "New Schedule" above or pick a template to schedule daily briefings, job searches, or file audits.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {schedules.map((s) => {
            const isActive = s.status === 'active';
            const isFailed = s.last_status === 'failed';
            const failCount = s.consecutive_failures || 0;

            return (
              <div
                key={s.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md ${
                  isFailed
                    ? 'bg-rose-950/20 border-rose-500/30'
                    : isActive
                    ? 'bg-slate-900/60 border-white/10 hover:border-cyan-500/30'
                    : 'bg-slate-950/40 border-white/5 opacity-75'
                }`}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-white truncate max-w-md" title={s.name}>
                      {s.name}
                    </h3>
                    
                    {/* Status badge */}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${
                      isActive 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                      {isActive ? 'Active' : 'Paused'}
                    </span>

                    {/* Failure alert badge */}
                    {failCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1" title={s.last_error || 'Execution failed'}>
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        <span>{failCount} {failCount === 1 ? 'Failure' : 'Failures'}</span>
                      </span>
                    )}

                    {/* Timezone pill */}
                    <span className="px-2 py-0.5 rounded bg-white/5 text-slate-400 text-[10px] font-mono border border-white/5 flex items-center gap-1">
                      <Globe2 className="w-3 h-3 text-cyan-400" />
                      {s.timezone || 'Asia/Kolkata'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {s.prompt}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1">
                    <span>
                      <strong>Frequency:</strong> {formatFrequency(s.frequency, s)}
                    </span>
                    {s.next_run && (
                      <span className="text-cyan-400 font-mono">
                        <strong>Next Run:</strong> {new Date(s.next_run).toLocaleString()}
                      </span>
                    )}
                    {s.last_run && (
                      <span>
                        <strong>Last Run:</strong> {new Date(s.last_run).toLocaleString()} ({s.last_status || 'done'})
                      </span>
                    )}
                  </div>

                  {/* Error preview if failed */}
                  {s.last_error && (
                    <div className="mt-1 text-[11px] font-mono text-rose-300 bg-rose-950/40 p-1.5 rounded border border-rose-500/20 truncate" title={s.last_error}>
                      Error: {s.last_error}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 self-end md:self-center">
                  <button
                    type="button"
                    onClick={() => handleRunNow(s)}
                    title="Run now immediately in background"
                    className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-medium flex items-center gap-1.5 transition-all"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Run Now</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTogglePause(s)}
                    title={isActive ? "Pause schedule" : "Resume schedule"}
                    className="p-2 rounded-xl glass-card border border-white/10 text-slate-400 hover:text-white transition-all"
                  >
                    {isActive ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(s)}
                    title="Edit schedule"
                    className="p-2 rounded-xl glass-card border border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(s)}
                    title="Delete schedule"
                    className="p-2 rounded-xl glass-card border border-white/10 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl max-w-lg w-full space-y-4 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-white font-semibold text-base">
                <Calendar className="w-5 h-5 text-cyan-400" />
                <span>{editingScheduleId ? 'Edit Recurring Schedule' : 'Create Recurring Task'}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Schedule Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="E.g. Daily Tech News Briefing"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/60 border border-white/10 text-slate-100 text-xs sm:text-sm outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Task Prompt (Agent Instructions)
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="E.g. Search for top 3 AI tools released today and save summary to workspace/daily_brief.txt"
                  rows={3}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/60 border border-white/10 text-slate-100 text-xs sm:text-sm outline-none focus:border-cyan-500 transition-colors resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Frequency Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-slate-100 text-xs sm:text-sm outline-none focus:border-cyan-500 transition-colors"
                  >
                    <option value="hourly">Hourly (Every 1 Hour)</option>
                    <option value="daily">Daily (Specified Time)</option>
                    <option value="weekly">Weekly (Specified Day)</option>
                    <option value="cron">Custom Cron Expression</option>
                    <option value="interval_1m">1 Minute (Demo / Test Mode)</option>
                  </select>
                </div>

                {/* Timezone Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-slate-100 text-xs sm:text-sm outline-none focus:border-cyan-500 transition-colors font-mono text-[11px]"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conditional Timing Inputs */}
              {(frequency === 'daily' || frequency === 'weekly') && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  {frequency === 'weekly' && (
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Day of Week
                      </label>
                      <select
                        value={dayOfWeek}
                        onChange={(e) => setDayOfWeek(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-slate-200 text-xs"
                      >
                        {DAYS_OF_WEEK.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Hour (0 - 23)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={hour}
                      onChange={(e) => setHour(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-slate-200 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Minute (0 - 59)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={minute}
                      onChange={(e) => setMinute(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-slate-200 text-xs"
                    />
                  </div>
                </div>
              )}

              {frequency === 'cron' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Cron Expression (5-field syntax)
                    </label>
                    <span className="text-[10px] text-cyan-400 font-mono">e.g. 0 9 * * 1-5</span>
                  </div>
                  <input
                    type="text"
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    placeholder="0 8 * * * (minute hour day month day_of_week)"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 font-mono text-xs text-cyan-300 border border-white/10 outline-none focus:border-cyan-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Example: <code className="text-slate-300">0 8 * * *</code> = 8am daily, <code className="text-slate-300">*/30 * * * *</code> = every 30 mins.
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-glow-cyan transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isSubmitting ? 'Saving...' : editingScheduleId ? 'Save Changes' : 'Activate Schedule'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
