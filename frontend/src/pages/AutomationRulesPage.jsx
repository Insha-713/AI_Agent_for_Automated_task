import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Sparkles, 
  Zap, 
  Play, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw,
  Clock,
  ArrowRight,
  Layers,
  Activity
} from 'lucide-react';

const TRIGGER_EVENTS = [
  { id: 'email_received', label: 'High Priority Email Received' },
  { id: 'job_alert', label: 'Matching Job Opportunity Found' },
  { id: 'schedule_tick', label: 'Scheduled Timer Tick' }
];

const ACTION_TARGETS = [
  { id: 'draft_email_reply', label: 'Draft AI Email Response' },
  { id: 'schedule_ai_call', label: 'Schedule Outgoing Telephony Call' },
  { id: 'execute_workflow', label: 'Trigger Automated Multi-Step Workflow' }
];

export default function AutomationRulesPage() {
  const [activeTab, setActiveTab] = useState('rules');

  const [rules, setRules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // New Rule Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('email_received');
  const [conditionExpr, setConditionExpr] = useState("'urgent' in payload.get('subject', '').lower()");
  const [actionTarget, setActionTarget] = useState('draft_email_reply');
  const [requiresApproval, setRequiresApproval] = useState(false);

  // Test Simulator Form
  const [simEvent, setSimEvent] = useState('email_received');
  const [simPayload, setSimPayload] = useState('{\n  "sender": "partner@techcorp.com",\n  "subject": "Urgent API integration review",\n  "importance": "high"\n}');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState(null);

  const [statusMessage, setStatusMessage] = useState(null);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/platform/rules');
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/platform/rules/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRules();
    fetchLogs();
  }, []);

  const handleToggleRule = async (id) => {
    try {
      const res = await fetch(`/api/platform/rules/${id}/toggle`, { method: 'PATCH' });
      if (res.ok) {
        setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: r.is_active ? 0 : 1 } : r));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteRule = async (id) => {
    try {
      const res = await fetch(`/api/platform/rules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRules(prev => prev.filter(r => r.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateRule = async (e) => {
    e?.preventDefault();
    if (!ruleName.trim()) return;

    try {
      const res = await fetch('/api/platform/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName.trim(),
          trigger_event: triggerEvent,
          trigger_type: triggerEvent,
          condition_expression: conditionExpr.trim(),
          action_target: actionTarget,
          action_type: actionTarget,
          action_payload: {},
          requires_approval: requiresApproval ? 1 : 0,
          is_active: 1,
          is_enabled: 1
        })
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: `Automation rule '${ruleName}' activated!` });
        setRuleName('');
        setShowAddForm(false);
        fetchRules();
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: 'Failed to create automation rule.' });
    }
  };

  const handleSimulateTrigger = async (e) => {
    e?.preventDefault();
    setIsSimulating(true);
    setSimResult(null);
    try {
      const parsed = JSON.parse(simPayload);
      const res = await fetch('/api/platform/rules/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: simEvent,
          payload: parsed
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSimResult(data);
        fetchLogs();
      }
    } catch (e) {
      setSimResult({ error: e.message });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-purple-950/40 border border-white/10 shadow-2xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Sliders className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-white">
              Automation <span className="text-indigo-400">Rule Builder</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              WHEN / THEN Engine
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Define declarative cross-agent event triggers with conditional logic and safety approval gates.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'rules'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Active Rules
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'simulator'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Event Simulator
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'logs'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Execution Logs
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

      {/* Tab 1: Rules List */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Central Automation Triggers</h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10 font-mono">
                {rules.length} rules
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-xs font-semibold text-indigo-300 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{showAddForm ? 'Close' : 'Add Rule'}</span>
            </button>
          </div>

          {/* New Rule Form */}
          {showAddForm && (
            <div className="glass-panel p-5 rounded-2xl border border-indigo-500/40 bg-slate-900/90 space-y-4">
              <h3 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Configure WHEN / THEN Automation Rule</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Rule Name</label>
                  <input
                    type="text"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="E.g. Auto-Draft AI Reply on High Priority Email"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">WHEN Event Occurs</label>
                  <select
                    value={triggerEvent}
                    onChange={(e) => setTriggerEvent(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white"
                  >
                    {TRIGGER_EVENTS.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">IF Condition Expression (Python Expression)</label>
                <input
                  type="text"
                  value={conditionExpr}
                  onChange={(e) => setConditionExpr(e.target.value)}
                  placeholder="'RESUME' in payload.get('comment_text', '').upper()"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-cyan-300 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">THEN Execute Action</label>
                  <select
                    value={actionTarget}
                    onChange={(e) => setActionTarget(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white"
                  >
                    {ACTION_TARGETS.map(a => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 p-2 rounded-xl bg-slate-950 border border-white/10">
                    <input
                      type="checkbox"
                      checked={requiresApproval}
                      onChange={(e) => setRequiresApproval(e.target.checked)}
                      className="rounded border-white/20 text-indigo-500 focus:ring-indigo-500"
                    />
                    <span>Require Human Approval Gate</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-white/5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateRule}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-semibold"
                >
                  Deploy Automation Rule
                </button>
              </div>
            </div>
          )}

          {/* Rules Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((r) => (
              <div key={r.id} className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{r.name}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleRule(r.id)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold transition-all ${
                        r.is_active
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500 border border-white/10'
                      }`}
                    >
                      {r.is_active ? 'ENABLED' : 'PAUSED'}
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-white/5 space-y-1 text-xs">
                    <div className="flex items-center gap-2 text-slate-400">
                      <span className="font-mono text-indigo-400 font-semibold">WHEN:</span>
                      <span className="text-white truncate">{r.trigger_event}</span>
                    </div>
                    {r.condition_expression && (
                      <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
                        <span className="text-amber-400 font-semibold">IF:</span>
                        <span className="text-cyan-300 truncate">{r.condition_expression}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-slate-400">
                      <span className="font-mono text-emerald-400 font-semibold">THEN:</span>
                      <span className="text-white truncate">{r.action_target}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px]">
                    {r.requires_approval ? (
                      <span className="flex items-center gap-1 text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-mono">
                        <ShieldAlert className="w-3 h-3" />
                        <span>Approval Gate Required</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Autonomous Execution</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Triggers event listener</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteRule(r.id)}
                    className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                    title="Delete rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Simulator */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-indigo-400" />
                <span>Simulate Event Trigger</span>
              </h2>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Trigger Event</label>
                <select
                  value={simEvent}
                  onChange={(e) => setSimEvent(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white"
                >
                  {TRIGGER_EVENTS.map(t => (
                    <option key={t.id} value={t.id}>{t.label} ({t.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Event Payload (JSON)</label>
                <textarea
                  value={simPayload}
                  onChange={(e) => setSimPayload(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-cyan-300 font-mono"
                />
              </div>

              <button
                type="button"
                onClick={handleSimulateTrigger}
                disabled={isSimulating}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
              >
                {isSimulating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                <span>Dispatch Event to Rule Engine</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 min-h-[380px] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-xs font-semibold text-white uppercase tracking-wider">Evaluation Engine Output</span>
              </div>

              {simResult ? (
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 rounded-xl bg-slate-900 border border-white/5 space-y-1">
                    <div className="text-slate-400">Trigger: <span className="text-white">{simResult.event}</span></div>
                    <div className="text-slate-400">Evaluated Rules: <span className="text-cyan-300">{simResult.matched_count || 0} matched</span></div>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-950 border border-white/10 text-emerald-400 overflow-x-auto max-h-[260px]">
                    {JSON.stringify(simResult, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="py-24 text-center text-slate-500 text-xs">
                  Dispatch a simulated trigger to preview how rules evaluate.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Execution Logs */}
      {activeTab === 'logs' && (
        <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Rule Dispatch & Execution Logs</h2>
            <button
              type="button"
              onClick={fetchLogs}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
              <span>Refresh</span>
            </button>
          </div>

          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No automation logs recorded yet. Use the Event Simulator to trigger rules.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="pb-2.5 font-medium">Event</th>
                    <th className="pb-2.5 font-medium">Rule ID</th>
                    <th className="pb-2.5 font-medium">Status</th>
                    <th className="pb-2.5 font-medium">Output</th>
                    <th className="pb-2.5 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map((l) => (
                    <tr key={l.id} className="text-slate-300 hover:bg-white/[0.02]">
                      <td className="py-3 font-mono text-indigo-300">{l.trigger_event}</td>
                      <td className="py-3 font-mono text-cyan-300">{l.rule_id}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                          l.status === 'executed'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="py-3 max-w-xs truncate">{l.output_summary}</td>
                      <td className="py-3 text-slate-500 font-mono text-[11px]">
                        {l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : 'Just now'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
