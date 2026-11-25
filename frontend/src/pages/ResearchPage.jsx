import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Sparkles, 
  Globe2, 
  Search, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Download, 
  Trash2, 
  RefreshCw,
  Layers,
  ShieldCheck,
  Tag
} from 'lucide-react';

const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'Hindi (हिन्दी)' },
  { id: 'ur', label: 'Urdu (اردو)' }
];

export default function ResearchPage() {
  const [topic, setTopic] = useState('Autonomous Multi-Agent Systems in Enterprise Production: Security, Orchestration, and Human-in-the-Loop Gates');
  const [language, setLanguage] = useState('en');
  const [sourcesCount, setSourcesCount] = useState(5);
  const [includeFactAttribution, setIncludeFactAttribution] = useState(true);

  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [activeDossier, setActiveDossier] = useState(null);

  const [documents, setDocuments] = useState([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const normalizeDossier = (doc) => {
    if (!doc) return null;
    let keyFindings = doc.key_findings;
    if (typeof keyFindings === 'string') {
      try { keyFindings = JSON.parse(keyFindings); } catch (e) { keyFindings = []; }
    }
    let factAttribution = doc.fact_attribution;
    if (typeof factAttribution === 'string') {
      try { factAttribution = JSON.parse(factAttribution); } catch (e) { factAttribution = []; }
    }
    let citations = doc.citations;
    if (typeof citations === 'string') {
      try { citations = JSON.parse(citations); } catch (e) { citations = []; }
    }
    if (!Array.isArray(citations) && Array.isArray(doc.sources)) {
      citations = doc.sources.map(s => ({
        title: s.title || s.source || 'Reference Source',
        url: s.url || '#',
        source: s.source || 'Web Source'
      }));
    }

    return {
      ...doc,
      executive_summary: doc.executive_summary || doc.summary || 'Summary synthesized from live multi-source research.',
      key_findings: Array.isArray(keyFindings) ? keyFindings : [],
      fact_attribution: Array.isArray(factAttribution) ? factAttribution : [],
      citations: Array.isArray(citations) ? citations : []
    };
  };

  const fetchDocuments = async (signal) => {
    setIsLoadingDocs(true);
    try {
      const res = await fetch('/api/platform/research/documents', { signal });
      if (res.ok) {
        const data = await res.json();
        const docs = (data.documents || []).map(normalizeDossier);
        setDocuments(docs);
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchDocuments(controller.signal);
    return () => controller.abort();
  }, []);

  const handleSynthesize = async (e) => {
    e?.preventDefault();
    if (!topic.trim()) return;

    setIsSynthesizing(true);
    setStatusMessage(null);
    try {
      let res = await fetch('/api/platform/research/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          language,
          sources_count: sourcesCount,
          include_fact_attribution: includeFactAttribution
        })
      });

      // Fallback to /research/generate if /research/synthesize is not found
      if (res.status === 404) {
        res = await fetch('/api/platform/research/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic,
            language,
            target_platform: 'article',
            sources_count: sourcesCount,
            include_fact_attribution: includeFactAttribution
          })
        });
      }

      if (res.ok) {
        const data = await res.json();
        const doc = normalizeDossier(data.document || data.dossier);
        setActiveDossier(doc);
        fetchDocuments();
      } else {
        const errData = await res.json().catch(() => ({}));
        setStatusMessage({ type: 'error', text: errData.detail || 'Research synthesis failed.' });
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: e.message || 'Synthesis error' });
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleDeleteDocument = async (id) => {
    try {
      const res = await fetch(`/api/platform/research/documents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== id));
        if (activeDossier?.id === id) setActiveDossier(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportMarkdown = () => {
    if (!activeDossier) return;
    const findings = Array.isArray(activeDossier.key_findings) ? activeDossier.key_findings : [];
    const attributions = Array.isArray(activeDossier.fact_attribution) ? activeDossier.fact_attribution : [];
    const cites = Array.isArray(activeDossier.citations) ? activeDossier.citations : [];

    const content = `# Research Dossier: ${activeDossier.topic}
Language: ${activeDossier.language} | Date: ${new Date().toLocaleDateString()}

## Executive Summary
${activeDossier.executive_summary || activeDossier.summary || 'Summary unavailable.'}

## Key Findings
${findings.map(f => `- ${f}`).join('\n')}

## Fact vs AI Attribution
| Claim | Type | Source / Verification |
|---|---|---|
${attributions.map(a => `| ${a.claim} | ${a.type} | ${a.source || a.verification || 'Synthesized'} |`).join('\n')}

## Citations
${cites.map(c => `- [${c.title}](${c.url}) - ${c.source}`).join('\n')}
`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research_${activeDossier.topic.slice(0, 30).replace(/\s+/g, '_')}.md`;
    a.click();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-teal-950/40 via-slate-900/60 to-cyan-950/40 border border-white/10 shadow-2xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <BookOpen className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-white">
              AI Research & <span className="text-teal-400">Content Agent</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
              Multilingual Dossier (EN / HI / UR)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Multi-source deep research synthesis, citation verification, and rigorous fact vs. AI claim attribution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeDossier && (
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="px-3.5 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-xs font-semibold text-teal-300 transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Dossier (MD)</span>
            </button>
          )}
        </div>
      </div>

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

      {/* Synthesis Configuration */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-400" />
          <span>Launch Deep Synthesis</span>
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Research Topic or Scientific Question</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Language */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Synthesis Language</span>
              </label>
              <div className="flex gap-2">
                {LANGUAGES.map(l => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLanguage(l.id)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      language === l.id
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Depth */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Source Depth</label>
              <select
                value={sourcesCount}
                onChange={(e) => setSourcesCount(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs text-white"
              >
                <option value={3}>Fast (3 Primary Sources)</option>
                <option value={5}>Balanced (5 Multi-Sources)</option>
                <option value={10}>Comprehensive (10 Multi-Sources)</option>
              </select>
            </div>

            {/* Fact Attribution Toggle */}
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 p-2 rounded-lg bg-slate-900/60 border border-white/5">
                <input
                  type="checkbox"
                  checked={includeFactAttribution}
                  onChange={(e) => setIncludeFactAttribution(e.target.checked)}
                  className="rounded border-white/20 text-teal-500 focus:ring-teal-500"
                />
                <span>Include Fact vs AI Attribution</span>
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSynthesize}
            disabled={isSynthesizing || !topic.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-teal-500/25 transition-all flex items-center justify-center gap-2"
          >
            {isSynthesizing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Aggregating Sources & Synthesizing Dossier...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Synthesize Multi-Source Research Dossier</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Active Dossier View */}
      {activeDossier && (
        <div className="glass-panel p-6 rounded-2xl border border-teal-500/30 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/10">
            <div>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Language: {activeDossier.language}
              </span>
              <h2 className="text-lg font-bold text-white mt-1 font-display">{activeDossier.topic}</h2>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 space-y-2">
            <span className="text-xs font-semibold text-teal-300 uppercase tracking-wider font-mono">Executive Summary</span>
            <p className="text-xs text-slate-200 leading-relaxed font-sans">{activeDossier.executive_summary}</p>
          </div>

          {/* Key Findings */}
          {Array.isArray(activeDossier.key_findings) && activeDossier.key_findings.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-white uppercase tracking-wider">Key Findings & Takeaways</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {activeDossier.key_findings.map((finding, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-900/40 border border-white/5 text-xs text-slate-300 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                    <span>{finding}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fact vs AI Attribution Table */}
          {Array.isArray(activeDossier.fact_attribution) && activeDossier.fact_attribution.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-white uppercase tracking-wider">Fact vs. AI Claim Attribution Matrix</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 border-b border-white/10 text-slate-400">
                    <tr>
                      <th className="p-3 font-medium">Claim</th>
                      <th className="p-3 font-medium">Type</th>
                      <th className="p-3 font-medium">Verification / Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-slate-950/40">
                    {activeDossier.fact_attribution.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="p-3 text-slate-200">{item.claim}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono font-semibold ${
                            item.type === 'fact' 
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                              : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 font-mono text-[11px]">{item.source || item.verification || 'Synthesized'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Citations List */}
          {Array.isArray(activeDossier.citations) && activeDossier.citations.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Source Citations</span>
              <div className="space-y-1.5">
                {activeDossier.citations.map((cite, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5 flex items-center justify-between text-xs">
                    <span className="text-white font-medium">{cite.title}</span>
                    <a
                      href={cite.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 underline font-mono text-[11px] flex items-center gap-1"
                    >
                      <span>{cite.source}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Previously Synthesized Documents History */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Synthesized Research Library</h2>
          <button
            type="button"
            onClick={fetchDocuments}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isLoadingDocs ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No research dossiers saved yet. Enter a topic above to begin.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => setActiveDossier(doc)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                  activeDossier?.id === doc.id
                    ? 'bg-teal-500/10 border-teal-500/40 shadow-glow-cyan'
                    : 'bg-slate-900/60 border-white/5 hover:border-teal-500/30'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300">
                      {doc.language}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDocument(doc.id);
                      }}
                      className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h3 className="text-xs font-semibold text-white line-clamp-2">{doc.topic}</h3>
                  <p className="text-[11px] text-slate-400 line-clamp-3">{doc.executive_summary}</p>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Recent'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
