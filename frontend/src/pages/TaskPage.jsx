import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  Square, 
  FileCheck2, 
  ShieldCheck, 
  Cpu, 
  RefreshCw,
  Briefcase,
  Languages,
  Clock,
  ArrowRight,
  Zap
} from 'lucide-react';
import AgentBrain from '../components/AgentBrain';
import VoiceInputButton from '../components/VoiceInputButton';
import WorkspaceUpload from '../components/WorkspaceUpload';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8080";
  
export default function TaskPage({ onTaskCompleted }) {
  const [prompt, setPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [steps, setSteps] = useState([]);
  const [finalAnswer, setFinalAnswer] = useState('');
  const [sources, setSources] = useState([]);
  const [duration, setDuration] = useState(0);
  const [taskStatus, setTaskStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [planItems, setPlanItems] = useState([]);
  const [pendingApproval, setPendingApproval] = useState(null);
  const [isDeepResearch, setIsDeepResearch] = useState(false);
  const [researchProgress, setResearchProgress] = useState(null);
  
  const eventSourceRef = useRef(null);

  // Template starter tasks
  const sampleTasks = [
    {
      title: "AI Job Research (India)",
      category: "Job Seekers",
      prompt: "Research top 3 skills needed for AI engineers in India in 2026 and save the summary to workspace/ai_skills_india.txt",
      icon: Briefcase,
      color: "from-cyan-500/10 to-blue-500/10 border-cyan-500/20 text-cyan-300"
    },
    {
      title: "Cold Email Outreach",
      category: "Freelancers",
      prompt: "Draft a personalized cold outreach email for a freelance Python/React developer and save it to workspace/freelance_pitch.txt",
      icon: Send,
      color: "from-violet-500/10 to-purple-500/10 border-violet-500/20 text-violet-300"
    },
    {
      title: "Hindi/Hinglish Contract",
      category: "Small Business",
      prompt: "Mujhe freelance digital marketing contract ka template bana kar workspace/marketing_contract.txt me save karo aur IST datetime check karo",
      icon: Languages,
      color: "from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-300"
    },
    {
      title: "Workspace & Time Audit",
      category: "Students",
      prompt: "Check current date and time in India (IST), audit all existing files in workspace, and summarize what's available",
      icon: Clock,
      color: "from-amber-500/10 to-orange-500/10 border-amber-500/20 text-amber-300"
    }
  ];

  const handleVoiceTranscript = (text) => {
    setPrompt(prev => prev ? `${prev} ${text}` : text);
  };

  const stopTask = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsRunning(false);
    setTaskStatus('stopped');
  };

  const handleRunTask = async (taskText) => {
    const textToRun = (taskText || prompt).trim();
    if (!textToRun || isRunning) return;

    // Reset previous states
    setIsRunning(true);
    setSteps([]);
    setPlanItems([]);
    setResearchProgress(null);
    setPendingApproval(null);
    setFinalAnswer('');
    setSources([]);
    setDuration(0);
    setTaskStatus('running');
    setErrorMessage('');

    try {
      // Step 1: Create task in backend SQLite
      const resp = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToRun, deep_research: isDeepResearch })
      });

      if (!resp.ok) {
        throw new Error(`Failed to create task: ${resp.statusText}`);
      }

      const taskData = await resp.json();
      const taskId = taskData.id;
      setCurrentTaskId(taskId);

      // Step 2: Connect to Server-Sent Events (SSE) stream with deep_research query param
      const sse = new EventSource(
        `${API_BASE_URL}/api/tasks/${taskId}/stream?deep_research=${isDeepResearch}`
      );
      eventSourceRef.current = sse;

      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'plan' || data.type === 'plan_update') {
            setPlanItems(data.plan_items || []);
          } else if (data.type === 'research_progress') {
            setResearchProgress(data);
          } else if (data.type === 'approval_required') {
            setPendingApproval(data);
          } else if (data.type === 'final_answer') {
            setFinalAnswer(data.content || '');
            if (data.sources) setSources(data.sources);
            if (data.research_progress) setResearchProgress(data.research_progress);
          } else if (data.type === 'done') {
            setTaskStatus(data.status || 'completed');
            setDuration(data.duration_seconds || 0);
            if (data.sources) setSources(data.sources);
            setIsRunning(false);
            setPendingApproval(null);
            sse.close();
            if (onTaskCompleted) onTaskCompleted(taskId);
          } else if (data.type === 'error') {
            setTaskStatus('failed');
            setErrorMessage(data.error || 'Execution encountered an error.');
            setIsRunning(false);
            setPendingApproval(null);
            sse.close();
          }

          // Append step to live timeline
          setSteps(prev => [...prev, data]);

        } catch (err) {
          console.error("Failed to parse SSE event:", err, event.data);
        }
      };

      sse.onerror = (err) => {
        console.error("SSE stream error:", err);
        // If stream ended naturally
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        setIsRunning(false);
      };

    } catch (err) {
      console.error("Task initiation failed:", err);
      setErrorMessage(err.message || 'Could not connect to backend server.');
      setIsRunning(false);
      setTaskStatus('failed');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleRunTask();
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      
      {/* Hero Title */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Private, Zero-Cost AI running entirely on your machine</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-white">
          What can <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-violet-400 bg-clip-text text-transparent">AgentFlow</span> do for you today?
        </h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Delegate your repetitive digital tasks: web research, document analysis, writing files, and dispatching emails.
        </p>
      </div>

      {/* Task Input Card */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/10 shadow-2xl relative">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="E.g., 'Research top 3 skills for AI engineers in 2026, summarize them, and save to workspace/ai_skills.txt' (English, हिन्दी or اردو)..."
          rows={3}
          disabled={isRunning}
          className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 text-sm sm:text-base outline-none resize-none leading-relaxed"
        />

        {/* Input Footer: Voice, Mode Toggle & Submit Controls */}
        <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            {/* Voice Input with English/Hindi/Urdu */}
            <VoiceInputButton onTranscript={handleVoiceTranscript} disabled={isRunning} />
            
            {/* Deep Research Toggle: Quick (1 round, 3 pages) vs Deep (3 rounds, 8 pages) */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setIsDeepResearch(false)}
                disabled={isRunning}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  !isDeepResearch
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-glow-cyan'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Quick multi-source search (1 round, up to 3 pages)"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Quick</span>
              </button>
              <button
                type="button"
                onClick={() => setIsDeepResearch(true)}
                disabled={isRunning}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  isDeepResearch
                    ? 'bg-gradient-to-r from-violet-600/30 to-fuchsia-600/30 text-violet-200 border border-violet-500/40 shadow-glow-violet'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Deep research: 3 rounds, up to 8 pages & cross-source verification"
              >
                <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
                <span>Deep Research</span>
              </button>
            </div>

            <span className="text-[11px] text-slate-400 hidden lg:inline">
              Ctrl + Enter to run
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isRunning ? (
              <button
                type="button"
                onClick={stopTask}
                className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-sm font-semibold flex items-center gap-2 transition-all"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop Agent</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleRunTask()}
                disabled={!prompt.trim()}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all ${
                  prompt.trim()
                    ? 'bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white shadow-glow-cyan'
                    : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-4 h-4 text-cyan-200" />
                <span>Execute Task</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Sandboxed Workspace File Manager & Upload */}
      <WorkspaceUpload
        onSelectFileForPrompt={(filename) => {
          setPrompt(`Read workspace/${filename} and summarize its key insights, action points, and recommendations in clear bullet points.`);
        }}
      />

      {/* Suggested Starter Tasks */}
      {!isRunning && steps.length === 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold tracking-wider uppercase text-slate-400">Popular Quick Tasks for India</span>
            <span>Click any card to load & run</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sampleTasks.map((st, i) => {
              const Icon = st.icon;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setPrompt(st.prompt);
                    handleRunTask(st.prompt);
                  }}
                  className={`text-left p-4 rounded-xl glass-card border bg-gradient-to-br ${st.color} hover:bg-white/5 transition-all group`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 font-medium">
                      {st.category}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">{st.title}</h4>
                  <p className="text-xs text-slate-400 line-clamp-2">{st.prompt}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Error alert if any */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-sm flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-rose-400"></div>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Live Agent Brain Timeline */}
      <AgentBrain
        steps={steps}
        isRunning={isRunning}
        finalAnswer={finalAnswer}
        sources={sources}
        duration={duration}
        taskStatus={taskStatus}
        planItems={planItems}
        pendingApproval={pendingApproval}
        onResolveApproval={(id, dec) => setPendingApproval(null)}
        researchProgress={researchProgress}
        isDeepResearch={isDeepResearch}
      />

    </div>
  );
}
