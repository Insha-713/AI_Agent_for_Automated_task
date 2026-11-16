import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase,
  Sparkles,
  BarChart3,
  UserCheck,
  Search,
  CheckCircle2,
  FileCode,
  Mail,
  Compass,
  Layers,
  Bell,
  Download,
  Upload,
  Plus,
  Trash2,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  FileText,
  Clock,
  TrendingUp,
  Percent,
  Sliders,
  Send,
  MessageSquare,
  X,
  ChevronRight,
  ShieldCheck,
  HelpCircle,
  Filter,
  Eye,
  Award,
  Globe,
  Edit3
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

const PILLAR_COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b'];
const STATUS_COLORS = {
  saved: 'bg-slate-700/50 text-slate-300 border-slate-600',
  interested: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  preparing: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  ready_to_apply: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  applied: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  assessment: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  interview: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  offer: 'bg-teal-500/20 text-teal-300 border-teal-500/40 shadow-glow-cyan',
  rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  withdrawn: 'bg-slate-800 text-slate-400 border-slate-700'
};

export default function CareerPage() {
  const [subTab, setSubTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Core Data States
  const [dashboardData, setDashboardData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [resumeVersions, setResumeVersions] = useState([]);
  const [alertSettings, setAlertSettings] = useState(null);
  const [reportsList, setReportsList] = useState([]);

  // Active Item Contexts
  const [selectedJob, setSelectedJob] = useState(null);
  const [atsEvaluation, setAtsEvaluation] = useState(null);
  const [tailoredResume, setTailoredResume] = useState(null);
  const [coverLetter, setCoverLetter] = useState(null);
  const [applicationPacket, setApplicationPacket] = useState(null);

  // Filters & Discovery
  const [jobQuery, setJobQuery] = useState('');
  const [jobCategory, setJobCategory] = useState('Generative AI Engineer');
  const [jobLocation, setJobLocation] = useState('Remote');
  const [statusFilter, setStatusFilter] = useState('all');

  // Multi-Job Compare Modal
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareJobsSelection, setCompareJobsSelection] = useState([]);
  const [compareResults, setCompareResults] = useState(null);

  // Application History Timeline Modal
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelineApp, setTimelineApp] = useState(null);
  const [timelineHistory, setTimelineHistory] = useState([]);

  // Conversational AI Chat Drawer
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'assistant',
      text: 'Hello Insha! I am your AgentFlow Career AI Assistant. Ask me anything about finding jobs, evaluating your ATS score, tailoring your resume, or preparing for interviews. (Supports English, हिन्दी, and اردو).'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Uploader ref
  const fileInputRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4500);
  };

  // Initial Data Fetch
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchDashboard(),
        fetchProfile(),
        fetchPreferences(),
        fetchJobs(),
        fetchApplications(),
        fetchAlertSettings(),
        fetchReports()
      ]);
    } catch (err) {
      console.error('Failed to load career data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/career/dashboard');
      if (res.ok) {
        const json = await res.json();
        setDashboardData(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/career/profile');
      if (res.ok) {
        const json = await res.json();
        setProfile(json.profile);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPreferences = async () => {
    try {
      const res = await fetch('/api/career/preferences');
      if (res.ok) {
        const json = await res.json();
        setPreferences(json.preferences);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/career/jobs?limit=50');
      if (res.ok) {
        const json = await res.json();
        setJobs(json.jobs || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchApplications = async () => {
    try {
      const res = await fetch('/api/career/applications');
      if (res.ok) {
        const json = await res.json();
        setApplications(json.applications || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAlertSettings = async () => {
    try {
      const res = await fetch('/api/career/alerts/settings');
      if (res.ok) {
        const json = await res.json();
        setAlertSettings(json.settings || {});
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/career/reports');
      if (res.ok) {
        const json = await res.json();
        setReportsList(json.reports || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // CV Upload Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      const res = await fetch('/api/career/profile/upload-cv', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data.profile);
        showToast(`Successfully extracted profile from ${file.name}! Completeness: ${data.profile.completeness_score}%`);
        fetchDashboard();
      } else {
        showToast(data.detail || 'CV upload failed', 'error');
      }
    } catch (err) {
      showToast('Error uploading CV: ' + err.message, 'error');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Profile Save
  const handleSaveProfile = async (updatedFields) => {
    try {
      const res = await fetch('/api/career/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data.profile);
        showToast('Profile updated successfully!');
        fetchDashboard();
      }
    } catch (err) {
      showToast('Failed to save profile: ' + err.message, 'error');
    }
  };

  // Preferences Save
  const handleSavePreferences = async (updatedPrefs) => {
    try {
      const res = await fetch('/api/career/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPrefs)
      });
      const data = await res.json();
      if (res.ok) {
        setPreferences(data.preferences);
        showToast('Career preferences saved!');
      }
    } catch (err) {
      showToast('Failed to save preferences: ' + err.message, 'error');
    }
  };

  // Job Discovery Trigger
  const handleDiscoverJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/career/jobs/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: jobCategory,
          location: jobLocation,
          limit: 15
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Discovered ${data.added_count} new opportunities (${data.duplicates_skipped} duplicates filtered).`);
        await fetchJobs();
        await fetchDashboard();
      } else {
        showToast(data.detail || 'Discovery failed', 'error');
      }
    } catch (err) {
      showToast('Discovery error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ATS Evaluation Trigger
  const handleAnalyzeATS = async (job) => {
    setSelectedJob(job);
    setLoading(true);
    setSubTab('ats');
    try {
      const res = await fetch('/api/career/ats/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: job.id })
      });
      const data = await res.json();
      if (res.ok) {
        setAtsEvaluation(data.evaluation);
        showToast(`ATS score evaluated: ${data.evaluation.overall_score}/100`);
      } else {
        showToast(data.detail || 'ATS analysis failed', 'error');
      }
    } catch (err) {
      showToast('ATS error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Compare Multiple Jobs
  const handleRunComparison = async () => {
    if (compareJobsSelection.length < 2) {
      showToast('Please select at least 2 jobs to compare', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/career/ats/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_ids: compareJobsSelection })
      });
      const data = await res.json();
      if (res.ok) {
        setCompareResults(data.comparisons);
      }
    } catch (e) {
      showToast('Comparison failed: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Generate Tailored Resume
  const handleGenerateResume = async (job) => {
    setSelectedJob(job);
    setLoading(true);
    setSubTab('resume');
    try {
      const res = await fetch('/api/career/resume/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.id,
          target_role: job.title
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTailoredResume(data);
        showToast('Generated STAR-tailored resume!');
      } else {
        showToast(data.detail || 'Resume generation failed', 'error');
      }
    } catch (err) {
      showToast('Resume generation error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Generate Cover Letter
  const handleGenerateCoverLetter = async (job, tone = 'Confident') => {
    setSelectedJob(job);
    setLoading(true);
    setSubTab('cover-letter');
    try {
      const res = await fetch('/api/career/cover-letter/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.id,
          tone: tone
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCoverLetter(data);
        showToast(`Generated ${tone} cover letter!`);
      } else {
        showToast(data.detail || 'Cover letter failed', 'error');
      }
    } catch (err) {
      showToast('Cover letter error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Prepare Job Application Packet
  const handlePrepareApplication = async (job) => {
    setSelectedJob(job);
    setLoading(true);
    setSubTab('assistant');
    try {
      const res = await fetch('/api/career/assistant/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: job.id })
      });
      const data = await res.json();
      if (res.ok) {
        setApplicationPacket(data.packet);
        showToast('Application packet and Q&A cheat sheet ready!');
      } else {
        showToast(data.detail || 'Application prep failed', 'error');
      }
    } catch (err) {
      showToast('Preparation error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Add Job to Application Tracker
  const handleAddToTracker = async (job, initialStatus = 'interested') => {
    try {
      const res = await fetch('/api/career/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.id,
          company: job.company,
          job_title: job.title,
          location: job.location,
          source: job.source,
          salary_notes: job.salary,
          status: initialStatus,
          notes: `Added from Job Finder (${job.source})`
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Added ${job.title} at ${job.company} to Application Tracker!`);
        fetchApplications();
        fetchDashboard();
      } else {
        showToast(data.detail || 'Failed to add application', 'error');
      }
    } catch (err) {
      showToast('Error tracking job: ' + err.message, 'error');
    }
  };

  // Update Application Status
  const handleUpdateAppStatus = async (appId, newStatus) => {
    try {
      const res = await fetch(`/api/career/applications/${appId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          notes: `Status changed to ${newStatus}`
        })
      });
      if (res.ok) {
        showToast(`Updated status to '${newStatus}'`);
        fetchApplications();
        fetchDashboard();
      }
    } catch (err) {
      showToast('Failed to update status: ' + err.message, 'error');
    }
  };

  // View Application Timeline History
  const handleViewTimeline = async (app) => {
    setTimelineApp(app);
    setShowTimelineModal(true);
    try {
      const res = await fetch(`/api/career/applications/${app.id}/history`);
      if (res.ok) {
        const json = await res.json();
        setTimelineHistory(json.history || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger Daily Job Alerts Now
  const handleTriggerAlertsNow = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/career/alerts/trigger-now', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(`Job alert executed! ${data.result.top_matches_count} top matches found. Email delivery: ${data.result.email_delivery}`);
        fetchReports();
      } else {
        showToast(data.detail || 'Trigger alert failed', 'error');
      }
    } catch (err) {
      showToast('Trigger alert error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Export Jobs Report (Excel / CSV)
  const handleExportJobs = async (fmt) => {
    try {
      const res = await fetch(`/api/career/reports/export-jobs?fmt=${fmt}`, { method: 'POST' });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agentflow_jobs_${new Date().toISOString().slice(0, 10)}.${fmt}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast(`Exported jobs list as .${fmt}!`);
      }
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    }
  };

  // Conversational Career Chat Submit
  const handleSendChat = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/career/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });
      const data = await res.json();
      if (res.ok) {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            text: data.reply.reply,
            intent: data.reply.intent,
            sources: data.reply.sources
          }
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { sender: 'assistant', text: 'Sorry, I encountered an issue processing your request: ' + (data.detail || 'Unknown error') }
        ]);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'assistant', text: 'Error connecting to Career Assistant: ' + err.message }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Filtered Jobs
  const filteredJobs = jobs.filter((j) => {
    const matchesQuery = !jobQuery || 
      j.title.toLowerCase().includes(jobQuery.toLowerCase()) ||
      j.company.toLowerCase().includes(jobQuery.toLowerCase()) ||
      j.location.toLowerCase().includes(jobQuery.toLowerCase()) ||
      (j.required_skills && j.required_skills.some(s => s.toLowerCase().includes(jobQuery.toLowerCase())));
    return matchesQuery;
  });

  // Filtered Applications
  const filteredApps = applications.filter((app) => {
    if (statusFilter === 'all') return true;
    return app.status === statusFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Toast Notification Banner */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-16 right-6 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-3 text-sm backdrop-blur-xl ${
              notification.type === 'error'
                ? 'bg-rose-950/90 text-rose-200 border-rose-500/40'
                : 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
            }`}
          >
            {notification.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            )}
            <span>{notification.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900/90 via-slate-950/90 to-cyan-950/40 p-6 backdrop-blur-xl shadow-glow-cyan">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 shadow-glow-cyan">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold font-display tracking-tight text-white">
                    Agent<span className="text-cyan-400">Flow</span> Career AI
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    v3.0 System
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Intelligent Personal AI Career Assistant &bull; 100% Local Inference &bull; Verified Profile Credentials
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.docx,.doc,.txt"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 transition-all shadow-sm"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Upload CV (PDF/DOCX)</span>
            </button>

            <button
              onClick={handleDiscoverJobs}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-glow-cyan transition-all"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Find Jobs Now</span>
            </button>

            <button
              onClick={() => setShowChatDrawer(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-sm transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5 text-violet-200" />
              <span>Career Chat AI</span>
            </button>
          </div>
        </div>

        {/* Top KPI Quick Bar */}
        {dashboardData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-[11px] text-slate-400 block">Profile Completeness</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold text-white font-mono">{dashboardData.profile_completeness}%</span>
                <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-cyan-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${dashboardData.profile_completeness}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-[11px] text-slate-400 block">Discovered Opportunities</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold text-cyan-300 font-mono">{dashboardData.total_jobs_discovered}</span>
                <span className="text-[10px] text-slate-500">active listings</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-[11px] text-slate-400 block">Application Funnel</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold text-indigo-300 font-mono">
                  {dashboardData.applications?.applied || 0}
                </span>
                <span className="text-[10px] text-slate-500">applied / {dashboardData.applications?.total || 0} tracked</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-[11px] text-slate-400 block">Top Match Score</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold text-emerald-400 font-mono">
                  {dashboardData.top_job_matches?.[0]?.overall_score || 0}%
                </span>
                <span className="text-[10px] text-emerald-400/80">estimated ATS</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Submodule Navigation Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-white/10 custom-scrollbar">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { id: 'profile', label: 'My Profile', icon: UserCheck },
          { id: 'jobs', label: 'Job Finder', icon: Search },
          { id: 'ats', label: 'ATS Analyzer', icon: Percent },
          { id: 'resume', label: 'Resume Builder', icon: FileCode },
          { id: 'cover-letter', label: 'Cover Letter', icon: Mail },
          { id: 'assistant', label: 'Application Assistant', icon: Compass },
          { id: 'tracker', label: 'Application Tracker', icon: Layers },
          { id: 'alerts', label: 'Daily Alerts', icon: Bell },
          { id: 'reports', label: 'Reports & Exports', icon: Download }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          TAB 1: CAREER DASHBOARD
      ===================================================================== */}
      {subTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Funnel & Distribution Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Application Pipeline Card */}
            <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white">Application Pipeline Funnel</h3>
                </div>
                <button
                  onClick={() => setSubTab('tracker')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <span>View Tracker</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {dashboardData?.applications ? (
                <div className="space-y-3">
                  {[
                    { key: 'saved', label: 'Saved / Bookmarked', color: 'bg-slate-600' },
                    { key: 'interested', label: 'Interested', color: 'bg-cyan-500' },
                    { key: 'preparing', label: 'Preparing Packet', color: 'bg-indigo-500' },
                    { key: 'ready_to_apply', label: 'Ready to Apply', color: 'bg-purple-500' },
                    { key: 'applied', label: 'Applied', color: 'bg-blue-500' },
                    { key: 'interview', label: 'Interview Scheduled', color: 'bg-emerald-500' },
                    { key: 'offer', label: 'Offer Received', color: 'bg-teal-400' }
                  ].map((stage) => {
                    const count = dashboardData.applications[stage.key] || 0;
                    const total = dashboardData.applications.total || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={stage.key} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-300 font-medium">{stage.label}</span>
                          <span className="text-slate-400 font-mono">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`${stage.color} h-full rounded-full transition-all duration-500`}
                            style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-500">Loading funnel data...</div>
              )}
            </div>

            {/* Quick Profile Summary Card */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">Active Candidate Profile</h3>
                </div>
                {profile ? (
                  <div className="space-y-3">
                    <div>
                      <span className="text-base font-bold text-white block">{profile.full_name || 'Insha Fatima'}</span>
                      <span className="text-xs text-slate-400">{profile.email}</span>
                      {profile.college && (
                        <span className="text-xs text-slate-400 block mt-0.5">{profile.college}</span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-white/5 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Technical Skills:</span>
                        <span className="text-cyan-300 font-mono font-semibold">
                          {profile.technical_skills?.length || 0} skills
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">AI / ML Frameworks:</span>
                        <span className="text-violet-300 font-mono font-semibold">
                          {profile.ai_ml_skills?.length || 0} skills
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Verified Projects:</span>
                        <span className="text-indigo-300 font-mono font-semibold">
                          {profile.projects?.length || 0} projects
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500">No profile loaded yet.</div>
                )}
              </div>

              <button
                onClick={() => setSubTab('profile')}
                className="w-full mt-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-colors"
              >
                Edit Complete Profile & Preferences
              </button>
            </div>
          </div>

          {/* Top Job Matches Table */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Top Competitive Opportunities (Heuristic ATS Match)</h3>
              </div>
              <button
                onClick={() => setSubTab('jobs')}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <span>Browse All Jobs ({dashboardData?.total_jobs_discovered || 0})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {dashboardData?.top_job_matches && dashboardData.top_job_matches.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboardData.top_job_matches.slice(0, 6).map((match, idx) => {
                  const job = match.job || {};
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold text-cyan-300 font-mono block">
                              {job.company || 'Enterprise Partner'}
                            </span>
                            <h4 className="text-sm font-bold text-white line-clamp-1">{job.title || 'AI Engineer'}</h4>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            {match.overall_score}%
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
                          <span>{job.location || 'Remote'}</span>
                          <span>&bull;</span>
                          <span className="capitalize">{job.workplace_type || 'Remote'}</span>
                        </div>

                        {match.matched_skills && match.matched_skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2.5">
                            {match.matched_skills.slice(0, 3).map((sk, sidx) => (
                              <span
                                key={sidx}
                                className="px-1.5 py-0.2 text-[10px] rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                              >
                                {sk}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
                        <button
                          onClick={() => handleAnalyzeATS(job)}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 transition-colors"
                        >
                          Analyze ATS
                        </button>
                        <button
                          onClick={() => handleGenerateResume(job)}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/20 transition-colors"
                        >
                          Tailor Resume
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                No job matches evaluated yet. Click "Find Jobs Now" above to discover opportunities.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: MY CAREER PROFILE & PREFERENCES
      ===================================================================== */}
      {subTab === 'profile' && profile && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Upload & Core Details */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <Upload className="w-4 h-4 text-cyan-400" />
                <span>Upload & Refresh CV</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Upload your latest resume in PDF or DOCX. AgentFlow extracts your verified credentials into structured data.
              </p>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-cyan-500/30 hover:border-cyan-400/60 rounded-xl p-6 text-center cursor-pointer bg-cyan-500/[0.02] hover:bg-cyan-500/[0.05] transition-all"
              >
                <FileText className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                <span className="text-xs font-semibold text-slate-200 block">Click to upload PDF or DOCX</span>
                <span className="text-[10px] text-slate-400 mt-1 block">Maximum 10 MB &bull; Strict Anti-Hallucination</span>
              </div>
            </div>

            {/* Profile Completeness Breakdown */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-white">Profile Completeness</span>
                <span className="text-xs font-mono font-bold text-cyan-400">{profile.completeness_score}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden mb-4">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                  style={{ width: `${profile.completeness_score}%` }}
                ></div>
              </div>
              <ul className="text-xs text-slate-400 space-y-1.5">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${profile.full_name ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span>Full Name & Contact Info</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${profile.college ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span>Education & Academic Credentials</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${profile.technical_skills?.length ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span>Verified Technical Skills ({profile.technical_skills?.length || 0})</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${profile.projects?.length ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span>Engineering Projects ({profile.projects?.length || 0})</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column: Editable Fields */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-cyan-400" />
                <span>Verified Candidate Credentials</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profile.full_name || ''}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950/60 border border-white/10 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={profile.email || ''}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950/60 border border-white/10 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={profile.phone || ''}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950/60 border border-white/10 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">College / University</label>
                  <input
                    type="text"
                    value={profile.college || ''}
                    onChange={(e) => setProfile({ ...profile, college: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950/60 border border-white/10 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">GitHub URL</label>
                  <input
                    type="url"
                    value={profile.github_url || ''}
                    onChange={(e) => setProfile({ ...profile, github_url: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950/60 border border-white/10 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">LinkedIn URL</label>
                  <input
                    type="url"
                    value={profile.linkedin_url || ''}
                    onChange={(e) => setProfile({ ...profile, linkedin_url: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950/60 border border-white/10 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Skills Tags */}
              <div className="pt-3 border-t border-white/5">
                <label className="text-[11px] font-medium text-slate-400 block mb-2">Technical Skills</label>
                <div className="flex flex-wrap gap-1.5">
                  {profile.technical_skills?.map((sk, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 text-xs rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center gap-1.5"
                    >
                      <span>{sk}</span>
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-white"
                        onClick={() => {
                          const updated = profile.technical_skills.filter((_, i) => i !== idx);
                          setProfile({ ...profile, technical_skills: updated });
                        }}
                      />
                    </span>
                  ))}
                </div>
              </div>

              {/* AI / ML Skills */}
              <div className="pt-3 border-t border-white/5">
                <label className="text-[11px] font-medium text-slate-400 block mb-2">AI / ML Frameworks</label>
                <div className="flex flex-wrap gap-1.5">
                  {profile.ai_ml_skills?.map((sk, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 text-xs rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/20 flex items-center gap-1.5"
                    >
                      <span>{sk}</span>
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-white"
                        onClick={() => {
                          const updated = profile.ai_ml_skills.filter((_, i) => i !== idx);
                          setProfile({ ...profile, ai_ml_skills: updated });
                        }}
                      />
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Save Button */}
              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => handleSaveProfile(profile)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-black font-semibold shadow-glow-cyan transition-all"
                >
                  Save Profile Changes
                </button>
              </div>
            </div>

            {/* Career Preferences Section */}
            {preferences && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <span>Target Career Preferences</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">Target Roles</label>
                    <input
                      type="text"
                      value={preferences.target_roles?.join(', ') || ''}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          target_roles: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                        })
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950/60 border border-white/10 text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">Preferred Locations</label>
                    <input
                      type="text"
                      value={preferences.preferred_locations?.join(', ') || ''}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          preferred_locations: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                        })
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950/60 border border-white/10 text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">Workplace Preference</label>
                    <select
                      value={preferences.workplace_type || 'remote'}
                      onChange={(e) => setPreferences({ ...preferences, workplace_type: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950/60 border border-white/10 text-white focus:outline-none focus:border-indigo-400"
                    >
                      <option value="remote">Remote Only</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="onsite">On-Site</option>
                      <option value="any">Flexible / Any</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">Expected Minimum CTC / Salary</label>
                    <input
                      type="text"
                      value={preferences.expected_salary || ''}
                      onChange={(e) => setPreferences({ ...preferences, expected_salary: e.target.value })}
                      placeholder="e.g. ₹8 - 15 LPA or $60,000 / yr"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950/60 border border-white/10 text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => handleSavePreferences(preferences)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm"
                  >
                    Save Preferences
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: AI JOB FINDER
      ===================================================================== */}
      {subTab === 'jobs' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex-1 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={jobQuery}
                    onChange={(e) => setJobQuery(e.target.value)}
                    placeholder="Search by title, company, skills (e.g. PyTorch, FastAPI, Remote)..."
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-950/60 border border-white/10 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <select
                  value={jobCategory}
                  onChange={(e) => setJobCategory(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl bg-slate-950/60 border border-white/10 text-white focus:outline-none"
                >
                  <option value="Generative AI Engineer">Generative AI</option>
                  <option value="AI Engineer">AI Engineer</option>
                  <option value="Python Backend Developer">Python Backend</option>
                  <option value="Data Scientist">Data Scientist</option>
                  <option value="Full Stack Developer">Full Stack</option>
                </select>

                <select
                  value={jobLocation}
                  onChange={(e) => setJobLocation(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl bg-slate-950/60 border border-white/10 text-white focus:outline-none"
                >
                  <option value="Remote">Remote</option>
                  <option value="India">India</option>
                  <option value="Global">Worldwide</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDiscoverJobs}
                  disabled={loading}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-black shadow-glow-cyan transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Discover Opportunities</span>
                </button>

                <button
                  onClick={() => setShowCompareModal(true)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-colors flex items-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5 text-violet-400" />
                  <span>Compare ({compareJobsSelection.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Job Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.map((job) => {
              const isSelectedForCompare = compareJobsSelection.includes(job.id);
              return (
                <div
                  key={job.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                    isSelectedForCompare
                      ? 'border-cyan-500/50 bg-cyan-500/[0.04]'
                      : 'border-white/10 bg-slate-900/60 hover:bg-slate-900/80'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-mono font-semibold text-cyan-400 block">{job.company}</span>
                        <h4 className="text-sm font-bold text-white line-clamp-2 mt-0.5">{job.title}</h4>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10 font-mono">
                        {job.source}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                      <span>{job.location}</span>
                      <span>&bull;</span>
                      <span className="capitalize">{job.workplace_type}</span>
                      {job.salary && (
                        <>
                          <span>&bull;</span>
                          <span className="text-emerald-400 font-mono">{job.salary}</span>
                        </>
                      )}
                    </div>

                    {job.required_skills && job.required_skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {job.required_skills.slice(0, 4).map((sk, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 text-[10px] rounded bg-white/5 text-slate-300 border border-white/10"
                          >
                            {sk}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-white/5 space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAnalyzeATS(job)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-colors"
                      >
                        Analyze ATS
                      </button>
                      <button
                        onClick={() => handleGenerateResume(job)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/30 transition-colors"
                      >
                        Tailor Resume
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <button
                        onClick={() => handleAddToTracker(job, 'interested')}
                        className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[11px]"
                      >
                        <Plus className="w-3 h-3 text-cyan-400" />
                        <span>Track Application</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (isSelectedForCompare) {
                              setCompareJobsSelection(compareJobsSelection.filter((id) => id !== job.id));
                            } else {
                              if (compareJobsSelection.length >= 5) {
                                showToast('Maximum 5 jobs can be compared simultaneously', 'error');
                                return;
                              }
                              setCompareJobsSelection([...compareJobsSelection, job.id]);
                            }
                          }}
                          className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                            isSelectedForCompare
                              ? 'bg-cyan-500 text-black border-cyan-400 font-semibold'
                              : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                          }`}
                        >
                          {isSelectedForCompare ? 'Selected' : '+ Compare'}
                        </button>

                        {job.original_url && (
                          <a
                            href={job.original_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-white"
                            title="Open original listing"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: ATS RESUME ANALYZER
      ===================================================================== */}
      {subTab === 'ats' && (
        <div className="space-y-6">
          {atsEvaluation ? (
            <div className="space-y-6">
              {/* Score Header Card */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs text-slate-400 block font-mono">
                      Target Job: {selectedJob ? `${selectedJob.title} @ ${selectedJob.company}` : 'Standard Role'}
                    </span>
                    <h2 className="text-2xl font-bold font-display text-white mt-1">
                      ATS Compatibility: <span className="text-cyan-400">{atsEvaluation.overall_score} / 100</span>
                    </h2>
                    <span className="text-xs text-emerald-400 font-semibold mt-1 inline-block">
                      {atsEvaluation.rating}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedJob && (
                      <button
                        onClick={() => handleGenerateResume(selectedJob)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow-cyan"
                      >
                        Generate Tailored Resume
                      </button>
                    )}
                  </div>
                </div>

                {/* 4 Pillars Breakdown Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10">
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[11px] text-slate-400 block">1. Keyword Alignment</span>
                    <span className="text-lg font-bold text-cyan-300 font-mono">
                      {atsEvaluation.breakdown?.keywords_score} / 40
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Core target skills match</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[11px] text-slate-400 block">2. Section Completeness</span>
                    <span className="text-lg font-bold text-violet-300 font-mono">
                      {atsEvaluation.breakdown?.sections_score} / 25
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Contact, Exp, Edu, Skills</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[11px] text-slate-400 block">3. Formatting & Readability</span>
                    <span className="text-lg font-bold text-emerald-300 font-mono">
                      {atsEvaluation.breakdown?.formatting_score} / 20
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Word count & bullet parsing</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[11px] text-slate-400 block">4. Measurable Results</span>
                    <span className="text-lg font-bold text-amber-300 font-mono">
                      {atsEvaluation.breakdown?.impact_score} / 15
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Action verbs & metrics</span>
                  </div>
                </div>
              </div>

              {/* Matched vs Missing Skills */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl">
                  <h3 className="text-sm font-semibold text-emerald-300 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Matched Keywords ({atsEvaluation.matched_skills?.length || 0})</span>
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {atsEvaluation.matched_skills?.map((sk, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 text-xs rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl">
                  <h3 className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span>Missing Target Skills to Highlight ({atsEvaluation.missing_skills?.length || 0})</span>
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {atsEvaluation.missing_skills?.map((sk, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 text-xs rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recommendations Checklist */}
              {atsEvaluation.recommendations && atsEvaluation.recommendations.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl">
                  <h3 className="text-sm font-semibold text-white mb-3">Actionable Improvements</h3>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {atsEvaluation.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-cyan-400 font-bold">&bull;</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Heuristic Disclaimer */}
              <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] text-xs text-slate-400 flex items-start gap-3">
                <HelpCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <span>{atsEvaluation.scoring_explanation}</span>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              Select a job from the "Job Finder" tab to analyze deterministic ATS compatibility.
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 5: AI RESUME BUILDER
      ===================================================================== */}
      {subTab === 'resume' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-cyan-400" />
                  <span>Job-Specific STAR Resume Customizer</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Built strictly from your verified profile credentials. Never fabricates employers or experience.
                </p>
              </div>

              {tailoredResume && (
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/career/resume/${tailoredResume.resume_version.id}/download/docx`}
                    download
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download DOCX</span>
                  </a>

                  <a
                    href={`/api/career/resume/${tailoredResume.resume_version.id}/download/html`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Printable HTML / PDF</span>
                  </a>
                </div>
              )}
            </div>

            {tailoredResume ? (
              <div className="mt-5">
                <textarea
                  value={tailoredResume.content_md}
                  onChange={(e) => setTailoredResume({ ...tailoredResume, content_md: e.target.value })}
                  rows={20}
                  className="w-full p-4 rounded-xl bg-slate-950/80 border border-white/10 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-400 leading-relaxed custom-scrollbar"
                ></textarea>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500">
                Select a job from the "Job Finder" tab and click "Tailor Resume" to generate a job-specific STAR resume.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 6: COVER LETTER GENERATOR
      ===================================================================== */}
      {subTab === 'cover-letter' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-cyan-400" />
                  <span>AI Cover Letter Generator</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Tailored application cover letters highlighting your verified achievements.
                </p>
              </div>

              {coverLetter && (
                <a
                  href={`/api/career/cover-letter/${coverLetter.cover_letter.id}/download/docx`}
                  download
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download DOCX</span>
                </a>
              )}
            </div>

            {selectedJob && (
              <div className="flex items-center gap-2 mt-4">
                <span className="text-xs text-slate-400">Tone:</span>
                {['Professional', 'Confident', 'Enthusiastic', 'Academic'].map((tone) => (
                  <button
                    key={tone}
                    onClick={() => handleGenerateCoverLetter(selectedJob, tone)}
                    className="px-3 py-1 text-xs rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
                  >
                    {tone}
                  </button>
                ))}
              </div>
            )}

            {coverLetter ? (
              <div className="mt-5">
                <textarea
                  value={coverLetter.content_md}
                  onChange={(e) => setCoverLetter({ ...coverLetter, content_md: e.target.value })}
                  rows={18}
                  className="w-full p-4 rounded-xl bg-slate-950/80 border border-white/10 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-400 leading-relaxed custom-scrollbar"
                ></textarea>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500">
                Select a job from the "Job Finder" tab to draft a tailored cover letter.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 7: APPLICATION ASSISTANT & Q&A
      ===================================================================== */}
      {subTab === 'assistant' && (
        <div className="space-y-6">
          {applicationPacket ? (
            <div className="space-y-6">
              {/* Safety Gate Alert */}
              <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.04] text-xs text-cyan-200 flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                <span>{applicationPacket.safety_notice}</span>
              </div>

              {/* Q&A Cheat Sheet */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl">
                <h3 className="text-sm font-semibold text-white mb-4">Application Form Q&A Cheat Sheet</h3>
                <div className="space-y-4">
                  {applicationPacket.qna_cheat_sheet?.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-2">
                      <span className="text-xs font-semibold text-cyan-300">{item.question}</span>
                      <p className="text-xs text-slate-300 leading-relaxed">{item.suggested_answer}</p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.suggested_answer);
                          showToast('Answer copied to clipboard!');
                        }}
                        className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 pt-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy Answer</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Checklist */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl">
                <h3 className="text-sm font-semibold text-white mb-3">Pre-Submission Checklist</h3>
                <div className="space-y-2">
                  {applicationPacket.checklist?.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              Select a job from the "Job Finder" tab and click "Prepare Application" to view the application dossier.
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 8: APPLICATION TRACKER
      ===================================================================== */}
      {subTab === 'tracker' && (
        <div className="space-y-6">
          {/* Status Filter Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-white/10 custom-scrollbar">
            {['all', 'saved', 'interested', 'preparing', 'ready_to_apply', 'applied', 'interview', 'offer', 'rejected'].map(
              (st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all ${
                    statusFilter === st
                      ? 'bg-cyan-500 text-black shadow-glow-cyan'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              )
            )}
          </div>

          {/* Applications Table / Cards */}
          <div className="space-y-3">
            {filteredApps.map((app) => (
              <div
                key={app.id}
                className="p-4 rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">{app.job_title}</h4>
                    <span className="text-xs text-slate-400">@ {app.company}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span>{app.location || 'Remote'}</span>
                    <span>&bull;</span>
                    <span>Source: {app.source}</span>
                    <span>&bull;</span>
                    <span>Updated: {app.updated_at?.slice(0, 10)}</span>
                  </div>
                  {app.notes && <p className="text-xs text-slate-300 mt-2 font-mono">{app.notes}</p>}
                </div>

                <div className="flex items-center gap-3">
                  {/* Status Dropdown */}
                  <select
                    value={app.status}
                    onChange={(e) => handleUpdateAppStatus(app.id, e.target.value)}
                    className={`px-3 py-1.5 text-xs rounded-xl border font-semibold capitalize focus:outline-none ${
                      STATUS_COLORS[app.status] || 'bg-slate-800 text-white'
                    }`}
                  >
                    <option value="saved">Saved</option>
                    <option value="interested">Interested</option>
                    <option value="preparing">Preparing</option>
                    <option value="ready_to_apply">Ready to Apply</option>
                    <option value="applied">Applied</option>
                    <option value="assessment">Assessment</option>
                    <option value="interview">Interview</option>
                    <option value="offer">Offer</option>
                    <option value="rejected">Rejected</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>

                  <button
                    onClick={() => handleViewTimeline(app)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-colors"
                    title="View Timeline History"
                  >
                    <Clock className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {filteredApps.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-500">
                No applications matching filter '{statusFilter}'.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 9: DAILY JOB ALERTS
      ===================================================================== */}
      {subTab === 'alerts' && alertSettings && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-cyan-400" />
                  <span>Daily Job Discovery Sentinel (08:00 AM IST)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Automated background scanner that searches, scores, and delivers top job opportunities every morning.
                </p>
              </div>

              <button
                onClick={handleTriggerAlertsNow}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow-cyan flex items-center gap-2 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Trigger Alert Scan Now</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">
                  Target Search Categories (comma-separated)
                </label>
                <input
                  type="text"
                  value={alertSettings.categories?.join(', ') || ''}
                  onChange={(e) =>
                    setAlertSettings({
                      ...alertSettings,
                      categories: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950/60 border border-white/10 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">
                  Minimum ATS Filter Threshold ({alertSettings.min_score || 60}%)
                </label>
                <input
                  type="range"
                  min="30"
                  max="90"
                  value={alertSettings.min_score || 60}
                  onChange={(e) => setAlertSettings({ ...alertSettings, min_score: parseInt(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={async () => {
                  await fetch('/api/career/alerts/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(alertSettings)
                  });
                  showToast('Alert settings saved!');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-black font-semibold shadow-glow-cyan transition-all"
              >
                Save Alert Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 10: CAREER REPORTS & EXPORTS
      ===================================================================== */}
      {subTab === 'reports' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl">
            <h3 className="text-base font-bold text-white mb-2">Export Data & Analytics</h3>
            <p className="text-xs text-slate-400 mb-4">
              Download your discovered opportunities and application records in spreadsheet or document format.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => handleExportJobs('xlsx')}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Export Discovered Jobs (.XLSX)</span>
              </button>

              <button
                onClick={() => handleExportJobs('csv')}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                <span>Export Discovered Jobs (.CSV)</span>
              </button>
            </div>
          </div>

          {/* Generated Reports History */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl">
            <h3 className="text-sm font-semibold text-white mb-3">Generated Report History</h3>
            <div className="space-y-2">
              {reportsList.map((rep) => (
                <div
                  key={rep.id}
                  className="p-3 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-white block">{rep.title}</span>
                    <span className="text-slate-400">{rep.summary}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">{rep.created_at?.slice(0, 10)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: MULTI-JOB COMPARISON SIDE-BY-SIDE
      ===================================================================== */}
      {showCompareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl custom-scrollbar">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-violet-400" />
                <span>Multi-Job ATS Comparison ({compareJobsSelection.length} Jobs)</span>
              </h3>
              <button
                onClick={() => setShowCompareModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="pt-4 space-y-4">
              <button
                onClick={handleRunComparison}
                disabled={loading || compareJobsSelection.length < 2}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-sm"
              >
                Run Side-by-Side ATS Comparison
              </button>

              {compareResults && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                  {compareResults.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
                      <div>
                        <span className="text-xs font-mono font-semibold text-cyan-300">{item.job.company}</span>
                        <h4 className="text-sm font-bold text-white">{item.job.title}</h4>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-900 border border-white/5">
                        <span className="text-xs text-slate-400 block">Overall ATS Score</span>
                        <span className="text-xl font-bold font-mono text-emerald-400">
                          {item.evaluation.overall_score} / 100
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">{item.evaluation.rating}</span>
                      </div>

                      <div className="text-xs space-y-1">
                        <span className="text-slate-400 block">Matched Skills:</span>
                        <div className="flex flex-wrap gap-1">
                          {item.evaluation.matched_skills?.slice(0, 3).map((sk, sidx) => (
                            <span
                              key={sidx}
                              className="px-1.5 py-0.2 text-[10px] rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                            >
                              {sk}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="text-xs space-y-1">
                        <span className="text-slate-400 block">Missing Skills:</span>
                        <div className="flex flex-wrap gap-1">
                          {item.evaluation.missing_skills?.slice(0, 3).map((sk, sidx) => (
                            <span
                              key={sidx}
                              className="px-1.5 py-0.2 text-[10px] rounded bg-amber-500/10 text-amber-300 border border-amber-500/20"
                            >
                              {sk}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: APPLICATION TIMELINE HISTORY
      ===================================================================== */}
      {showTimelineModal && timelineApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-sm font-bold text-white">{timelineApp.job_title}</h3>
                <span className="text-xs text-slate-400">@ {timelineApp.company} &bull; Timeline History</span>
              </div>
              <button
                onClick={() => setShowTimelineModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
              {timelineHistory.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 text-xs">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0"></div>
                  <div>
                    <span className="font-semibold text-white capitalize">{item.to_status?.replace('_', ' ')}</span>
                    <span className="text-[10px] text-slate-500 block font-mono">
                      {item.changed_at?.replace('T', ' ').slice(0, 19)}
                    </span>
                    {item.notes && <p className="text-slate-300 mt-0.5">{item.notes}</p>}
                  </div>
                </div>
              ))}
              {timelineHistory.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-500">No status changes recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          DRAWER: AI CAREER CHAT ASSISTANT
      ===================================================================== */}
      <AnimatePresence>
        {showChatDrawer && (
          <motion.div
            initial={{ opacity: 0, x: 350 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 350 }}
            className="fixed top-0 bottom-0 right-0 w-full sm:w-[420px] z-50 bg-slate-950/95 border-l border-white/10 backdrop-blur-2xl p-5 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Career AI Chat</h3>
                  <span className="text-[10px] text-slate-400">English &bull; हिन्दी &bull; اردو</span>
                </div>
              </div>
              <button
                onClick={() => setShowChatDrawer(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Prompt Chips */}
            <div className="flex items-center gap-1.5 py-3 overflow-x-auto custom-scrollbar border-b border-white/5">
              {[
                'Find 5 remote AI internships',
                'Which skills am I missing?',
                'Draft cover letter for DeepMind'
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setChatInput(chip);
                  }}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 whitespace-nowrap transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3 custom-scrollbar">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-br-sm'
                        : 'bg-white/5 text-slate-200 border border-white/10 rounded-bl-sm whitespace-pre-wrap'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  <span>Career AI is thinking...</span>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendChat} className="pt-3 border-t border-white/10 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask Career AI anything..."
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
