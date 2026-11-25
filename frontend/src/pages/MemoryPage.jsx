import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Check, 
  X, 
  Copy, 
  Tag, 
  Code2, 
  Layers 
} from 'lucide-react';

const CATEGORIES = ['all', 'profile', 'career', 'preferences', 'integrations'];

export default function MemoryPage() {
  const [memoryItems, setMemoryItems] = useState([]);
  const [contextData, setContextData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Add Item State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState('profile');
  const [newDesc, setNewDesc] = useState('');

  // Editing State
  const [editingKey, setEditingKey] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  const [statusMessage, setStatusMessage] = useState(null);
  const [copiedContext, setCopiedContext] = useState(false);

  const fetchMemory = async () => {
    setIsLoading(true);
    try {
      const [memRes, ctxRes] = await Promise.all([
        fetch('/api/platform/memory'),
        fetch('/api/platform/memory/context')
      ]);

      if (memRes.ok) {
        const memData = await memRes.json();
        setMemoryItems(memData.items || memData.memory || []);
      }
      if (ctxRes.ok) {
        const ctxData = await ctxRes.json();
        setContextData(ctxData.context || {});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMemory();
  }, []);

  const handleSaveItem = async (e) => {
    e?.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    try {
      const res = await fetch('/api/platform/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: newKey.trim(),
          value: newValue.trim(),
          category: newCategory,
          description: newDesc.trim() || null
        })
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: `Saved memory item '${newKey}'.` });
        setNewKey('');
        setNewValue('');
        setNewDesc('');
        setShowAddForm(false);
        fetchMemory();
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to save memory item.' });
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: e.message || 'Error saving item' });
    }
  };

  const handleUpdateItem = async (item) => {
    try {
      const res = await fetch('/api/platform/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: item.key,
          value: editingValue,
          category: item.category,
          description: item.description
        })
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: `Updated '${item.key}'.` });
        setEditingKey(null);
        fetchMemory();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteItem = async (key) => {
    try {
      const res = await fetch(`/api/platform/memory/${encodeURIComponent(key)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: `Deleted memory item '${key}'.` });
        fetchMemory();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredItems = memoryItems.filter(item => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-violet-950/40 via-slate-900/60 to-cyan-950/40 border border-white/10 shadow-2xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
              <Brain className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-white">
              Central AI <span className="text-violet-400">Memory</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
              Shared Cross-Agent Context
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Persistent profile, writing tone, project URLs, and domain credentials shared seamlessly across all 10 AI agents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchMemory}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-violet-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-xs font-semibold shadow-lg shadow-violet-500/25 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Memory Key</span>
          </button>
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

      {/* Add Memory Modal / Card */}
      {showAddForm && (
        <div className="glass-panel p-5 rounded-2xl border border-violet-500/40 bg-slate-900/90 space-y-4">
          <h3 className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Add Shared Memory Key</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Key Name (e.g. github_url)</label>
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="portfolio_url"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white"
              >
                <option value="profile">profile</option>
                <option value="career">career</option>
                <option value="preferences">preferences</option>
                <option value="integrations">integrations</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Description (Optional)</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Personal portfolio link"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Value (Text / JSON)</label>
            <textarea
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="https://insha-portfolio.vercel.app"
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white font-mono"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3.5 py-1.5 rounded-xl bg-white/5 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveItem}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-xs font-semibold"
            >
              Save Memory Item
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Items Table & Live Context Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Memory Items */}
        <div className="lg:col-span-8 space-y-4">
          <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
            
            {/* Category Filter Pills */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2 border-b border-white/10">
              <div className="flex gap-1.5">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize border transition-all ${
                      selectedCategory === cat
                        ? 'bg-violet-500/20 text-violet-300 border-violet-500/40 shadow-sm'
                        : 'bg-white/5 border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <span className="text-[11px] font-mono text-slate-400">
                {filteredItems.length} keys
              </span>
            </div>

            {/* Items Table */}
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const isEditing = editingKey === item.key;
                return (
                  <div key={item.key} className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 hover:border-violet-500/30 transition-all space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                          {item.key}
                        </span>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                          {item.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(item)}
                              className="p-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                              title="Save changes"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingKey(null)}
                              className="p-1 rounded bg-white/5 text-slate-400 hover:text-white"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingKey(item.key);
                                setEditingValue(item.value);
                              }}
                              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                              title="Edit value"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.key)}
                              className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                              title="Delete key"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <textarea
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        rows={2}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-violet-500/50 text-xs text-white font-mono"
                      />
                    ) : (
                      <div className="text-xs text-slate-300 font-sans break-all">
                        {item.value}
                      </div>
                    )}

                    {item.description && (
                      <div className="text-[11px] text-slate-500 italic">
                        {item.description}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Injected Cross-Agent Context JSON */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-violet-400" />
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Prompt Context Object</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(contextData, null, 2));
                  setCopiedContext(true);
                  setTimeout(() => setCopiedContext(false), 2000);
                }}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                title="Copy Context JSON"
              >
                {copiedContext ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-violet-400" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              This compiled dictionary is injected automatically into every agent's execution prompt:
            </p>
            <pre className="p-3 rounded-xl bg-slate-950 border border-white/10 text-[11px] font-mono text-cyan-300 max-h-[460px] overflow-y-auto custom-scrollbar">
              {JSON.stringify(contextData, null, 2)}
            </pre>
          </div>
        </div>

      </div>

    </div>
  );
}
