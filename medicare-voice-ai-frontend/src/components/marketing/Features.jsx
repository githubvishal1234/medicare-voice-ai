import { PhoneCall, CalendarClock, FileText, Languages, Bell, Stethoscope } from "lucide-react";

const FEATURES = [
  {
    icon: PhoneCall,
    title: "24/7 Call Handling",
    body: "Every call is answered instantly, day or night, with a natural voice tuned for medical terminology.",
  },
  {
    icon: CalendarClock,
    title: "Native Scheduling",
    body: "Books, reschedules, and confirms appointments directly in your calendar — no double entry, no missed slots.",
  },
  {
    icon: FileText,
    title: "Automatic Transcripts",
    body: "Every call is transcribed and summarized with action items, so your staff can review in seconds.",
  },
  {
    icon: Languages,
    title: "Multilingual by Default",
    body: "Fluent in English, Spanish, and more — patients are served in the language they're most comfortable with.",
  },
  {
    icon: Bell,
    title: "Smart Escalation",
    body: "Emergencies and complex billing issues are routed straight to your human staff, instantly and reliably.",
  },
  {
    icon: Stethoscope,
    title: "Clinical Context Aware",
    body: "Pulls patient history from your EHR mid-call to personalize every interaction and reduce back-and-forth.",
  },
];

export default function Features() {
  return (
    <section id="features" className="mx-auto max-w-(--container-max) px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#059669" }}>Features</p>
        <h2 className="mt-3 font-display text-3xl font-bold text-[#0f172a] sm:text-[40px]">
          Everything your front desk needs, none of the wait times
        </h2>
        <p className="mt-4 text-lg text-on-surface-variant">
          Built specifically for clinical workflows — not a generic call center bot.
        </p>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-outline-variant bg-white p-7 shadow-[0_4px_20px_rgba(15,23,42,0.05)] transition-shadow hover:shadow-[0_10px_30px_rgba(15,23,42,0.08)]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: "#f0fdfa" }}>
              <f.icon size={20} style={{ color: "#059669" }} />
            </div>
            <h3 className="mt-5 font-display text-lg font-bold text-on-surface">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
