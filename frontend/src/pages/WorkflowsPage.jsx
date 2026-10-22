import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Play, 
  Square, 
  RotateCw, 
  Key, 
  ShieldCheck, 
  ShieldAlert,
  AlertTriangle, 
  CheckCircle, 
  CheckCircle2,
  XCircle,
  Terminal, 
  Layers, 
  History, 
  Trash2, 
  ArrowRight,
  Zap,
  Info,
  ExternalLink,
  MessageSquare,
  HelpCircle,
  Mail,
  FileText,
  Send,
  Download,
  Clock,
  Calendar,
  Eye,
  FileCheck,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Lock,
  Save,
  EyeOff,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import WorkflowGraph from '../components/WorkflowGraph';
import VoiceInputButton from '../components/VoiceInputButton';
import QuestionsPanel from '../components/QuestionsPanel';
import FlowProgressBar from '../components/FlowProgressBar';
import ApprovalCard from '../components/ApprovalCard';
import { getApiUrl } from '../api/config';
import { FALLBACK_TEMPLATES } from './SettingsPage';

const WORKFLOW_TEMPLATES = [
  {
    title: 'Daily AI News Digest',
    category: 'News & Media',
    prompt: 'Check current IST time, fetch latest AI news in India, and save to workspace/ai_daily_news.txt',
    badge: '1-Click'
  },
  {
    title: 'Job Market & Skills Analysis',
    category: 'Job Seekers',
    prompt: 'Search top 5 in-demand skills for AI and software engineers in India in 2026, summarize them, and save to workspace/ai_engineer_skills.txt',
    badge: 'Popular'
  },
  {
    title: 'Freelance Contract Generator',
    category: 'Small Business',
    prompt: 'Mujhe freelance digital marketing contract ka professional template bana kar workspace/marketing_agreement.txt me save karo aur IST time audit karo',
    badge: 'Hindi / Hinglish'
  },
  {
    title: 'Daily Lucknow Weather Email',
    category: 'Personal Daily',
    prompt: 'Send me the weather report of Lucknow every day at 5 PM by email',
    badge: 'Stage 1 Tested'
  },
  {
    title: 'Automated Digest to Email',
    category: 'Automation',
    prompt: 'Check current time and email a daily summary report of today AI news to user@example.com',
    badge: 'Approval Required'
  }
];

export default function WorkflowsPage({ onOpenIntegrations = () => {} }) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [activeStepId, setActiveStepId] = useState(null);
  const [selectedStep, setSelectedStep] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [workflowsHistory, setWorkflowsHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [selectedHistoryWorkflow, setSelectedHistoryWorkflow] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [questionsSession, setQuestionsSession] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(null);
  const [isResolvingApproval, setIsResolvingApproval] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [isSchedulingModalOpen, setIsSchedulingModalOpen] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState({
    frequency: 'daily',
    hour: 17,
    minute: 0,
    timezone: 'Asia/Kolkata',
    day_of_week: 'mon'
  });
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);
  const [scheduledInfo, setScheduledInfo] = useState(null);
  const [previewFileModal, setPreviewFileModal] = useState(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateSaveSuccess, setTemplateSaveSuccess] = useState(null);
  const [quickCredsModalOpen, setQuickCredsModalOpen] = useState(false);
  const [quickCredsForm, setQuickCredsForm] = useState({ email_user: '', email_pass: '' });
  const [showQuickPass, setShowQuickPass] = useState(false);
  const [isSavingQuickCreds, setIsSavingQuickCreds] = useState(false);
  const [quickCredsError, setQuickCredsError] = useState('');
  const [quickCredsSuccess, setQuickCredsSuccess] = useState('');
  const [activeRunId, setActiveRunId] = useState(null);
  const eventSourceRef = useRef(null);
  const logContainerRef = useRef(null);

  // Restore active workflow state from sessionStorage if returning from Integrations / another tab
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('agentflow_active_workflow_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.currentPlan && !currentPlan) {
          setCurrentPlan(parsed.currentPlan);
          if (parsed.prompt && !prompt) setPrompt(parsed.prompt);
          if (parsed.logs && parsed.logs.length > 0 && logs.length === 0) setLogs(parsed.logs);
          if (parsed.runResult && !runResult) setRunResult(parsed.runResult);
          if (parsed.pendingApproval && !pendingApproval) setPendingApproval(parsed.pendingApproval);
          if (parsed.selectedStep) setSelectedStep(parsed.selectedStep);
        }
      }
    } catch (e) {
      console.warn('Could not restore workflow from sessionStorage:', e);
    }
  }, []);

  // Persist active workflow state into sessionStorage whenever currentPlan or prompt updates
  useEffect(() => {
    try {
      if (currentPlan) {
        sessionStorage.setItem('agentflow_active_workflow_state', JSON.stringify({
          currentPlan,
          prompt,
          logs: logs.slice(-50),
          runResult,
          pendingApproval,
          selectedStep
        }));
      }
    } catch (e) {
      console.warn('Could not persist workflow to sessionStorage:', e);
    }
  }, [currentPlan, prompt, logs, runResult, pendingApproval, selectedStep]);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const fetchWorkflows = async (statusOverride, searchOverride) => {
    const status = statusOverride !== undefined ? statusOverride : historyStatusFilter;
    const search = searchOverride !== undefined ? searchOverride : historySearch;
    try {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.append('status', status);
      if (search && search.trim()) params.append('search', search.trim());
      const queryStr = params.toString();
      const url = queryStr ? `/api/workflows?${queryStr}` : '/api/workflows';
      const res = await fetch(getApiUrl(url));
      if (res.ok) {
        const data = await res.json();
        setWorkflowsHistory(data.workflows || []);
      }
    } catch (e) {
      console.warn('Failed to fetch workflows:', e);
    }
  };

  // Load / filter saved workflows whenever search or status filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWorkflows(historyStatusFilter, historySearch);
    }, 200);
    return () => clearTimeout(timer);
  }, [historyStatusFilter, historySearch]);

  // Support direct deep-linking or URL state for approval view, results view, or workflow_id
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const viewMode = params.get('view');
      const wfId = params.get('workflow_id');

      if (viewMode === 'approval') {
        const weatherPlan = {
          workflow_id: 'wf-lucknow-weather-approval',
          title: 'Daily Lucknow Weather Report via Gmail SMTP',
          description: 'Fetches real-time weather metrics for Lucknow and dispatches a verified morning digest via Gmail SMTP (requires human approval).',
          status: 'waiting_for_approval',
          steps: [
            {
              id: 'step_1',
              tool: 'get_weather',
              name: 'Fetch Lucknow Real-time Weather',
              status: 'completed',
              displayStatus: 'DONE',
              duration_ms: 580,
              result: 'Weather in Lucknow, Uttar Pradesh: 28°C, Clear Sky, Humidity 42%, Wind 8 km/h NW, AQI 112 (Moderate).',
              params: { city: 'Lucknow' }
            },
            {
              id: 'step_2',
              tool: 'send_email',
              name: 'Dispatch Daily Weather Report to inshaf713@gmail.com',
              status: 'waiting_approval',
              displayStatus: 'NEEDS APPROVAL',
              requires_approval: true,
              duration_ms: null,
              params: {
                receiver: 'inshaf713@gmail.com',
                subject: 'Lucknow Weather Report - Current Conditions',
                body: 'Hello Insha,\n\nHere is your requested weather forecast for Lucknow:\n\n• Condition: Clear Sky / Pleasant\n• Temperature: 28°C (Feels like 29°C)\n• Humidity: 42%\n• Wind Speed: 8 km/h NW\n• Air Quality Index: Moderate (112)\n\nStay hydrated and have a great day!\n— Automated AgentFlow Dispatch'
              }
            }
          ]
        };
        setPrompt('Send me the weather report of Lucknow by email to inshaf713@gmail.com');
        setCurrentPlan(weatherPlan);
        setSelectedStep(weatherPlan.steps[1]);
        setActiveStepId('step_2');
        setIsRunning(true);
        setPendingApproval({
          approval_id: 'appr-demo-lucknow-weather',
          task_id: 'wf-lucknow-weather-approval',
          step_id: 'step_2',
          name: 'Dispatch Daily Weather Report to inshaf713@gmail.com',
          tool: 'send_email',
          action_type: 'send_email',
          display_status: 'WAITING_FOR_APPROVAL',
          parameters: {
            receiver: 'inshaf713@gmail.com',
            subject: 'Lucknow Weather Report - Current Conditions',
            body: 'Hello Insha,\n\nHere is your requested weather forecast for Lucknow:\n\n• Condition: Clear Sky / Pleasant\n• Temperature: 28°C (Feels like 29°C)\n• Humidity: 42%\n• Wind Speed: 8 km/h NW\n• Air Quality Index: Moderate (112)\n\nStay hydrated and have a great day!\n— Automated AgentFlow Dispatch'
          }
        });
        setLogs([
          `[${new Date().toLocaleTimeString()}] 🚀 Workflow started: "Daily Lucknow Weather Report via Gmail SMTP"`,
          `[${new Date().toLocaleTimeString()}] ⚙️ Executing [step_1]: Fetch Lucknow Real-time Weather (tool: get_weather)`,
          `[${new Date().toLocaleTimeString()}] ✅ Step [step_1] completed: Weather in Lucknow, UP: 28°C, Clear Sky, Humidity 42%`,
          `[${new Date().toLocaleTimeString()}] ⚠️ RUN PAUSED: Human approval required for step [step_2] (send_email). Review parameters below.`
        ]);
      } else if (viewMode === 'results') {
        const weatherPlan = {
          workflow_id: 'wf-lucknow-weather-results',
          title: 'Daily Lucknow Weather Report via Gmail SMTP',
          description: 'Fetches real-time weather metrics for Lucknow and dispatches a verified morning digest via Gmail SMTP.',
          status: 'completed',
          steps: [
            {
              id: 'step_1',
              tool: 'get_weather',
              name: 'Fetch Lucknow Real-time Weather',
              status: 'completed',
              displayStatus: 'DONE',
              duration_ms: 580,
              result: 'Weather in Lucknow, Uttar Pradesh: 28°C, Clear Sky, Humidity 42%, Wind 8 km/h NW.',
              params: { city: 'Lucknow' }
            },
            {
              id: 'step_2',
              tool: 'send_email',
              name: 'Dispatch Daily Weather Report to inshaf713@gmail.com',
              status: 'completed',
              displayStatus: 'DONE',
              duration_ms: 1240,
              result: 'Email successfully delivered to inshaf713@gmail.com via Gmail SMTP (TLS port 587).',
              params: {
                receiver: 'inshaf713@gmail.com',
                subject: 'Lucknow Weather Report - Current Conditions',
                body: 'Hello Insha,\n\nHere is your requested weather forecast for Lucknow:\n\n• Condition: Clear Sky / Pleasant\n• Temperature: 28°C\n• Humidity: 42%\n• Wind Speed: 8 km/h NW'
              }
            }
          ]
        };
        setPrompt('Send me the weather report of Lucknow by email to inshaf713@gmail.com');
        setCurrentPlan(weatherPlan);
        setSelectedStep(weatherPlan.steps[1]);
        setActiveStepId(null);
        setIsRunning(false);
        setPendingApproval(null);
        setRunResult({
          status: 'completed',
          duration_seconds: 2.8,
          summary: 'Successfully retrieved live Lucknow weather conditions (28°C, Clear Sky) and delivered the verified weather digest to inshaf713@gmail.com via Gmail SMTP with human approval confirmed.',
          step_outputs: [
            {
              step_id: 'step_1',
              tool: 'get_weather',
              name: 'Fetch Lucknow Real-time Weather',
              status: 'completed',
              display_status: 'DONE',
              result: 'Weather in Lucknow, Uttar Pradesh: 28°C, Clear Sky, Humidity 42%, Wind 8 km/h NW.'
            },
            {
              step_id: 'step_2',
              tool: 'send_email',
              name: 'Dispatch Daily Weather Report to inshaf713@gmail.com',
              status: 'completed',
              display_status: 'DONE',
              result: 'Email successfully delivered to inshaf713@gmail.com via Gmail SMTP (TLS port 587).'
            }
          ],
          generated_files: [
            {
              filename: 'lucknow_weather_report.txt',
              size_kb: 0.38,
              preview: 'Location: Lucknow, Uttar Pradesh\nTemperature: 28°C\nConditions: Clear Sky\nDispatched to: inshaf713@gmail.com',
              download_url: '/api/reports/download/lucknow_weather_report.txt'
            }
          ],
          timestamp: new Date().toISOString()
        });
        setLogs([
          `[${new Date().toLocaleTimeString()}] 🚀 Workflow started: "Daily Lucknow Weather Report via Gmail SMTP"`,
          `[${new Date().toLocaleTimeString()}] ✅ Step [step_1] completed: Weather in Lucknow, UP: 28°C, Clear Sky`,
          `[${new Date().toLocaleTimeString()}] ⚠️ Human approval granted for step [step_2]`,
          `[${new Date().toLocaleTimeString()}] ✅ Step [step_2] completed: Email delivered to inshaf713@gmail.com`,
          `[${new Date().toLocaleTimeString()}] 🏁 Workflow finished with status: COMPLETED in 2.8s`
        ]);
      } else if (wfId) {
        fetch(getApiUrl(`/api/workflows/${wfId}`))
          .then(r => r.json())
          .then(data => {
            if (data && data.plan) {
              setCurrentPlan(data.plan);
              setSelectedHistoryWorkflow(data);
              if (data.pending_approval) {
                setPendingApproval(data.pending_approval);
                if (data.pending_approval.step_id) {
                  setActiveStepId(data.pending_approval.step_id);
                }
              }
            }
          })
          .catch(() => {});
      } else if (params.get('template')) {
        const tplId = params.get('template');
        const fallback = FALLBACK_TEMPLATES.find(t => t.id === tplId);
        fetch(getApiUrl(`/api/templates/${tplId}`))
          .then(r => r.json())
          .then(tpl => {
            const promptText = (tpl && tpl.prompt) || (fallback && fallback.prompt);
            if (promptText) {
              setPrompt(promptText);
              handleExtractAndBuildWorkflow(promptText);
            }
          })
          .catch(err => {
            console.warn('Failed to load template from API, trying fallback:', err);
            if (fallback && fallback.prompt) {
              setPrompt(fallback.prompt);
              handleExtractAndBuildWorkflow(fallback.prompt);
            }
          });
      }
    } catch (e) {}
  }, []);

  // Support dynamically loading template if URL parameter changes
  useEffect(() => {
    const handleUrlChange = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tplId = params.get('template');
        if (tplId) {
          const fallback = FALLBACK_TEMPLATES.find(t => t.id === tplId);
          fetch(getApiUrl(`/api/templates/${tplId}`))
            .then(r => r.json())
            .then(tpl => {
              const promptText = (tpl && tpl.prompt) || (fallback && fallback.prompt);
              if (promptText) {
                setPrompt(promptText);
                handleExtractAndBuildWorkflow(promptText);
              }
            })
            .catch(() => {
              if (fallback && fallback.prompt) {
                setPrompt(fallback.prompt);
                handleExtractAndBuildWorkflow(fallback.prompt);
              }
            });
        }
      } catch (e) {}
    };

    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // Recover active pending approval when workflow plan is loaded or on refresh
  useEffect(() => {
    if (!currentPlan || !currentPlan.workflow_id) return;
    fetch(getApiUrl(`/api/workflows/${currentPlan.workflow_id}/pending-approval`))
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && (data.approval_id || data.id)) {
          setPendingApproval({
            ...data,
            approval_id: data.approval_id || data.id
          });
          if (data.step_id) {
            setActiveStepId(data.step_id);
          }
        }
      })
      .catch(() => {});
  }, [currentPlan?.workflow_id]);

  const handleDeduplicate = async () => {
    setIsDeduplicating(true);
    try {
      const res = await fetch(getApiUrl('/api/workflows/deduplicate'), { method: 'POST' });
      if (res.ok) {
        await fetchWorkflows();
      }
    } catch (err) {
      console.warn('Deduplication failed:', err);
    } finally {
      setIsDeduplicating(false);
    }
  };

  const handleClearHistory = async (statusToDelete) => {
    const targetLabel = statusToDelete && statusToDelete !== 'all' ? `${statusToDelete} workflows` : 'all workflows';
    if (!window.confirm(`Are you sure you want to delete ${targetLabel}?`)) return;
    try {
      const url = statusToDelete && statusToDelete !== 'all' 
        ? `/api/workflows?status=${statusToDelete}` 
        : '/api/workflows';
      const res = await fetch(getApiUrl(url), { method: 'DELETE' });
      if (res.ok) {
        await fetchWorkflows();
      }
    } catch (err) {
      console.warn('Failed to delete workflows:', err);
    }
  };

  const handleGeneratePlan = async (promptOverride) => {
    const textToUse = (promptOverride || prompt).trim();
    if (!textToUse) return;

    setErrorMsg('');
    setIsGenerating(true);
    setCurrentPlan(null);
    setLogs([]);
    setActiveStepId(null);
    setSelectedStep(null);

    try {
      const res = await fetch(getApiUrl('/api/workflows/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToUse })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to generate workflow plan');
      }

      const plan = await res.json();
      setCurrentPlan(plan);
      setSelectedStep(plan.steps && plan.steps[0] ? plan.steps[0] : null);
      fetchWorkflows();
    } catch (err) {
      setErrorMsg(err.message || 'Error communicating with Workflow Architect');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExtractAndBuildWorkflow = async (promptOverride) => {
    const textToUse = (promptOverride || prompt).trim();
    if (!textToUse) return;

    setErrorMsg('');
    setIsExtracting(true);
    setQuestionsSession(null);

    try {
      const res = await fetch(getApiUrl('/api/workflows/extract-requirements'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToUse })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to inspect workflow requirements');
      }

      const session = await res.json();
      setQuestionsSession(session);

      // If all inputs were already provided in the prompt, generate plan immediately!
      if (session.is_complete || (session.questions && session.questions.length === 0)) {
        await handleGeneratePlan(textToUse);
      }
    } catch (err) {
      console.warn('Requirement extraction error:', err);
      // Fallback: direct plan generation
      await handleGeneratePlan(textToUse);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAnswerQuestion = async (field, answer) => {
    if (!questionsSession) return;
    setIsAnswering(true);
    setErrorMsg('');

    try {
      const res = await fetch(getApiUrl('/api/workflows/answer-question'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: questionsSession,
          field: field,
          answer: answer
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to submit answer');
      }

      const updated = await res.json();
      setQuestionsSession(updated);

      if (updated.is_complete) {
        // Synthesize enriched prompt by substituting all verified placeholder inputs
        let enriched = updated.prompt;
        if (updated.known_inputs) {
          const ki = updated.known_inputs;
          if (ki.city) {
            enriched = enriched.replace(/\{city\}/gi, ki.city);
          }
          const emailVal = ki.receiver_email || ki.email;
          if (emailVal) {
            enriched = enriched.replace(/\{email\}/gi, emailVal).replace(/\{receiver_email\}/gi, emailVal);
          }
          if (ki.topic) {
            enriched = enriched.replace(/\{topic\}/gi, ki.topic);
          }
          if (ki.url) {
            enriched = enriched.replace(/\{url\}/gi, ki.url);
          }
          for (const [k, v] of Object.entries(ki)) {
            enriched = enriched.replace(new RegExp(`\\{${k}\\}`, 'gi'), String(v));
          }
        }
        setPrompt(enriched);
        await handleGeneratePlan(enriched);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error processing response');
    } finally {
      setIsAnswering(false);
    }
  };

  const handleRunWorkflow = () => {
    if (!currentPlan || !currentPlan.workflow_id) return;

    setIsRunning(true);
    setPendingApproval(null);
    setErrorMsg('');
    setLogs([]);
    setRunResult(null);

    const runParam = activeRunId ? `&run_id=${encodeURIComponent(activeRunId)}` : '';
    const streamUrl = getApiUrl(`/api/workflows/${currentPlan.workflow_id}/stream?dry_run=${dryRun ? 'true' : 'false'}${runParam}`);
    const es = new EventSource(streamUrl);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const timestamp = new Date().toLocaleTimeString();

        if (data.type === 'workflow_start') {
          if (data.run_id) {
            setActiveRunId(data.run_id);
          }
          setLogs((prev) => [...prev, `[${timestamp}] 🚀 Workflow started: "${data.title}" (Dry-run: ${data.dry_run})`]);
        } else if (data.type === 'step_start') {
          setActiveStepId(data.step_id);
          setCurrentPlan((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              steps: prev.steps.map((s) => (s.id === data.step_id ? { ...s, status: 'running' } : s))
            };
          });
          setLogs((prev) => [...prev, `[${timestamp}] ⚙️ Executing [${data.step_id}]: ${data.name} (tool: ${data.tool})`]);
        } else if (data.type === 'step_result') {
          setCurrentPlan((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              steps: prev.steps.map((s) => (s.id === data.step_id ? { ...s, status: 'completed', result: data.result, mock: data.mock } : s))
            };
          });
          const preview = String(data.result).slice(0, 180).replace(/\n/g, ' ');
          setLogs((prev) => [...prev, `[${timestamp}] ✅ Step [${data.step_id}] completed${data.mock ? ' [mock]' : ''}: ${preview}...`]);
        } else if (data.type === 'step_error') {
          const disp = data.display_status || 'FAILED';
          setCurrentPlan((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              steps: prev.steps.map((s) => (s.id === data.step_id ? { ...s, status: 'failed', displayStatus: disp, error: data.error } : s))
            };
          });
          setLogs((prev) => [...prev, `[${timestamp}] ❌ Step [${data.step_id}] ${disp}: ${data.error}`]);
        } else if (data.type === 'step_skipped') {
          setCurrentPlan((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              steps: prev.steps.map((s) => (s.id === data.step_id ? { ...s, status: 'skipped', error: data.reason } : s))
            };
          });
          setLogs((prev) => [...prev, `[${timestamp}] ⏭️ Step [${data.step_id}] SKIPPED: ${data.reason}`]);
        } else if (data.type === 'heartbeat') {
          // Keep-alive heartbeat from backend while awaiting approval
        } else if (data.type === 'approval_required') {
          setPendingApproval(data);
          if (data.run_id) {
            setActiveRunId(data.run_id);
          }
          setActiveStepId(data.step_id);
          setCurrentPlan((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: 'waiting_for_approval',
              steps: prev.steps.map((s) => (s.id === data.step_id ? { ...s, status: 'waiting_approval' } : s))
            };
          });
          setLogs((prev) => [
            ...prev,
            `[${timestamp}] ⚠️ RUN PAUSED: Human approval required for step [${data.step_id}] (${data.name}). Please review parameters and choose Approve or Reject.`
          ]);
          setTimeout(() => {
            document.getElementById('human-approval-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        } else if (data.type === 'approval_resolved') {
          setPendingApproval(null);
          setLogs((prev) => [
            ...prev,
            `[${timestamp}] ⚖️ Human Approval decision: ${data.decision.toUpperCase()}`
          ]);
        } else if (data.type === 'workflow_complete') {
          setPendingApproval(null);
          setIsRunning(false);
          setActiveStepId(null);
          setRunResult({
            status: data.status,
            duration_seconds: data.duration_seconds,
            summary: data.summary,
            step_outputs: data.step_outputs || [],
            generated_files: data.generated_files || [],
            timestamp: data.timestamp || new Date().toISOString()
          });
          setLogs((prev) => [
            ...prev,
            `[${timestamp}] 🏁 Workflow finished with status: ${data.status.toUpperCase()} in ${data.duration_seconds}s`
          ]);
          es.close();
          fetchWorkflows();
        } else if (data.type === 'workflow_cancelled') {
          setPendingApproval(null);
          setIsRunning(false);
          setActiveStepId(null);
          setRunResult({
            status: 'cancelled',
            duration_seconds: 0,
            summary: 'Workflow execution was cancelled or rejected by user.',
            step_outputs: [],
            generated_files: [],
            timestamp: new Date().toISOString()
          });
          setLogs((prev) => [...prev, `[${timestamp}] 🛑 Workflow was cancelled.`]);
          es.close();
          fetchWorkflows();
        } else if (data.type === 'error') {
          setPendingApproval(null);
          setErrorMsg(data.error);
          setIsRunning(false);
          setActiveStepId(null);
          es.close();
        }
      } catch (parseErr) {
        console.error('Error parsing SSE event:', parseErr);
      }
    };

    es.onerror = () => {
      // Do NOT erase pendingApproval if currently waiting for human decision!
      // This preserves the card and Approve/Reject buttons if the network or proxy times out.
      if (!pendingApproval) {
        setIsRunning(false);
        setActiveStepId(null);
      }
      es.close();
    };
  };

  const handleCancelWorkflow = async () => {
    if (!currentPlan) return;
    try {
      await fetch(getApiUrl(`/api/workflows/${currentPlan.workflow_id}/cancel`), { method: 'POST' });
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Requesting cancellation...`]);
    } catch (e) {
      console.warn('Failed to cancel workflow:', e);
    }
  };

  const handleSaveAsMyTemplate = async () => {
    if (!currentPlan) return;
    setIsSavingTemplate(true);
    try {
      const res = await fetch(getApiUrl('/api/templates'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentPlan.title || 'Custom Workflow',
          prompt: prompt || currentPlan.prompt,
          category: 'Custom',
          description: currentPlan.description || prompt,
          tools_used: (currentPlan.steps || []).map(s => s.tool),
          required_credentials: (currentPlan.missing_credentials || []).map(mc => mc.key || mc),
          default_inputs: {},
          requires_approval: (currentPlan.steps || []).some(s => s.requires_approval),
          plan: currentPlan,
          icon: 'Sparkles',
          badge: 'My Template'
        })
      });
      if (res.ok) {
        setTemplateSaveSuccess('Workflow saved to My Templates! You can now launch it anytime from Integrations.');
        setTimeout(() => setTemplateSaveSuccess(null), 5000);
      } else {
        const err = await res.json();
        setErrorMsg(err.detail || 'Failed to save template');
      }
    } catch (err) {
      setErrorMsg('Error saving custom template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleLoadSavedWorkflow = async (wf) => {
    try {
      const res = await fetch(getApiUrl(`/api/workflows/${wf.id}`));
      if (res.ok) {
        const fullWf = await res.json();
        setCurrentPlan(fullWf.plan);
        setSelectedHistoryWorkflow(fullWf);
        setSelectedStep(fullWf.plan.steps && fullWf.plan.steps[0] ? fullWf.plan.steps[0] : null);
        setLogs([]);
      }
    } catch (e) {
      console.warn('Failed to load workflow details:', e);
    }
  };

  const handleDeleteWorkflow = async (e, wfId) => {
    e.stopPropagation();
    try {
      const res = await fetch(getApiUrl(`/api/workflows/${wfId}`), { method: 'DELETE' });
      if (res.ok) {
        if (currentPlan && currentPlan.workflow_id === wfId) {
          setCurrentPlan(null);
        }
        fetchWorkflows();
      }
    } catch (err) {
      console.warn('Delete workflow failed:', err);
    }
  };

  const handleResolveApproval = async (decision, apprId, alreadySubmitted = false) => {
    const approvalIdToUse = apprId || pendingApproval?.approval_id || pendingApproval?.id;
    if (!approvalIdToUse) return;

    setIsResolvingApproval(true);
    const timestamp = new Date().toLocaleTimeString();

    // Log decision immediately in UI
    setLogs((prev) => [
      ...prev,
      `[${timestamp}] 👤 Human Approval decision recorded: ${decision.toUpperCase()}`
    ]);

    try {
      if (!alreadySubmitted) {
        const res = await fetch(getApiUrl(`/api/approvals/${approvalIdToUse}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.warn('Approval resolution notice:', err);
        }
      }

      // Hide approval card immediately once decision is recorded (Requirement 1)
      setPendingApproval(null);

      if (decision === 'reject') {
        setIsRunning(false);
        setActiveStepId(null);
        setRunResult({
          status: 'cancelled',
          duration_seconds: 0,
          summary: 'Workflow execution was cancelled or rejected by user.',
          step_outputs: [],
          generated_files: [],
          timestamp: new Date().toISOString()
        });
        fetchWorkflows();
      }
    } catch (err) {
      console.warn('Error resolving approval:', err);
    } finally {
      setIsResolvingApproval(false);
    }
  };

  const handleSaveQuickEmail = async (e) => {
    if (e) e.preventDefault();
    if (!quickCredsForm.email_user || !quickCredsForm.email_user.includes('@')) {
      setQuickCredsError('Please enter a valid Gmail address (e.g. user@gmail.com).');
      return;
    }
    const cleanPass = (quickCredsForm.email_pass || '').replace(/\s+/g, '');
    if (cleanPass.length !== 16) {
      setQuickCredsError(`Google App Password must be exactly 16 characters (entered: ${cleanPass.length}).`);
      return;
    }

    setIsSavingQuickCreds(true);
    setQuickCredsError('');
    try {
      const resp = await fetch(getApiUrl('/api/integrations/credentials/email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_user: quickCredsForm.email_user.trim(),
          email_pass: cleanPass
        })
      });
      const data = await resp.json();
      if (resp.ok) {
        setQuickCredsSuccess('Credentials saved successfully in backend SQLite & env!');
        if (currentPlan) {
          setCurrentPlan((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              missing_credentials: (prev.missing_credentials || []).filter(
                (mc) => (mc.key || mc) !== 'EMAIL_USER' && (mc.key || mc) !== 'EMAIL_PASS'
              )
            };
          });
        }
        setLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] 🔑 Email credentials configured and saved in backend. Ready to execute!`
        ]);
        setTimeout(() => {
          setQuickCredsModalOpen(false);
          setQuickCredsSuccess('');
          setQuickCredsForm({ email_user: '', email_pass: '' });
        }, 1200);
      } else {
        setQuickCredsError(data.detail || 'Failed to save email credentials.');
      }
    } catch (err) {
      setQuickCredsError('Network error connecting to backend.');
    } finally {
      setIsSavingQuickCreds(false);
    }
  };

  const handleScheduleWorkflow = async (e) => {
    if (e) e.preventDefault();
    if (!currentPlan) return;

    setIsSubmittingSchedule(true);
    setErrorMsg('');
    try {
      const res = await fetch(getApiUrl('/api/schedules'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: currentPlan.title,
          prompt: prompt || currentPlan.description,
          frequency: scheduleConfig.frequency,
          timezone: scheduleConfig.timezone || 'Asia/Kolkata',
          hour: parseInt(scheduleConfig.hour, 10),
          minute: parseInt(scheduleConfig.minute, 10),
          day_of_week: scheduleConfig.day_of_week
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to register schedule');
      }

      const scheduledData = await res.json();
      setScheduledInfo(scheduledData);
      setIsSchedulingModalOpen(false);
    } catch (err) {
      setErrorMsg(err.message || 'Error scheduling workflow');
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  const activeStepNum = runResult ? 4 : (isRunning || pendingApproval) ? 3 : currentPlan ? 2 : 1;

  const EXAMPLE_CHIPS = [
    { label: '🌤️ Weather email now', prompt: 'Send me the weather report of Lucknow by email to inshaf713@gmail.com' },
    { label: '🤖 Daily AI news on Telegram', prompt: 'Check current IST time, fetch latest AI news in India, and send on Telegram' },
    { label: '📊 Clean my CSV', prompt: 'Analyze tabular data from workspace/sample.csv, compute KPIs and save executive report' },
    { label: '💼 Top AI Skills in India', prompt: 'Search top 5 in-demand skills for AI and software engineers in India in 2026, summarize them, and save to workspace/ai_engineer_skills.txt' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      
      {/* 4-Step Progress Bar at the Top */}
      <FlowProgressBar activeStep={activeStepNum} isRunning={isRunning} hasResult={!!runResult} />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-violet-950/40 border border-white/10 shadow-2xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-white">
              Prompt-to-Workflow <span className="text-cyan-400">Engine</span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Turn natural language tasks (in English, Hindi or Urdu) into autonomous, executable step graphs with zero hand-wiring.
          </p>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-2 self-start md:self-auto px-3 py-1.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Strict Registered Tools Only</span>
        </div>
      </div>

      {/* Top Workflow Builder Section: Input + Conversational Questions Panel */}
      <div className={`grid grid-cols-1 ${questionsSession ? 'lg:grid-cols-12' : ''} gap-6 items-start`}>
        
        {/* Left / Main Column: Task Input & Starter Templates */}
        <div className={`${questionsSession ? 'lg:col-span-7' : 'w-full'} space-y-4`}>
          <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Describe your workflow task</span>
              </label>
              <span className="text-[11px] text-slate-400">English, हिन्दी or اردو</span>
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="E.g., 'Send me the weather report every day at 5 PM by email' or 'Roz subah 8 baje top AI news mere Gmail par bhejo'..."
              rows={3}
              disabled={isExtracting || isGenerating || isRunning}
              className="w-full bg-slate-950/50 text-slate-100 placeholder:text-slate-500 text-sm outline-none resize-none p-3.5 rounded-xl border border-white/10 focus:border-cyan-500/50 transition-colors"
            />

            {/* Quick Example Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="text-[11px] font-semibold text-slate-400">Quick chips:</span>
              {EXAMPLE_CHIPS.map((chip, cIdx) => (
                <button
                  key={cIdx}
                  type="button"
                  onClick={() => {
                    setPrompt(chip.prompt);
                    handleExtractAndBuildWorkflow(chip.prompt);
                  }}
                  disabled={isExtracting || isGenerating || isRunning}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 hover:bg-cyan-500/15 text-slate-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/30 transition-all cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Action Controls & Voice Input */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <VoiceInputButton 
                  onTranscript={(t) => setPrompt((prev) => (prev ? `${prev} ${t}` : t))} 
                  disabled={isExtracting || isGenerating || isRunning} 
                />

                {/* Dry Run Mode Switch */}
                <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 cursor-pointer hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    disabled={isRunning}
                    className="w-3.5 h-3.5 rounded accent-cyan-500 cursor-pointer"
                  />
                  <span className="font-medium">Dry Run (Simulate)</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExtractAndBuildWorkflow()}
                  disabled={!prompt.trim() || isExtracting || isGenerating || isRunning}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExtracting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Analyzing Requirements...</span>
                    </>
                  ) : isGenerating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Architecting Plan...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Build Workflow</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 1-Click Templates */}
            <div className="pt-3 border-t border-white/5">
              <span className="text-[11px] font-medium text-slate-400 mb-2 block">Quick Examples (1-Click):</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {WORKFLOW_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPrompt(tmpl.prompt);
                      handleExtractAndBuildWorkflow(tmpl.prompt);
                    }}
                    disabled={isExtracting || isGenerating || isRunning}
                    className="text-left p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 truncate">
                        {tmpl.title}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {tmpl.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-1">{tmpl.prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Questions Panel */}
        {questionsSession && (
          <div className="lg:col-span-5">
            <QuestionsPanel
              session={questionsSession}
              onAnswer={handleAnswerQuestion}
              onReset={() => setQuestionsSession(null)}
              isSubmitting={isAnswering || isGenerating}
            />
          </div>
        )}

      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-3 shadow-lg">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <span className="flex-1 font-medium">{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-white">&times;</button>
        </div>
      )}

      {/* Template Save Success Banner */}
      {templateSaveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-3 shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="flex-1 font-medium">{templateSaveSuccess}</span>
          <button onClick={() => setTemplateSaveSuccess(null)} className="text-emerald-400 hover:text-white">&times;</button>
        </div>
      )}

      {/* Missing Credentials Alert Banner with 1-Click Action */}
      {currentPlan && currentPlan.missing_credentials && currentPlan.missing_credentials.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs space-y-3 shadow-lg backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <Key className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>Missing Integration Credentials ({currentPlan.missing_credentials.length})</span>
            </div>
            <div className="flex items-center gap-2">
              {currentPlan.missing_credentials.some(mc => (mc.key || mc).includes('EMAIL')) && (
                <button
                  type="button"
                  onClick={() => {
                    setQuickCredsModalOpen(true);
                    setQuickCredsError('');
                    setQuickCredsSuccess('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Configure Gmail Here</span>
                </button>
              )}
              <button
                type="button"
                onClick={onOpenIntegrations}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <span>Open Integrations</span>
              </button>
              {!dryRun && (
                <button
                  type="button"
                  onClick={() => setDryRun(true)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <span>Enable Simulation Mode</span>
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-amber-200/80">
            This workflow requires tools that are not configured in your server environment. You can configure them above directly without leaving this page, or run in <strong>Simulation (Dry Run)</strong> mode.
          </p>
          <ul className="list-disc list-inside space-y-1 text-[11px] font-mono text-amber-300/90 pl-1">
            {currentPlan.missing_credentials.map((mc, i) => (
              <li key={i}>
                <strong>{mc.key || mc}</strong>: {mc.instructions || 'Configuration required in Integrations'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick In-Context Credentials Setup Modal */}
      {quickCredsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-white/10 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Configure Gmail Integration</h3>
                  <p className="text-xs text-slate-400">Save credentials directly without losing your active workflow.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickCredsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {quickCredsError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{quickCredsError}</span>
              </div>
            )}

            {quickCredsSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{quickCredsSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveQuickEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Sender Gmail Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="your.email@gmail.com"
                  value={quickCredsForm.email_user}
                  onChange={(e) => setQuickCredsForm({ ...quickCredsForm, email_user: e.target.value })}
                  className="w-full bg-slate-950/80 text-white placeholder:text-slate-500 text-xs p-2.5 rounded-xl border border-white/10 outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    16-Character App Password
                  </label>
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <span>Google App Passwords</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showQuickPass ? 'text' : 'password'}
                    required
                    placeholder="abcd efgh ijkl mnop"
                    value={quickCredsForm.email_pass}
                    onChange={(e) => setQuickCredsForm({ ...quickCredsForm, email_pass: e.target.value })}
                    className="w-full bg-slate-950/80 text-white placeholder:text-slate-500 text-xs p-2.5 pr-10 rounded-xl border border-white/10 outline-none focus:border-cyan-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowQuickPass(!showQuickPass)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showQuickPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                  <span>Saved securely in backend SQLite &amp; env</span>
                  <span className={(quickCredsForm.email_pass || '').replace(/\s+/g, '').length === 16 ? 'text-emerald-400 font-semibold' : 'text-slate-500 font-mono'}>
                    {(quickCredsForm.email_pass || '').replace(/\s+/g, '').length}/16 chars
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setQuickCredsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuickCreds}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
                >
                  {isSavingQuickCreds ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save &amp; Continue Workflow</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Visual Workflow Graph & Execution Panel */}
      {currentPlan && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/60 border border-white/10">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>{currentPlan.title}</span>
                {dryRun && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    Dry Run Mode
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">{currentPlan.description}</p>
            </div>

            {/* Run Now, Schedule, and Cancel Action Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {isRunning ? (
                <button
                  type="button"
                  onClick={handleCancelWorkflow}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Cancel Run</span>
                </button>
              ) : (
                <div className="flex items-center gap-2.5">
                  {/* Run Now Button */}
                  <div className="flex flex-col items-start sm:items-center">
                    <button
                      type="button"
                      onClick={handleRunWorkflow}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{dryRun ? 'Simulate Run' : 'Run Now'}</span>
                    </button>
                    <span className="text-[9.5px] text-slate-400 mt-0.5">Executes immediately</span>
                  </div>

                  {/* Save and Schedule Button */}
                  <div className="flex flex-col items-start sm:items-center">
                    <button
                      type="button"
                      onClick={() => setIsSchedulingModalOpen(true)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Save &amp; Schedule</span>
                    </button>
                    <span className="text-[9.5px] text-slate-400 mt-0.5">Repeats via APScheduler</span>
                  </div>

                  {/* Save as My Template Button */}
                  <div className="flex flex-col items-start sm:items-center">
                    <button
                      type="button"
                      onClick={handleSaveAsMyTemplate}
                      disabled={isSavingTemplate}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 transition-all flex items-center gap-1.5"
                      title="Save this workflow into your reusable template gallery"
                    >
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{isSavingTemplate ? 'Saving...' : 'Save as Template'}</span>
                    </button>
                    <span className="text-[9.5px] text-slate-400 mt-0.5">Reusable gallery</span>
                  </div>

                  {/* Dry Run Toggle */}
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 ml-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={dryRun}
                      onChange={(e) => setDryRun(e.target.checked)}
                      className="rounded border-white/20 bg-slate-950 text-cyan-500 focus:ring-0"
                    />
                    <span className="text-[11px] text-slate-400">Dry Run</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Active Schedule Notification Banner */}
          {scheduledInfo && (
            <div className="p-3.5 rounded-2xl bg-cyan-950/50 border border-cyan-500/40 text-cyan-200 text-xs flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">Workflow Scheduled in APScheduler</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {scheduledInfo.frequency}
                    </span>
                  </div>
                  <p className="text-[11px] text-cyan-200/80 mt-0.5">
                    Timezone: <strong>{scheduledInfo.timezone_str || 'Asia/Kolkata'}</strong>
                    {scheduledInfo.next_run && (
                      <span> &bull; Next run: <strong className="text-white">{new Date(scheduledInfo.next_run).toLocaleString('en-IN', { timeZone: scheduledInfo.timezone_str || 'Asia/Kolkata' })}</strong></span>
                    )}
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/30 font-medium">
                Active in Background (Runs even when browser closed)
              </span>
            </div>
          )}

          {/* Results Panel (Shown above the step graph after run finishes) */}
          {runResult && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/95 to-slate-950/90 border border-white/10 shadow-2xl space-y-4 animate-in fade-in duration-200">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${
                    runResult.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    runResult.status === 'partial' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}>
                    {runResult.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> :
                     runResult.status === 'partial' ? <AlertTriangle className="w-5 h-5" /> :
                     <XCircle className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white tracking-wide">
                        Workflow Execution Results
                      </h3>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                        runResult.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        runResult.status === 'partial' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {runResult.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Duration: <strong className="text-cyan-300">{runResult.duration_seconds}s</strong>
                      {runResult.timestamp && <span> &bull; Completed {new Date(runResult.timestamp).toLocaleTimeString()}</span>}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setRunResult(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-xs flex items-center gap-1"
                  title="Dismiss results panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Readable Executive Summary */}
              {runResult.summary && (
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-slate-200 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-semibold text-cyan-300 block text-[11px] uppercase tracking-wider">Executive Summary</span>
                    <p className="leading-relaxed text-slate-300">{runResult.summary}</p>
                  </div>
                </div>
              )}

              {/* Generated Files & Download Section */}
              {runResult.generated_files && runResult.generated_files.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4" />
                    <span>Generated Workspace Files ({runResult.generated_files.length})</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {runResult.generated_files.map((file, fIdx) => (
                      <div key={fIdx} className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <div className="truncate">
                            <span className="font-mono text-xs font-semibold text-white block truncate">
                              {file.filename}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {file.size_kb} KB &bull; workspace/{file.filename}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewFileModal(file)}
                            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] font-medium flex items-center gap-1 border border-white/5 transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Preview</span>
                          </button>
                          <a
                            href={file.download_url}
                            download={file.filename}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1 shadow-sm transition-all"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step Outputs Showcase */}
              {runResult.step_outputs && runResult.step_outputs.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1">
                    Actual Step Outputs
                  </span>
                  <div className="grid grid-cols-1 gap-2.5">
                    {runResult.step_outputs.map((step, sIdx) => (
                      <div key={sIdx} className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                              {step.step_id}
                            </span>
                            <span className="text-xs font-semibold text-white">{step.name}</span>
                            <code className="text-[10px] font-mono text-cyan-300 bg-cyan-950/40 px-1.5 py-0.2 rounded">
                              {step.tool}
                            </code>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                            step.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                            step.status === 'failed' ? 'bg-rose-500/20 text-rose-300' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {step.display_status || step.status}
                          </span>
                        </div>

                        {step.result && (
                          <pre className="p-2.5 rounded-lg bg-slate-950/80 border border-white/5 font-mono text-[11px] text-slate-200 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar leading-relaxed">
                            {step.result}
                          </pre>
                        )}

                        {step.error && (
                          <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs font-mono">
                            {step.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Large, Prominent Human Approval Card (Rendered at top of pipeline when pending) */}
          {pendingApproval && (
            <ApprovalCard 
              approval={pendingApproval} 
              onResolve={handleResolveApproval} 
              dryRun={dryRun} 
            />
          )}

          {/* Step Graph Canvas */}
          <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-white/10 shadow-xl">
            <WorkflowGraph
              steps={currentPlan.steps || []}
              activeStepId={activeStepId}
              selectedStepId={selectedStep ? selectedStep.id : null}
              pendingApproval={pendingApproval}
              onResolveApproval={handleResolveApproval}
              onSelectStep={(s) => setSelectedStep(s)}
              onOpenIntegrations={onOpenIntegrations}
            />
          </div>

          {/* Collapsible Live Activity Logs Panel */}
          <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-lg">
            <div 
              onClick={() => setShowLogs(!showLogs)}
              className="flex items-center justify-between p-3.5 bg-slate-900/60 hover:bg-slate-900 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Live Activity Log</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-400 font-mono">
                  {logs.length} events
                </span>
                {isRunning && (
                  <span className="flex items-center gap-1.5 text-[10px] text-cyan-400 ml-2 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                    Streaming Live
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                <span className="text-[11px] hidden sm:inline">
                  {showLogs ? 'Hide detailed console' : 'View live logs'}
                </span>
                {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>

            {showLogs && (
              <div
                ref={logContainerRef}
                className="p-3.5 bg-slate-950/90 font-mono text-[11px] leading-relaxed text-slate-300 border-t border-white/10 max-h-60 overflow-y-auto space-y-1.5 custom-scrollbar animate-in fade-in duration-150"
              >
                {logs.length === 0 ? (
                  <span className="text-slate-600 italic">No execution events yet. Click 'Run Now' or 'Simulate Run' to begin.</span>
                ) : (
                  logs.map((line, idx) => (
                    <div key={idx} className="whitespace-pre-wrap break-words">
                      {line}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Saved Workflows History (Survives Restarts) */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Saved Workflows &amp; Re-run History</h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 font-mono">
              {workflowsHistory.length} total
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDeduplicate}
              disabled={isDeduplicating}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-cyan-300 border border-white/10 transition-all flex items-center gap-1.5"
              title="Merge identical workflows and remove duplicates"
            >
              <RotateCw className={`w-3 h-3 ${isDeduplicating ? 'animate-spin' : ''}`} />
              <span>Clean Duplicates</span>
            </button>

            {workflowsHistory.length > 0 && (
              <button
                type="button"
                onClick={() => handleClearHistory(historyStatusFilter)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-all flex items-center gap-1.5"
                title={`Delete ${historyStatusFilter === 'all' ? 'all' : historyStatusFilter} workflows`}
              >
                <Trash2 className="w-3 h-3" />
                <span>{historyStatusFilter === 'all' ? 'Clear All' : `Clear ${historyStatusFilter}`}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls: Search and Status Pills */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between pt-1">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search workflows by prompt or title..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-slate-950/60 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
            {historySearch && (
              <button
                onClick={() => setHistorySearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {['all', 'completed', 'partial', 'failed', 'interrupted', 'draft'].map((statusKey) => (
              <button
                key={statusKey}
                type="button"
                onClick={() => setHistoryStatusFilter(statusKey)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all whitespace-nowrap ${
                  historyStatusFilter === statusKey
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent'
                }`}
              >
                {statusKey}
              </button>
            ))}
          </div>
        </div>

        {/* Workflow Cards */}
        {workflowsHistory.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-white/[0.01] border border-white/5">
            <p className="text-xs text-slate-400 italic">No workflows matching current search/filter criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {workflowsHistory.map((wf) => (
              <div
                key={wf.id}
                onClick={() => handleLoadSavedWorkflow(wf)}
                className="p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/10 transition-all cursor-pointer flex flex-col justify-between group shadow-sm hover:border-cyan-500/30"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 truncate" title={wf.title}>
                      {wf.title}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold tracking-wider ${
                      wf.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      wf.status === 'running' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse' :
                      wf.status === 'partial' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      wf.status === 'failed' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                      wf.status === 'interrupted' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                      'bg-slate-800 text-slate-400 border border-white/5'
                    }`}>
                      {wf.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mb-2 leading-relaxed">{wf.prompt}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-slate-500">
                  <span>{new Date(wf.created_at).toLocaleDateString()}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 group-hover:underline flex items-center gap-0.5 font-medium">
                      Open <ArrowRight className="w-2.5 h-2.5" />
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteWorkflow(e, wf.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                      title="Delete workflow"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scheduling Configuration Modal Dialog */}
      {isSchedulingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-white/10 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Save &amp; Schedule Workflow</h3>
                  <p className="text-xs text-slate-400">Automated recurring background task</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSchedulingModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleScheduleWorkflow} className="space-y-4">
              {/* Frequency selection */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Repeat Frequency</label>
                <div className="grid grid-cols-3 gap-2">
                  {['daily', 'hourly', 'weekly'].map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setScheduleConfig({ ...scheduleConfig, frequency: freq })}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold capitalize border transition-all ${
                        scheduleConfig.frequency === freq
                          ? 'bg-cyan-600 text-white border-cyan-400 shadow-lg shadow-cyan-600/30'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hour & Minute */}
              {scheduleConfig.frequency !== 'hourly' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">Execution Hour (0-23)</label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={scheduleConfig.hour}
                      onChange={(e) => setScheduleConfig({ ...scheduleConfig, hour: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">Execution Minute (0-59)</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={scheduleConfig.minute}
                      onChange={(e) => setScheduleConfig({ ...scheduleConfig, minute: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Timezone */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Target Timezone</label>
                <select
                  value={scheduleConfig.timezone}
                  onChange={(e) => setScheduleConfig({ ...scheduleConfig, timezone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:border-cyan-400 focus:outline-none"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30) - Default</option>
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                </select>
              </div>

              {/* UI Explanation */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-slate-300 space-y-1">
                <span className="font-semibold text-cyan-300 block">⚡ How it works:</span>
                <p className="text-slate-400 leading-relaxed">
                  "Run now" executes immediately, while "Save and schedule" registers a persistent timer in APScheduler that executes repeatedly at the chosen time even when your browser is closed.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsSchedulingModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSchedule}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30 transition-all flex items-center gap-2"
                >
                  {isSubmittingSchedule ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                  <span>Save &amp; Register Schedule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl p-6 rounded-3xl bg-slate-900 border border-white/10 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div className="truncate">
                  <h3 className="text-sm font-bold text-white font-mono truncate">{previewFileModal.filename}</h3>
                  <span className="text-[11px] text-slate-400">{previewFileModal.size_kb} KB &bull; workspace/{previewFileModal.filename}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewFileModal(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <pre className="flex-1 p-4 rounded-xl bg-slate-950 border border-white/10 font-mono text-xs text-slate-200 overflow-y-auto whitespace-pre-wrap leading-relaxed custom-scrollbar">
              {previewFileModal.preview}
            </pre>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-[11px] text-slate-400">File safely saved in sandboxed workspace directory.</span>
              <a
                href={previewFileModal.download_url}
                download={previewFileModal.filename}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download File</span>
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
