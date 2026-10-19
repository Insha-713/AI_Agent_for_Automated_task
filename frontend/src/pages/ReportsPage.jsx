import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSpreadsheet,
  Upload,
  Download,
  BarChart3,
  TrendingUp,
  Database,
  CheckCircle2,
  AlertCircle,
  FileText,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Layers,
  ShoppingBag,
  GraduationCap,
  Briefcase,
  Copy,
  Check
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const CHART_COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#6366f1'];

export default function ReportsPage() {
  const [samples, setSamples] = useState([]);
  const [selectedSample, setSelectedSample] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('charts'); // 'charts' | 'table' | 'summary'
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Fetch sample datasets on mount
  useEffect(() => {
    fetchSamples();
  }, []);

  const fetchSamples = async () => {
    try {
      const res = await fetch('/api/reports/samples');
      const data = await res.json();
      if (data.samples) {
        setSamples(data.samples);
        if (data.samples.length > 0 && !selectedSample) {
          // Pre-select first sample
          setSelectedSample(data.samples[0].filename);
          analyzeFile(data.samples[0].filename);
        }
      }
    } catch (err) {
      console.error('Failed to load sample datasets:', err);
    }
  };

  const analyzeFile = async (filename) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reports/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw {
          message: data.error || data.detail || 'Failed to analyze file',
          hint: data.hint || 'Please verify that the file exists and is a valid dataset.',
          filename: filename
        };
      }
      setAnalysisResult(data);
    } catch (err) {
      setError({
        message: err.message || 'Failed to analyze dataset',
        hint: err.hint || 'Please verify that the file is properly formatted with headers.',
        filename: err.filename || filename
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/reports/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw {
          message: data.error || data.detail || 'Upload failed',
          hint: data.hint || 'Make sure the uploaded file is a valid .csv or .xlsx table with data.',
          filename: null
        };
      }
      setSelectedSample(null);
      setAnalysisResult(data);
    } catch (err) {
      setError({
        message: err.message || 'Upload failed',
        hint: err.hint || 'Make sure the file format is supported (.csv, .xlsx) and non-empty.',
        filename: null
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCopySummary = () => {
    if (analysisResult?.summary_markdown) {
      navigator.clipboard.writeText(analysisResult.summary_markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadFile = (filename) => {
    window.open(`/api/reports/download/${filename}`, '_blank');
  };

  const getSampleIcon = (cat) => {
    if (cat.includes('Retail') || cat.includes('Business')) return ShoppingBag;
    if (cat.includes('Education') || cat.includes('Career')) return GraduationCap;
    return Briefcase;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display text-white">CSV & Excel Report Engine</h1>
              <p className="text-sm text-slate-400">
                Automated cleaning, KPI extraction, Recharts visualizations & multi-sheet Excel export.
              </p>
            </div>
          </div>
        </div>

        {/* Upload Custom File */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-medium cursor-pointer transition-colors shadow-sm">
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>{uploading ? 'Processing...' : 'Upload CSV / Excel'}</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Preloaded Datasets Selector */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Preloaded Indian Datasets
          </span>
          <span className="text-xs text-slate-500">Click to run full automated audit & report</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {samples.map((s) => {
            const Icon = getSampleIcon(s.category);
            const isSelected = selectedSample === s.filename;
            return (
              <motion.button
                key={s.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSelectedSample(s.filename);
                  analyzeFile(s.filename);
                }}
                className={`text-left p-4 rounded-xl border transition-all glass-panel ${
                  isSelected
                    ? 'border-cyan-500/50 bg-cyan-500/5 shadow-glow-cyan'
                    : 'border-white/10 hover:border-white/20 bg-slate-900/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                    {s.category}
                  </span>
                  <Icon className="w-4 h-4 text-slate-400" />
                </div>
                <h3 className="font-semibold text-sm text-white mb-1">{s.title}</h3>
                <p className="text-xs text-slate-400 line-clamp-2 mb-3">{s.description}</p>
                <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                  <span>Audience: {s.target_audience}</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Error Alert with Friendly Message & Retry */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel shadow-lg"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-rose-200">
                {typeof error === 'object' ? error.message : error}
              </div>
              {typeof error === 'object' && error.hint && (
                <div className="text-xs text-rose-300/80 leading-relaxed">
                  💡 <span className="font-medium text-rose-200">Recommendation:</span> {error.hint}
                </div>
              )}
            </div>
          </div>
          {(typeof error === 'object' && error.filename || selectedSample) && (
            <button
              onClick={() => analyzeFile((typeof error === 'object' && error.filename) || selectedSample)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-xs font-semibold transition-all self-start sm:self-center shrink-0 hover:scale-105 active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5 text-rose-300" />
              <span>Retry Analysis</span>
            </button>
          )}
        </motion.div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="py-20 flex flex-col items-center justify-center space-y-4">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm text-slate-300 font-medium">Cleaning dataset, calculating KPIs & synthesizing report...</p>
        </div>
      )}

      {/* Analysis Results */}
      {!loading && analysisResult && (
        <div className="space-y-6">
          {/* Top Control Bar: File Details & Export Actions */}
          <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60 glass-panel flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  {analysisResult.file_name}
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-normal">
                    Cleaned & Verified
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  {analysisResult.row_count} records • {analysisResult.column_count} dimensions • 100% Free Local Analysis
                </p>
              </div>
            </div>

            {/* Export Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {analysisResult.exports?.xlsx && (
                <button
                  onClick={() => downloadFile(analysisResult.exports.xlsx)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Excel (.xlsx)</span>
                </button>
              )}
              {analysisResult.exports?.csv && (
                <button
                  onClick={() => downloadFile(analysisResult.exports.csv)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Clean CSV</span>
                </button>
              )}
              {analysisResult.exports?.md && (
                <button
                  onClick={() => downloadFile(analysisResult.exports.md)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Summary (.md)</span>
                </button>
              )}
            </div>
          </div>

          {/* Stat Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {analysisResult.charts?.stat_cards?.map((card, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-4 rounded-xl border border-white/10 bg-slate-900/40 glass-panel space-y-1"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-medium">{card.title}</span>
                  {card.icon === 'database' && <Database className="w-4 h-4 text-cyan-400" />}
                  {card.icon === 'check-circle' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {card.icon === 'trending-up' && <TrendingUp className="w-4 h-4 text-violet-400" />}
                </div>
                <div className="text-xl font-bold text-white tracking-tight">
                  {card.value !== null && card.value !== undefined && card.value !== 'NaN' && card.value !== 'nan' ? card.value : 'N/A'}
                </div>
                <div className="text-[11px] text-slate-400">
                  {card.subtitle !== null && card.subtitle !== undefined && card.subtitle !== 'NaN' && card.subtitle !== 'nan' ? card.subtitle : 'N/A'}
                </div>
              </motion.div>
            ))}
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <button
              onClick={() => setActiveTab('charts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'charts'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Interactive Visualizations</span>
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'summary'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Executive Summary</span>
            </button>
            <button
              onClick={() => setActiveTab('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'table'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Data Records Table</span>
            </button>
          </div>

          {/* Tab 1: Charts */}
          {activeTab === 'charts' && (() => {
            const barData = (analysisResult.charts?.bar_chart || []).filter(
              (item) => item.value !== null && item.value !== undefined && !Number.isNaN(item.value)
            );
            const pieData = (analysisResult.charts?.pie_chart || []).filter(
              (item) => item.value !== null && item.value !== undefined && !Number.isNaN(item.value) && item.value > 0
            );
            const lineData = (analysisResult.charts?.line_chart || []).filter(
              (item) => item.value !== null && item.value !== undefined && !Number.isNaN(item.value)
            );

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart: Primary Metric by Group */}
                {barData.length > 0 ? (
                  <div className="p-5 rounded-xl border border-white/10 bg-slate-900/40 glass-panel space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-cyan-400" />
                        <span>{analysisResult.charts.primary_metric?.replace(/_/g, ' ').toUpperCase()} by Segment</span>
                      </h3>
                      <span className="text-[11px] text-slate-400 font-mono">Top contributors</span>
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} angle={-25} textAnchor="end" interval={0} />
                          <YAxis stroke="#94a3b8" fontSize={11} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                            formatter={(val) => [val !== null && val !== undefined && !Number.isNaN(val) ? (typeof val === 'number' ? val.toLocaleString() : val) : 'N/A', 'Total']}
                          />
                          <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]}>
                            {barData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-xl border border-white/10 bg-slate-900/40 glass-panel flex flex-col items-center justify-center h-64 text-slate-500 text-xs">
                    <BarChart3 className="w-8 h-8 mb-2 opacity-40" />
                    <span>No numeric segment data available</span>
                  </div>
                )}

                {/* Pie Chart: Distribution */}
                {pieData.length > 0 ? (
                  <div className="p-5 rounded-xl border border-white/10 bg-slate-900/40 glass-panel space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-violet-400" />
                        <span>Segment Volume Share</span>
                      </h3>
                      <span className="text-[11px] text-slate-400 font-mono">Distribution</span>
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            labelLine={false}
                            fontSize={11}
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`pie-cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                            formatter={(val) => [val !== null && val !== undefined && !Number.isNaN(val) ? val : 'N/A', 'Count']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-xl border border-white/10 bg-slate-900/40 glass-panel flex flex-col items-center justify-center h-64 text-slate-500 text-xs">
                    <TrendingUp className="w-8 h-8 mb-2 opacity-40" />
                    <span>No categorical distribution available</span>
                  </div>
                )}

                {/* Line Chart: Progression / Date Series */}
                {lineData.length > 0 && (
                  <div className="p-5 rounded-xl border border-white/10 bg-slate-900/40 glass-panel space-y-4 lg:col-span-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span>Timeline & Event Progression</span>
                      </h3>
                      <span className="text-[11px] text-slate-400 font-mono">Chronological trend</span>
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lineData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                          <YAxis stroke="#94a3b8" fontSize={11} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                            formatter={(val) => [val !== null && val !== undefined && !Number.isNaN(val) ? (typeof val === 'number' ? val.toLocaleString() : val) : 'N/A', 'Value']}
                          />
                          <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Tab 2: Executive Summary */}
          {activeTab === 'summary' && (
            <div className="p-6 rounded-xl border border-white/10 bg-slate-900/50 glass-panel space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Strategic Executive Synthesis
                </span>
                <button
                  onClick={handleCopySummary}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{copied ? 'Copied Markdown!' : 'Copy Markdown'}</span>
                </button>
              </div>

              <div className="prose prose-invert prose-sm max-w-none space-y-3 text-slate-200">
                <pre className="p-4 rounded-xl bg-slate-950/80 border border-white/5 text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
                  {analysisResult.summary_markdown}
                </pre>
              </div>
            </div>
          )}

          {/* Tab 3: Data Records Preview */}
          {activeTab === 'table' && (
            <div className="p-5 rounded-xl border border-white/10 bg-slate-900/40 glass-panel space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Cleaned Records Preview</h3>
                <span className="text-xs text-slate-400">Showing first 25 rows</span>
              </div>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-800 text-slate-300 border-b border-white/10 z-10">
                    <tr>
                      <th className="py-2 px-3 font-semibold text-slate-400">#</th>
                      {analysisResult.columns?.map((col) => (
                        <th key={col} className="py-2 px-3 font-semibold text-slate-200 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-[11px] text-slate-300">
                    {analysisResult.records_preview?.map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
                        {analysisResult.columns?.map((col) => {
                          const val = row[col];
                          const isNullish = val === null || val === undefined || (typeof val === 'number' && Number.isNaN(val)) || String(val).toLowerCase() === 'nan' || String(val).toLowerCase() === 'none';
                          return (
                            <td key={col} className="py-2 px-3 whitespace-nowrap">
                              {isNullish ? (
                                <span className="text-slate-500 font-medium">N/A</span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
