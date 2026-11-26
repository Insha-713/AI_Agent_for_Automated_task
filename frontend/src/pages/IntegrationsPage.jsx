import React, { useState, useEffect, useMemo } from 'react';
import { cleanAuthorUrnInput, isValidAuthorUrn } from '../utils/authorUrn';
import { 
  Plug, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Check, 
  RefreshCw, 
  ExternalLink, 
  Key, 
  ShieldCheck, 
  Clock, 
  Server, 
  Mail, 
  MessageCircle, 
  PhoneCall, 
  Linkedin, 
  Github, 
  Search, 
  Cpu,
  Layers,
  FileText,
  Briefcase,
  Mic,
  Globe,
  Volume2,
  Send,
  Webhook,
  Calendar,
  Eye,
  EyeOff,
  Trash2,
  X,
  AlertTriangle,
  HelpCircle,
  Share2,
  ChevronRight,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

const ICON_MAP = {
  Sparkles,
  Cpu,
  Server,
  Linkedin,
  MessageCircle,
  PhoneCall,
  Mail,
  Search,
  FileText,
  Briefcase,
  Mic,
  Globe,
  Volume2,
  Send,
  Webhook,
  Calendar,
  MessageSquare: MessageCircle
};

export default function IntegrationsPage({ onNavigate = () => {} }) {
  const [catalog, setCatalog] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [activeConfigItem, setActiveConfigItem] = useState(null);
  const [configForm, setConfigForm] = useState({});
  const [showSecrets, setShowSecrets] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [modalTestStatus, setModalTestStatus] = useState(null);

  // Reconfigure LinkedIn Modal state
  const [showLinkedInReconfig, setShowLinkedInReconfig] = useState(false);
  const [linkedInForm, setLinkedInForm] = useState({
    token: '',
    authorUrn: '',
    hfToken: '',
    clientId: ''
  });
  const [linkedInShowToken, setLinkedInShowToken] = useState(false);
  const [linkedInShowHf, setLinkedInShowHf] = useState(false);
  const [linkedInSaving, setLinkedInSaving] = useState(false);
  const [linkedInDetecting, setLinkedInDetecting] = useState(false);
  const [linkedInTestStatus, setLinkedInTestStatus] = useState(null);
  const [showLinkedInMemberHelp, setShowLinkedInMemberHelp] = useState(false);

  // Disconnect Confirmation Modal state
  const [disconnectItem, setDisconnectItem] = useState(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Inline testing state on cards
  const [testingId, setTestingId] = useState(null);
  const [cardTestResults, setCardTestResults] = useState({});

  // Global notification banner
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (type, text) => {
    setToastMsg({ type, text });
    setTimeout(() => {
      setToastMsg(null);
    }, 5000);
  };

  const fetchCatalog = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/platform/integrations/catalog');
      if (res.ok) {
        const data = await res.json();
        setCatalog(data);
      } else {
        setErrorMsg('Failed to load integrations catalog.');
      }
    } catch (e) {
      setErrorMsg(e.message || 'Network error while fetching integrations.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  // Filtered integrations list
  const filteredIntegrations = useMemo(() => {
    if (!catalog || !catalog.integrations) return [];
    return catalog.integrations.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
      const matchesSearch = 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.category_name && item.category_name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      let matchesStatus = true;
      if (statusFilter === 'connected') {
        matchesStatus = item.status === 'connected';
      } else if (statusFilter === 'not_configured') {
        matchesStatus = item.status === 'not_configured' && !item.is_coming_soon;
      } else if (statusFilter === 'coming_soon') {
        matchesStatus = item.is_coming_soon;
      } else if (statusFilter === 'attention') {
        matchesStatus = item.status === 'connection_failed' || item.status === 'requires_attention';
      }

      return matchesCategory && matchesSearch && matchesStatus;
    });
  }, [catalog, selectedCategory, searchQuery, statusFilter]);

  // Handle testing connection directly from card
  const handleTestConnection = async (item) => {
    setTestingId(item.id);
    try {
      const res = await fetch('/api/platform/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: item.id })
      });
      const data = await res.json();
      setCardTestResults(prev => ({
        ...prev,
        [item.id]: {
          success: data.success,
          status: data.status,
          message: data.message
        }
      }));
      if (data.success) {
        showToast('success', `${item.name}: Connection verified successfully!`);
      } else {
        showToast('error', `${item.name}: ${data.message || 'Verification failed.'}`);
      }
    } catch (e) {
      setCardTestResults(prev => ({
        ...prev,
        [item.id]: {
          success: false,
          status: 'connection_failed',
          message: e.message || 'Connection test failed.'
        }
      }));
      showToast('error', `Connection test error: ${e.message}`);
    } finally {
      setTestingId(null);
    }
  };

  // Open focused configuration modal
  const handleOpenConfig = (item) => {
    setActiveConfigItem(item);
    const initialForm = {};
    (item.fields || []).forEach(f => {
      // Don't prefill masked secret bullets into editable input so user knows they can type fresh secret
      initialForm[f.key] = '';
    });
    setConfigForm(initialForm);
    setShowSecrets({});
    setModalTestStatus(null);
  };

  // Test inside config modal
  const handleModalTest = async () => {
    if (!activeConfigItem) return;
    setModalTestStatus({ loading: true, message: 'Validating credentials with provider...' });
    try {
      const res = await fetch('/api/platform/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: activeConfigItem.id,
          credentials: configForm
        })
      });
      const data = await res.json();
      setModalTestStatus({
        loading: false,
        success: data.success,
        message: data.message
      });
    } catch (e) {
      setModalTestStatus({
        loading: false,
        success: false,
        message: e.message || 'Verification test failed.'
      });
    }
  };

  // Save credentials from focused modal
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!activeConfigItem) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/platform/integrations/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration_id: activeConfigItem.id,
          credentials: configForm
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('success', `Saved credentials for ${activeConfigItem.name}.`);
        setActiveConfigItem(null);
        await fetchCatalog();
      } else {
        showToast('error', data.detail || data.message || 'Failed to save credentials.');
      }
    } catch (e) {
      showToast('error', e.message || 'Error saving credentials.');
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-detect member ID from LinkedIn API
  const handleAutoDetectLinkedIn = async () => {
    setLinkedInDetecting(true);
    setLinkedInTestStatus({ loading: true, message: 'Probing LinkedIn API for Member ID...' });
    try {
      const res = await fetch('/api/platform/linkedin/detect-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: linkedInForm.token.trim() })
      });
      const data = await res.json();
      if (data.success && data.author_urn) {
        const cleaned = cleanAuthorUrnInput(data.author_urn);
        setLinkedInForm(prev => ({ ...prev, authorUrn: cleaned }));
        setLinkedInTestStatus({
          loading: false,
          success: true,
          message: `Discovered LinkedIn member '${data.name}' (${cleaned}).`
        });
      } else {
        setLinkedInTestStatus({
          loading: false,
          success: false,
          message: data.message || 'Auto-detection requires OpenID Connect scopes or manual member ID entry.'
        });
      }
    } catch (e) {
      setLinkedInTestStatus({
        loading: false,
        success: false,
        message: e.message || 'Failed to detect member identifier.'
      });
    } finally {
      setLinkedInDetecting(false);
    }
  };

  // Save fresh LinkedIn configuration
  const handleSaveLinkedInReconfig = async (e) => {
    e.preventDefault();
    if (!linkedInForm.token.trim()) {
      setLinkedInTestStatus({ success: false, message: 'LinkedIn Access Token is required.' });
      return;
    }
    let authorUrnToUse = cleanAuthorUrnInput(linkedInForm.authorUrn);
    if (authorUrnToUse !== linkedInForm.authorUrn) {
      setLinkedInForm(prev => ({ ...prev, authorUrn: authorUrnToUse }));
    }

    // Guard: Reject vanity URLs immediately
    const cleanLower = authorUrnToUse.toLowerCase();
    if (cleanLower.includes('linkedin.com') || cleanLower.includes('http://') || cleanLower.includes('https://') || cleanLower.includes('/in/')) {
      setLinkedInTestStatus({
        loading: false,
        success: false,
        message: 'Invalid Author URN: Public profile URLs (https://www.linkedin.com/in/...) cannot be used. Enter your numeric Member ID (e.g. urn:li:person:1116653996).'
      });
      return;
    }

    if (authorUrnToUse && !isValidAuthorUrn(authorUrnToUse)) {
      setLinkedInTestStatus({
        loading: false,
        success: false,
        message: `Invalid Author URN format: "${authorUrnToUse}". Must match "^urn:li:(person|organization):[0-9]+$" with numeric ID.`
      });
      return;
    }

    setLinkedInSaving(true);
    setLinkedInTestStatus({ loading: true, message: 'Validating credentials with LinkedIn API...' });

    try {
      // 1. Live test first
      const testRes = await fetch('/api/platform/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: 'linkedin',
          token: linkedInForm.token.trim(),
          author_urn: authorUrnToUse || 'urn:li:person:discover'
        })
      });
      const testData = await testRes.json();

      if (testData.discovered_urn && !authorUrnToUse) {
        authorUrnToUse = testData.discovered_urn;
        setLinkedInForm(prev => ({ ...prev, authorUrn: authorUrnToUse }));
      }

      if (!authorUrnToUse) {
        setLinkedInTestStatus({
          loading: false,
          success: false,
          message: 'Author URN is required. Format: urn:li:person:<id> (or enable OpenID Connect in Developer Portal to auto-detect).'
        });
        setLinkedInSaving(false);
        return;
      }

      // 2. Save credentials
      const credsToSave = {
        LINKEDIN_ACCESS_TOKEN: linkedInForm.token.trim(),
        LINKEDIN_AUTHOR_URN: authorUrnToUse
      };
      if (linkedInForm.hfToken.trim()) {
        credsToSave.HUGGINGFACE_API_KEY = linkedInForm.hfToken.trim();
      }
      if (linkedInForm.clientId.trim()) {
        credsToSave.LINKEDIN_CLIENT_ID = linkedInForm.clientId.trim();
      }

      const saveRes = await fetch('/api/platform/integrations/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration_id: 'linkedin',
          credentials: credsToSave
        })
      });

      if (saveRes.ok) {
        setLinkedInTestStatus({
          loading: false,
          success: testData.success,
          message: testData.success 
            ? 'LinkedIn credentials successfully validated and saved!' 
            : `Credentials saved. Notice: ${testData.message}`
        });
        showToast('success', 'LinkedIn credentials updated successfully.');
        setTimeout(() => {
          setShowLinkedInReconfig(false);
          fetchCatalog();
        }, 1200);
      } else {
        const saveErr = await saveRes.json();
        setLinkedInTestStatus({ loading: false, success: false, message: saveErr.detail || 'Save failed' });
      }
    } catch (e) {
      setLinkedInTestStatus({ loading: false, success: false, message: e.message || 'Error configuring LinkedIn' });
    } finally {
      setLinkedInSaving(false);
    }
  };

  // Disconnect confirmation
  const handleConfirmDisconnect = async () => {
    if (!disconnectItem) return;
    setIsDisconnecting(true);
    try {
      const res = await fetch('/api/platform/integrations/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: disconnectItem.id })
      });
      if (res.ok) {
        showToast('success', `Disconnected ${disconnectItem.name}.`);
        setDisconnectItem(null);
        await fetchCatalog();
      } else {
        showToast('error', 'Failed to disconnect integration.');
      }
    } catch (e) {
      showToast('error', e.message || 'Error disconnecting integration.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const summary = catalog?.summary || {
    total_integrations: 0,
    connected_integrations: 0,
    not_configured: 0,
    attention_required: 0
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl border flex items-center gap-3 backdrop-blur-md transition-all ${
          toastMsg.type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200' 
            : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
        }`}>
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-medium">{toastMsg.text}</span>
          <button onClick={() => setToastMsg(null)} className="p-1 hover:bg-white/10 rounded-lg">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header & Quick Action Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-600/30 to-indigo-600/30 text-purple-300 border border-purple-500/40 shadow-inner">
            <Plug className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Integrations Hub</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                Centralized Hub
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              One central place to configure, test, and manage external credentials. Automatically synchronized across all agents.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
          <button
            type="button"
            onClick={() => {
              setLinkedInForm({ token: '', authorUrn: '', hfToken: '', clientId: '' });
              setLinkedInTestStatus(null);
              setShowLinkedInReconfig(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20 border border-blue-400/30 flex items-center gap-2 transition-all"
          >
            <Linkedin className="w-4 h-4" />
            <span>Reconfigure LinkedIn Credentials</span>
          </button>
          
          <button
            type="button"
            onClick={fetchCatalog}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>
        </div>
      </div>

      {/* Top Summary Metrics Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Total */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 bg-slate-900/40 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Integrations</p>
            <h3 className="text-2xl font-bold text-white mt-1">{summary.total_integrations}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">{summary.active_integrations || 18} Active &bull; 9 Coming Soon</p>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Plug className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2: Connected */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 bg-slate-900/40 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Connected</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{summary.connected_integrations}</h3>
            <p className="text-[10px] text-emerald-400/80 mt-0.5">Verified &amp; Operational</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3: Not Configured */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 bg-slate-900/40 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Not Configured</p>
            <h3 className="text-2xl font-bold text-amber-400 mt-1">{summary.not_configured}</h3>
            <p className="text-[10px] text-amber-400/80 mt-0.5">Ready for Credentials</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4: Attention Required */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 bg-slate-900/40 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Attention Required</p>
            <h3 className="text-2xl font-bold text-rose-400 mt-1">{summary.attention_required}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">{summary.attention_required === 0 ? 'All Systems Healthy' : 'Action Required'}</p>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Categories Tabs & Search Filters */}
      <div className="space-y-3">
        {/* Category Selector Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            All Integrations ({summary.total_integrations})
          </button>
          
          {(catalog?.categories || []).map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              {cat.name} ({cat.items.length})
            </button>
          ))}
        </div>

        {/* Search & Status Filters Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search integrations by name, service, or capabilities..."
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-900/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs bg-slate-900/80 border border-white/10 text-slate-300 focus:outline-none focus:border-purple-500 transition-all"
            >
              <option value="all">All Statuses</option>
              <option value="connected">Connected Only</option>
              <option value="not_configured">Not Configured</option>
              <option value="coming_soon">Coming Soon</option>
              <option value="attention">Issues / Attention</option>
            </select>
          </div>
        </div>
      </div>

      {/* Integrations Grid */}
      {isLoading ? (
        <div className="glass-panel p-12 rounded-2xl border border-white/10 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Loading integrations catalog and connection diagnostics...</p>
        </div>
      ) : filteredIntegrations.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-white/10 text-center space-y-3">
          <Search className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-sm font-semibold text-white">No integrations match your search</h3>
          <p className="text-xs text-slate-400">Try adjusting your filters or search keywords.</p>
          <button
            onClick={() => { setSelectedCategory('all'); setSearchQuery(''); setStatusFilter('all'); }}
            className="px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIntegrations.map((item) => {
            const IconComponent = ICON_MAP[item.icon_name] || Plug;
            const testResult = cardTestResults[item.id];
            const isCurrentlyTesting = testingId === item.id;

            return (
              <div 
                key={item.id}
                className="glass-panel p-5 rounded-2xl border border-white/10 bg-slate-900/50 hover:border-purple-500/30 transition-all flex flex-col justify-between space-y-4 group"
              >
                {/* Card Top */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:scale-105 transition-transform">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white group-hover:text-purple-300 transition-colors">
                          {item.name}
                        </h3>
                        <span className="text-[10px] font-medium text-slate-400">
                          {item.category_name}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {item.is_coming_soon ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shrink-0">
                        Coming Soon
                      </span>
                    ) : item.status === 'connected' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Connected</span>
                      </span>
                    ) : item.status === 'connection_failed' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 shrink-0 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>Failed</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                        Not Configured
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Status explanation */}
                  {item.status_message && (
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        item.status === 'connected' ? 'bg-emerald-400' : item.is_coming_soon ? 'bg-indigo-400' : 'bg-amber-400'
                      }`} />
                      <span className="truncate">{item.status_message}</span>
                    </div>
                  )}

                  {/* Test Result Feedback if triggered on card */}
                  {testResult && (
                    <div className={`p-2 rounded-xl text-[10px] font-mono border ${
                      testResult.success 
                        ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300' 
                        : 'bg-rose-950/60 border-rose-500/30 text-rose-300'
                    }`}>
                      {testResult.message}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                  {item.is_coming_soon ? (
                    <span className="text-[11px] text-slate-500 italic">Planned for release v4.2</span>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        {item.configured ? (
                          <button
                            type="button"
                            onClick={() => handleOpenConfig(item)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 flex items-center gap-1 transition-all"
                          >
                            <Key className="w-3 h-3 text-purple-400" />
                            <span>Edit</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenConfig(item)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 flex items-center gap-1 transition-all"
                          >
                            <Key className="w-3 h-3" />
                            <span>Configure</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleTestConnection(item)}
                          disabled={isCurrentlyTesting}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 flex items-center gap-1 transition-all disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${isCurrentlyTesting ? 'animate-spin' : ''}`} />
                          <span>Test</span>
                        </button>
                      </div>

                      {item.configured && item.fields?.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setDisconnectItem(item)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                          title="Disconnect Integration"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================================= */}
      {/* 1. DEDICATED FOCUSED CREDENTIAL CONFIGURATION MODAL */}
      {/* ================================================================= */}
      {activeConfigItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-white/15 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Configure {activeConfigItem.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {activeConfigItem.category_name} &bull; Stored securely in encrypted SQLite
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setActiveConfigItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveConfig} className="p-5 overflow-y-auto space-y-4 flex-1">
              {activeConfigItem.fields && activeConfigItem.fields.length > 0 ? (
                activeConfigItem.fields.map(field => {
                  const isSecret = field.is_secret;
                  const isVisible = showSecrets[field.key] || false;
                  
                  return (
                    <div key={field.key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                          <span>{field.label}</span>
                          {field.required && <span className="text-rose-400 text-[10px]">* Required</span>}
                        </label>
                        {field.has_value && (
                          <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" />
                            <span>Saved: {field.masked_value}</span>
                          </span>
                        )}
                      </div>

                      <div className="relative">
                        <input
                          type={isSecret && !isVisible ? 'password' : field.type || 'text'}
                          value={configForm[field.key] || ''}
                          onChange={(e) => setConfigForm({ ...configForm, [field.key]: e.target.value })}
                          placeholder={field.has_value ? `Leave blank to keep existing (${field.masked_value})` : field.placeholder}
                          className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-950 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono transition-all"
                        />
                        {isSecret && (
                          <button
                            type="button"
                            onClick={() => setShowSecrets({ ...showSecrets, [field.key]: !isVisible })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                          >
                            {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>

                      {field.help && (
                        <p className="text-[10px] text-slate-400">{field.help}</p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-xs">
                  This integration uses AgentFlow's built-in zero-cost engine and requires no external API keys or subscription!
                </div>
              )}

              {/* Developer Console Direct Link */}
              {activeConfigItem.help_url && activeConfigItem.help_url !== '#' && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                    <span>{activeConfigItem.help_text || 'Developer Portal'}</span>
                  </div>
                  <a
                    href={activeConfigItem.help_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1"
                  >
                    <span>Open Console</span>
                    <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Test Status Feedback inside Modal */}
              {modalTestStatus && (
                <div className={`p-3 rounded-xl text-xs font-mono border flex items-start gap-2 ${
                  modalTestStatus.loading
                    ? 'bg-purple-950/40 border-purple-500/30 text-purple-300'
                    : modalTestStatus.success
                      ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/60 border-rose-500/30 text-rose-300'
                }`}>
                  {modalTestStatus.loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin shrink-0 mt-0.5" />
                  ) : modalTestStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <span>{modalTestStatus.message}</span>
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleModalTest}
                  disabled={modalTestStatus?.loading}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 flex items-center gap-1.5 transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${modalTestStatus?.loading ? 'animate-spin' : ''}`} />
                  <span>Test Connection</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveConfigItem(null)}
                    className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Save Credentials</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 2. RECONFIGURE LINKEDIN CREDENTIALS MODAL (CLEAN INPUTS) */}
      {/* ================================================================= */}
      {showLinkedInReconfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-xl rounded-2xl border border-white/15 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Linkedin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Reconfigure LinkedIn Credentials
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Clean setup &bull; No prefilled masked bullets &bull; Direct OAuth verification
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowLinkedInReconfig(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveLinkedInReconfig} className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Field 1: LinkedIn Access Token */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                  <span>LinkedIn Access Token (OAuth 2.0)</span>
                  <span className="text-rose-400 text-[10px]">* Required</span>
                </label>
                <div className="relative">
                  <input
                    type={linkedInShowToken ? 'text' : 'password'}
                    value={linkedInForm.token}
                    onChange={(e) => setLinkedInForm({ ...linkedInForm, token: e.target.value })}
                    placeholder="Paste your 300+ char token (AQWM...)"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-950 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setLinkedInShowToken(!linkedInShowToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {linkedInShowToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  User token generated from LinkedIn Developer Portal with <code className="text-blue-300">w_member_social</code> publishing permission.
                </p>
              </div>

              {/* Field 2: LinkedIn Author URN */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200">
                    Author URN (Member ID)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAutoDetectLinkedIn}
                      disabled={linkedInDetecting || !linkedInForm.token.trim()}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 disabled:opacity-40"
                    >
                      <Sparkles className={`w-3 h-3 ${linkedInDetecting ? 'animate-spin' : ''}`} />
                      <span>{linkedInDetecting ? 'Detecting...' : 'Auto-Detect via API'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLinkedInMemberHelp(!showLinkedInMemberHelp)}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 underline"
                    >
                      {showLinkedInMemberHelp ? 'Hide Help' : 'How to find ID?'}
                    </button>
                    <span className="text-rose-400 text-[10px]">* Required</span>
                  </div>
                </div>
                <input
                  type="text"
                  value={linkedInForm.authorUrn}
                  onChange={(e) => setLinkedInForm({ ...linkedInForm, authorUrn: e.target.value })}
                  onBlur={(e) => {
                    const cleaned = cleanAuthorUrnInput(e.target.value);
                    if (cleaned && cleaned !== e.target.value) {
                      setLinkedInForm({ ...linkedInForm, authorUrn: cleaned });
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData('text');
                    const cleaned = cleanAuthorUrnInput(pasted);
                    setLinkedInForm({ ...linkedInForm, authorUrn: cleaned });
                  }}
                  placeholder="e.g. 1116653996 or urn:li:person:1116653996"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-950 border font-mono transition-all ${
                    (linkedInForm.authorUrn || '').toLowerCase().includes('linkedin.com') || (linkedInForm.authorUrn || '').toLowerCase().includes('/in/')
                      ? 'border-rose-500 text-rose-200'
                      : 'border-white/10 text-white focus:border-blue-500'
                  }`}
                />

                {/* Real-time Validation & Cleaned Preview Badge */}
                {(() => {
                  const val = (linkedInForm.authorUrn || '').trim();
                  const valLower = val.toLowerCase();
                  if (!val) {
                    return (
                      <p className="text-[10px] text-slate-400 leading-normal">
                        Enter your numeric Member ID or <code className="text-cyan-300">urn:li:person:&lt;id&gt;</code>. Plain text only (HTML and markdown are automatically stripped).
                      </p>
                    );
                  }
                  if (valLower.includes('http://') || valLower.includes('https://') || valLower.includes('linkedin.com') || valLower.includes('/in/')) {
                    return (
                      <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-rose-400" />
                        <div>
                          <strong>Invalid Author URN:</strong> Public profile URLs (<code className="text-rose-200">https://www.linkedin.com/in/...</code>) are not accepted. Click <strong>"How to find ID?"</strong> above to find your internal numeric Member ID.
                        </div>
                      </div>
                    );
                  }

                  const cleaned = cleanAuthorUrnInput(val);
                  const isValid = isValidAuthorUrn(cleaned);
                  const hadFormatting = cleaned !== val;

                  if (isValid) {
                    return (
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                          <span>Cleaned Author URN to save: <strong className="text-white bg-slate-800 px-1.5 py-0.5 rounded border border-white/10">{cleaned}</strong></span>
                        </p>
                        {hadFormatting && (
                          <p className="text-[10px] text-amber-300 font-mono">
                            ✓ Accidental markdown formatting and HTML entities stripped safely.
                          </p>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] flex items-start gap-1.5 font-mono">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-rose-400" />
                      <div>
                        <span>Cleaned: <strong className="text-white">{cleaned || val}</strong></span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">Must match pattern: ^urn:li:(person|organization):[0-9]+$ (numeric ID required)</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Expandable Member ID Help Guide */}
                {showLinkedInMemberHelp && (
                  <div className="mt-2.5 p-3 rounded-xl bg-slate-950/90 border border-cyan-500/20 text-[11px] text-slate-300 space-y-2.5">
                    <div className="flex items-center justify-between font-semibold text-cyan-300 text-xs">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        2 Ways to Get Your LinkedIn Member ID
                      </span>
                      <button 
                        type="button"
                        onClick={() => setShowLinkedInMemberHelp(false)} 
                        className="text-slate-400 hover:text-white text-[10px]"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-1">
                      <p className="font-medium text-white text-[11px]">
                        ⚡ Option 1: Find ID in Page Source (Takes 30 Seconds, No Portal Setup)
                      </p>
                      <ol className="list-decimal list-inside text-slate-300 space-y-0.5 pl-1 text-[10px]">
                        <li>Open your LinkedIn profile in your browser (<code className="text-cyan-300">linkedin.com/in/...</code>).</li>
                        <li>Right-click anywhere on the page and click <strong>View Page Source</strong> (or press <kbd className="bg-black/50 px-1 rounded">Ctrl+U</kbd>).</li>
                        <li>Press <kbd className="bg-black/50 px-1 rounded">Ctrl+F</kbd> and search for: <code className="text-amber-300">urn:li:member:</code></li>
                        <li>Copy the digits (e.g. <code className="text-emerald-300 font-mono">123456789</code>) and paste them into the box above.</li>
                      </ol>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-1">
                      <p className="font-medium text-white text-[11px]">
                        🔑 Option 2: Auto-Detect via OpenID Connect Product
                      </p>
                      <ol className="list-decimal list-inside text-slate-300 space-y-0.5 pl-1 text-[10px]">
                        <li>Go to <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">LinkedIn Developer Portal</a> ➔ Select your App ➔ <strong>Products</strong> tab.</li>
                        <li>Add the free product: <strong>"Sign In with LinkedIn using OpenID Connect"</strong> (instant 1-click access).</li>
                        <li>In <strong>OAuth 2.0 Tools</strong>, generate a token with <code className="text-cyan-300">openid</code>, <code className="text-cyan-300">profile</code>, and <code className="text-cyan-300">w_member_social</code>.</li>
                        <li>Paste the token above and click <strong>Auto-Detect via API</strong>.</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>

              {/* Field 3: Optional Hugging Face Token for FLUX visuals */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                  <span>Hugging Face Access Token (For AI Visual Studio)</span>
                  <span className="text-emerald-400 text-[10px]">100% Free Option</span>
                </label>
                <div className="relative">
                  <input
                    type={linkedInShowHf ? 'text' : 'password'}
                    value={linkedInForm.hfToken}
                    onChange={(e) => setLinkedInForm({ ...linkedInForm, hfToken: e.target.value })}
                    placeholder="hf_... (Free user token from huggingface.co/settings/tokens)"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-950 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setLinkedInShowHf(!linkedInShowHf)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {linkedInShowHf ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Powers photorealistic developer workspace visuals via FLUX.1-schnell without rate limits or stock photos.
                </p>
              </div>

              {/* Step-by-Step Guidance Card */}
              <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/20 space-y-2 text-xs">
                <div className="font-semibold text-blue-300 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>How to retrieve your LinkedIn Member ID &amp; URN:</span>
                </div>
                <div className="space-y-2 text-[11px] text-slate-300">
                  <p>
                    <strong className="text-white">Option A (Auto-Discovery via OpenID Connect):</strong> In LinkedIn Developer Portal &gt; Products, add <strong className="text-blue-300">"Sign In with LinkedIn using OpenID Connect"</strong> (instant free approval). When generating a token in OAuth Tools, select <code className="text-blue-300">w_member_social</code>, <code className="text-blue-300">openid</code>, and <code className="text-blue-300">profile</code>. AgentFlow will automatically discover your Member ID!
                  </p>
                  <p>
                    <strong className="text-white">Option B (Direct Member ID Lookup):</strong> Open your profile on linkedin.com, right click &gt; View Page Source (Ctrl+U), search for <code className="text-blue-300">urn:li:member:</code> or <code className="text-blue-300">fsd_profile:urn:li:fsd_profile:</code>. Copy the ID and paste as <code className="text-blue-300">urn:li:person:&lt;id&gt;</code> above.
                  </p>
                </div>
              </div>

              {/* Live Test Feedback */}
              {linkedInTestStatus && (
                <div className={`p-3 rounded-xl text-xs font-mono border flex items-start gap-2 ${
                  linkedInTestStatus.loading
                    ? 'bg-blue-950/40 border-blue-500/30 text-blue-300'
                    : linkedInTestStatus.success
                      ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/60 border-rose-500/30 text-rose-300'
                }`}>
                  {linkedInTestStatus.loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin shrink-0 mt-0.5" />
                  ) : linkedInTestStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <span>{linkedInTestStatus.message}</span>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLinkedInReconfig(false)}
                  className="px-3.5 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linkedInSaving}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {linkedInSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Test &amp; Save Credentials</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. DISCONNECT CONFIRMATION MODAL */}
      {/* ================================================================= */}
      {disconnectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Disconnect {disconnectItem.name}?</h3>
                <p className="text-xs text-slate-400">Confirmation Required</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to disconnect <strong className="text-white">{disconnectItem.name}</strong>? Stored credentials will be safely cleared from SQLite and your local runtime environment.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDisconnectItem(null)}
                className="px-3.5 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDisconnect}
                disabled={isDisconnecting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDisconnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Yes, Disconnect</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
