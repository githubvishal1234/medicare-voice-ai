import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic2, GitBranch, BookOpen, RefreshCw, Plus, Trash2, Info, ArrowRight } from "lucide-react";
import AppShell from "../../components/AppShell";
import { Card, Button, Chip, Skeleton, ErrorState } from "../../components/ui";
import * as api from "../../lib/api";

const VOICES = [
  { name: "Dr. Sarah (Calm, Professional)", note: "Recommended for general reception" },
  { name: "Mark (Clear, Authoritative)", note: "Recommended for billing inquiries" },
];

export default function AgentSettings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState({ voice_profile: "", greeting_script: "" });
  const [rules, setRules] = useState([]);
  const [docCount, setDocCount] = useState(0);
  const [ehrIntegration, setEhrIntegration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleDraft, setRuleDraft] = useState({ title: "", detail: "" });
  const [savingRule, setSavingRule] = useState(false);

  const loadAll = useCallback(() => {
    setLoading(true);
    setError(false);
    return Promise.all([
      api.getAgentSettings(),
      api.listRoutingRules(),
      api.listKBDocuments(),
      api.listEHRIntegrations(),
    ])
      .then(([settingsData, rulesData, docsData, ehrData]) => {
        setSettings(settingsData);
        setDraft({ voice_profile: settingsData.voice_profile, greeting_script: settingsData.greeting_script });
        setRules(rulesData);
        setDocCount(docsData.length);
        setEhrIntegration(ehrData[0] || null);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadAll().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  function discard() {
    if (settings) setDraft({ voice_profile: settings.voice_profile, greeting_script: settings.greeting_script });
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updateAgentSettings(draft);
      setSettings(updated);
      setDraft({ voice_profile: updated.voice_profile, greeting_script: updated.greeting_script });
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule) {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)));
    await api.updateRoutingRule(rule.id, { enabled: !rule.enabled });
  }

  async function removeRule(id) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    await api.deleteRoutingRule(id);
  }

  async function submitRule(e) {
    e.preventDefault();
    if (!ruleDraft.title.trim()) return;
    setSavingRule(true);
    try {
      const rule = await api.createRoutingRule(ruleDraft);
      setRules((prev) => [...prev, rule]);
      setRuleDraft({ title: "", detail: "" });
      setShowRuleForm(false);
    } finally {
      setSavingRule(false);
    }
  }

  const dirty =
    settings && (draft.voice_profile !== settings.voice_profile || draft.greeting_script !== settings.greeting_script);

  if (error) {
    return (
      <AppShell title="AI Agent Settings" subtitle="Configure MedVoice AI behaviors, knowledge, and integrations.">
        <ErrorState detail="We couldn't load your agent settings." onRetry={loadAll} className="py-24" />
      </AppShell>
    );
  }

  return (
    <AppShell title="AI Agent Settings" subtitle="Configure MedVoice AI behaviors, knowledge, and integrations.">
      <div className="mb-6 flex justify-end gap-3">
        <Button variant="outline" onClick={discard} disabled={!dirty || saving}>Discard Changes</Button>
        <Button onClick={save} disabled={!dirty || saving}>{saving ? "Saving..." : "Save Configuration"}</Button>
      </div>

      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Mic2 size={16} style={{ color: "#059669" }} />
            <h2 className="font-display text-base font-bold text-on-surface">Greeting &amp; Voice</h2>
          </div>

          {loading ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              <p className="mt-4 text-xs font-semibold text-on-surface-variant">Voice Profile</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {VOICES.map((v) => (
                  <button
                    key={v.name}
                    onClick={() => setDraft((d) => ({ ...d, voice_profile: v.name }))}
                    className={`focus-ring rounded-xl border p-4 text-left transition-colors ${draft.voice_profile === v.name ? "border-[#059669] bg-[#f0fdfa]/40" : "border-outline-variant hover:bg-surface-low"}`}
                  >
                    <p className="text-sm font-semibold text-on-surface">{v.name}</p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">{v.note}</p>
                  </button>
                ))}
              </div>

              <label className="mt-5 block text-xs font-semibold text-on-surface-variant">Initial Greeting Script</label>
              <textarea
                rows={3}
                value={draft.greeting_script}
                onChange={(e) => setDraft((d) => ({ ...d, greeting_script: e.target.value }))}
                className="focus-ring mt-1 w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2.5 text-sm"
              />
            </>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2">
            <GitBranch size={16} style={{ color: "#059669" }} />
            <h2 className="font-display text-base font-bold text-on-surface">Routing Protocols</h2>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">Define when MedVoice should escalate calls to human staff.</p>
          <div className="mt-4 space-y-3">
            {loading ? (
              [1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)
            ) : rules.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No routing rules configured yet.</p>
            ) : (
              rules.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-outline-variant p-3.5">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{r.title}</p>
                    {r.detail && <p className="text-xs text-on-surface-variant">{r.detail}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={() => toggleRule(r)}
                      className="h-4 w-4 rounded accent-[#059669]"
                    />
                    <button
                      onClick={() => removeRule(r.id)}
                      className="focus-ring rounded-md p-1 text-on-surface-variant hover:bg-surface-container"
                      aria-label={`Remove ${r.title}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {showRuleForm ? (
            <form onSubmit={submitRule} className="mt-3 space-y-2 rounded-xl border border-outline-variant p-3.5">
              <input
                required
                value={ruleDraft.title}
                onChange={(e) => setRuleDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Rule title (e.g. Medical Emergencies)"
                className="focus-ring w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm"
              />
              <input
                value={ruleDraft.detail}
                onChange={(e) => setRuleDraft((d) => ({ ...d, detail: e.target.value }))}
                placeholder="Detail (e.g. Keywords: pain, bleeding, urgent, 911)"
                className="focus-ring w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={savingRule} className="px-3 py-1.5 text-xs">
                  {savingRule ? "Adding..." : "Add Rule"}
                </Button>
                <button
                  type="button"
                  onClick={() => setShowRuleForm(false)}
                  className="focus-ring rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowRuleForm(true)}
              className="focus-ring mt-3 flex items-center gap-2 text-sm font-semibold"
              style={{ color: "#059669" }}
            >
              <Plus size={15} /> Add Custom Rule
            </button>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen size={16} style={{ color: "#059669" }} />
              <h2 className="font-display text-base font-bold text-on-surface">Knowledge Base</h2>
            </div>
            <button
              onClick={() => navigate("/app/knowledge-base")}
              className="focus-ring flex items-center gap-1 text-sm font-semibold"
              style={{ color: "#059669" }}
            >
              Manage <ArrowRight size={14} />
            </button>
          </div>
          {loading ? (
            <Skeleton className="mt-4 h-10 w-48" />
          ) : (
            <p className="mt-3 text-sm text-on-surface-variant">
              {docCount} document{docCount === 1 ? "" : "s"} indexed. Upload files, add website sources, and manage FAQs from the Knowledge Base page.
            </p>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2">
            <RefreshCw size={16} style={{ color: "#059669" }} />
            <h2 className="font-display text-base font-bold text-on-surface">EHR Integration</h2>
          </div>
          {loading ? (
            <Skeleton className="mt-4 h-16 w-full rounded-xl" />
          ) : ehrIntegration ? (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-outline-variant p-3.5">
              <div>
                <p className="text-sm font-semibold text-on-surface">{ehrIntegration.name}</p>
                <Chip tone={ehrIntegration.connected ? "success" : "neutral"} className="mt-1">{ehrIntegration.status}</Chip>
              </div>
              <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={() => navigate("/app/ehr")}>
                Manage Integration
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-on-surface-variant">No EHR system connected yet.</p>
          )}
          <div className="mt-3 flex items-start gap-2 text-xs text-on-surface-variant">
            <Info size={14} className="mt-0.5 shrink-0" />
            Changes to EHR integration settings may require up to 5 minutes to propagate across active MedVoice instances.
          </div>
        </Card>
      </div>
    </AppShell>
  );
}