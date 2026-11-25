import React, { useState, useMemo } from 'react';
import {
  HelpCircle,
  Search,
  BookOpen,
  Bot,
  Newspaper,
  Send,
  Calendar,
  Brain,
  Wrench,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Zap,
  Clock,
  Terminal,
  FolderOpen
} from 'lucide-react';

const HELP_SECTIONS = [
  // 1. Getting Started
  {
    id: 'getting-started-what-is',
    category: 'getting_started',
    title: 'What is AgentFlow?',
    summary: 'An autonomous, 100% local-first AI automation platform for tasks, career intelligence, scheduled workflows, and messaging.',
    steps: [
      'AgentFlow combines a LangGraph ReAct agent engine with local and cloud LLMs (Ollama, Groq, Gemini).',
      'It performs multi-step reasoning, file operations, web searches, news intelligence, and Telegram dispatches automatically.',
      'All execution is sandboxed inside your local workspace/ directory, keeping your private data on your machine.'
    ],
    tip: 'No paid APIs are strictly required: you can run 100% locally with Ollama (e.g., llama3.1).'
  },
  {
    id: 'getting-started-dashboard',
    category: 'getting_started',
    title: 'Dashboard Overview & Key Metrics',
    summary: 'Understand the key performance indicators and live telemetry on the main dashboard.',
    steps: [
      'Total Executions: Aggregates every autonomous run completed by AgentFlow across workflows and background schedules.',
      'Success Rate: Calculates reliability percentage based on verified task and step completion.',
      'Active Schedules: Real-time counter of registered APScheduler background jobs and the upcoming execution time.',
      'Time Saved: Estimated hours and equivalent financial savings based on automated manual hours.',
      'Quick Agent Launchpad: 1-click access to specialized agents (Career, Social Media, LinkedIn, WhatsApp, etc.).'
    ],
    action: { label: 'Go to Dashboard', tab: 'dashboard' }
  },
  {
    id: 'getting-started-navigation',
    category: 'getting_started',
    title: 'How to Navigate the Application',
    summary: 'Move efficiently between the natural language workflow builder, scheduled sentinels, integrations, and specialized agents.',
    steps: [
      'Use the Left Sidebar to switch tabs. Click the collapse button (< / >) on the top-right of the sidebar for more screen space.',
      'Top Status Bar displays live backend uptime, active LLM model, Gmail/Telegram readiness, and a toggle for Simulation vs. Real execution.',
      'System Showcase tab allows visual audit inspection and live diagnostic probing of every subsystem.'
    ]
  },
  {
    id: 'getting-started-setup',
    category: 'getting_started',
    title: 'Initial Setup & Configuration',
    summary: 'How to prepare your local environment and verify your LLM connection.',
    steps: [
      '1. Verify Python & Virtual Environment: Ensure your backend dependencies are installed in .venv.',
      '2. Configure .env: Set LLM_PROVIDER=ollama (default) or provide GROQ_API_KEY / GEMINI_API_KEY for cloud inference.',
      '3. Start the Server: Run python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000.',
      '4. Check the Top Bar: Confirm the backend indicator turns green with "Online".'
    ],
    action: { label: 'Open Settings', tab: 'settings' }
  },

  // 2. AI Agent
  {
    id: 'agent-create-task',
    category: 'ai_agent',
    title: 'How to Create a Task / Workflow',
    summary: 'Build autonomous workflows using plain conversational English or Hindi/Hinglish.',
    steps: [
      'Navigate to "Create Workflow" in the sidebar.',
      'Type your instructions in plain language (e.g., "Check current IST time, fetch latest AI news in India, and save to workspace/ai_daily_news.txt").',
      'Click "Generate Plan" to inspect the generated multi-step plan before execution, or click "Execute Task" to run immediately.',
      'AgentFlow will autonomously call registered tools, stream reasoning steps, and show the finished result.'
    ],
    action: { label: 'Create Workflow', tab: 'workflows' }
  },
  {
    id: 'agent-quick-vs-deep',
    category: 'ai_agent',
    title: 'Quick Search vs Deep Research',
    summary: 'Choose the right research mode depending on the depth and complexity of your query.',
    steps: [
      'Quick Search: Fast 1-to-2 query lookup for quick facts, weather, news headlines, or basic questions.',
      'Deep Research: Multi-source research mode that plans multiple targeted search queries, parses web pages, cross-verifies findings, and synthesizes an executive briefing report in workspace/.'
    ]
  },
  {
    id: 'agent-interaction',
    category: 'ai_agent',
    title: 'How to Interact with the AI Agent',
    summary: 'Best practices for writing effective prompts and interacting with streamed tool calls.',
    steps: [
      'Be specific about file output destinations (e.g., "save to workspace/report.txt").',
      'Specify target recipients for communication tools (e.g., "send email to user@example.com").',
      'You can use one-click starter template chips on the builder page to test verified recipes.'
    ]
  },
  {
    id: 'agent-file-management',
    category: 'ai_agent',
    title: 'How to Upload & Manage Files',
    summary: 'Upload reference resumes, documents, and datasets into the secure workspace.',
    steps: [
      'Click "Upload File" in the workspace section or drag and drop files directly.',
      'Supported formats: PDF, TXT, Markdown, JSON, DOCX.',
      'Uploaded files reside inside the local workspace/ folder and can be inspected by tools such as read_file and save_file.'
    ]
  },
  {
    id: 'agent-tools-how-they-work',
    category: 'ai_agent',
    title: 'How Agent Tools Work',
    summary: 'The LangGraph agent uses 6 core deterministic tools to accomplish complex goals.',
    steps: [
      'web_search: Real-time queries using DuckDuckGo HTML scraping (no API key required).',
      'read_file: Reads file contents safely from the local workspace/ directory.',
      'write_file / save_file: Writes structured outputs and reports safely to workspace/.',
      'get_datetime: Obtains precise current ISO time in Asia/Kolkata (IST).',
      'send_telegram_message: Sends formatted Telegram notifications with Markdown support.',
      'send_email: Dispatches emails via local or configured SMTP.'
    ]
  },
  {
    id: 'agent-human-approval',
    category: 'ai_agent',
    title: 'How Human Approval Gate Works',
    summary: 'A critical safety mechanism that pauses execution before sensitive external actions.',
    steps: [
      'When an agent is about to perform an external action (such as sending an email or making a phone call), it pauses execution.',
      'An Approval Card appears displaying the exact payload, target recipient, and action parameters.',
      'Execution proceeds only when you click "Approve" (or cancel with "Reject").'
    ]
  },

  // 3. AI News Intelligence
  {
    id: 'news-rss-works',
    category: 'news_intelligence',
    title: 'How Google News RSS Works',
    summary: 'Ingests real-time news across customizable topics without paid news APIs.',
    steps: [
      'Queries Google News RSS endpoint using localized parameters (&hl=en-IN&gl=IN&ceid=IN:en).',
      'Extracts title, publication timestamp, source redirect link, and authentic publisher name.',
      'Dual-strategy publisher extractor extracts both RFC-822 source metadata and hyphen-separated publication titles.'
    ],
    action: { label: 'Open News Intelligence', tab: 'news' }
  },
  {
    id: 'news-arxiv-ingestion',
    category: 'news_intelligence',
    title: 'How arXiv Research Ingestion Works',
    summary: 'Fetches the newest scholarly research papers from arXiv computer science repositories.',
    steps: [
      'Queries arXiv API for cs.AI (Artificial Intelligence) and cs.LG (Machine Learning) categories.',
      'Sorts by submittedDate descending to fetch current preprints.',
      'Parses authors, abstract summary, PDF URL, and publication metadata.'
    ]
  },
  {
    id: 'news-generate-digest',
    category: 'news_intelligence',
    title: 'How to Generate a News Digest',
    summary: 'Compile an aggregated, beautifully formatted intelligence brief in one click.',
    steps: [
      'Open the "Live AI News" tab from the sidebar.',
      'Select a preset topic (e.g., "AI in India", "Global GenAI & LLMs") or type a custom topic.',
      'Toggle "Include arXiv Research" if you want scholarly papers included.',
      'Click "Fetch Fresh Digest". The backend compiles top stories into a formatted Markdown report.'
    ]
  },
  {
    id: 'news-deduplication',
    category: 'news_intelligence',
    title: 'How Duplicate News is Removed',
    summary: 'Ensures repetitive syndication stories across news outlets do not clutter your digest.',
    steps: [
      'Titles are normalized (lowercased, stripped of punctuation, and cleaned of publisher tags).',
      'Jaccard word-overlap similarity algorithm compares incoming stories against previously added items.',
      'Stories with >65% token overlap are automatically pruned, keeping only the earliest and most complete source.'
    ]
  },
  {
    id: 'news-saving-reports',
    category: 'news_intelligence',
    title: 'How News Reports are Saved',
    summary: 'Persisting daily intelligence digests to your local workspace disk.',
    steps: [
      'Every compiled daily digest is automatically written to workspace/ai_daily_news.txt.',
      'Includes IST generation timestamp, story count, and verified direct source links.',
      'You can copy the entire Markdown digest to clipboard or deliver it to Telegram.'
    ]
  },

  // 4. Telegram Integration
  {
    id: 'telegram-connect-bot',
    category: 'telegram',
    title: 'How to Connect a Telegram Bot',
    summary: 'Create and connect your own Telegram bot in less than two minutes.',
    steps: [
      '1. Open Telegram and search for @BotFather.',
      '2. Send /newbot and follow the prompts to choose a bot name and unique username.',
      '3. Copy the HTTP API token provided by BotFather.',
      '4. Add the token to your .env file: TELEGRAM_BOT_TOKEN=your_token_here.',
      '5. Restart the backend or verify via the Integrations Hub.'
    ],
    action: { label: 'Open Integrations', tab: 'integrations' }
  },
  {
    id: 'telegram-configure-chat-id',
    category: 'telegram',
    title: 'How to Configure Your Chat ID',
    summary: 'Find your personal or group Telegram Chat ID to receive automated updates.',
    steps: [
      '1. In Telegram, start a conversation with your newly created bot (click Start).',
      '2. Open Telegram and search for @userinfobot or @raw_data_bot.',
      '3. Send any message to receive your numerical ID (e.g., 123456789).',
      '4. Set it in .env: TELEGRAM_CHAT_ID=123456789.'
    ]
  },
  {
    id: 'telegram-check-connectivity',
    category: 'telegram',
    title: 'How to Check Telegram Connectivity',
    summary: 'Test bot communication safely without dispatching unwanted spam messages.',
    steps: [
      'Navigate to the "System Showcase" page in the sidebar.',
      'Find the "Telegram Bot Check" button in the Live Diagnostic Console.',
      'Click "Run Diagnostic". It calls Telegram\'s getMe API to confirm bot username, ID, and connection status safely.'
    ],
    action: { label: 'Test in Showcase', tab: 'showcase' }
  },
  {
    id: 'telegram-scheduled-delivery',
    category: 'telegram',
    title: 'How Scheduled News Delivery Works',
    summary: 'Wake up to fresh AI news delivered straight to your Telegram every morning.',
    steps: [
      'AgentFlow includes a pre-configured daily schedule: Daily AI News Telegram Delivery.',
      'At 08:00 AM IST every day, APScheduler triggers the news intelligence pipeline.',
      'It fetches live RSS & arXiv feeds, deduplicates stories, compiles a digest, and dispatches it directly to your Telegram chat.'
    ]
  },

  // 5. Scheduler & Automation
  {
    id: 'scheduler-create',
    category: 'scheduler',
    title: 'How to Create a Schedule',
    summary: 'Set up autonomous timers that execute agent workflows without human intervention.',
    steps: [
      'Navigate to the "Schedules" tab in the sidebar.',
      'Click "+ Create Schedule" in the top-right corner.',
      'Enter a descriptive Schedule Name and the exact AI prompt to execute.',
      'Choose your frequency (Daily, Hourly, Weekly, or Custom Cron).',
      'Click "Create Schedule" to register the task in SQLite and APScheduler.'
    ],
    action: { label: 'Open Schedules', tab: 'schedules' }
  },
  {
    id: 'scheduler-daily-hourly',
    category: 'scheduler',
    title: 'Daily vs. Hourly Schedules',
    summary: 'How AgentFlow handles daily cron schedules vs. recurring hourly intervals.',
    steps: [
      'Daily: Configured with CronTrigger at a specific hour and minute in your timezone (e.g., 08:00 AM IST). Runs once per day.',
      'Hourly: Configured with IntervalTrigger(seconds=3600). Executes once every 3600 seconds from activation.',
      'Both frequencies survive application restarts by automatic re-hydration from the SQLite database.'
    ]
  },
  {
    id: 'scheduler-pause-resume',
    category: 'scheduler',
    title: 'How to Pause & Resume Schedules',
    summary: 'Temporarily halt or reactivate scheduled sentinels with a single click.',
    steps: [
      'On the Schedules page, each schedule card features a Pause / Resume toggle button.',
      'Click "Pause" to stop future triggers without deleting your configuration.',
      'Click "Resume" to re-arm the timer. The next run time is recalculated immediately.'
    ]
  },
  {
    id: 'scheduler-run-now',
    category: 'scheduler',
    title: 'How to Use "Run Now"',
    summary: 'Trigger an immediate test execution of any schedule without waiting for its timer.',
    steps: [
      'Click the "Run Now" (Play icon) button on any schedule card.',
      'AgentFlow executes the task immediately in the background.',
      'Last run timestamp and status (completed/failed) are recorded in SQLite and updated in real time.'
    ]
  },
  {
    id: 'scheduler-execution-history',
    category: 'scheduler',
    title: 'How to View Execution History',
    summary: 'Inspect detailed step-by-step audit logs of previous autonomous executions.',
    steps: [
      'Navigate to "History" in the sidebar.',
      'Filter runs by status (All, Completed, Failed) or search by keyword.',
      'Click any run to view total execution time, steps taken, tools invoked, and output artifacts.'
    ],
    action: { label: 'View History', tab: 'history' }
  },

  // 6. Workspace & Memory
  {
    id: 'workspace-manage-files',
    category: 'workspace_memory',
    title: 'How to Manage Workspace Files',
    summary: 'Understand the sandboxed workspace directory where all generated files reside.',
    steps: [
      'All files created by AgentFlow are strictly stored inside the root workspace/ folder.',
      'You can download, view, or replace files directly through the UI or via your local file explorer.',
      'The workspace sandbox ensures AgentFlow never modifies files outside this dedicated directory.'
    ]
  },
  {
    id: 'workspace-sqlite-memory',
    category: 'workspace_memory',
    title: 'How SQLite Memory Works',
    summary: 'AgentFlow uses SQLite database tables to store tasks, workflow templates, schedules, and cross-agent context.',
    steps: [
      'agentflow.db stores persistent state: tasks, task_steps, schedules, and agent memory key-value pairs.',
      'SQLite PRAGMA foreign_keys and WAL mode ensure high concurrency and database integrity.',
      'Memory persists across server restarts and machine reboots.'
    ]
  },
  {
    id: 'workspace-approvals-safe',
    category: 'workspace_memory',
    title: 'File Operations & Approvals Safety',
    summary: 'How AgentFlow prevents accidental file corruption or data loss.',
    steps: [
      'File writes use atomic writing or safe overwrite guards.',
      'Read operations are validated to ensure target file paths resolve inside the workspace boundaries.',
      'Crucial system files and hidden configuration files (.env) cannot be modified through agent tools.'
    ]
  },

  // 7. Settings & Troubleshooting
  {
    id: 'troubleshooting-llm-setup',
    category: 'troubleshooting',
    title: 'LLM Provider Configuration (Ollama, Groq, Gemini)',
    summary: 'Configure and switch between local Ollama inference and fast cloud LLMs.',
    steps: [
      'Ollama (Local): Download from ollama.com, run "ollama pull llama3.1", and start Ollama. Set LLM_PROVIDER=ollama in .env.',
      'Groq (Cloud): Sign up at console.groq.com, generate an API key, and set GROQ_API_KEY=gsk_... in .env.',
      'Gemini (Cloud): Generate an API key from Google AI Studio, and set GEMINI_API_KEY=AIza... in .env.',
      'AgentFlow automatically detects configured cloud keys if LLM_PROVIDER is left blank.'
    ],
    action: { label: 'Open Settings', tab: 'settings' }
  },
  {
    id: 'troubleshooting-ollama-offline',
    category: 'troubleshooting',
    title: 'Error: "No LLM available on this server"',
    summary: 'What to do when the backend reports that the local LLM is unreachable.',
    steps: [
      '1. Check if Ollama is running: Open your terminal and run "curl http://localhost:11434" or "ollama list".',
      '2. Start Ollama: Launch the Ollama desktop application or run "ollama serve".',
      '3. Alternatively, configure a cloud provider: Add GROQ_API_KEY or GEMINI_API_KEY to your .env file to enable instant cloud inference.'
    ]
  },
  {
    id: 'troubleshooting-telegram-errors',
    category: 'troubleshooting',
    title: 'Telegram Dispatch & Connection Errors',
    summary: 'Resolve common issues with Telegram bot messaging.',
    steps: [
      'Unauthorized / HTTP 401: Your TELEGRAM_BOT_TOKEN is incorrect. Verify the exact token with @BotFather.',
      'Chat Not Found / HTTP 400: You must press "Start" in Telegram to initiate the chat with your bot before it can message you.',
      'Network / Socket Timeout: Ensure your machine has active internet connectivity to reach api.telegram.org.'
    ]
  },
  {
    id: 'troubleshooting-scheduler',
    category: 'troubleshooting',
    title: 'Scheduler Not Triggering at Target Time',
    summary: 'Troubleshooting background cron triggers and timezone settings.',
    steps: [
      '1. Timezone Check: Verify your schedule timezone is set to Asia/Kolkata (IST • UTC+5:30).',
      '2. Backend Process: The FastAPI server process must be running for APScheduler background timers to fire.',
      '3. Re-hydration: If the server was stopped during the scheduled run time, use "Run Now" on the schedule card to catch up.'
    ]
  }
];

const CATEGORIES = [
  { id: 'all', label: 'All Guides', icon: BookOpen },
  { id: 'getting_started', label: 'Getting Started', icon: Sparkles },
  { id: 'ai_agent', label: 'AI Agent & Tools', icon: Bot },
  { id: 'news_intelligence', label: 'News Intelligence', icon: Newspaper },
  { id: 'telegram', label: 'Telegram Bot', icon: Send },
  { id: 'scheduler', label: 'Schedules & Timers', icon: Calendar },
  { id: 'workspace_memory', label: 'Workspace & Memory', icon: Brain },
  { id: 'troubleshooting', label: 'Troubleshooting & FAQ', icon: Wrench },
];

export default function HelpCentrePage({ onNavigate = () => {}, initialCategory = 'all' }) {
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState('getting-started-what-is');

  const filteredSections = useMemo(() => {
    let list = HELP_SECTIONS;
    if (selectedCategory !== 'all') {
      list = list.filter(item => item.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item => 
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.steps.some(s => s.toLowerCase().includes(q))
      );
    }
    return list;
  }, [selectedCategory, searchQuery]);

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 sm:px-6 py-6 animate-fadeIn">
      
      {/* Modern Minimalist Header */}
      <div className="p-6 sm:p-7 rounded-2xl glass-panel border border-slate-200/80 dark:border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="p-2 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 dark:border-cyan-500/30">
                <HelpCircle className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white">
                Central <span className="text-cyan-500 dark:text-cyan-400">Help Centre</span>
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Complete, beginner-friendly documentation, step-by-step guides, and troubleshooting tips for every AgentFlow feature.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('showcase')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>System Showcase</span>
            </button>
          </div>
        </div>

        {/* Live Search Bar */}
        <div className="relative max-w-xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guides, tools, schedules, errors, or keywords..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Count Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <span>Showing {filteredSections.length} guide{filteredSections.length !== 1 ? 's' : ''}</span>
        {searchQuery && (
          <span className="font-mono text-cyan-600 dark:text-cyan-400">Filter: "{searchQuery}"</span>
        )}
      </div>

      {/* Expandable Accordion List */}
      {filteredSections.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-panel border border-slate-200 dark:border-white/10 space-y-3">
          <HelpCircle className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No matching guides found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Try adjusting your search query or selecting a different category from above.
          </p>
          <button
            onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-500 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSections.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                className={`rounded-2xl transition-all border ${
                  isExpanded
                    ? 'bg-white dark:bg-slate-900/90 border-cyan-500/40 shadow-sm'
                    : 'glass-panel border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                {/* Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(item.id)}
                  className="w-full p-4 sm:p-5 flex items-start justify-between gap-4 text-left group"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10">
                        {item.category.replace('_', ' ')}
                      </span>
                      <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>

                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white flex-shrink-0 transition-colors">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="px-4 sm:px-5 pb-5 pt-1 space-y-4 border-t border-slate-100 dark:border-white/5 animate-fadeIn">
                    {/* Step-by-Step Instructions */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                        Step-by-Step Instructions
                      </h4>
                      <div className="space-y-2">
                        {item.steps.map((step, sIdx) => (
                          <div key={sIdx} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                            <span className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5 border border-cyan-500/20">
                              {sIdx + 1}
                            </span>
                            <span className="leading-relaxed flex-1">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Optional Pro Tip */}
                    {item.tip && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <span><strong>Tip:</strong> {item.tip}</span>
                      </div>
                    )}

                    {/* Jump to Action Button */}
                    {item.action && (
                      <div className="pt-2 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => onNavigate(item.action.tab)}
                          className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                        >
                          <span>{item.action.label}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Minimal Footer Callout */}
      <div className="p-5 rounded-2xl glass-panel border border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-500" />
          <span>Need live diagnostic data? Check the System Showcase tab.</span>
        </div>
        <button
          onClick={() => onNavigate('showcase')}
          className="text-cyan-600 dark:text-cyan-400 hover:underline font-medium flex items-center gap-1"
        >
          <span>Open System Showcase</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
}
