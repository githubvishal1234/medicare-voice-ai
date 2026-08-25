import { useCallback, useEffect, useState } from "react";
import { Database, CheckCircle2, Info, Key, Plus, Copy, Trash2, Webhook, X } from "lucide-react";
import AppShell from "../../components/AppShell";
import { Card, Chip, Button, Skeleton, ErrorState } from "../../components/ui";
import * as api from "../../lib/api";

export default function EHRIntegration() {
  const [integrations, setIntegrations] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [webhook, setWebhook] = useState({ endpoint_url: "", events: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [newKeyPlaintext, setNewKeyPlaintext] = useState(null);
  const [webhookUrl, setWebhookUrl] = useState("");

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([api.listEHRIntegrations(), api.listAPIKeys(), api.getWebhook()])
      .then(([ints, keys, hook]) => {
        if (cancelled) return;
        setIntegrations(ints);
        setApiKeys(keys);
        setWebhook(hook);
        setWebhookUrl(hook.endpoint_url || "");
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return load();
  }, [load]);

  async function toggleConnect(integration) {
    const updated = await api.updateEHRIntegration(integration.id, { connected: !integration.connected });
    setIntegrations((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  async function generateKey() {
    const label = window.prompt("Label for this key (e.g. 'Production Application')");
    if (!label) return;
    const created = await api.createAPIKey({ label, environment: "production" });
    setNewKeyPlaintext(created.plaintext_key);
    setApiKeys((prev) => [created, ...prev]);
  }

  async function revokeKey(id) {
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
    await api.revokeAPIKey(id);
  }

  async function saveWebhook() {
    const updated = await api.updateWebhook({ endpoint_url: webhookUrl, events: webhook.events });
    setWebhook(updated);
  }

  function toggleEvent(ev) {
    setWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(ev) ? prev.events.filter((e) => e !== ev) : [...prev.events, ev],
    }));
  }

  if (error) {
    return (
      <AppShell title="EHR Integration Hub" subtitle="Manage seamless bidirectional data flow between Medicare Voice AI and your existing Electronic Health Record systems.">
        <ErrorState detail="We couldn't load your EHR integrations." onRetry={load} className="py-24" />
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell title="EHR Integration Hub" subtitle="Manage seamless bidirectional data flow between Medicare Voice AI and your existing Electronic Health Record systems.">
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="EHR Integration Hub"
      subtitle="Manage seamless bidirectional data flow between Medicare Voice AI and your existing Electronic Health Record systems."
    >
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
        <CheckCircle2 size={16} className="text-green-600" />
        Native Integrations · {integrations.length} Certified Partners
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {integrations.map((e) => (
          <Card key={e.id} hoverable className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container">
                  <Database size={18} className="text-on-surface" />
                </div>
                <div>
                  <p className="font-display font-bold text-on-surface">{e.name}</p>
                  <Chip tone={e.connected ? "success" : "neutral"} className="mt-1">{e.status}</Chip>
                </div>
              </div>
              <Button variant={e.connected ? "outline" : "primary"} className="px-3 py-1.5 text-xs" onClick={() => toggleConnect(e)}>
                {e.connected ? "Manage" : "Configure"}
              </Button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{e.detail}</p>
            {e.note && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-low p-3 text-xs text-on-surface-variant">
                <Info size={14} className="mt-0.5 shrink-0" />
                {e.note}
              </div>
            )}
            {(e.meta1_label || e.meta2_label) && (
              <div className="mt-4 flex gap-6 border-t border-outline-variant pt-3 text-xs">
                {e.meta1_label && (
                  <div>
                    <p className="text-on-surface-variant">{e.meta1_label}</p>
                    <p className="font-semibold text-on-surface">{e.meta1_value}</p>
                  </div>
                )}
                {e.meta2_label && (
                  <div>
                    <p className="text-on-surface-variant">{e.meta2_label}</p>
                    <p className="font-semibold text-on-surface">{e.meta2_value}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key size={16} style={{ color: "#059669" }} />
              <h2 className="font-display text-base font-bold text-on-surface">API Credentials</h2>
            </div>
            <Button className="px-3 py-1.5 text-xs" onClick={generateKey}><Plus size={13} /> Generate Key</Button>
          </div>
          <p className="mt-2 text-sm text-on-surface-variant">
            Use these credentials to authenticate automated requests to the Medicare Voice AI REST API.
          </p>

          {newKeyPlaintext && (
            <div className="mt-4 flex items-start justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs">
              <div className="min-w-0">
                <p className="font-semibold text-amber-900">Copy this key now — it won't be shown again.</p>
                <p className="mt-1 truncate font-mono text-amber-800">{newKeyPlaintext}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  className="focus-ring rounded-md p-1.5 text-amber-700 hover:bg-amber-100"
                  onClick={() => navigator.clipboard?.writeText(newKeyPlaintext)}
                >
                  <Copy size={15} />
                </button>
                <button className="focus-ring rounded-md p-1.5 text-amber-700 hover:bg-amber-100" onClick={() => setNewKeyPlaintext(null)}>
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {apiKeys.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No API keys yet.</p>
            ) : (
              apiKeys.map((k) => (
                <div key={k.id} className="flex items-center justify-between rounded-xl border border-outline-variant p-3.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-on-surface">{k.label}</p>
                      <Chip tone={k.environment === "production" ? "success" : "warning"}>
                        {k.environment === "production" ? "Active" : "Test Data"}
                      </Chip>
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-on-surface-variant">{k.key_prefix}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button className="focus-ring rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container" onClick={() => revokeKey(k.id)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Webhook size={16} style={{ color: "#059669" }} />
            <h2 className="font-display text-base font-bold text-on-surface">Webhooks</h2>
          </div>
          <p className="mt-2 text-sm text-on-surface-variant">
            Listen to real-time events on your Voice AI account, such as completed call transcripts or patient flagged intents.
          </p>
          <label className="mt-4 block text-xs font-semibold text-on-surface-variant">Endpoint URL</label>
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-app.com/webhooks/medvoice"
            className="focus-ring mt-1 w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm"
          />
          <label className="mt-4 block text-xs font-semibold text-on-surface-variant">Events to send</label>
          <div className="mt-2 space-y-2">
            {["transcript.completed", "intent.requires_action", "agent.error"].map((ev) => (
              <label key={ev} className="flex items-center gap-2 text-sm text-on-surface">
                <input
                  type="checkbox"
                  checked={webhook.events.includes(ev)}
                  onChange={() => toggleEvent(ev)}
                  className="h-4 w-4 rounded accent-[#059669]"
                />
                <span className="font-mono text-xs">{ev}</span>
              </label>
            ))}
          </div>
          <Button className="mt-5 w-full" onClick={saveWebhook}>Update Webhook</Button>
        </Card>
      </div>
    </AppShell>
  );
}