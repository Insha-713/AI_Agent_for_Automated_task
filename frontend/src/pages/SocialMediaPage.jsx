import React, { useState, useEffect } from 'react';
import { 
  Share2, 
  Sparkles, 
  Calendar, 
  Copy, 
  Check, 
  Clock, 
  Tag, 
  Trash2, 
  Send, 
  RefreshCw, 
  Layers, 
  TrendingUp, 
  Globe2,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  X,
  ShieldCheck
} from 'lucide-react';

const PLATFORMS = [
  { id: 'twitter', label: 'Twitter / X', maxChars: 280, color: 'text-sky-400 border-sky-400/30 bg-sky-500/10' },
  { id: 'linkedin', label: 'LinkedIn', maxChars: 3000, color: 'text-blue-400 border-blue-400/30 bg-blue-500/10' },
  { id: 'instagram', label: 'Instagram', maxChars: 2200, color: 'text-pink-400 border-pink-400/30 bg-pink-500/10' },
  { id: 'facebook', label: 'Facebook', maxChars: 5000, color: 'text-indigo-400 border-indigo-400/30 bg-indigo-500/10' }
];

const TONES = [
  { id: 'engaging', label: 'Engaging & Viral' },
  { id: 'professional', label: 'Professional' },
  { id: 'educational', label: 'Educational / Deep Dive' },
  { id: 'storytelling', label: 'Personal Story' },
  { id: 'humorous', label: 'Humorous / Casual' }
];

const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'Hindi (हिन्दी)' },
  { id: 'ur', label: 'Urdu (اردو)' }
];

export default function SocialMediaPage() {
  const [platform, setPlatform] = useState('linkedin');
  const [tone, setTone] = useState('engaging');
  const [language, setLanguage] = useState('en');
  const [topic, setTopic] = useState('');
  const [targetAudience, setTargetAudience] = useState('Tech professionals, recruiters & founders');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPost, setGeneratedPost] = useState(null);
  const [copied, setCopied] = useState(false);
  
  const [posts, setPosts] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [filter, setFilter] = useState('all');
  const [actionMessage, setActionMessage] = useState(null);

  // Scheduling Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [modalDate, setModalDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [modalTime, setModalTime] = useState('10:00');
  const [modalTz, setModalTz] = useState('Asia/Kolkata');
  const [modalFreq, setModalFreq] = useState('one_time');
  const [modalApproval, setModalApproval] = useState(false);
  const [modalAutoPublish, setModalAutoPublish] = useState(false);
  const [isModalSaving, setIsModalSaving] = useState(false);

  const fetchPosts = async () => {
    setIsLoadingPosts(true);
    try {
      const res = await fetch('/api/platform/social/posts');
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (e) {
      console.error('Failed to load posts', e);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  const handleSaveScheduleFromModal = async (e) => {
    e?.preventDefault();
    if (!generatedPost) return;

    setIsModalSaving(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/platform/social/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: generatedPost.platform || platform,
          content: generatedPost.content,
          hashtags: generatedPost.hashtags || [],
          date: modalDate,
          time: modalTime,
          timezone: modalTz,
          frequency: modalFreq,
          approval_required: modalApproval,
          auto_publish: modalAutoPublish
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setActionMessage({
          type: 'success',
          text: `Scheduled successfully! Status: ${(data.post?.status || 'scheduled').toUpperCase()}`
        });
        setShowScheduleModal(false);
        fetchPosts();
      } else {
        setActionMessage({ type: 'error', text: data.detail || 'Failed to schedule post' });
      }
    } catch (e) {
      setActionMessage({ type: 'error', text: e.message || 'Scheduling failed' });
    } finally {
      setIsModalSaving(false);
    }
  };

  const handleApprovePost = async (id) => {
    try {
      const res = await fetch(`/api/platform/social/posts/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: `Post approved! (${data.action})` });
        fetchPosts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePausePost = async (id) => {
    try {
      const res = await fetch(`/api/platform/social/posts/${id}/pause`, { method: 'POST' });
      if (res.ok) {
        setActionMessage({ type: 'success', text: 'Post schedule paused.' });
        fetchPosts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResumePost = async (id) => {
    try {
      const res = await fetch(`/api/platform/social/posts/${id}/resume`, { method: 'POST' });
      if (res.ok) {
        setActionMessage({ type: 'success', text: 'Post schedule resumed.' });
        fetchPosts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleGenerate = async (e) => {
    e?.preventDefault();
    if (!topic.trim()) return;

    setIsGenerating(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/platform/social/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          topic,
          tone,
          target_audience: targetAudience,
          language
        })
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedPost(data.draft || data.post);
      } else {
        setActionMessage({ type: 'error', text: 'Failed to generate post. Check backend logs.' });
      }
    } catch (e) {
      setActionMessage({ type: 'error', text: e.message || 'Generation failed' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToDrafts = async (status = 'draft') => {
    if (!generatedPost) return;

    try {
      const res = await fetch('/api/platform/social/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: generatedPost.platform || platform,
          content: generatedPost.content,
          hashtags: (generatedPost.hashtags || []).join(' '),
          scheduled_for: status === 'scheduled' ? new Date(Date.now() + 86400000).toISOString() : null,
          status
        })
      });

      if (res.ok) {
        setActionMessage({ 
          type: 'success', 
          text: status === 'scheduled' ? 'Post scheduled successfully!' : 'Saved to Content Calendar & Drafts!' 
        });
        fetchPosts();
      }
    } catch (e) {
      setActionMessage({ type: 'error', text: 'Failed to save post' });
    }
  };

  const handleDeletePost = async (id) => {
    try {
      const res = await fetch(`/api/platform/social/posts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePublishNow = async (id) => {
    setActionMessage(null);
    try {
      const res = await fetch(`/api/platform/social/posts/${id}/publish`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setActionMessage({
          type: 'success',
          text: `Successfully published! Post ID: ${data.result?.post_id || 'Delivered'}`
        });
      } else {
        setActionMessage({
          type: 'error',
          text: data.result?.error || 'Publishing failed. Please verify API credentials in Integrations Hub.'
        });
      }
      fetchPosts();
    } catch (e) {
      setActionMessage({ type: 'error', text: e.message || 'Publishing failed' });
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredPosts = posts.filter(p => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-purple-950/40 via-slate-900/60 to-cyan-950/40 border border-white/10 shadow-2xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Share2 className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-white">
              Social Media <span className="text-purple-400">Content Studio</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              v3.0 Multi-Platform
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Generate viral captions, hashtags, and optimal posting times across LinkedIn, Twitter/X, Instagram, and Facebook.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchPosts}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${isLoadingPosts ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className={`p-4 rounded-2xl flex items-center gap-2.5 text-xs font-medium border ${
          actionMessage.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Post Generator Controls */}
        <div className="lg:col-span-6 space-y-4">
          <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Create New Content</span>
            </h2>

            {/* Platform Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Target Platform</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-center ${
                      platform === p.id 
                        ? `${p.color} ring-1 ring-white/20 font-semibold shadow-md`
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tone Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Voice & Tone</label>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      tone === t.id
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Language Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Content Language</span>
              </label>
              <div className="flex gap-2">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLanguage(l.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      language === l.id
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic Input */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Topic, Project, or Announcement
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="E.g., Built an autonomous AI workflow engine using Python and React with human approval gates..."
                rows={4}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Target Audience */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Target Audience (Optional)
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="E.g., Tech leads, Hiring managers, Python engineers"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !topic.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Post...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Multi-Platform Post</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Generated Preview & Actions */}
        <div className="lg:col-span-6 space-y-4">
          <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 min-h-[420px] flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">Preview</span>
                  {generatedPost && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {generatedPost.platform}
                    </span>
                  )}
                </div>

                {generatedPost && (
                  <button
                    type="button"
                    onClick={() => handleCopy(`${generatedPost.content}\n\n${(generatedPost.hashtags || []).join(' ')}`)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-purple-400" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>

              {generatedPost ? (
                <div className="pt-4 space-y-4">
                  {/* Post Content */}
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                    {generatedPost.content}
                  </div>

                  {/* Hashtags */}
                  {generatedPost.hashtags && generatedPost.hashtags.length > 0 && (
                    <div>
                      <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mb-2">
                        <Tag className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Recommended Hashtags</span>
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {generatedPost.hashtags.map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[11px] font-mono">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Best Time */}
                  {generatedPost.best_time && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-xs text-amber-300">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <span><strong>Optimal Posting Time:</strong> {generatedPost.best_time}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-20 text-center text-slate-500 space-y-2">
                  <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs">Fill in your topic on the left and click "Generate Multi-Platform Post"</p>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            {generatedPost && (
              <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveToDrafts('draft')}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Save to Drafts</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(true)}
                  className="flex-1 py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-xs font-semibold text-purple-200 transition-all flex items-center justify-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  <span>Configure Schedule & Auto-Publish</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schedule Configuration Modal */}
      {showScheduleModal && generatedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-white/20 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">Schedule Post ({generatedPost.platform || platform})</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveScheduleFromModal} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Date</label>
                  <input
                    type="date"
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Time</label>
                  <input
                    type="time"
                    value={modalTime}
                    onChange={(e) => setModalTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Timezone</label>
                  <select
                    value={modalTz}
                    onChange={(e) => setModalTz(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Frequency</label>
                  <select
                    value={modalFreq}
                    onChange={(e) => setModalFreq(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white"
                  >
                    <option value="one_time">One-Time</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={modalApproval}
                    onChange={(e) => setModalApproval(e.target.checked)}
                    className="rounded bg-slate-800 text-purple-500"
                  />
                  <span>Require Manual Approval Gate</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={modalAutoPublish}
                    onChange={(e) => setModalAutoPublish(e.target.checked)}
                    className="rounded bg-slate-800 text-purple-500"
                  />
                  <span>Autonomous Auto-Publish (Disabled by default)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isModalSaving}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white"
                >
                  {isModalSaving ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Saved Drafts & Content Calendar */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Content Calendar & Saved Drafts</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10 font-mono">
              {posts.length} posts
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {['all', 'draft', 'pending_approval', 'scheduled', 'published', 'paused', 'failed'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize border transition-all ${
                  filter === st
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-white/5 text-slate-400 border-transparent hover:text-white'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {filteredPosts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No {filter !== 'all' ? filter.replace('_', ' ') : ''} posts saved yet. Generate one above to save it here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPosts.map((p) => (
              <div key={p.id} className="p-4 rounded-xl bg-slate-900/60 border border-white/5 flex flex-col justify-between space-y-3 hover:border-purple-500/30 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {p.platform}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      p.status === 'published' 
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : p.status === 'pending_approval'
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : p.status === 'scheduled'
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                        : p.status === 'paused'
                        ? 'bg-slate-700 text-slate-300 border border-white/10'
                        : p.status === 'failed'
                        ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        : 'bg-slate-800 text-slate-400 border border-white/10'
                    }`}>
                      {p.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-4 leading-relaxed font-sans">
                    {p.content}
                  </p>
                  {p.hashtags && (
                    <p className="text-[10px] text-cyan-400 font-mono truncate">
                      {Array.isArray(p.hashtags) ? p.hashtags.join(' ') : p.hashtags}
                    </p>
                  )}
                  {p.next_run_at && (
                    <p className="text-[10px] text-purple-300 font-mono">
                      Next Run: {new Date(p.next_run_at).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-400">
                  <span>{p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Recent'}</span>
                  <div className="flex items-center gap-1.5">
                    {p.status === 'pending_approval' && (
                      <button
                        type="button"
                        onClick={() => handleApprovePost(p.id)}
                        className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-medium text-[10px] transition-all"
                        title="Approve post"
                      >
                        Approve
                      </button>
                    )}
                    {p.status === 'scheduled' && (
                      <button
                        type="button"
                        onClick={() => handlePausePost(p.id)}
                        className="p-1 rounded hover:bg-white/10 text-amber-400"
                        title="Pause schedule"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {p.status === 'paused' && (
                      <button
                        type="button"
                        onClick={() => handleResumePost(p.id)}
                        className="p-1 rounded hover:bg-white/10 text-cyan-400"
                        title="Resume schedule"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {p.status !== 'published' && p.status !== 'pending_approval' && (
                      <button
                        type="button"
                        onClick={() => handlePublishNow(p.id)}
                        className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 font-medium text-[10px] transition-all"
                        title="Publish to platform now"
                      >
                        Publish Now
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopy(`${p.content}\n\n${p.hashtags || ''}`)}
                      className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                      title="Copy content"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePost(p.id)}
                      className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                      title="Delete post"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
