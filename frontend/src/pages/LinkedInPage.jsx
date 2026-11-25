import React, { useState, useEffect } from 'react';
import { 
  Linkedin, 
  Sparkles, 
  MessageSquare, 
  ShieldCheck, 
  Copy, 
  Check, 
  Clock, 
  Send, 
  RefreshCw, 
  ExternalLink,
  Tag,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Cpu,
  Calendar,
  Play,
  Pause,
  Trash2,
  Edit3,
  Sliders,
  Repeat,
  CheckSquare,
  XCircle,
  Globe,
  BellRing,
  Download,
  Image as ImageIcon,
  Layers,
  ArrowRight
} from 'lucide-react';
import AgentOnboardingBanner from '../components/AgentOnboardingBanner';

const POST_TYPES = [
  { id: 'project_showcase', label: '1. Project Showcase', desc: 'Tech stack, problem solved, architecture & impact' },
  { id: 'achievement', label: '2. Personal Achievement', desc: 'Milestone, certification, engineering breakthrough' },
  { id: 'educational', label: '3. Educational / Tech Insight', desc: 'Step-by-step tutorial, system design, best practices' },
  { id: 'commentary', label: '4. Industry Commentary', desc: 'AI trends, automation shift, engineering analysis' },
  { id: 'career_update', label: '5. Internship / Career Update', desc: 'New role, internship, career growth chapter' },
  { id: 'research_publication', label: '6. Research Publication', desc: 'Empirical study, benchmark findings, technical paper' },
  { id: 'product_announcement', label: '7. Product Announcement', desc: 'New feature, open-source launch, SaaS unveiling' }
];

const IMAGE_STYLES = [
  { id: 'Modern Tech', label: 'Modern Tech', desc: 'Glowing cyan & blue, dark background, 8k minimal' },
  { id: 'Minimalist', label: 'Minimalist', desc: 'High contrast vector typography, crisp monochrome' },
  { id: 'Corporate', label: 'Corporate', desc: 'Navy blue & slate palette, polished enterprise visual' },
  { id: 'Dark Cyberpunk', label: 'Dark Cyberpunk', desc: 'Obsidian dark, neon violet & cyan circuit lines' },
  { id: 'Scientific Diagram', label: 'Scientific Diagram', desc: 'Technical blueprint, modular nodes & clean annotations' }
];

const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1 Square (Feed Default)', dims: '1024x1024' },
  { id: '16:9', label: '16:9 Landscape (Wide)', dims: '1024x576' },
  { id: '4:5', label: '4:5 Portrait (Mobile)', dims: '800x1000' }
];

const TONES = [
  { id: 'thought_leadership', label: 'Thought Leadership' },
  { id: 'founder_story', label: 'Founder / Builder Story' },
  { id: 'casual_tech', label: 'Casual & Developer Friendly' },
  { id: 'detailed_breakdown', label: 'Detailed Engineering Breakdown' }
];

const REPLY_TONES = [
  { id: 'appreciative', label: 'Appreciative & Engaging' },
  { id: 'technical', label: 'Technical & In-Depth' },
  { id: 'networking', label: 'Networking & Connect' }
];

const TIMEZONES = [
  { id: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, UTC+5:30) - Default' },
  { id: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { id: 'America/New_York', label: 'America/New_York (EST/EDT, UTC-5)' },
  { id: 'America/Chicago', label: 'America/Chicago (CST/CDT, UTC-6)' },
  { id: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT, UTC-8)' },
  { id: 'Europe/London', label: 'Europe/London (GMT/BST, UTC+0/+1)' },
  { id: 'Europe/Paris', label: 'Europe/Paris (CET/CEST, UTC+1/+2)' },
  { id: 'Asia/Dubai', label: 'Asia/Dubai (GST, UTC+4)' },
  { id: 'Asia/Singapore', label: 'Asia/Singapore (SGT, UTC+8)' },
  { id: 'Asia/Tokyo', label: 'Asia/Tokyo (JST, UTC+9)' },
  { id: 'Australia/Sydney', label: 'Australia/Sydney (AEST, UTC+10)' }
];

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function LinkedInPage({ onNavigate = () => {} }) {
  const [activeTab, setActiveTab] = useState('creator');
  
  // Post Creator State
  const [postType, setPostType] = useState('project_showcase');
  const [tone, setTone] = useState('thought_leadership');
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('Python, FastAPI, Autonomous AI, Local LLM');
  const [audience, setAudience] = useState('Engineers, Architects & Tech Leaders');
  const [keyTech, setKeyTech] = useState('Python, FastAPI, React, Local LLMs');
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftResult, setDraftResult] = useState(null);
  const [copiedDraft, setCopiedDraft] = useState(false);

  // AI Visual & Carousel Studio State
  const [visualType, setVisualType] = useState('single'); // 'single' | 'carousel'
  const [imageStyle, setImageStyle] = useState('Modern Tech');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [slideCount, setSlideCount] = useState(4);
  const [imagePrompt, setImagePrompt] = useState('');
  const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);
  const [generatedVisual, setGeneratedVisual] = useState(null);
  const [generatedCarousel, setGeneratedCarousel] = useState(null);
  const [activeCarouselSlide, setActiveCarouselSlide] = useState(0);
  const [attachedMediaUrl, setAttachedMediaUrl] = useState(null);
  const [visualStatusMsg, setVisualStatusMsg] = useState(null);

  // Reply Assistant State
  const [originalPost, setOriginalPost] = useState('');
  const [commentText, setCommentText] = useState('');
  const [replyTone, setReplyTone] = useState('appreciative');
  const [isReplying, setIsReplying] = useState(false);
  const [replyResult, setReplyResult] = useState(null);
  const [copiedReply, setCopiedReply] = useState(false);

  // Scheduling State
  const [schedPlatform, setSchedPlatform] = useState('linkedin');
  const [schedContent, setSchedContent] = useState('');
  const [schedHeadline, setSchedHeadline] = useState('');
  const [schedHashtags, setSchedHashtags] = useState('#AI #Python #SoftwareEngineering #Automation');
  const [schedDate, setSchedDate] = useState(getTomorrowStr());
  const [schedTime, setSchedTime] = useState('10:00');
  const [schedTimezone, setSchedTimezone] = useState('Asia/Kolkata');
  const [schedFrequency, setSchedFrequency] = useState('one_time');
  const [schedStartDate, setSchedStartDate] = useState(getTomorrowStr());
  const [schedEndDate, setSchedEndDate] = useState('');
  const [schedApprovalRequired, setSchedApprovalRequired] = useState(false);
  const [schedAutoPublish, setSchedAutoPublish] = useState(false); // User prompt: disabled until user explicitly enables it
  const [editingPostId, setEditingPostId] = useState(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isSyncingSentinel, setIsSyncingSentinel] = useState(false);

  // Scheduled Posts Queue State
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(false);
  const [schedFilter, setSchedFilter] = useState('all');

  // API Status State
  const [apiStatus, setApiStatus] = useState(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const fetchStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch('/api/platform/linkedin/status');
      if (res.ok) {
        const data = await res.json();
        setApiStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch LinkedIn status', e);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const fetchScheduledPosts = async () => {
    setIsLoadingScheduled(true);
    try {
      const res = await fetch('/api/platform/social/posts?platform=linkedin');
      if (res.ok) {
        const data = await res.json();
        setScheduledPosts(data.posts || []);
      }
    } catch (e) {
      console.error('Failed to fetch scheduled posts', e);
    } finally {
      setIsLoadingScheduled(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchScheduledPosts();
  }, []);

  const handleDraftPost = async (e) => {
    e?.preventDefault();
    if (!topic.trim()) return;

    setIsDrafting(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/platform/linkedin/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_type: postType,
          topic,
          tone,
          keywords,
          details: {
            audience,
            key_tech: keyTech
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const draft = data.draft || data.post;
        setDraftResult(draft);
        if (draft) {
          setSchedContent(draft.content || '');
          setSchedHeadline(draft.headline || '');
          setSchedHashtags((draft.hashtags || []).join(' '));
          if (draft.image_prompt) {
            setImagePrompt(draft.image_prompt);
          }
        }
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to draft post. Please retry.' });
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: e.message || 'Draft error' });
    } finally {
      setIsDrafting(false);
    }
  };

  const handleGenerateVisual = async () => {
    const promptToUse = imagePrompt.trim() || `${topic.trim() || 'Software Architecture'}, modern tech visual, dark theme, 8k`;
    setIsGeneratingVisual(true);
    setVisualStatusMsg(null);

    try {
      if (visualType === 'carousel') {
        const res = await fetch('/api/platform/images/generate-carousel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: topic.trim() || 'AI Systems Architecture',
            slide_count: Number(slideCount),
            style: imageStyle,
            goal: postType
          })
        });

        if (res.ok) {
          const data = await res.json();
          setGeneratedCarousel(data.carousel);
          setActiveCarouselSlide(0);
          setVisualStatusMsg({ type: 'success', text: `Generated ${data.carousel?.total_slides || slideCount}-slide visual carousel!` });
        } else {
          setVisualStatusMsg({ type: 'error', text: 'Failed to generate carousel slides.' });
        }
      } else {
        const res = await fetch('/api/platform/images/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: promptToUse,
            style: imageStyle,
            aspect_ratio: aspectRatio,
            visual_type: postType === 'project_showcase' ? 'project_cover' : 'technical_infographic'
          })
        });

        if (res.ok) {
          const data = await res.json();
          setGeneratedVisual(data.image);
          setVisualStatusMsg({ type: 'success', text: 'AI Visual generated successfully!' });
        } else {
          setVisualStatusMsg({ type: 'error', text: 'Failed to generate single visual.' });
        }
      }
    } catch (e) {
      setVisualStatusMsg({ type: 'error', text: e.message || 'Image generation error' });
    } finally {
      setIsGeneratingVisual(false);
    }
  };

  const handleAttachVisualToPost = (imgUrl) => {
    setAttachedMediaUrl(imgUrl);
    setVisualStatusMsg({ type: 'success', text: 'Visual attached to scheduled post!' });
  };


  const handleDraftReply = async (e) => {
    e?.preventDefault();
    if (!commentText.trim()) return;

    setIsReplying(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/platform/linkedin/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_post: originalPost,
          comment_text: commentText,
          tone: replyTone
        })
      });

      if (res.ok) {
        const data = await res.json();
        setReplyResult(data.reply);
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to draft reply.' });
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: e.message || 'Reply error' });
    } finally {
      setIsReplying(false);
    }
  };

  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublishDirect = async () => {
    if (!draftResult) return;
    setIsPublishing(true);
    setStatusMessage(null);
    try {
      const fullText = `${draftResult.headline ? `${draftResult.headline}\n\n` : ''}${draftResult.content}\n\n${(draftResult.hashtags || []).join(' ')}`;
      const res = await fetch('/api/platform/linkedin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fullText })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({
          type: 'success',
          text: `Successfully published to LinkedIn! Post ID: ${data.post_id || 'UGC Post created'}`
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'LinkedIn API error. Ensure LINKEDIN_ACCESS_TOKEN and LINKEDIN_AUTHOR_URN are configured in Integrations Hub.'
        });
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: e.message || 'Direct publishing failed' });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveToSocialDrafts = async () => {
    if (!draftResult) return;
    try {
      const res = await fetch('/api/platform/social/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'linkedin',
          content: `${draftResult.headline ? `${draftResult.headline}\n\n` : ''}${draftResult.content}`,
          hashtags: (draftResult.hashtags || []).join(' '),
          status: 'draft'
        })
      });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Saved to Social Media drafts!' });
        fetchScheduledPosts();
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: 'Failed to save to drafts' });
    }
  };

  const handleOpenInScheduler = () => {
    if (draftResult) {
      setSchedContent(draftResult.content || '');
      setSchedHeadline(draftResult.headline || '');
      setSchedHashtags((draftResult.hashtags || []).join(' '));
    }
    setEditingPostId(null);
    setActiveTab('scheduler');
  };

  const handleSaveSchedule = async (e) => {
    e?.preventDefault();
    if (!schedContent.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter or draft post content to schedule.' });
      return;
    }
    if (!schedDate || !schedTime) {
      setStatusMessage({ type: 'error', text: 'Please select both date and time for execution.' });
      return;
    }

    setIsSavingSchedule(true);
    setStatusMessage(null);
    try {
      const parsedHashtags = schedHashtags
        .split(' ')
        .map(h => h.trim())
        .filter(h => h.length > 0);

      let res;
      if (editingPostId) {
        // Edit existing schedule
        res = await fetch(`/api/platform/social/posts/${editingPostId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: schedContent,
            date: schedDate,
            time: schedTime,
            timezone: schedTimezone,
            frequency: schedFrequency,
            start_date: schedStartDate || schedDate,
            end_date: schedEndDate || null,
            approval_required: schedApprovalRequired,
            auto_publish: schedAutoPublish,
            hashtags: parsedHashtags
          })
        });
      } else {
        // Create new schedule
        res = await fetch('/api/platform/social/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: 'linkedin',
            content: schedContent,
            headline: schedHeadline,
            hashtags: parsedHashtags,
            date: schedDate,
            time: schedTime,
            timezone: schedTimezone,
            frequency: schedFrequency,
            start_date: schedStartDate || schedDate,
            end_date: schedEndDate || null,
            approval_required: schedApprovalRequired,
            auto_publish: schedAutoPublish
          })
        });
      }

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        const postStatus = data.post?.status || (schedApprovalRequired ? 'pending_approval' : 'scheduled');
        setStatusMessage({
          type: 'success',
          text: `Schedule saved successfully! Status: ${postStatus.toUpperCase()}. Next run: ${data.schedule_meta?.local_time || `${schedDate} ${schedTime} (${schedTimezone})`}`
        });
        setEditingPostId(null);
        fetchScheduledPosts();
      } else {
        setStatusMessage({
          type: 'error',
          text: data.detail || 'Failed to save schedule. Check input parameters.'
        });
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: e.message || 'Error saving schedule' });
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleApprovePost = async (postId) => {
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/platform/social/posts/${postId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        if (data.action === 'published') {
          setStatusMessage({
            type: 'success',
            text: `Post approved and published immediately! Post ID: ${data.result?.post_id || 'Delivered'}`
          });
        } else if (data.action === 'publish_attempted' && data.status === 'failed') {
          setStatusMessage({
            type: 'error',
            text: data.result?.error || 'Approved, but publishing failed. Check credentials.'
          });
        } else {
          setStatusMessage({
            type: 'success',
            text: 'Post approved! Transitioned to SCHEDULED queue for automatic execution.'
          });
        }
        fetchScheduledPosts();
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: e.message || 'Approval failed' });
    }
  };

  const handlePausePost = async (postId) => {
    try {
      const res = await fetch(`/api/platform/social/posts/${postId}/pause`, { method: 'POST' });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Schedule paused.' });
        fetchScheduledPosts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResumePost = async (postId) => {
    try {
      const res = await fetch(`/api/platform/social/posts/${postId}/resume`, { method: 'POST' });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Schedule resumed.' });
        fetchScheduledPosts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      const res = await fetch(`/api/platform/social/posts/${postId}`, { method: 'DELETE' });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Post removed.' });
        fetchScheduledPosts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditSchedule = (post) => {
    setEditingPostId(post.id);
    setSchedContent(post.content || '');
    setSchedHeadline(post.headline || '');
    setSchedHashtags(Array.isArray(post.hashtags) ? post.hashtags.join(' ') : post.hashtags || '');
    setSchedTimezone(post.timezone || 'Asia/Kolkata');
    setSchedFrequency(post.frequency || 'one_time');
    setSchedApprovalRequired(Boolean(post.approval_required));
    setSchedAutoPublish(Boolean(post.auto_publish));
    setSchedStartDate(post.start_date || getTodayStr());
    setSchedEndDate(post.end_date || '');

    if (post.next_run_at || post.scheduled_for) {
      try {
        const dt = new Date(post.next_run_at || post.scheduled_for);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        setSchedDate(`${y}-${m}-${d}`);
        const hr = String(dt.getHours()).padStart(2, '0');
        const mn = String(dt.getMinutes()).padStart(2, '0');
        setSchedTime(`${hr}:${mn}`);
      } catch (e) {
        // fallback
      }
    }
    setActiveTab('scheduler');
    window.scrollTo({ top: 150, behavior: 'smooth' });
  };

  const handleTriggerSentinelSync = async () => {
    setIsSyncingSentinel(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/platform/social/sync-now', { method: 'POST' });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: '5-Minute Autonomous Publisher Sentinel cycle executed!' });
        await fetchScheduledPosts();
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: 'Sync error' });
    } finally {
      setIsSyncingSentinel(false);
    }
  };

  const filteredScheduled = scheduledPosts.filter(p => {
    if (schedFilter === 'all') return true;
    return p.status === schedFilter;
  });

  const formatExecutionTime = (isoString, tz) => {
    if (!isoString) return 'Not scheduled';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-US', {
        timeZone: tz || 'Asia/Kolkata',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }) + ` (${tz || 'Asia/Kolkata'})`;
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-cyan-950/40 border border-white/10 shadow-2xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Linkedin className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-white">
              LinkedIn <span className="text-blue-400">Automation & Scheduling Studio</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              v4.0 Autonomous
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Architect engineering posts, configure timezone-aware recurring schedules, gate with approval workflows, and publish automatically.
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex flex-wrap bg-slate-900/80 p-1.5 rounded-2xl border border-white/10 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('creator')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'creator'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Post Creator
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scheduler')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'scheduler'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span>Schedule Post & Queue</span>
            {scheduledPosts.filter(p => p.status === 'pending_approval').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {scheduledPosts.filter(p => p.status === 'pending_approval').length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('replies')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'replies'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Comment Reply Drafter
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('api')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'api'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            API Status
          </button>
        </div>
      </div>

      {/* Pre-flight Connection Banner */}
      {apiStatus && !apiStatus.configured && (
        <AgentOnboardingBanner
          agentName="LinkedIn Agent"
          requiredIntegration="LinkedIn Official API"
          isConfigured={false}
          description="Connect your LinkedIn account (Access Token + Person/Organization URN) to schedule and publish thought leadership posts."
          onOpenConnections={() => onNavigate('connections')}
        />
      )}

      {statusMessage && (
        <div className={`p-4 rounded-2xl flex items-center gap-2.5 text-xs font-medium border ${
          statusMessage.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Tab 1: Post Creator */}
      {activeTab === 'creator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span>Configure LinkedIn Post</span>
              </h2>

              {/* Post Type */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Post Format & Goal</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {POST_TYPES.map((pt) => (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => setPostType(pt.id)}
                      className={`p-2.5 rounded-xl text-left border transition-all ${
                        postType === pt.id
                          ? 'bg-blue-500/15 border-blue-500/40 text-blue-300 shadow-sm'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <div className="text-xs font-semibold">{pt.label}</div>
                      <div className="text-[10px] text-slate-400 truncate">{pt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Tone & Narrative</label>
                <div className="flex flex-wrap gap-2">
                  {TONES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTone(t.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        tone === t.id
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic / Project */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Project Details, Milestone, or Tech Insights
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="E.g., Successfully integrated multi-agent workflows into AgentFlow with an automated approval gateway and SQLite fallback..."
                  rows={4}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Target Audience & Key Technologies Guided Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Target Audience</label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Engineers, Architects & Tech Leaders">Engineers &amp; Tech Leaders</option>
                    <option value="Recruiters & Hiring Managers">Recruiters &amp; Hiring Managers</option>
                    <option value="Founders, VCs & Product Leaders">Founders &amp; Product Leaders</option>
                    <option value="AI Researchers & Developers">AI Researchers &amp; Developers</option>
                    <option value="Students & Early Career Builders">Students &amp; Early Career Builders</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Key Technologies</label>
                  <input
                    type="text"
                    value={keyTech}
                    onChange={(e) => setKeyTech(e.target.value)}
                    placeholder="Python, FastAPI, Local LLMs, React"
                    className="w-full px-2.5 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Key Skills / Keywords to Highlight
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Python, React, System Architecture, GenAI"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={handleDraftPost}
                disabled={isDrafting || !topic.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
              >
                {isDrafting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Architecting LinkedIn Post...</span>
                  </>
                ) : (
                  <>
                    <Linkedin className="w-4 h-4" />
                    <span>Draft LinkedIn Post</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Preview */}
          <div className="lg:col-span-6 space-y-4">
            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 min-h-[460px] flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">LinkedIn Feed Preview</span>
                    <span className="text-[10px] text-slate-400">&bull; Authentic Builder Format</span>
                  </div>

                  {draftResult && (
                    <button
                      type="button"
                      onClick={() => {
                        const fullText = `${draftResult.headline ? `${draftResult.headline}\n\n` : ''}${draftResult.content}\n\n${(draftResult.hashtags || []).join(' ')}`;
                        navigator.clipboard.writeText(fullText);
                        setCopiedDraft(true);
                        setTimeout(() => setCopiedDraft(false), 2000);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
                    >
                      {copiedDraft ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
                      <span>{copiedDraft ? 'Copied' : 'Copy Full Post'}</span>
                    </button>
                  )}
                </div>

                {draftResult ? (
                  <div className="pt-4 space-y-4">
                    {draftResult.headline && (
                      <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 font-display font-semibold text-xs text-blue-200">
                        {draftResult.headline}
                      </div>
                    )}

                    <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                      {draftResult.content}
                    </div>

                    {draftResult.hashtags && draftResult.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {draftResult.hashtags.map((tag, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[11px] font-mono">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {draftResult.suggested_time && (
                      <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 flex items-center gap-2">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span><strong>Best Engagement Window:</strong> {draftResult.suggested_time}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-24 text-center text-slate-500 space-y-2">
                    <Linkedin className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs">Describe your milestone or project on the left to draft an authentic LinkedIn post</p>
                  </div>
                )}
              </div>

              {draftResult && (
                <div className="pt-4 border-t border-white/10 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleOpenInScheduler}
                    className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4 text-cyan-300" />
                    <span>Configure Schedule & Auto-Publish</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePublishDirect}
                    disabled={isPublishing}
                    className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                  >
                    {isPublishing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>Publish Directly</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveToSocialDrafts}
                    className="py-2.5 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-slate-400" />
                    <span>Save Draft</span>
                  </button>
                </div>
              )}
            </div>

            {/* AI Visual & Carousel Studio */}
            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    <ImageIcon className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-xs font-semibold text-white">AI Visual &amp; Carousel Studio</h3>
                    <p className="text-[10px] text-slate-400">Authentic image generation for posts and multi-slide carousels</p>
                  </div>
                </div>

                <div className="flex bg-slate-900/80 p-1 rounded-xl border border-white/10 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setVisualType('single')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      visualType === 'single'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Single Visual
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisualType('carousel')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                      visualType === 'carousel'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    <span>Carousel</span>
                  </button>
                </div>
              </div>

              {/* Style & Ratio Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Visual Style</label>
                  <select
                    value={imageStyle}
                    onChange={(e) => setImageStyle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                  >
                    {IMAGE_STYLES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {visualType === 'single' ? (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Aspect Ratio</label>
                    <select
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    >
                      {ASPECT_RATIOS.map(r => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Number of Slides</label>
                    <select
                      value={slideCount}
                      onChange={(e) => setSlideCount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value={3}>3 Slides (Concise Summary)</option>
                      <option value={4}>4 Slides (Standard Deep Dive)</option>
                      <option value={5}>5 Slides (Full Masterclass)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Prompt Input */}
              {visualType === 'single' && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Visual Prompt</label>
                  <input
                    type="text"
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="E.g. modern tech system architecture diagram, cloud nodes, glowing cyan"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              {/* Generate Button */}
              <button
                type="button"
                onClick={handleGenerateVisual}
                disabled={isGeneratingVisual || (!topic.trim() && !imagePrompt.trim())}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2"
              >
                {isGeneratingVisual ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{visualType === 'carousel' ? 'Synthesizing Carousel Slides...' : 'Generating AI Visual...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-purple-300" />
                    <span>{visualType === 'carousel' ? `Generate ${slideCount}-Slide Carousel Visuals` : 'Generate AI Image'}</span>
                  </>
                )}
              </button>

              {/* Visual Status Toast */}
              {visualStatusMsg && (
                <div className={`p-2.5 rounded-xl text-[11px] font-medium border ${
                  visualStatusMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  {visualStatusMsg.text}
                </div>
              )}

              {/* Single Visual Result Card */}
              {visualType === 'single' && generatedVisual && (
                <div className="pt-3 border-t border-white/10 space-y-3">
                  <div className="relative rounded-xl overflow-hidden border border-white/10 bg-slate-950">
                    <img
                      src={generatedVisual.image_url}
                      alt={generatedVisual.prompt}
                      className="w-full max-h-64 object-contain mx-auto"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-[10px] text-slate-300 font-mono">
                      {generatedVisual.dimensions} &bull; {(generatedVisual.file_size_bytes / 1024).toFixed(1)} KB
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <a
                      href={generatedVisual.image_url}
                      download={generatedVisual.filename}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 flex items-center gap-1.5 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Image</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleAttachVisualToPost(generatedVisual.image_url)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        attachedMediaUrl === generatedVisual.image_url
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-purple-600 hover:bg-purple-500 text-white'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{attachedMediaUrl === generatedVisual.image_url ? 'Attached to Post' : 'Attach to Post'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Carousel Result Card */}
              {visualType === 'carousel' && generatedCarousel && (
                <div className="pt-3 border-t border-white/10 space-y-3">
                  {/* Slide Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {generatedCarousel.slides.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveCarouselSlide(idx)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium flex-shrink-0 transition-all ${
                          activeCarouselSlide === idx
                            ? 'bg-purple-500 text-slate-950 font-bold shadow'
                            : 'bg-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        Slide {s.slide_number}
                      </button>
                    ))}
                  </div>

                  {/* Active Slide Display */}
                  {generatedCarousel.slides[activeCarouselSlide] && (
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 space-y-3">
                      <div className="relative rounded-lg overflow-hidden border border-white/10 bg-slate-950">
                        <img
                          src={generatedCarousel.slides[activeCarouselSlide].image_url}
                          alt={generatedCarousel.slides[activeCarouselSlide].title}
                          className="w-full max-h-56 object-contain mx-auto"
                        />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-purple-600/90 text-white text-[10px] font-bold">
                          Slide {generatedCarousel.slides[activeCarouselSlide].slide_number} of {generatedCarousel.total_slides}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <h4 className="text-xs font-bold text-white">
                          {generatedCarousel.slides[activeCarouselSlide].title}
                        </h4>
                        <p className="text-[11px] text-purple-300 font-medium">
                          {generatedCarousel.slides[activeCarouselSlide].subtitle}
                        </p>
                        <ul className="text-[10px] text-slate-300 space-y-1 list-disc list-inside">
                          {generatedCarousel.slides[activeCarouselSlide].bullets.map((b, bIdx) => (
                            <li key={bIdx}>{b}</li>
                          ))}
                        </ul>
                        <div className="p-2 rounded-lg bg-white/5 text-[10px] text-amber-200">
                          <strong>Key Takeaway:</strong> {generatedCarousel.slides[activeCarouselSlide].takeaway}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <a
                          href={generatedCarousel.slides[activeCarouselSlide].image_url}
                          download={`slide_${generatedCarousel.slides[activeCarouselSlide].slide_number}.png`}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 hover:bg-white/10 text-slate-300 flex items-center gap-1.5"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download Slide {generatedCarousel.slides[activeCarouselSlide].slide_number}</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleAttachVisualToPost(generatedCarousel.slides[0].image_url)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Attach Carousel to Post</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Complete Scheduling Interface & Autonomous Sentinel Queue */}
      {activeTab === 'scheduler' && (
        <div className="space-y-6">
          
          {/* Scheduling Configuration Form */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">
                  {editingPostId ? 'Edit LinkedIn Schedule' : 'Schedule LinkedIn Post'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Asia/Kolkata & UTC Aware
                </span>
              </div>

              {editingPostId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPostId(null);
                    setSchedContent('');
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Cancel Edit</span>
                </button>
              )}
            </div>

            {/* AI Visual & Carousel Studio */}
            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    <ImageIcon className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-xs font-semibold text-white">AI Visual &amp; Carousel Studio</h3>
                    <p className="text-[10px] text-slate-400">Authentic image generation for posts and multi-slide carousels</p>
                  </div>
                </div>

                <div className="flex bg-slate-900/80 p-1 rounded-xl border border-white/10 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setVisualType('single')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      visualType === 'single'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Single Visual
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisualType('carousel')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                      visualType === 'carousel'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    <span>Carousel</span>
                  </button>
                </div>
              </div>

              {/* Style & Ratio Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Visual Style</label>
                  <select
                    value={imageStyle}
                    onChange={(e) => setImageStyle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                  >
                    {IMAGE_STYLES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {visualType === 'single' ? (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Aspect Ratio</label>
                    <select
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    >
                      {ASPECT_RATIOS.map(r => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Number of Slides</label>
                    <select
                      value={slideCount}
                      onChange={(e) => setSlideCount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value={3}>3 Slides (Concise Summary)</option>
                      <option value={4}>4 Slides (Standard Deep Dive)</option>
                      <option value={5}>5 Slides (Full Masterclass)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Prompt Input */}
              {visualType === 'single' && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Visual Prompt</label>
                  <input
                    type="text"
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="E.g. modern tech system architecture diagram, cloud nodes, glowing cyan"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              {/* Generate Button */}
              <button
                type="button"
                onClick={handleGenerateVisual}
                disabled={isGeneratingVisual || (!topic.trim() && !imagePrompt.trim())}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2"
              >
                {isGeneratingVisual ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{visualType === 'carousel' ? 'Synthesizing Carousel Slides...' : 'Generating AI Visual...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-purple-300" />
                    <span>{visualType === 'carousel' ? `Generate ${slideCount}-Slide Carousel Visuals` : 'Generate AI Image'}</span>
                  </>
                )}
              </button>

              {/* Visual Status Toast */}
              {visualStatusMsg && (
                <div className={`p-2.5 rounded-xl text-[11px] font-medium border ${
                  visualStatusMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  {visualStatusMsg.text}
                </div>
              )}

              {/* Single Visual Result Card */}
              {visualType === 'single' && generatedVisual && (
                <div className="pt-3 border-t border-white/10 space-y-3">
                  <div className="relative rounded-xl overflow-hidden border border-white/10 bg-slate-950">
                    <img
                      src={generatedVisual.image_url}
                      alt={generatedVisual.prompt}
                      className="w-full max-h-64 object-contain mx-auto"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-[10px] text-slate-300 font-mono">
                      {generatedVisual.dimensions} &bull; {(generatedVisual.file_size_bytes / 1024).toFixed(1)} KB
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <a
                      href={generatedVisual.image_url}
                      download={generatedVisual.filename}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 flex items-center gap-1.5 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Image</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleAttachVisualToPost(generatedVisual.image_url)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        attachedMediaUrl === generatedVisual.image_url
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-purple-600 hover:bg-purple-500 text-white'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{attachedMediaUrl === generatedVisual.image_url ? 'Attached to Post' : 'Attach to Post'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Carousel Result Card */}
              {visualType === 'carousel' && generatedCarousel && (
                <div className="pt-3 border-t border-white/10 space-y-3">
                  {/* Slide Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {generatedCarousel.slides.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveCarouselSlide(idx)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium flex-shrink-0 transition-all ${
                          activeCarouselSlide === idx
                            ? 'bg-purple-500 text-slate-950 font-bold shadow'
                            : 'bg-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        Slide {s.slide_number}
                      </button>
                    ))}
                  </div>

                  {/* Active Slide Display */}
                  {generatedCarousel.slides[activeCarouselSlide] && (
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 space-y-3">
                      <div className="relative rounded-lg overflow-hidden border border-white/10 bg-slate-950">
                        <img
                          src={generatedCarousel.slides[activeCarouselSlide].image_url}
                          alt={generatedCarousel.slides[activeCarouselSlide].title}
                          className="w-full max-h-56 object-contain mx-auto"
                        />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-purple-600/90 text-white text-[10px] font-bold">
                          Slide {generatedCarousel.slides[activeCarouselSlide].slide_number} of {generatedCarousel.total_slides}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <h4 className="text-xs font-bold text-white">
                          {generatedCarousel.slides[activeCarouselSlide].title}
                        </h4>
                        <p className="text-[11px] text-purple-300 font-medium">
                          {generatedCarousel.slides[activeCarouselSlide].subtitle}
                        </p>
                        <ul className="text-[10px] text-slate-300 space-y-1 list-disc list-inside">
                          {generatedCarousel.slides[activeCarouselSlide].bullets.map((b, bIdx) => (
                            <li key={bIdx}>{b}</li>
                          ))}
                        </ul>
                        <div className="p-2 rounded-lg bg-white/5 text-[10px] text-amber-200">
                          <strong>Key Takeaway:</strong> {generatedCarousel.slides[activeCarouselSlide].takeaway}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <a
                          href={generatedCarousel.slides[activeCarouselSlide].image_url}
                          download={`slide_${generatedCarousel.slides[activeCarouselSlide].slide_number}.png`}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 hover:bg-white/10 text-slate-300 flex items-center gap-1.5"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download Slide {generatedCarousel.slides[activeCarouselSlide].slide_number}</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleAttachVisualToPost(generatedCarousel.slides[0].image_url)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Attach Carousel to Post</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-5">
              
              {/* Row 1: Platform Selection & Frequency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Platform Selection
                  </label>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-white/10">
                    <Linkedin className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-white">LinkedIn Official UGC API</span>
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                      Active
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Frequency</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'one_time', label: 'One-Time' },
                      { id: 'daily', label: 'Daily' },
                      { id: 'weekly', label: 'Weekly' }
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSchedFrequency(f.id)}
                        className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all ${
                          schedFrequency === f.id
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                            : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 2: Date, Time & Timezone */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <span>Execution Date</span>
                  </label>
                  <input
                    type="date"
                    min={getTodayStr()}
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Execution Time</span>
                  </label>
                  <input
                    type="time"
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    <span>Timezone (Default: Asia/Kolkata)</span>
                  </label>
                  <select
                    value={schedTimezone}
                    onChange={(e) => setSchedTimezone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.id} value={tz.id} className="bg-slate-900 text-white">
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Recurring Boundaries (Start & End Date) */}
              {schedFrequency !== 'one_time' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20">
                  <div>
                    <label className="block text-xs font-medium text-cyan-300 mb-1">
                      Start Date for Recurring Cycle
                    </label>
                    <input
                      type="date"
                      value={schedStartDate}
                      onChange={(e) => setSchedStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-cyan-300 mb-1">
                      Optional End Date for Recurring Cycle
                    </label>
                    <input
                      type="date"
                      min={schedStartDate || schedDate}
                      value={schedEndDate}
                      onChange={(e) => setSchedEndDate(e.target.value)}
                      placeholder="Leave blank for indefinite recurrence"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}

              {/* Row 4: Post Content Preview & Editor */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Post Content Preview & Customization
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {schedContent.length} characters
                  </span>
                </div>
                <textarea
                  value={schedContent}
                  onChange={(e) => setSchedContent(e.target.value)}
                  placeholder="Paste or write the LinkedIn post content here..."
                  rows={5}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 leading-relaxed font-sans"
                />
              </div>

              {/* Hashtags */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Hashtags
                </label>
                <input
                  type="text"
                  value={schedHashtags}
                  onChange={(e) => setSchedHashtags(e.target.value)}
                  placeholder="#AI #Python #SoftwareEngineering"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              {/* Row 5: Policy Toggles (Approval Required & Auto-Publish) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                
                {/* Approval Required Toggle */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="sched_approval"
                    checked={schedApprovalRequired}
                    onChange={(e) => setSchedApprovalRequired(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded bg-slate-800 border-white/20 text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <div>
                    <label htmlFor="sched_approval" className="text-xs font-semibold text-white cursor-pointer flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>Require Human Approval Gate</span>
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      When enabled, post stays in <strong>Pending Approval</strong> and cannot be published until explicitly authorized.
                    </p>
                  </div>
                </div>

                {/* Auto-Publish Toggle (Disabled by default until explicitly enabled) */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="sched_autopublish"
                    checked={schedAutoPublish}
                    onChange={(e) => setSchedAutoPublish(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded bg-slate-800 border-white/20 text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <div>
                    <label htmlFor="sched_autopublish" className="text-xs font-semibold text-white cursor-pointer flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Autonomous Auto-Publish</span>
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Disabled by default. When enabled, the 5-minute autonomous sentinel publishes automatically when due.
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleTriggerSentinelSync}
                  disabled={isSyncingSentinel}
                  className="py-2.5 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
                  title="Force sentinel to check due posts right now"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncingSentinel ? 'animate-spin' : ''}`} />
                  <span>Sync Sentinel Now</span>
                </button>

                <button
                  type="submit"
                  disabled={isSavingSchedule || !schedContent.trim()}
                  className="py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2"
                >
                  {isSavingSchedule ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Schedule...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingPostId ? 'Update Schedule' : 'Save Schedule'}</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>

          {/* Scheduled Posts Queue & History Table */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">Scheduled LinkedIn Queue & Execution Monitor</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10 font-mono">
                  {scheduledPosts.length} posts
                </span>
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'scheduled', label: 'Scheduled' },
                  { id: 'pending_approval', label: 'Pending Approval' },
                  { id: 'published', label: 'Published' },
                  { id: 'paused', label: 'Paused' },
                  { id: 'failed', label: 'Failed' }
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSchedFilter(st.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      schedFilter === st.id
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                        : 'bg-white/5 text-slate-400 border-transparent hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredScheduled.length === 0 ? (
              <div className="py-16 text-center text-slate-500 space-y-2">
                <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs">
                  No {schedFilter !== 'all' ? schedFilter.replace('_', ' ') : ''} LinkedIn posts in queue.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {filteredScheduled.map((post) => (
                  <div
                    key={post.id}
                    className="p-4 rounded-xl bg-slate-900/60 border border-white/5 hover:border-cyan-500/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Status Badge */}
                        <span className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full font-semibold border ${
                          post.status === 'published'
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                            : post.status === 'pending_approval'
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 animate-pulse'
                            : post.status === 'scheduled'
                            ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                            : post.status === 'publishing'
                            ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                            : post.status === 'paused'
                            ? 'bg-slate-700/50 border-white/10 text-slate-300'
                            : post.status === 'failed'
                            ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                            : 'bg-slate-800 text-slate-400 border-white/10'
                        }`}>
                          {post.status.replace('_', ' ')}
                        </span>

                        {/* Frequency Badge */}
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10 capitalize">
                          {post.frequency || 'One-time'}
                        </span>

                        {/* Approval Badge */}
                        {post.approval_required ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            Approval Gate
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/10">
                            Pre-Approved
                          </span>
                        )}

                        {/* Auto-publish Badge */}
                        {post.auto_publish ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            Auto-Publish ON
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/10">
                            Auto-Publish OFF
                          </span>
                        )}
                      </div>

                      {/* Content Snippet */}
                      <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
                        {post.content}
                      </p>

                      {/* Execution Details & Timestamps */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 text-cyan-300">
                          <Clock className="w-3.5 h-3.5" />
                          <span><strong>Next Run:</strong> {formatExecutionTime(post.next_run_at || post.scheduled_for, post.timezone)}</span>
                        </span>
                        {post.error_message && (
                          <span className="text-rose-400 truncate max-w-md">
                            <strong>Notice:</strong> {post.error_message}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                      {/* Approve Button */}
                      {post.status === 'pending_approval' && (
                        <button
                          type="button"
                          onClick={() => handleApprovePost(post.id)}
                          className="py-1.5 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Approve Now</span>
                        </button>
                      )}

                      {/* Pause / Resume */}
                      {post.status === 'scheduled' && (
                        <button
                          type="button"
                          onClick={() => handlePausePost(post.id)}
                          className="py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs flex items-center gap-1"
                          title="Pause schedule"
                        >
                          <Pause className="w-3.5 h-3.5 text-amber-400" />
                          <span>Pause</span>
                        </button>
                      )}

                      {post.status === 'paused' && (
                        <button
                          type="button"
                          onClick={() => handleResumePost(post.id)}
                          className="py-1.5 px-2.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs flex items-center gap-1"
                          title="Resume schedule"
                        >
                          <Play className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Resume</span>
                        </button>
                      )}

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => handleEditSchedule(post)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white"
                        title="Edit schedule"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeletePost(post.id)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 border border-white/10 text-slate-300 hover:text-rose-400"
                        title="Delete schedule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Tab 3: Comment Reply Assistant */}
      {activeTab === 'replies' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span>Smart Comment Reply Assistant</span>
              </h2>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Original Post Context (Optional)
                </label>
                <textarea
                  value={originalPost}
                  onChange={(e) => setOriginalPost(e.target.value)}
                  placeholder="Briefly paste what your post was about..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Incoming Comment
                </label>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="E.g., Great architecture! How do you handle failure recovery in the workflow executor?"
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Reply Strategy</label>
                <div className="flex flex-wrap gap-2">
                  {REPLY_TONES.map((rt) => (
                    <button
                      key={rt.id}
                      type="button"
                      onClick={() => setReplyTone(rt.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        replyTone === rt.id
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {rt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleDraftReply}
                disabled={isReplying || !commentText.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
              >
                {isReplying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Draft Intelligent Reply</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 min-h-[360px] flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">Suggested Reply</span>
                  {replyResult && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(replyResult.reply_text);
                        setCopiedReply(true);
                        setTimeout(() => setCopiedReply(false), 2000);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300 hover:text-white flex items-center gap-1.5"
                    >
                      {copiedReply ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
                      <span>{copiedReply ? 'Copied' : 'Copy Reply'}</span>
                    </button>
                  )}
                </div>

                {replyResult ? (
                  <div className="pt-4 space-y-4">
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                      {replyResult.reply_text}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono">
                        Tone: {replyResult.tone}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center text-slate-500 text-xs">
                    Paste an incoming comment on the left to draft an insightful response.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Official API Diagnostics */}
      {activeTab === 'api' && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-semibold text-white">LinkedIn Official Developer API Status</h2>
            </div>
            <button
              type="button"
              onClick={fetchStatus}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isLoadingStatus ? 'animate-spin' : ''}`} />
              <span>Re-check</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">OAuth Adapter</span>
              <div className="text-sm font-bold text-white font-mono">{apiStatus?.provider || 'LinkedIn REST'}</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Client ID</span>
              <div className="text-sm font-bold text-white font-mono">
                {apiStatus?.client_id_configured ? (
                  <span className="text-emerald-400 flex items-center gap-1">Configured <Check className="w-3.5 h-3.5" /></span>
                ) : (
                  <span className="text-amber-400">Awaiting Credentials</span>
                )}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Client Secret</span>
              <div className="text-sm font-bold text-white font-mono">
                {apiStatus?.client_secret_configured ? (
                  <span className="text-emerald-400 flex items-center gap-1">Configured <Check className="w-3.5 h-3.5" /></span>
                ) : (
                  <span className="text-amber-400">Awaiting Credentials</span>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 space-y-2">
            <h3 className="font-semibold text-white">How to connect LinkedIn Official API:</h3>
            <ol className="list-decimal pl-4 space-y-1 text-slate-300">
              <li>Visit <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noreferrer" className="text-blue-400 underline">LinkedIn Developer Portal</a> and create an app.</li>
              <li>Add the <strong>Share on LinkedIn</strong> and <strong>Sign In with LinkedIn using OpenID Connect</strong> products.</li>
              <li>Set the Authorized Redirect URL to: <code className="text-cyan-300 bg-black/40 px-1 py-0.5 rounded font-mono">{apiStatus?.redirect_uri || 'https://<your-backend>/api/platform/linkedin/oauth/callback'}</code></li>
              <li>Set environment variables <code className="text-cyan-300 font-mono">LINKEDIN_CLIENT_ID</code> and <code className="text-cyan-300 font-mono">LINKEDIN_CLIENT_SECRET</code> on your host.</li>
            </ol>
          </div>
        </div>
      )}

    </div>
  );
}
