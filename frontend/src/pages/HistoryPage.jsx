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
  Eye, 
  FileText 
} from 'lucide-react';
import AgentBrain from '../components/AgentBrain';

export default function HistoryPage() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch('/api/tasks?limit=50');
      const data = await resp.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const viewTaskDetails = async (taskId) => {
    setIsLoadingDetail(true);
    try {
      const resp = await fetch(`/api/tasks/${taskId}`);
      if (resp.ok) {
        const fullTask = await resp.json();
        setSelectedTask(fullTask);
      }
    } catch (err) {
      console.error('Failed to fetch task details:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const deleteTask = async (taskId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this task from history?')) return;

    try {
      const resp = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (resp.ok) {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        if (selectedTask && selectedTask.id === taskId) {
          setSelectedTask(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const filteredTasks = tasks.filter(t => 
    t.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.final_answer && t.final_answer.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white">Execution History</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
              SQLite Persisted
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Audit past agent runs, inspected steps, sources, and durations.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search past tasks..."
              className="pl-8 pr-3 py-1.5 rounded-xl glass-input text-xs text-slate-200 placeholder:text-slate-500 outline-none w-48 sm:w-64"
            />
          </div>

          <button
            onClick={fetchTasks}
            className="p-2 rounded-xl glass-card hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            title="Refresh history"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main split view or list */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Task List */}
        <div className={`space-y-3 ${selectedTask ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
          {isLoading ? (
            <div className="glass-panel rounded-2xl p-8 text-center text-slate-400 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mx-auto mb-2" />
              Loading task history...
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="glass-panel rounded-2xl p-10 text-center text-slate-400 text-sm">
              <History className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-300">No tasks found</p>
              <p className="text-xs text-slate-500 mt-1">Tasks you execute will appear here automatically.</p>
            </div>
          ) : (
            filteredTasks.map((t) => {
              const isSelected = selectedTask && selectedTask.id === t.id;
              const isSuccess = t.status === 'completed';
              return (
                <div
                  key={t.id}
                  onClick={() => viewTaskDetails(t.id)}
                  className={`glass-panel rounded-xl p-4 border transition-all cursor-pointer group ${
                    isSelected 
                      ? 'border-cyan-400/80 bg-cyan-950/20 shadow-glow-cyan' 
                      : 'border-white/5 hover:border-white/20 hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase flex items-center gap-1 ${
                      isSuccess 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {isSuccess ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                      {t.status}
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {t.duration_seconds ? `${t.duration_seconds}s` : '0s'}
                      </span>
                      <button
                        onClick={(e) => deleteTask(t.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-all"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-medium text-slate-100 line-clamp-2 mb-2 font-display">
                    {t.prompt}
                  </h3>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5">
                    <span>{new Date(t.created_at).toLocaleString()}</span>
                    <span className="text-cyan-400 group-hover:translate-x-1 transition-transform flex items-center gap-0.5 font-medium">
                      Inspect Steps <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Detailed Brain Inspection */}
        {selectedTask && (
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Live Brain Replay
              </span>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close Replay
              </button>
            </div>

            {isLoadingDetail ? (
              <div className="glass-panel rounded-2xl p-12 text-center text-slate-400 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mx-auto mb-2" />
                Loading recorded execution steps...
              </div>
            ) : (
              <AgentBrain
                steps={selectedTask.steps || []}
                isRunning={false}
                finalAnswer={selectedTask.final_answer || ''}
                sources={selectedTask.sources || []}
                duration={selectedTask.duration_seconds || 0}
                taskStatus={selectedTask.status || 'completed'}
              />
            )}
          </div>
        )}

      </div>

    </div>
  );
}
