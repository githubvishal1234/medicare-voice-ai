import { Database, HeartPulse, CloudCog, FolderCog, CheckCircle2 } from "lucide-react";

const EHRS = [
  { icon: Database, name: "Epic Systems", detail: "Real-time bidirectional sync" },
  { icon: HeartPulse, name: "Oracle Cerner", detail: "Records &amp; clinical summaries".replace("&amp;", "&") },
  { icon: CloudCog, name: "athenahealth", detail: "Scheduled sync every 15 min" },
  { icon: FolderCog, name: "Veradigm", detail: "Voice-to-text workflows" },
];

export default function Integration() {
  return (
    <section id="integration" className="mx-auto max-w-(--container-max) px-5 py-24 sm:px-8">
      <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#059669" }}>Integration</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-[#0f172a] sm:text-[40px]">
            Native to the EHR you already use
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">
            Medicare Voice AI reads and writes directly into your patient records — no manual
            re-entry, no lag between the call ending and your calendar updating.
          </p>
          <ul className="mt-8 space-y-3">
            {["Bidirectional patient demographic sync", "Real-time appointment availability", "Webhooks for custom infrastructure", "REST API for advanced workflows"].map((t) => (
              <li key={t} className="flex items-start gap-3 text-sm text-on-surface">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" style={{ color: "#059669" }} />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {EHRS.map((e) => (
            <div key={e.name} className="rounded-2xl border border-outline-variant bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container">
                <e.icon size={18} className="text-on-surface" />
              </div>
              <p className="mt-4 font-display font-bold text-on-surface">{e.name}</p>
              <p className="mt-1 text-sm text-on-surface-variant">{e.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
