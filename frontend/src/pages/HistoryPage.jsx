import React, { useState, useEffect } from 'react';
import { 
  History, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw, 
  Search, 
  ChevronRight, 
  ChevronLeft, 
  Eye, 
  FileText,
  Download,
  Database,
  Filter,
  Calendar,
  Layers,
  X,
  Copy,
  Check,
  AlertTriangle,
  Play
} from 'lucide-react';
import { getApiUrl } from '../api/config';

export default function HistoryPage() {
  const [runs, setRuns] = useState([]);
  const [totalRuns, setTotalRuns] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 15;

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const [selectedRun, setSelectedRun] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [previewFile, setPreviewFile] = useState(null);
  const [copiedFile, setCopiedFile] = useState(false);

  const [dbMeta, setDbMeta] = useState({
    type: 'sqlite',
    writable: true,
    stored_runs_count: 0
  });

  // Fetch DB Health & Meta
  const fetchHealth = async () => {
    try {
      const resp = await fetch(getApiUrl('/api/health'));
      if (resp.ok) {
        const data = await resp.json();
        setDbMeta({
          type: data.database?.type || data.database_type || 'sqlite',
          writable: data.database?.writable ?? data.database_writable ?? true,
          stored_runs_count: data.database?.stored_runs_count ?? data.stored_runs_count ?? 0
        });
      }
    } catch (err) {
      console.warn('Notice fetching health:', err);
    }
  };

  // Fetch Workflow Runs
  const fetchRuns = async () => {
    setIsLoading(true);
    try {
      const offset = (page - 1) * limit;
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });

      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (dateFilter && dateFilter !== 'all') params.set('date_filter', dateFilter);

      const resp = await fetch(getApiUrl(`/api/runs?${params.toString()}`));
      if (resp.ok) {
        const data = await resp.json();
        setRuns(data.runs || []);
        setTotalRuns(data.total || 0);
      } else {
        // Fallback to /api/tasks if /api/runs is not available
        const fallbackResp = await fetch(getApiUrl('/api/tasks?limit=50'));
        if (fallbackResp.ok) {
          const fallbackData = await fallbackResp.json();
          setRuns(fallbackData.tasks || []);
          setTotalRuns((fallbackData.tasks || []).length);
        }
      }
    } catch (err) {
      console.error('Failed to fetch runs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [page, statusFilter, dateFilter]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setPage(1);
    fetchRuns();
  };

  const viewRunDetails = async (runId) => {
    setIsLoadingDetail(true);
    try {
      const resp = await fetch(getApiUrl(`/api/runs/${runId}`));
      if (resp.ok) {
        const fullRun = await resp.json();
        setSelectedRun(fullRun);
      } else {
        // Fallback to task details if not a workflow run
        const taskResp = await fetch(getApiUrl(`/api/tasks/${runId}`));
        if (taskResp.ok) {
          const taskData = await taskResp.json();
          setSelectedRun(taskData);
        }
      }
    } catch (err) {
      console.error('Failed to fetch run details:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const deleteRun = async (runId, e) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to permanently delete run '${runId}' from the database?`)) return;

    try {
      const resp = await fetch(getApiUrl(`/api/runs/${runId}`), { method: 'DELETE' });
      if (resp.ok) {
        setRuns(prev => prev.filter(r => r.id !== runId));
        setTotalRuns(prev => Math.max(0, prev - 1));
        if (selectedRun && selectedRun.id === runId) {
          setSelectedRun(null);
        }
        fetchHealth();
      }
    } catch (err) {
      console.error('Failed to delete run:', err);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalRuns / limit));

  const handleCopyFileText = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      
      {/* Header with Database Metadata Badges */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-white">Execution History</h1>
            
            {/* Database indicator */}
            <span className={`text-xs px-3 py-1 rounded-full border font-semibold flex items-center gap-1.5 ${
              dbMeta.type === 'postgres' 
                ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' 
                : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
            }`}>
              <Database className="w-3.5 h-3.5" />
              <span>{dbMeta.type === 'postgres' ? 'PostgreSQL (Cloud Database)' : 'SQLite Database'}</span>
            </span>

            {/* Total Stored Runs Badge */}
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/10 font-mono">
              {totalRuns} run{totalRuns !== 1 ? 's' : ''} stored
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Permanent audit trail of executed workflows, step outputs, approval decisions, and generated artifacts.
          </p>
        </div>

        <button
          onClick={() => { fetchRuns(); fetchHealth(); }}
          className="px-3.5 py-2 rounded-xl glass-card hover:bg-white/10 text-slate-300 hover:text-white transition-colors flex items-center gap-2 text-xs font-semibold"
          title="Refresh run history"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-4">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by prompt, title, or run ID..."
            className="w-full pl-10 pr-4 py-2 rounded-xl glass-input text-xs text-slate-200 placeholder:text-slate-500 outline-none border border-white/10 focus:border-cyan-400/50"
          />
        </form>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="glass-card px-3 py-1.5 rounded-xl text-xs text-slate-200 bg-slate-900 border border-white/10 outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="interrupted">Interrupted (Restarted)</option>
              <option value="cancelled">Cancelled / Rejected</option>
              <option value="running">Running</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
              className="glass-card px-3 py-1.5 rounded-xl text-xs text-slate-200 bg-slate-900 border border-white/10 outline-none cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Split Grid: Run List on Left, Run Inspector on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Runs List */}
        <div className={`space-y-3 ${selectedRun ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
          {isLoading ? (
            <div className="glass-panel rounded-2xl p-12 text-center text-slate-400 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mx-auto mb-2" />
              Loading persistent workflow runs...
            </div>
          ) : runs.length === 0 ? (
            <div className="glass-panel rounded-2xl p-12 text-center text-slate-400 text-sm space-y-2">
              <History className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-slate-200 text-base">No workflow runs found</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {searchQuery || statusFilter !== 'all' || dateFilter !== 'all'
                  ? 'No execution runs match your chosen filters. Try clearing your search.'
                  : 'Execute a workflow or scheduled task to see permanent execution records here.'}
              </p>
            </div>
          ) : (
            runs.map((r) => {
              const isSelected = selectedRun && selectedRun.id === r.id;
              const statusLower = (r.status || '').toLowerCase();
              const isSuccess = statusLower === 'completed';
              const isFailed = statusLower === 'failed';
              const isInterrupted = statusLower === 'interrupted';
              const isCancelled = statusLower === 'cancelled' || statusLower === 'rejected';

              let badgeClass = 'bg-slate-700/30 text-slate-300 border-white/10';
              if (isSuccess) badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
              else if (isFailed) badgeClass = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
              else if (isInterrupted) badgeClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
              else if (isCancelled) badgeClass = 'bg-purple-500/15 text-purple-400 border-purple-500/30';

              const startedTime = r.started_at || r.created_at;
              const displayDate = startedTime ? new Date(startedTime).toLocaleString() : 'Recent';
              const duration = r.duration_seconds ? `${r.duration_seconds}s` : '0s';
              const title = r.prompt || (r.plan && r.plan.title) || r.workflow_id || 'Workflow Run';

              return (
                <div
                  key={r.id}
                  onClick={() => viewRunDetails(r.id)}
                  className={`glass-panel rounded-2xl p-4 border transition-all cursor-pointer group relative overflow-hidden ${
                    isSelected 
                      ? 'border-cyan-400/80 bg-cyan-950/20 shadow-glow-cyan' 
                      : 'border-white/10 hover:border-white/20 hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border flex items-center gap-1.5 ${badgeClass}`}>
                      {isSuccess && <CheckCircle2 className="w-3 h-3" />}
                      {isFailed && <AlertCircle className="w-3 h-3" />}
                      {isInterrupted && <AlertTriangle className="w-3 h-3" />}
                      {isCancelled && <X className="w-3 h-3" />}
                      <span>{r.status || 'unknown'}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {duration}
                      </span>
                      <button
                        onClick={(e) => deleteRun(r.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-all"
                        title="Delete run from database"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-100 line-clamp-2 mb-2 font-display">
                    {title}
                  </h3>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5">
                    <span className="font-mono text-[10px] text-slate-500">{r.id}</span>
                    <span className="text-slate-400">{displayDate}</span>
                    <span className="text-cyan-400 group-hover:translate-x-1 transition-transform flex items-center gap-0.5 font-medium">
                      Inspect <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 px-1 text-xs text-slate-400">
              <span>
                Showing {(page - 1) * limit + 1} - {Math.min(page * limit, totalRuns)} of {totalRuns}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg glass-card hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-cyan-300 font-bold px-2">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg glass-card hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Run Inspector */}
        {selectedRun && (
          <div className="lg:col-span-7 space-y-4 animate-in fade-in duration-200">
            <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/10 space-y-6">
              
              {/* Run Inspector Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-white/10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      RUN ID: {selectedRun.id}
                    </span>
                    {selectedRun.workflow_id && (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono text-slate-400 bg-white/5 border border-white/10">
                        {selectedRun.workflow_id}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-white font-display">
                    {selectedRun.prompt || selectedRun.plan?.title || 'Execution Inspector'}
                  </h2>
                </div>

                <button
                  onClick={() => setSelectedRun(null)}
                  className="p-2 rounded-xl glass-card hover:bg-white/10 text-slate-400 hover:text-white"
                  title="Close Inspector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Interrupted Warning Banner if server restarted */}
              {selectedRun.status === 'interrupted' && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">Run Interrupted by Server Restart</span>
                    <span className="text-amber-300/80">
                      {selectedRun.interrupted_reason || 'Backend container restarted while this workflow was executing.'}
                    </span>
                  </div>
                </div>
              )}

              {/* Summary Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">Status</span>
                  <span className="text-sm font-bold capitalize text-cyan-300">{selectedRun.status}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">Duration</span>
                  <span className="text-sm font-bold text-slate-200">{selectedRun.duration_seconds || 0}s</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">Started</span>
                  <span className="text-[11px] text-slate-300">
                    {selectedRun.started_at ? new Date(selectedRun.started_at).toLocaleTimeString() : 'N/A'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">Completed</span>
                  <span className="text-[11px] text-slate-300">
                    {selectedRun.completed_at ? new Date(selectedRun.completed_at).toLocaleTimeString() : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Generated Files Section (Database Survives Restart) */}
              {(selectedRun.db_files?.length > 0 || selectedRun.generated_files?.length > 0) && (
                <div className="space-y-2.5 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                      <FileText className="w-4 h-4" />
                      Generated Workspace Files (Persisted in DB)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      Survives Container Restarts
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(selectedRun.db_files || selectedRun.generated_files || []).map((f, fIdx) => {
                      const fname = typeof f === 'string' ? f : f.filename || `file_${fIdx}`;
                      const fsize = typeof f === 'object' && f.size_kb ? `${f.size_kb} KB` : '';
                      const fcontent = typeof f === 'object' ? (f.content_text || f.preview || '') : '';

                      return (
                        <div
                          key={fIdx}
                          className="p-3 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="truncate flex-1">
                            <span className="font-mono font-bold text-slate-200 block truncate">{fname}</span>
                            {fsize && <span className="text-[10px] text-slate-400 font-mono">{fsize}</span>}
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {fcontent && (
                              <button
                                type="button"
                                onClick={() => setPreviewFile({ filename: fname, content: fcontent })}
                                className="p-1.5 rounded-lg glass-card hover:bg-white/10 text-cyan-300 hover:text-white"
                                title="Preview content stored in database"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <a
                              href={getApiUrl(`/api/workspace/files/${encodeURIComponent(fname)}/download`)}
                              download={fname}
                              className="p-1.5 rounded-lg glass-card hover:bg-white/10 text-emerald-400 hover:text-white"
                              title="Download file"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step Execution Timeline */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  Recorded Execution Steps
                </span>

                {selectedRun.steps && selectedRun.steps.length > 0 ? (
                  <div className="space-y-2.5">
                    {selectedRun.steps.map((st, idx) => {
                      const isStSuccess = st.status === 'completed';
                      const isStFailed = st.status === 'failed';
                      const isStRejected = st.status === 'rejected';

                      return (
                        <div
                          key={st.id || idx}
                          className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] text-slate-500">#{idx + 1}</span>
                              <code className="px-2 py-0.5 rounded bg-white/5 text-cyan-300 font-mono font-bold text-[11px]">
                                {st.tool_name || st.tool || 'Step'}
                              </code>
                              <span className="font-medium text-slate-200">{st.name || st.step_id}</span>
                            </div>

                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                              isStSuccess 
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                                : isStFailed || isStRejected
                                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                : 'bg-slate-700 text-slate-300 border-white/10'
                            }`}>
                              {st.status}
                            </span>
                          </div>

                          {/* Output or Error Preview */}
                          {st.output_summary && (
                            <div className="p-2.5 rounded-lg bg-black/50 border border-white/5 text-slate-300 font-mono text-[11px] max-h-36 overflow-y-auto whitespace-pre-wrap">
                              {st.output_summary}
                            </div>
                          )}

                          {st.error_message && (
                            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/20 text-rose-300 text-[11px]">
                              {st.error_message}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : selectedRun.step_logs && selectedRun.step_logs.length > 0 ? (
                  <div className="space-y-2">
                    {selectedRun.step_logs.map((log, lIdx) => (
                      <div key={lIdx} className="p-3 rounded-xl bg-slate-900/60 border border-white/5 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <code className="text-cyan-300 font-mono">[{log.step_id}]</code>
                          <span className="text-[10px] uppercase font-bold text-slate-400">{log.status}</span>
                        </div>
                        <p className="text-slate-300 font-mono text-[11px]">{log.result || log.message || log.error}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No individual step records logged for this run.</p>
                )}
              </div>

            </div>
          </div>
        )}

      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-3xl rounded-3xl border border-white/20 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white font-mono">{previewFile.filename}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Database Persisted
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyFileText(previewFile.content)}
                  className="px-2.5 py-1.5 rounded-xl glass-card hover:bg-white/10 text-xs text-slate-300 flex items-center gap-1.5"
                >
                  {copiedFile ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedFile ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="p-1.5 rounded-xl glass-card hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-black/80 border border-white/10 text-xs font-mono text-slate-200 max-h-[60vh] overflow-y-auto whitespace-pre-wrap leading-relaxed custom-scrollbar">
              {previewFile.content}
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="px-5 py-2 rounded-xl glass-card hover:bg-white/10 text-xs font-bold text-white"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
