import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Globe,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Trash2,
  Pause,
  Play,
  Clock,
  ShieldAlert,
  Zap,
  Sparkles,
  Server
} from 'lucide-react';
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis
} from 'recharts';

export default function MonitoringPage() {
  const [monitors, setMonitors] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkingIds, setCheckingIds] = useState(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMonitor, setNewMonitor] = useState({
    name: '',
    url: '',
    expected_status: 200,
    interval_minutes: 15,
    failure_threshold: 3
  });
  const [modalError, setModalError] = useState('');

  // Fetch all monitors on mount
  useEffect(() => {
    fetchMonitors();
  }, []);

  const fetchMonitors = async () => {
    try {
      const res = await fetch('/api/monitors');
      const data = await res.json();
      if (data.monitors) {
        setMonitors(data.monitors);
        setKpis(data.kpis);
      }
    } catch (err) {
      console.error('Failed to load website monitors:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckSingle = async (monitorId) => {
    setCheckingIds(prev => new Set(prev).add(monitorId));
    try {
      const res = await fetch(`/api/monitors/${monitorId}/check`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.monitor) {
        setMonitors(prev => prev.map(m => m.id === monitorId ? data.monitor : m));
        // Refresh high level KPIs
        fetchMonitors();
      }
    } catch (err) {
      console.error('Failed checking monitor:', err);
    } finally {
      setCheckingIds(prev => {
        const next = new Set(prev);
        next.delete(monitorId);
        return next;
      });
    }
  };

  const handleCheckAll = async () => {
    setCheckingAll(true);
    try {
      const res = await fetch('/api/monitors/check-all', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setMonitors(data.monitors);
        setKpis(data.kpis);
      }
    } catch (err) {
      console.error('Failed checking all monitors:', err);
    } finally {
      setCheckingAll(false);
    }
  };

  const handleToggleActive = async (monitorId) => {
    try {
      const res = await fetch(`/api/monitors/${monitorId}/toggle`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setMonitors(prev => prev.map(m => m.id === monitorId ? { ...m, is_active: data.is_active } : m));
      }
    } catch (err) {
      console.error('Failed toggling monitor:', err);
    }
  };

  const handleDelete = async (monitorId) => {
    if (!window.confirm('Are you sure you want to delete this monitor?')) return;
    try {
      const res = await fetch(`/api/monitors/${monitorId}`, { method: 'DELETE' });
      if (res.ok) {
        setMonitors(prev => prev.filter(m => m.id !== monitorId));
        fetchMonitors();
      }
    } catch (err) {
      console.error('Failed deleting monitor:', err);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    if (!newMonitor.name.trim() || !newMonitor.url.trim()) {
      setModalError('Please enter both service name and valid URL.');
      return;
    }

    try {
      const res = await fetch('/api/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMonitor)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create monitor');
      }
      setIsModalOpen(false);
      setNewMonitor({
        name: '',
        url: '',
        expected_status: 200,
        interval_minutes: 15,
        failure_threshold: 3
      });
      fetchMonitors();
    } catch (err) {
      setModalError(err.message);
    }
  };

  const addPreset = (preset) => {
    setNewMonitor({
      name: preset.name,
      url: preset.url,
      expected_status: 200,
      interval_minutes: preset.interval || 15,
      failure_threshold: 3
    });
    setIsModalOpen(true);
  };

  const PRESETS = [
    { name: 'NPCI UPI Portal', url: 'https://www.npci.org.in', interval: 15 },
    { name: 'Google India', url: 'https://www.google.co.in', interval: 30 },
    { name: 'GitHub Status', url: 'https://www.githubstatus.com', interval: 30 },
    { name: 'Python PyPI', url: 'https://pypi.org', interval: 60 }
  ];

  const getStatusBadge = (status, isActive) => {
    if (!isActive) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5">
          <Pause className="w-3 h-3" /> Paused
        </span>
      );
    }
    if (status === 'up') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Operational
        </span>
      );
    }
    if (status === 'degraded') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" /> Degraded
        </span>
      );
    }
    if (status === 'down') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5">
          <XCircle className="w-3 h-3" /> Offline
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
        Pending
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display text-white">Website & API Monitoring</h1>
              <p className="text-sm text-slate-400">
                Live uptime, status code, latency checks on a schedule & repeated-failure incident detection.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCheckAll}
            disabled={checkingAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingAll ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
            <span>{checkingAll ? 'Probing All...' : 'Check All Now'}</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-semibold shadow-glow-cyan transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Monitor</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl border border-white/10 bg-slate-900/40 glass-panel space-y-1"
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">System Uptime</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{kpis.uptime_percentage}%</div>
            <div className="text-[11px] text-emerald-400">
              {kpis.up_count} of {kpis.total_monitors} services online
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="p-4 rounded-xl border border-white/10 bg-slate-900/40 glass-panel space-y-1"
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Avg Latency</span>
              <Zap className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{kpis.avg_latency_ms} ms</div>
            <div className="text-[11px] text-slate-400">Across operational targets</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-xl border border-white/10 bg-slate-900/40 glass-panel space-y-1"
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Monitored Endpoints</span>
              <Server className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{kpis.total_monitors}</div>
            <div className="text-[11px] text-slate-400">15m background sentinel</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-4 rounded-xl border border-white/10 bg-slate-900/40 glass-panel space-y-1"
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Active Incidents</span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div className={`text-2xl font-bold tracking-tight ${kpis.active_incidents > 0 ? 'text-rose-400' : 'text-white'}`}>
              {kpis.active_incidents}
            </div>
            <div className="text-[11px] text-slate-400">
              {kpis.active_incidents > 0 ? 'Repeated alerts dispatched' : 'Zero outages detected'}
            </div>
          </motion.div>
        </div>
      )}

      {/* Preset Quick Add Bar */}
      <div className="p-3.5 rounded-xl border border-white/10 bg-slate-900/40 glass-panel flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Quick Add Popular Endpoints:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => addPreset(p)}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3 h-3 text-cyan-400" />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Monitors List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            <span className="text-xs text-slate-400">Loading website health sentinels...</span>
          </div>
        ) : monitors.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl glass-panel space-y-3">
            <Globe className="w-10 h-10 text-slate-500 mx-auto" />
            <h3 className="text-base font-semibold text-white">No Website Monitors Configured</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Add your website or API endpoint to start automated uptime checks and outage alerts.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-cyan-500 text-black text-xs font-semibold shadow-glow-cyan"
            >
              + Add First Monitor
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {monitors.map((m) => {
              const isChecking = checkingIds.has(m.id);
              const hasAlert = m.consecutive_failures >= (m.failure_threshold || 3);
              return (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-5 rounded-2xl border transition-all glass-panel space-y-4 ${
                    hasAlert
                      ? 'border-rose-500/40 bg-rose-500/5'
                      : m.last_status === 'up'
                      ? 'border-white/10 bg-slate-900/40'
                      : 'border-amber-500/30 bg-amber-500/5'
                  }`}
                >
                  {/* Top Row: Title, Status Badge, Controls */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white tracking-tight">{m.name}</h3>
                        {getStatusBadge(m.last_status, m.is_active)}
                      </div>
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-400 hover:text-cyan-400 font-mono flex items-center gap-1 transition-colors"
                      >
                        <span className="truncate max-w-[240px] sm:max-w-[320px]">{m.url}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCheckSingle(m.id)}
                        disabled={isChecking}
                        title="Check health now"
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-cyan-400' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(m.id)}
                        title={m.is_active ? 'Pause Monitor' : 'Resume Monitor'}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
                      >
                        {m.is_active ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        title="Delete Monitor"
                        className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/20 border border-white/10 text-slate-400 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Middle Row: Metrics & Latency */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-950/60 border border-white/5 text-center">
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium uppercase">Response Time</div>
                      <div className="text-sm font-bold text-white font-mono">
                        {m.last_latency_ms ? `${m.last_latency_ms} ms` : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium uppercase">HTTP Status</div>
                      <div className="text-sm font-bold text-white font-mono">
                        {m.last_status_code ? m.last_status_code : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium uppercase">Failures</div>
                      <div className={`text-sm font-bold font-mono ${m.consecutive_failures > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {m.consecutive_failures || 0} / {m.failure_threshold || 3}
                      </div>
                    </div>
                  </div>

                  {/* Sparkline / Recent Latency Chart */}
                  {m.recent_logs?.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>Latency Trend (Last {m.recent_logs.length} checks)</span>
                        <span>{m.recent_logs[m.recent_logs.length - 1]?.latency_ms} ms</span>
                      </div>
                      <div className="h-10 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={m.recent_logs}>
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '6px', fontSize: '11px', color: '#fff' }}
                              formatter={(v) => [`${v} ms`, 'Latency']}
                            />
                            <Bar dataKey="latency_ms" fill="#06b6d4" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Incident / Failure Note */}
                  {hasAlert && (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-400" />
                      <span>Alert: {m.consecutive_failures} consecutive failures detected. Telegram incident sent.</span>
                    </div>
                  )}

                  {/* Bottom Timestamp */}
                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-white/5 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-600" /> Interval: {m.interval_minutes}m
                    </span>
                    <span>Last: {m.last_checked_at || 'Awaiting probe'}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Monitor Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg p-6 rounded-2xl border border-white/10 bg-slate-900 glass-panel shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" /> Add New Website Monitor
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              {modalError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Service / Website Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NPCI UPI Ecosystem, My Store API"
                    value={newMonitor.name}
                    onChange={(e) => setNewMonitor({ ...newMonitor, name: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-slate-200 text-xs focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://example.com/api/health"
                    value={newMonitor.url}
                    onChange={(e) => setNewMonitor({ ...newMonitor, url: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-slate-200 text-xs font-mono focus:border-cyan-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Expected Code</label>
                    <input
                      type="number"
                      value={newMonitor.expected_status}
                      onChange={(e) => setNewMonitor({ ...newMonitor, expected_status: parseInt(e.target.value) || 200 })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-slate-200 text-xs text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Interval (Min)</label>
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      value={newMonitor.interval_minutes}
                      onChange={(e) => setNewMonitor({ ...newMonitor, interval_minutes: parseInt(e.target.value) || 15 })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-slate-200 text-xs text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Alert Threshold</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={newMonitor.failure_threshold}
                      onChange={(e) => setNewMonitor({ ...newMonitor, failure_threshold: parseInt(e.target.value) || 3 })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-slate-200 text-xs text-center font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-semibold shadow-glow-cyan transition-all"
                  >
                    Start Monitoring
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
