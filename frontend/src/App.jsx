import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import TopStatusBar from './components/TopStatusBar';
import WelcomeTourModal from './components/WelcomeTourModal';
import ParticleBackground from './components/ParticleBackground';
import ErrorBoundary from './components/ErrorBoundary';

// Immediate primary page
import DashboardPage from './pages/DashboardPage';

// Code-split lazy-loaded pages
const WorkflowsPage = lazy(() => import('./pages/WorkflowsPage'));
const ShowcasePage = lazy(() => import('./pages/ShowcasePage'));
const HelpCentrePage = lazy(() => import('./pages/HelpCentrePage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const SchedulesPage = lazy(() => import('./pages/SchedulesPage'));
const MonitoringPage = lazy(() => import('./pages/MonitoringPage'));
const NewsPage = lazy(() => import('./pages/NewsPage'));
const CareerPage = lazy(() => import('./pages/CareerPage'));

// Platform specialized agents
const LinkedInPage = lazy(() => import('./pages/LinkedInPage'));
const CallingPage = lazy(() => import('./pages/CallingPage'));
const EmailAgentPage = lazy(() => import('./pages/EmailAgentPage'));
const ResearchPage = lazy(() => import('./pages/ResearchPage'));

// Setup & Control
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'));
const ConnectionsPage = lazy(() => import('./pages/ConnectionsPage'));
const AutomationRulesPage = lazy(() => import('./pages/AutomationRulesPage'));
const MemoryPage = lazy(() => import('./pages/MemoryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const TaskPage = lazy(() => import('./pages/TaskPage'));

import { ShieldCheck } from 'lucide-react';

export default function App() {
  const getInitialTab = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) return tabParam;
      if (window.location.hash) return window.location.hash.replace('#', '');
    } catch (e) {}
    return 'dashboard';
  };

  const [activeTab, setActiveTabState] = useState(getInitialTab);
  const [dryRun, setDryRun] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [showTourModal, setShowTourModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleNavigate = (tab, params = {}) => {
    setActiveTabState(tab);
    try {
      const url = new URL(window.location);
      url.searchParams.set('tab', tab);
      if (params.template) {
        url.searchParams.set('template', params.template);
      } else {
        url.searchParams.delete('template');
      }
      window.history.replaceState({}, '', url);
    } catch (e) {}
  };

  const setActiveTab = (tab) => handleNavigate(tab);

  useEffect(() => {
    const handlePopState = () => {
      const tab = getInitialTab();
      setActiveTabState(tab);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('notour') === 'true') {
        setShowTourModal(false);
        return;
      }
      if (params.get('tour') === 'true') {
        setShowTourModal(true);
        return;
      }
      const seen = localStorage.getItem('agentflow_tour_seen');
      if (!seen) {
        setShowTourModal(true);
      }
    } catch (e) {}
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className={`min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative selection:bg-cyan-500 selection:text-black ${isDark ? 'dark' : ''}`}>
      {/* Dynamic Glow Particle Background */}
      <ParticleBackground />

      {/* Left Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onOpenTour={() => setShowTourModal(true)} 
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${sidebarCollapsed ? 'pl-20' : 'pl-64'} transition-all duration-200`}>
        {/* Top Status Bar with real-time indicators */}
        <TopStatusBar 
          dryRun={dryRun}
          onToggleDryRun={() => setDryRun(!dryRun)}
          onOpenIntegrations={() => setActiveTab('integrations')}
          onOpenTour={() => setShowTourModal(true)}
          isDark={isDark}
          toggleTheme={toggleTheme}
        />

        {/* Page Content with Transition & Suspense Code-Splitting */}
        <main className="flex-1 pb-16">
          <ErrorBoundary key={activeTab} onNavigate={handleNavigate}>
            <Suspense fallback={
              <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-400">
                <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium">Loading page...</span>
              </div>
            }>
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                >
                  {/* Main Section */}
                  {activeTab === 'dashboard' && <DashboardPage onNavigate={(tab) => setActiveTab(tab)} />}
                  {activeTab === 'showcase' && <ShowcasePage />}
                  {activeTab === 'help' && <HelpCentrePage onNavigate={handleNavigate} />}
                  {activeTab === 'workflows' && (
                    <WorkflowsPage 
                      dryRun={dryRun} 
                      setDryRun={setDryRun}
                      onOpenIntegrations={() => setActiveTab('integrations')} 
                      onNavigate={handleNavigate}
                    />
                  )}
                  {activeTab === 'history' && <HistoryPage onNavigate={(tab) => setActiveTab(tab)} />}
                  {activeTab === 'schedules' && <SchedulesPage onNavigate={handleNavigate} />}
                  {activeTab === 'monitoring' && <MonitoringPage onNavigate={handleNavigate} />}
                  {activeTab === 'news' && <NewsPage onNavigate={handleNavigate} />}

                  {/* AI Agents Section */}
                  {activeTab === 'career' && <CareerPage onNavigate={handleNavigate} />}
                  {activeTab === 'linkedin' && <LinkedInPage onNavigate={handleNavigate} />}
                  {activeTab === 'calling' && <CallingPage onNavigate={handleNavigate} />}
                  {activeTab === 'email_agent' && <EmailAgentPage onNavigate={handleNavigate} />}
                  {activeTab === 'research' && <ResearchPage onNavigate={handleNavigate} />}

                  {/* Setup & Control Section */}
                  {(activeTab === 'connections' || activeTab === 'integrations') && <IntegrationsPage onNavigate={handleNavigate} />}
                  {activeTab === 'rules' && <AutomationRulesPage onNavigate={handleNavigate} />}
                  {activeTab === 'memory' && <MemoryPage onNavigate={handleNavigate} />}
                  {activeTab === 'settings' && <SettingsPage onNavigate={handleNavigate} />}
                  {activeTab === 'tasks' && <TaskPage onTaskCompleted={() => {}} onNavigate={handleNavigate} />}
                </motion.div>
              </AnimatePresence>
            </Suspense>
          </ErrorBoundary>
        </main>

        {/* Minimal Modern Footer */}
        <footer className="border-t border-slate-200 dark:border-white/5 py-4 text-center text-xs text-slate-500 dark:text-slate-400 glass-panel">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span>Local Inference &bull; Sandboxed to <code className="text-cyan-700 dark:text-cyan-400 font-mono text-[11px]">workspace/</code></span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleNavigate('help')}
                className="text-cyan-600 dark:text-cyan-400 hover:underline font-medium"
              >
                Help Centre
              </button>
              <span>&bull;</span>
              <span>AgentFlow v3.0</span>
            </div>
          </div>
        </footer>
      </div>

      {/* 4-Step Welcome Tour Modal */}
      <WelcomeTourModal 
        isOpen={showTourModal} 
        onClose={() => setShowTourModal(false)} 
      />
    </div>
  );
}
