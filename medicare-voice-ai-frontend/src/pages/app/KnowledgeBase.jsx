import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search, UploadCloud, FileText, Globe, HelpCircle, Trash2,
  CheckCircle2, Loader2, Plus, ExternalLink, X,
} from "lucide-react";
import AppShell from "../../components/AppShell";
import { Card, Chip, Button, Skeleton, ErrorState } from "../../components/ui";
import * as api from "../../lib/api";

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUpdated(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function KnowledgeBase() {
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState([]);
  const [sources, setSources] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [faqDraft, setFaqDraft] = useState({ question: "", answer: "" });
  const [savingFaq, setSavingFaq] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([api.listKBDocuments(), api.listKBSources(), api.listFAQs()])
      .then(([docsData, sourcesData, faqsData]) => {
        if (cancelled) return;
        setDocs(docsData);
        setSources(sourcesData);
        setFaqs(faqsData);
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

  async function handleUpload(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const doc = await api.uploadKBDocument(file);
        setDocs((prev) => [doc, ...prev]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeDoc(id) {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    await api.deleteKBDocument(id);
  }

  async function submitSource(e) {
    e.preventDefault();
    if (!sourceUrl.trim()) return;
    setAddingSource(true);
    try {
      const source = await api.addKBSource(sourceUrl.trim());
      setSources((prev) => [source, ...prev]);
      setSourceUrl("");
    } finally {
      setAddingSource(false);
    }
  }

  async function removeSource(id) {
    setSources((prev) => prev.filter((s) => s.id !== id));
    await api.deleteKBSource(id);
  }

  async function submitFaq(e) {
    e.preventDefault();
    if (!faqDraft.question.trim() || !faqDraft.answer.trim()) return;
    setSavingFaq(true);
    try {
      const faq = await api.addFAQ(faqDraft);
      setFaqs((prev) => [faq, ...prev]);
      setFaqDraft({ question: "", answer: "" });
      setShowFaqForm(false);
    } finally {
      setSavingFaq(false);
    }
  }

  async function removeFaq(id) {
    setFaqs((prev) => prev.filter((f) => f.id !== id));
    await api.deleteFAQ(id);
  }

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => d.name.toLowerCase().includes(q));
  }, [docs, query]);

  const filteredFaqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter((f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q));
  }, [faqs, query]);

  if (error) {
    return (
      <AppShell
        title="Knowledge Base"
        subtitle="What MedVoice AI knows about your clinic — upload documents, add sources, and manage FAQs."
      >
        <ErrorState detail="We couldn't load your knowledge base." onRetry={load} className="py-24" />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Knowledge Base"
      subtitle="What MedVoice AI knows about your clinic — upload documents, add sources, and manage FAQs."
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="Search the knowledge base..."
            className="focus-ring w-full rounded-full border border-outline-variant bg-surface-lowest py-2.5 pl-9 pr-4 text-sm placeholder:text-on-surface-variant/70"
          />
        </div>
        <Chip tone="success" className="ml-auto">
          <CheckCircle2 size={12} /> AI Index Up To Date
        </Chip>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-teal-600" />
            <h2 className="font-display text-base font-bold text-on-surface">Documents</h2>
          </div>
          <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-outline-variant bg-surface-low px-6 py-8 text-center transition-colors hover:border-teal-600/50 hover:bg-teal-600/5">
            {uploading ? (
              <Loader2 size={22} className="animate-spin text-on-surface-variant" />
            ) : (
              <UploadCloud size={22} className="text-on-surface-variant" />
            )}
            <p className="text-sm font-semibold text-on-surface">{uploading ? "Uploading..." : "Upload Clinic Documents"}</p>
            <p className="text-xs text-on-surface-variant">Drag and drop PDFs, or click to browse</p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.doc,.docx"
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>

          <div className="mt-4 space-y-2">
            {loading ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)
            ) : filteredDocs.length === 0 ? (
              <p className="py-6 text-center text-sm text-on-surface-variant">No documents uploaded yet.</p>
            ) : (
              filteredDocs.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-outline-variant px-3.5 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FileText size={15} className="shrink-0 text-on-surface-variant" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-on-surface">{d.name}</p>
                      <p className="text-xs text-on-surface-variant">{formatBytes(d.size_bytes)} · {formatUpdated(d.updated_at)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {d.status === "Indexing" ? (
                      <Chip tone="warning"><Loader2 size={11} className="animate-spin" /> Indexing</Chip>
                    ) : (
                      <Chip tone="success">Indexed</Chip>
                    )}
                    <button
                      onClick={() => removeDoc(d.id)}
                      className="focus-ring rounded-md p-1 text-on-surface-variant hover:bg-surface-container"
                      aria-label={`Remove ${d.name}`}
                    >
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
            <Globe size={16} className="text-teal-600" />
            <h2 className="font-display text-base font-bold text-on-surface">Website Sources</h2>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">
            MedVoice periodically re-crawls these pages to keep answers current.
          </p>
          <form onSubmit={submitSource} className="mt-4 flex gap-2">
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://your-clinic.com/page"
              className="focus-ring w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm"
            />
            <Button type="submit" disabled={addingSource} className="shrink-0 px-3">
              {addingSource ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            </Button>
          </form>
          <div className="mt-4 space-y-2">
            {loading ? (
              [1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)
            ) : sources.length === 0 ? (
              <p className="py-4 text-center text-sm text-on-surface-variant">No website sources added yet.</p>
            ) : (
              sources.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-outline-variant px-3.5 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ExternalLink size={14} className="shrink-0 text-on-surface-variant" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-on-surface">{s.url}</p>
                      <p className="text-xs text-on-surface-variant">Updated {formatUpdated(s.updated_at)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Chip tone={s.status === "Indexing" ? "warning" : "success"}>{s.status}</Chip>
                    <button
                      onClick={() => removeSource(s.id)}
                      className="focus-ring rounded-md p-1 text-on-surface-variant hover:bg-surface-container"
                      aria-label={`Remove ${s.url}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-7 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle size={16} className="text-teal-600" />
              <h2 className="font-display text-base font-bold text-on-surface">FAQs</h2>
            </div>
            <button
              onClick={() => setShowFaqForm((v) => !v)}
              className="focus-ring flex items-center gap-1.5 text-sm font-semibold text-teal-700"
            >
              {showFaqForm ? <X size={14} /> : <Plus size={14} />} {showFaqForm ? "Cancel" : "Add FAQ"}
            </button>
          </div>

          {showFaqForm && (
            <form onSubmit={submitFaq} className="mt-3 space-y-2 rounded-lg border border-outline-variant p-3.5">
              <input
                required
                value={faqDraft.question}
                onChange={(e) => setFaqDraft((d) => ({ ...d, question: e.target.value }))}
                placeholder="Question"
                className="focus-ring w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm"
              />
              <textarea
                required
                rows={2}
                value={faqDraft.answer}
                onChange={(e) => setFaqDraft((d) => ({ ...d, answer: e.target.value }))}
                placeholder="Answer"
                className="focus-ring w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm"
              />
              <Button type="submit" disabled={savingFaq} className="px-3 py-1.5 text-xs">
                {savingFaq ? "Saving..." : "Save FAQ"}
              </Button>
            </form>
          )}

          <div className="mt-3 space-y-2">
            {loading ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)
            ) : filteredFaqs.length === 0 ? (
              <p className="py-4 text-center text-sm text-on-surface-variant">No FAQs yet.</p>
            ) : (
              filteredFaqs.map((f) => (
                <details key={f.id} className="group rounded-lg border border-outline-variant px-3.5 py-2.5">
                  <summary className="focus-ring flex cursor-pointer list-none items-center justify-between text-sm font-medium text-on-surface marker:content-none">
                    {f.question}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        removeFaq(f.id);
                      }}
                      className="focus-ring rounded-md p-1 text-on-surface-variant hover:bg-surface-container"
                      aria-label={`Remove ${f.question}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{f.answer}</p>
                </details>
              ))
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}