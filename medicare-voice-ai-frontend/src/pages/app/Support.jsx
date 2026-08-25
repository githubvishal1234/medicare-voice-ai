import { useEffect, useState } from "react";
import {
  MessageCircle, BookOpen, Mail, Send, ChevronRight,
  LifeBuoy, Clock, ExternalLink,
} from "lucide-react";
import AppShell from "../../components/AppShell";
import { Card, Button, Skeleton } from "../../components/ui";
import * as api from "../../lib/api";

export default function Support() {
  const [subject, setSubject] = useState("Technical Issue");
  const [priority, setPriority] = useState("Normal");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [docsLinks, setDocsLinks] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getSupportDocs()
      .then((data) => {
        if (cancelled) return;
        setDocsLinks(data);
        setDocsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDocsError(true);
        setDocsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e) {
    e.preventDefault();
    setSending(true);
    try {
      await api.createSupportTicket({ subject, priority, message });
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell
      title="Support"
      subtitle="Get help from our team, or find answers in the documentation."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <Card hoverable className="flex flex-col p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-info-bg">
            <MessageCircle size={20} className="text-info" />
          </div>
          <h2 className="mt-4 font-display text-base font-bold text-on-surface">Live Chat</h2>
          <p className="mt-1 flex-1 text-sm text-on-surface-variant">
            Chat with our support team in real time. Typical response time under 3 minutes.
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Online now
          </div>
          <Button className="mt-4">Start Chat</Button>
        </Card>

        <Card hoverable className="flex flex-col p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container">
            <BookOpen size={20} className="text-on-surface" />
          </div>
          <h2 className="mt-4 font-display text-base font-bold text-on-surface">Documentation</h2>
          <p className="mt-1 flex-1 text-sm text-on-surface-variant">
            Guides and references for configuring your AI receptionist and integrations.
          </p>
          <Button variant="outline" className="mt-4">
            Browse Docs <ExternalLink size={14} />
          </Button>
        </Card>

        <Card hoverable className="flex flex-col p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container">
            <LifeBuoy size={20} className="text-on-surface" />
          </div>
          <h2 className="mt-4 font-display text-base font-bold text-on-surface">Priority Support</h2>
          <p className="mt-1 flex-1 text-sm text-on-surface-variant">
            Professional plan includes phone support for urgent, patient-facing issues.
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
            <Clock size={13} /> Avg. response: 12 min
          </div>
          <Button variant="outline" className="mt-4">Call Us</Button>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-teal-600" />
            <h2 className="font-display text-base font-bold text-on-surface">Contact Us</h2>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">
            Send a message and we'll get back to you by email.
          </p>

          {sent ? (
            <div className="mt-5 flex items-center gap-3 rounded-xl bg-success-bg p-4">
              <Send size={16} className="shrink-0 text-success" />
              <p className="text-sm font-medium text-success">
                Message sent — our team will reply within one business day.
              </p>
            </div>
          ) : (
            <form className="mt-5 space-y-4" onSubmit={submit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-on-surface-variant">Subject</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="focus-ring w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2.5 text-sm"
                  >
                    <option>Technical Issue</option>
                    <option>Billing Question</option>
                    <option>EHR Integration</option>
                    <option>Feature Request</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-on-surface-variant">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="focus-ring w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2.5 text-sm"
                  >
                    <option>Normal</option>
                    <option>Urgent — Patient Impact</option>
                    <option>Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">Message</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe the issue or question..."
                  className="focus-ring w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2.5 text-sm"
                />
              </div>
              <Button type="submit" disabled={sending}>
                <Send size={14} /> {sending ? "Sending..." : "Send Message"}
              </Button>
            </form>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-base font-bold text-on-surface">Documentation</h2>
          <div className="mt-4 space-y-1">
            {docsLoading ? (
              [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)
            ) : docsError ? (
              <p className="py-4 text-center text-sm text-on-surface-variant">Couldn't load documentation links.</p>
            ) : (
              docsLinks.map((d) => (
                <button
                  key={d.title}
                  className="focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-low"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-on-surface">{d.title}</p>
                    <p className="truncate text-xs text-on-surface-variant">{d.detail}</p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-on-surface-variant" />
                </button>
              ))
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}