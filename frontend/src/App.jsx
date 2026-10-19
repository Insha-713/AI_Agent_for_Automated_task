import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import TopStatusBar from './components/TopStatusBar';
import WelcomeTourModal from './components/WelcomeTourModal';
import ParticleBackground from './components/ParticleBackground';
import TaskPage from './pages/TaskPage';
import HistoryPage from './pages/HistoryPage';
import SchedulesPage from './pages/SchedulesPage';
import SettingsPage from './pages/SettingsPage';
import DashboardPage from './pages/DashboardPage';
import WorkflowsPage from './pages/WorkflowsPage';
import NewsPage from './pages/NewsPage';
import ReportsPage from './pages/ReportsPage';
import MonitoringPage from './pages/MonitoringPage';
import { ShieldCheck, Heart } from 'lucide-react';

export default function App() {
  const getInitialTab = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) return tabParam;
      if (window.location.hash) return window.location.hash.replace('#', '');
    } catch (e) {}
    return 'workflows';
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
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className={`min-h-screen flex bg-[#080c14] text-slate-100 relative selection:bg-cyan-500 selection:text-black ${isDark ? 'dark' : ''}`}>
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

      {/* Main Content Area (Offset for sidebar) */}
      <div className={`flex-1 flex flex-col min-w-0 ${sidebarCollapsed ? 'pl-20' : 'pl-64'} transition-all duration-300`}>
        {/* Top Status Bar with real-time indicators */}
        <TopStatusBar 
          dryRun={dryRun}
          onToggleDryRun={() => setDryRun(!dryRun)}
          onOpenIntegrations={() => setActiveTab('settings')}
          onOpenTour={() => setShowTourModal(true)}
          isDark={isDark}
          toggleTheme={toggleTheme}
        />

        {/* Page Content with Smooth Transition */}
        <main className="flex-1 pb-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {activeTab === 'workflows' && (
                <WorkflowsPage 
                  dryRun={dryRun} 
                  setDryRun={setDryRun}
                  onOpenIntegrations={() => setActiveTab('settings')} 
                />
              )}
              {activeTab === 'dashboard' && (
                <DashboardPage 
                  onNavigate={(tab) => setActiveTab(tab)} 
                />
              )}
              {activeTab === 'history' && (
                <HistoryPage 
                  onNavigate={(tab) => setActiveTab(tab)} 
                />
              )}
              {activeTab === 'schedules' && <SchedulesPage />}
              {activeTab === 'reports' && <ReportsPage />}
              {activeTab === 'monitoring' && <MonitoringPage />}
              {activeTab === 'news' && <NewsPage />}
              {activeTab === 'settings' && <SettingsPage onNavigate={handleNavigate} />}
              {activeTab === 'tasks' && <TaskPage onTaskCompleted={() => {}} />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Minimal Footer */}
        <footer className="border-t border-white/5 py-5 text-center text-xs text-slate-400 glass-panel">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>100% Private Local Inference &bull; No Paid APIs &bull; Sandboxed to <code className="text-cyan-300 font-mono">workspace/</code></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>AgentFlow v2.0 &bull; Built for India</span>
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
