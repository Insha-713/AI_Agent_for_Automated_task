import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Save,
  User,
  Mail,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Cpu,
  Key,
  BookOpen,
  Eye,
  EyeOff,
  Lock,
  Info,
  Plug,
  Layers,
  Send,
  Search,
  Newspaper,
  HardDrive,
  ExternalLink,
  ArrowRight,
  Zap,
  Check,
  Copy,
  CloudSun,
  CloudRain,
  Briefcase,
  BarChart3,
  Activity,
  FileSpreadsheet,
  X,
  Edit2,
  Trash2
} from 'lucide-react';

const DEFAULT_SERVICES = [
  {
    service: 'email',
    display_name: 'Gmail SMTP (Outbound)',
    status: 'connected',
    configured: true,
    latency_ms: 140,
    message: 'Gmail SMTP authenticated via TLS port 587.',
    guidance: 'Allows agent to dispatch email digests, weather alerts and notifications.'
  },
  {
    service: 'telegram',
    display_name: 'Telegram Bot Sentinel',
    status: 'not_configured',
    configured: false,
    latency_ms: 0,
    message: 'TELEGRAM_BOT_TOKEN not configured in server environment.',
    guidance: 'Open @BotFather on Telegram, send /newbot, and paste the generated bot token.'
  },
  {
    service: 'llm',
    display_name: 'AI Language Model (LLM)',
    status: 'connected',
    configured: true,
    latency_ms: 38,
    active_model: 'llama3.1',
    provider: 'ollama',
    message: 'Local or cloud LLM inference engine.',
    guidance: 'Supports Ollama (local), Groq (cloud), or Google Gemini (cloud).'
  },
  {
    service: 'search',
    display_name: 'DuckDuckGo Search',
    status: 'connected',
    configured: true,
    latency_ms: 195,
    message: 'DuckDuckGo search active (no API key required).',
    guidance: 'Queries live web results and current market developments.'
  },
  {
    service: 'news',
    display_name: 'Google News RSS Stream',
    status: 'connected',
    configured: true,
    latency_ms: 180,
    message: 'Google News Indian RSS feed active with verified publication timestamps.',
    guidance: 'Fetches and deduplicates latest Indian technology and AI articles.'
  },
  {
    service: 'workspace',
    display_name: 'Sandboxed Workspace Storage',
    status: 'connected',
    configured: true,
    latency_ms: 1.1,
    free_space_gb: 48.5,
    message: "Workspace sandboxed safely to 'workspace/' directory.",
    guidance: 'All agent file operations are strictly restricted inside this directory.'
  }
];

export const FALLBACK_TEMPLATES = [
  {
    id: "tpl-daily-ai-news-digest",
    title: "Daily AI News Digest",
    category: "News",
    badge: "Popular",
    icon: "Newspaper",
    description: "Fetch today's top 5 AI news in India with dates and links, summarize them, and save to workspace/ai_news_digest.txt.",
    prompt: "Fetch today's top 5 AI news in India with dates and links, summarize them, and save to workspace/ai_news_digest.txt.",
    tools_used: ["get_latest_news", "save_file"],
    required_credentials: [],
    requires_approval: true,
    is_builtin: true
  },
  {
    id: "tpl-ai-news-telegram",
    title: "AI News to Telegram",
    category: "News",
    badge: "Automated",
    icon: "Send",
    description: "Every day at 8 AM IST, fetch the top 5 AI news in India with dates and links and send a short summary to my Telegram.",
    prompt: "Every day at 8 AM IST, fetch the top 5 AI news in India with dates and links and send a short summary to my Telegram.",
    tools_used: ["get_latest_news", "send_telegram_message"],
    required_credentials: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
    requires_approval: true,
    is_builtin: true
  },
  {
    id: "tpl-weather-report-email",
    title: "Weather Report by Email",
    category: "Weather",
    badge: "Popular",
    icon: "CloudSun",
    description: "Get the current weather for {city}, write a short summary with temperature, conditions, humidity, wind and rain chance, and email it to {email}.",
    prompt: "Get the current weather for {city}, write a short summary with temperature, conditions, humidity, wind and rain chance, and email it to {email}.",
    tools_used: ["get_weather", "send_email"],
    required_credentials: ["EMAIL_USER", "EMAIL_PASS"],
    default_inputs: { city: "", email: "" },
    requires_approval: true,
    is_builtin: true
  },
  {
    id: "tpl-daily-weather-telegram",
    title: "Daily Weather on Telegram",
    category: "Weather",
    badge: "Scheduled",
    icon: "CloudRain",
    description: "Every day at 7 AM IST, send the weather forecast for {city} to my Telegram.",
    prompt: "Every day at 7 AM IST, send the weather forecast for {city} to my Telegram.",
    tools_used: ["get_weather", "send_telegram_message"],
    required_credentials: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
    default_inputs: { city: "" },
    requires_approval: true,
    is_builtin: true
  },
  {
    id: "tpl-weekly-tech-research-brief",
    title: "Weekly Tech Research Brief",
    category: "Business",
    badge: "Research",
    icon: "Search",
    description: "Every Sunday at 6 PM IST, research this week's top AI and technology developments from multiple sources, write a short brief with source links and dates, and email it to {email}.",
    prompt: "Every Sunday at 6 PM IST, research this week's top AI and technology developments from multiple sources, write a short brief with source links and dates, and email it to {email}.",
    tools_used: ["multi_search", "get_latest_news", "fetch_page", "send_email"],
    required_credentials: ["EMAIL_USER", "EMAIL_PASS"],
    default_inputs: { email: "" },
    requires_approval: true,
    is_builtin: true
  },
  {
    id: "tpl-campus-placement-analytics",
    title: "Campus Placement Analytics",
    category: "Data",
    badge: "Analytics",
    icon: "BarChart3",
    description: "Analyze workspace/samples/student_placement_data.csv, calculate average, highest and lowest CTC, compare branches, and save an executive summary to workspace/placement_summary.md.",
    prompt: "Analyze workspace/samples/student_placement_data.csv, calculate average, highest and lowest CTC, compare branches, and save an executive summary to workspace/placement_summary.md.",
    tools_used: ["analyze_tabular_data", "save_file"],
    required_credentials: [],
    requires_approval: true,
    is_builtin: true
  },
  {
    id: "tpl-clean-my-spreadsheet",
    title: "Clean My Spreadsheet",
    category: "Data",
    badge: "Utility",
    icon: "FileSpreadsheet",
    description: "Clean workspace/{file}, remove duplicates, fix inconsistent text and dates, flag missing and invalid values, list every change, and save the cleaned file to workspace/cleaned_{file}.",
    prompt: "Clean workspace/{file}, remove duplicates, fix inconsistent text and dates, flag missing and invalid values, list every change, and save the cleaned file to workspace/cleaned_{file}.",
    tools_used: ["analyze_tabular_data", "save_file"],
    required_credentials: [],
    default_inputs: { file: "samples/student_placement_data.csv" },
    requires_approval: true,
    is_builtin: true
  },
  {
    id: "tpl-website-uptime-monitor",
    title: "Website Uptime Monitor",
    category: "Monitoring",
    badge: "DevOps",
    icon: "Activity",
    description: "Every 15 minutes check {url} and send me a Telegram alert if it is down or slower than 2 seconds.",
    prompt: "Every 15 minutes check {url} and send me a Telegram alert if it is down or slower than 2 seconds.",
    tools_used: ["check_website_health", "send_telegram_message"],
    required_credentials: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
    default_inputs: { url: "https://www.google.co.in" },
    requires_approval: true,
    is_builtin: true
  },
  {
    id: "tpl-internship-scholarship-finder",
    title: "Internship and Scholarship Finder",
    category: "Career",
    badge: "Students",
    icon: "Briefcase",
    description: "Find 5 current AI internships in India for BCA and Data Science students with company, role, apply link and last date, and save to workspace/internships.txt.",
    prompt: "Find 5 current AI internships in India for BCA and Data Science students with company, role, apply link and last date, and save to workspace/internships.txt.",
    tools_used: ["multi_search", "fetch_page", "save_file"],
    required_credentials: [],
    requires_approval: true,
    is_builtin: true
  },
  {
    id: "tpl-ai-skills-roadmap",
    title: "AI Skills Roadmap",
    category: "Career",
    badge: "Career",
    icon: "Sparkles",
    description: "Research the top 7 in-demand skills for an AI Engineer in 2026, add one free learning resource for each, and save to workspace/ai_roadmap.txt.",
    prompt: "Research the top 7 in-demand skills for an AI Engineer in 2026, add one free learning resource for each, and save to workspace/ai_roadmap.txt.",
    tools_used: ["multi_search", "save_file"],
    required_credentials: [],
    requires_approval: true,
    is_builtin: true
  },
  {
    id: "tpl-important-emails-telegram",
    title: "Important Emails to Telegram",
    category: "Monitoring",
    badge: "Secure",
    icon: "Mail",
    description: "Every morning at 9 AM IST, read my important unread emails (jobs, bills, college) and send a list to my Telegram.",
    prompt: "Every morning at 9 AM IST, read my important unread emails (jobs, bills, college) and send a list to my Telegram.",
    tools_used: ["read_important_emails", "send_telegram_message"],
    required_credentials: ["EMAIL_USER", "EMAIL_PASS", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
    requires_approval: true,
    is_builtin: true
  },
  {
    id: "tpl-freelance-expense-report",
    title: "Freelance Expense Report",
    category: "Data",
    badge: "Finance",
    icon: "FileSpreadsheet",
    description: "Analyze workspace/samples/freelance_agency_expenses.csv, show spending by category and payment method, and save the report to workspace/expense_report.md.",
    prompt: "Analyze workspace/samples/freelance_agency_expenses.csv, show spending by category and payment method, and save the report to workspace/expense_report.md.",
    tools_used: ["analyze_tabular_data", "save_file"],
    required_credentials: [],
    requires_approval: true,
    is_builtin: true
  }
];

export default function SettingsPage({ onNavigate = () => {} }) {
  const [activeTab, setActiveTab] = useState('integrations'); // 'integrations' | 'templates' | 'memory'

  // Preferences & Memory State
  const [settings, setSettings] = useState({
    user_name: '',
    default_email: '',
    writing_style: 'Professional, concise, and courteous Indian business English',
    user_role: 'Software Engineer & AI Enthusiast',
    location: 'India (IST)',
    currency_preference: 'INR (₹)',
    custom_instructions: 'Always summarize key points into bullet points first. Always use Indian Standard Time (IST) and currency in INR (₹).'
  });

  // Integrations State
  const [integrations, setIntegrations] = useState(DEFAULT_SERVICES);
  const [testingService, setTestingService] = useState(null);
  const [integrationStatuses, setIntegrationStatuses] = useState({});
  const [secrets, setSecrets] = useState({
    email_user: '',
    email_pass: '',
    telegram_token: '',
    telegram_chat_id: ''
  });
  const [showSecrets, setShowSecrets] = useState({
    email_pass: false,
    telegram_token: false
  });
  const [savedIndicators, setSavedIndicators] = useState({
    email: false,
    telegram: false
  });
  const [credentialsSummary, setCredentialsSummary] = useState({
    email: { configured: false, email_user: '', has_password: false, masked_password: '' },
    telegram: { configured: false, has_token: false, masked_token: '', chat_id: '' }
  });
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingTelegram, setIsEditingTelegram] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);

  // Workflow Templates State - Pre-seeded with FALLBACK_TEMPLATES so it NEVER renders 0
  const [templates, setTemplates] = useState(FALLBACK_TEMPLATES);
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cloningId, setCloningId] = useState(null);
  const [clonedSuccess, setClonedSuccess] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  const fetchTemplates = async () => {
    try {
      const tResp = await fetch('/api/templates');
      if (tResp.ok) {
        const tData = await tResp.json();
        const list = Array.isArray(tData) ? tData : (tData?.templates || []);
        if (list.length > 0) {
          setTemplates(list);
          return;
        }
      }
    } catch (tErr) {
      console.warn('Failed to fetch from /api/templates, attempting fallback:', tErr);
    }

    try {
      const fallbackResp = await fetch('/api/workflows/templates');
      if (fallbackResp.ok) {
        const fallbackData = await fallbackResp.json();
        const list = Array.isArray(fallbackData) ? fallbackData : (fallbackData?.templates || []);
        if (list.length > 0) {
          setTemplates(list);
          return;
        }
      }
    } catch (fErr) {
      console.warn('Failed to fetch from fallback /api/workflows/templates:', fErr);
    }
  };

  useEffect(() => {
    fetchInitialData();
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (activeTab === 'templates') {
      fetchTemplates();
    }
  }, [activeTab]);

  const fetchInitialData = async () => {
    // 1. Fetch user settings
    try {
      const sResp = await fetch('/api/settings');
      if (sResp.ok) {
        const sData = await sResp.json();
        setSettings(prev => ({ ...prev, ...(sData.settings || {}) }));
      }
    } catch (e) {
      console.warn('Settings fetch error:', e);
    }

    // 2. Fetch credentials summary (masked)
    try {
      const cResp = await fetch('/api/integrations/credentials');
      if (cResp.ok) {
        const cData = await cResp.json();
        setCredentialsSummary(cData);
        if (cData.email?.configured) {
          setSecrets(prev => ({ ...prev, email_user: cData.email.email_user || '' }));
          setSavedIndicators(prev => ({ ...prev, email: true }));
          setIsEditingEmail(false);
        } else {
          setIsEditingEmail(true);
        }
        if (cData.telegram?.configured) {
          setSecrets(prev => ({ ...prev, telegram_chat_id: cData.telegram.chat_id || '' }));
          setSavedIndicators(prev => ({ ...prev, telegram: true }));
          setIsEditingTelegram(false);
        } else {
          setIsEditingTelegram(true);
        }
      }
    } catch (e) {
      console.warn('Credentials summary fetch error:', e);
    }

    // 3. Fetch integrations status
    try {
      const iResp = await fetch('/api/integrations/status');
      if (iResp.ok) {
        const iData = await iResp.json();
        setIntegrations(iData.services || []);
        const statusMap = {};
        (iData.services || []).forEach(s => {
          statusMap[s.service] = s;
        });
        setIntegrationStatuses(statusMap);
      }
    } catch (e) {
      console.warn('Integrations status fetch error:', e);
    }
  };

  const handleTestIntegration = async (serviceName) => {
    setTestingService(serviceName);
    try {
      const resp = await fetch(`/api/integrations/test/${serviceName}`, { method: 'POST' });
      const data = await resp.json();
      setIntegrationStatuses(prev => ({ ...prev, [serviceName]: data }));
    } catch (e) {
      console.error(`Test failed for ${serviceName}:`, e);
    } finally {
      setTestingService(null);
    }
  };

  const handleSaveEmailIntegration = async (e) => {
    if (e) e.preventDefault();
    if (!secrets.email_user || !secrets.email_user.includes('@')) {
      setToast({ type: 'error', text: 'Please enter a valid Gmail address (e.g. user@gmail.com).' });
      return;
    }
    setIsSavingEmail(true);
    try {
      const resp = await fetch('/api/integrations/credentials/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_user: secrets.email_user,
          email_pass: secrets.email_pass || undefined
        })
      });
      const data = await resp.json();
      if (resp.ok) {
        setToast({ type: 'success', text: 'Email integration configured and saved persistently!' });
        setSavedIndicators(prev => ({ ...prev, email: true }));
        setIsEditingEmail(false);
        setSecrets(prev => ({ ...prev, email_pass: '' }));
        await fetchInitialData();
      } else {
        setToast({ type: 'error', text: data.detail || 'Failed to save email credentials.' });
      }
    } catch (err) {
      setToast({ type: 'error', text: 'Network error saving email credentials.' });
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleDisconnectEmail = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Gmail integration?')) return;
    try {
      const resp = await fetch('/api/integrations/credentials/email', { method: 'DELETE' });
      if (resp.ok) {
        setToast({ type: 'success', text: 'Email integration credentials removed.' });
        setSecrets(prev => ({ ...prev, email_user: '', email_pass: '' }));
        setSavedIndicators(prev => ({ ...prev, email: false }));
        setIsEditingEmail(true);
        await fetchInitialData();
      }
    } catch (err) {
      console.warn('Disconnect error:', err);
    }
  };

  const handleSaveTelegramIntegration = async (e) => {
    if (e) e.preventDefault();
    setIsSavingTelegram(true);
    try {
      const resp = await fetch('/api/integrations/credentials/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_token: secrets.telegram_token || undefined,
          telegram_chat_id: secrets.telegram_chat_id || undefined
        })
      });
      if (resp.ok) {
        setToast({ type: 'success', text: 'Telegram integration configured and saved persistently!' });
        setSavedIndicators(prev => ({ ...prev, telegram: true }));
        setIsEditingTelegram(false);
        setSecrets(prev => ({ ...prev, telegram_token: '' }));
        await fetchInitialData();
      } else {
        const data = await resp.json();
        setToast({ type: 'error', text: data.detail || 'Failed to save Telegram credentials.' });
      }
    } catch (err) {
      setToast({ type: 'error', text: 'Network error saving Telegram credentials.' });
    } finally {
      setIsSavingTelegram(false);
    }
  };

  const handleSaveSecret = async (service) => {
    if (service === 'email') {
      return handleSaveEmailIntegration();
    }
    if (service === 'telegram') {
      return handleSaveTelegramIntegration();
    }
  };

  const handleUseTemplate = (tpl) => {
    const tplId = typeof tpl === 'string' ? tpl : tpl.id;
    try {
      const url = new URL(window.location);
      url.searchParams.set('tab', 'workflows');
      url.searchParams.set('template', tplId);
      window.history.pushState({}, '', url);
    } catch (e) {}

    if (onNavigate) {
      onNavigate('workflows', { template: tplId });
    } else {
      window.location.href = `/?tab=workflows&template=${tplId}`;
    }
  };

  const getTemplateIcon = (tpl) => {
    const name = tpl?.icon || '';
    const cat = tpl?.category || '';
    if (name === 'Newspaper' || cat === 'News') return Newspaper;
    if (name === 'CloudSun' || (cat === 'Weather' && tpl?.id?.includes('email'))) return CloudSun;
    if (name === 'CloudRain' || cat === 'Weather') return CloudRain;
    if (name === 'Briefcase' || cat === 'Career') return Briefcase;
    if (name === 'Activity' || cat === 'Monitoring') return Activity;
    if (name === 'BarChart' || cat === 'Data') return BarChart3;
    if (name === 'Sun') return Sparkles;
    if (name === 'Mail') return Mail;
    if (name === 'Send') return Send;
    if (name === 'FileText') return FileSpreadsheet;
    return Layers;
  };

  const getRequirementBadge = (tpl) => {
    const creds = tpl.required_credentials || [];
    if (!creds || creds.length === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          No setup needed
        </span>
      );
    }

    const needsEmail = creds.includes('EMAIL_USER') || creds.includes('EMAIL_PASS');
    const needsTelegram = creds.includes('TELEGRAM_BOT_TOKEN') || creds.includes('TELEGRAM_CHAT_ID');

    const emailStatus = integrationStatuses['email']?.status === 'connected';
    const telegramStatus = integrationStatuses['telegram']?.status === 'connected';

    if (needsEmail && needsTelegram) {
      const isOk = emailStatus && telegramStatus;
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
          isOk ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isOk ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
          {isOk ? 'Needs Gmail & Telegram (Connected)' : 'Needs Gmail & Telegram'}
        </span>
      );
    }

    if (needsEmail) {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
          emailStatus ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${emailStatus ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
          {emailStatus ? 'Needs Gmail (Connected)' : 'Needs Gmail'}
        </span>
      );
    }

    if (needsTelegram) {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
          telegramStatus ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${telegramStatus ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
          {telegramStatus ? 'Needs Telegram (Connected)' : 'Needs Telegram'}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
        Requires Credentials
      </span>
    );
  };

  const getApprovalBadge = (tpl) => {
    if (tpl.requires_approval) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
          <ShieldCheck className="w-3 h-3 text-amber-400" />
          Requires Approval
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-400 border border-white/5">
        Auto-executes
      </span>
    );
  };


  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setToast(null);

    try {
      const resp = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });

      if (resp.ok) {
        setToast({ type: 'success', text: 'Memory & personalization preferences saved successfully!' });
      } else {
        setToast({ type: 'error', text: 'Failed to update preferences.' });
      }
    } catch (e) {
      setToast({ type: 'error', text: 'Error communicating with backend.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const getServiceIcon = (service) => {
    switch (service) {
      case 'llm':
      case 'ollama': return Cpu;
      case 'telegram': return Send;
      case 'email': return Mail;
      case 'search': return Search;
      case 'news': return Newspaper;
      case 'workspace': return HardDrive;
      default: return Plug;
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'connected') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Connected
        </span>
      );
    }
    if (status === 'not_configured') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
          Not Configured
        </span>
      );
    }
    if (status === 'offline') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
          Offline
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
        Degraded
      </span>
    );
  };

  const filteredTemplates = templates.filter(tpl => {
    const matchesCat = selectedCategory === 'All' || (tpl.category || '').toLowerCase() === selectedCategory.toLowerCase();
    if (!matchesCat) return false;
    if (!templateSearch.trim()) return true;
    const q = templateSearch.toLowerCase();
    const inTitle = (tpl.title || '').toLowerCase().includes(q);
    const inDesc = (tpl.description || '').toLowerCase().includes(q);
    const inTools = (tpl.tools_used || []).some(t => String(t).toLowerCase().includes(q));
    const inCat = (tpl.category || '').toLowerCase().includes(q);
    return inTitle || inDesc || inTools || inCat;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display text-white">Integrations & Settings Hub</h1>
              <p className="text-sm text-slate-400">
                Verify service connections, browse ready-to-run workflow templates, and personalize your agent.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/60 border border-white/10 glass-panel">
          <button
            onClick={() => setActiveTab('integrations')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'integrations'
                ? 'bg-cyan-500 text-black shadow-glow-cyan'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plug className="w-3.5 h-3.5" />
            <span>Integrations</span>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'templates'
                ? 'bg-cyan-500 text-black shadow-glow-cyan'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Templates ({templates.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('memory')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'memory'
                ? 'bg-cyan-500 text-black shadow-glow-cyan'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Personalization</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl text-xs sm:text-sm flex items-center gap-2 border ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toast.text}</span>
        </motion.div>
      )}

      {/* Cloned Template Alert */}
      {clonedSuccess && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-glow-cyan"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span>Workflow <strong>"{clonedSuccess.title}"</strong> created successfully ({clonedSuccess.id})!</span>
          </div>
          <span className="text-[11px] text-cyan-300 underline font-mono">
            Switch to the <strong>Workflows</strong> tab to view and dry-run its step graph.
          </span>
        </motion.div>
      )}

      {/* TAB 1: INTEGRATIONS HUB */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Plug className="w-3.5 h-3.5 text-cyan-400" /> Active Service Connections
            </span>
            <span className="text-xs text-slate-500">100% Free • Secrets Stored Locally</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {integrations.map((svc) => {
              const currentStatus = integrationStatuses[svc.service] || svc;
              const Icon = getServiceIcon(svc.service);
              const isTesting = testingService === svc.service;

              return (
                <motion.div
                  key={svc.service}
                  whileHover={{ y: -2 }}
                  className="p-5 rounded-2xl border border-white/10 bg-slate-900/40 glass-panel flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-cyan-400">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-white">{svc.display_name}</h3>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {currentStatus.latency_ms ? `${currentStatus.latency_ms} ms` : 'Local Probe'}
                          </div>
                        </div>
                      </div>
                      {getStatusBadge(currentStatus.status)}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {currentStatus.message}
                    </p>

                    {currentStatus.guidance && (
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-[11px] text-slate-400 font-mono leading-relaxed">
                        {currentStatus.guidance}
                      </div>
                    )}

                    {/* Email Credentials & App Password */}
                    {svc.service === 'email' && (
                      <div className="pt-2 border-t border-white/5 space-y-3">
                        {credentialsSummary?.email?.configured && !isEditingEmail ? (
                          /* Configured State View */
                          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/20 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Email integration configured</span>
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                                {credentialsSummary?.email?.source === 'environment' ? 'ENV' : 'PERSISTENT'}
                              </span>
                            </div>

                            <div className="space-y-1 text-xs font-mono">
                              <div className="flex items-center justify-between text-slate-300">
                                <span className="text-slate-400">Account:</span>
                                <span className="font-semibold text-slate-100">{credentialsSummary?.email?.email_user || secrets.email_user}</span>
                              </div>
                              <div className="flex items-center justify-between text-slate-300">
                                <span className="text-slate-400">App Password:</span>
                                <span className="tracking-widest text-emerald-400">••••••••••••••••</span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsEditingEmail(true);
                                  setSecrets(prev => ({ ...prev, email_user: credentialsSummary?.email?.email_user || prev.email_user, email_pass: '' }));
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-medium transition-colors"
                              >
                                <Edit2 className="w-3 h-3 text-cyan-400" />
                                <span>Edit / Update</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleDisconnectEmail}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-medium transition-colors"
                              >
                                <Trash2 className="w-3 h-3 text-rose-400" />
                                <span>Disconnect</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Edit / Setup Form */
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-slate-300 flex items-center gap-1">
                                <Lock className="w-3 h-3 text-cyan-400" />
                                <span>Configure Gmail Integration</span>
                              </span>
                              <a 
                                href="https://myaccount.google.com/apppasswords" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 text-[10px]"
                              >
                                <span>Google App Passwords</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">Gmail Address</label>
                              <input
                                type="email"
                                placeholder="your.email@gmail.com"
                                value={secrets.email_user}
                                onChange={(e) => setSecrets({ ...secrets, email_user: e.target.value })}
                                className="w-full bg-slate-950/60 text-slate-100 placeholder:text-slate-500 text-xs p-2 rounded-lg border border-white/10 outline-none focus:border-cyan-500 font-mono"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-[10px] text-slate-400">16-character Google App Password</label>
                                <span className={`text-[10px] font-mono ${(secrets.email_pass || '').replace(/\s+/g, '').length === 16 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                  {(secrets.email_pass || '').replace(/\s+/g, '').length === 16 ? '✓ 16 chars' : `${(secrets.email_pass || '').replace(/\s+/g, '').length}/16`}
                                </span>
                              </div>
                              <div className="relative">
                                <input
                                  type={showSecrets.email_pass ? 'text' : 'password'}
                                  placeholder="abcd efgh ijkl mnop"
                                  value={secrets.email_pass}
                                  onChange={(e) => setSecrets({ ...secrets, email_pass: e.target.value })}
                                  className="w-full bg-slate-950/60 text-slate-100 placeholder:text-slate-500 text-xs p-2 pr-8 rounded-lg border border-white/10 outline-none focus:border-cyan-500 font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowSecrets({ ...showSecrets, email_pass: !showSecrets.email_pass })}
                                  className="absolute right-2 top-2 text-slate-400 hover:text-white"
                                  title={showSecrets.email_pass ? "Hide secret" : "Show secret"}
                                >
                                  {showSecrets.email_pass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-1">Requires 2-Step Verification enabled on your Google account.</p>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              {credentialsSummary?.email?.configured ? (
                                <button
                                  type="button"
                                  onClick={() => setIsEditingEmail(false)}
                                  className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-400 text-xs transition-colors"
                                >
                                  Cancel
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  Saved in SQLite &amp; env
                                </span>
                              )}
                              <button
                                type="button"
                                disabled={isSavingEmail}
                                onClick={() => handleSaveSecret('email')}
                                className="px-3 py-1.5 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-md transition-colors flex items-center gap-1.5"
                              >
                                {isSavingEmail ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    <span>Saving...</span>
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-3 h-3" />
                                    <span>Save Integration</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Telegram Bot Token & Chat ID */}
                    {svc.service === 'telegram' && (
                      <div className="pt-2 border-t border-white/5 space-y-3">
                        {credentialsSummary?.telegram?.configured && !isEditingTelegram ? (
                          /* Configured State View */
                          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/20 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Telegram integration configured</span>
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                                {credentialsSummary?.telegram?.source === 'environment' ? 'ENV' : 'PERSISTENT'}
                              </span>
                            </div>

                            <div className="space-y-1 text-xs font-mono">
                              <div className="flex items-center justify-between text-slate-300">
                                <span className="text-slate-400">Chat ID:</span>
                                <span className="font-semibold text-slate-100">{credentialsSummary?.telegram?.chat_id || secrets.telegram_chat_id || 'Configured'}</span>
                              </div>
                              <div className="flex items-center justify-between text-slate-300">
                                <span className="text-slate-400">Bot Token:</span>
                                <span className="tracking-widest text-emerald-400">{credentialsSummary?.telegram?.masked_token || '••••••••••••••••'}</span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsEditingTelegram(true);
                                  setSecrets(prev => ({ ...prev, telegram_chat_id: credentialsSummary?.telegram?.chat_id || prev.telegram_chat_id, telegram_token: '' }));
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-medium transition-colors"
                              >
                                <Edit2 className="w-3 h-3 text-cyan-400" />
                                <span>Edit / Update</span>
                              </button>
                              <a
                                href="https://t.me/BotFather"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-400 hover:text-cyan-300 text-xs transition-colors"
                              >
                                <span>@BotFather</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          </div>
                        ) : (
                          /* Edit / Setup Form */
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-slate-300 flex items-center gap-1">
                                <Lock className="w-3 h-3 text-cyan-400" />
                                <span>Bot Token &amp; Chat ID</span>
                              </span>
                              <a 
                                href="https://t.me/BotFather" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 text-[10px]"
                              >
                                <span>Open @BotFather</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">Bot Token</label>
                              <div className="relative">
                                <input
                                  type={showSecrets.telegram_token ? 'text' : 'password'}
                                  placeholder="123456:ABC-DEF..."
                                  value={secrets.telegram_token}
                                  onChange={(e) => setSecrets({ ...secrets, telegram_token: e.target.value })}
                                  className="w-full bg-slate-950/60 text-slate-100 placeholder:text-slate-500 text-xs p-2 pr-8 rounded-lg border border-white/10 outline-none focus:border-cyan-500 font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowSecrets({ ...showSecrets, telegram_token: !showSecrets.telegram_token })}
                                  className="absolute right-2 top-2 text-slate-400 hover:text-white"
                                  title={showSecrets.telegram_token ? "Hide secret" : "Show secret"}
                                >
                                  {showSecrets.telegram_token ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">Telegram Chat ID</label>
                              <input
                                type="text"
                                placeholder="e.g. 987654321"
                                value={secrets.telegram_chat_id}
                                onChange={(e) => setSecrets({ ...secrets, telegram_chat_id: e.target.value })}
                                className="w-full bg-slate-950/60 text-slate-100 placeholder:text-slate-500 text-xs p-2 rounded-lg border border-white/10 outline-none focus:border-cyan-500 font-mono"
                              />
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              {credentialsSummary?.telegram?.configured ? (
                                <button
                                  type="button"
                                  onClick={() => setIsEditingTelegram(false)}
                                  className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-400 text-xs transition-colors"
                                >
                                  Cancel
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  Saved in SQLite &amp; env
                                </span>
                              )}
                              <button
                                type="button"
                                disabled={isSavingTelegram}
                                onClick={() => handleSaveSecret('telegram')}
                                className="px-3 py-1.5 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-md transition-colors flex items-center gap-1.5"
                              >
                                {isSavingTelegram ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    <span>Saving...</span>
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-3 h-3" />
                                    <span>Save Integration</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Active LLM Provider Details & Live Probe Result */}
                    {(svc.service === 'llm' || svc.service === 'ollama') && (
                      <div className="pt-2 border-t border-white/5 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Active Provider</span>
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            {currentStatus.provider ? currentStatus.provider.toUpperCase() : 'OLLAMA'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          <span>Active Model:</span>
                          <span className="text-slate-200 font-semibold">{currentStatus.active_model || 'llama3.1'}</span>
                        </div>
                        {currentStatus.test_response && (
                          <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-300 font-mono">
                            <span className="font-semibold text-emerald-400">Probe Result: </span>
                            "{currentStatus.test_response}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                      {svc.service.toUpperCase()}
                    </span>
                    <button
                      onClick={() => handleTestIntegration(svc.service)}
                      disabled={isTesting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 font-medium transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
                      <span>{isTesting ? 'Testing...' : (svc.service === 'email' ? 'Test Email Connection' : (svc.service === 'llm' || svc.service === 'ollama' ? 'Test LLM Connection' : 'Test Connection'))}</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: WORKFLOW TEMPLATES GALLERY */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          {/* Header & Subtitle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400" /> Curated Workflow Templates ({templates.length})
              </span>
              <p className="text-xs text-slate-400 mt-0.5">
                Pre-built, production-tested autonomous workflows for students, job seekers, and SMBs.
              </p>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Showing <span className="text-cyan-400 font-semibold">{filteredTemplates.length}</span> of {templates.length} templates
            </div>
          </div>

          {/* Search Box & Category Filter Bar */}
          <div className="space-y-3 p-4 rounded-2xl border border-white/10 bg-slate-900/60 glass-panel">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                placeholder="Search templates by title, description, or tools (e.g. weather, telegram, sales, csv)..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-slate-100 placeholder:text-slate-500 text-xs focus:border-cyan-500 outline-none transition-colors"
              />
              {templateSearch && (
                <button
                  type="button"
                  onClick={() => setTemplateSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400 font-semibold mr-1">Category:</span>
              {['All', 'News', 'Weather', 'Data', 'Career', 'Monitoring', 'Business'].map((cat) => {
                const count = cat === 'All'
                  ? templates.length
                  : templates.filter(t => (t.category || '').toLowerCase() === cat.toLowerCase()).length;
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-cyan-500 text-black font-semibold shadow-glow-cyan'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-black/20 text-black font-mono' : 'bg-white/10 text-slate-400 font-mono'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Templates Grid */}
          {filteredTemplates.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-white/10 bg-slate-900/30 glass-panel space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">No matching templates found</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No templates matched your search "{templateSearch}" in category "{selectedCategory}".
              </p>
              <button
                onClick={() => {
                  setTemplateSearch('');
                  setSelectedCategory('All');
                }}
                className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-slate-200 font-medium transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTemplates.map((tpl) => {
                const Icon = getTemplateIcon(tpl);
                return (
                  <motion.div
                    key={tpl.id}
                    whileHover={{ y: -2 }}
                    className="p-5 rounded-2xl border border-white/10 bg-slate-900/50 glass-panel flex flex-col justify-between space-y-4 hover:border-cyan-500/30 transition-all duration-200"
                  >
                    <div className="space-y-3">
                      {/* Top Header: Icon + Category + Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                              {tpl.category}
                            </span>
                            {tpl.badge && (
                              <span className="ml-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
                                {tpl.badge}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          {getApprovalBadge(tpl)}
                        </div>
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3 className="font-bold text-sm text-white mb-1.5 group-hover:text-cyan-300 transition-colors">
                          {tpl.title}
                        </h3>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {tpl.description}
                        </p>
                      </div>

                      {/* Integration Requirements Status */}
                      <div className="pt-1">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                          Integration Status:
                        </div>
                        {getRequirementBadge(tpl)}
                      </div>

                      {/* Registered Tools */}
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                          Tools Used ({tpl.tools_used?.length || 0}):
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {tpl.tools_used?.map((tool) => (
                            <span
                              key={tool}
                              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-white/5"
                            >
                              {tool}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {tpl.is_builtin ? "Built-in Template" : "My Custom Template"}
                      </span>
                      <button
                        onClick={() => handleUseTemplate(tpl)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-semibold shadow-glow-cyan transition-all"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Use Template</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PERSONALIZATION & MEMORY */}
      {activeTab === 'memory' && (
        <form onSubmit={handleSavePreferences} className="space-y-6">
          <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/40 glass-panel space-y-5">
            <div>
              <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                <User className="w-4 h-4 text-cyan-400" /> User Profile & Memory
              </h2>
              <p className="text-xs text-slate-400">
                These preferences are automatically injected into the agent's system prompt on every execution.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Your Name</label>
                <input
                  type="text"
                  placeholder="e.g. Insha Fatima"
                  value={settings.user_name}
                  onChange={(e) => setSettings({ ...settings, user_name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-slate-200 text-xs focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notification Email</label>
                <input
                  type="email"
                  placeholder="e.g. your_email@gmail.com"
                  value={settings.default_email}
                  onChange={(e) => setSettings({ ...settings, default_email: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-slate-200 text-xs focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Location / Timezone</label>
                <input
                  type="text"
                  value={settings.location}
                  onChange={(e) => setSettings({ ...settings, location: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-slate-200 text-xs focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Currency Preference</label>
                <input
                  type="text"
                  value={settings.currency_preference}
                  onChange={(e) => setSettings({ ...settings, currency_preference: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-slate-200 text-xs focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Role / Persona</label>
              <input
                type="text"
                placeholder="e.g. SMB Founder, Student, Job Seeker"
                value={settings.user_role}
                onChange={(e) => setSettings({ ...settings, user_role: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-slate-200 text-xs focus:border-cyan-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Custom Agent Instructions</label>
              <textarea
                rows={3}
                placeholder="Specific instructions to adhere to across all tasks..."
                value={settings.custom_instructions}
                onChange={(e) => setSettings({ ...settings, custom_instructions: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-slate-200 text-xs focus:border-cyan-500 outline-none resize-none"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-semibold shadow-glow-cyan transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Preferences'}</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
