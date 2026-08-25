import { ShieldCheck, Lock, FileCheck2, UserCog } from "lucide-react";

const POINTS = [
  { icon: ShieldCheck, title: "Data Protection", body: "Built with healthcare-grade privacy and security controls, audited regularly." },
  { icon: Lock, title: "End-to-End Encryption", body: "AES-256 at rest and TLS 1.3 in transit for all patient voice data and transcripts." },
  { icon: FileCheck2, title: "Audit Logs", body: "Every action is recorded in a tamper-evident audit trail you can review anytime." },
  { icon: UserCog, title: "Role-Based Access", body: "Granular, role-based permissions for admins, medical staff, and AI agents." },
];

export default function Security() {
  return (
    <section id="security" className="bg-[#0f172a] py-24">
      <div className="mx-auto max-w-(--container-max) px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-300">Security</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-white sm:text-[40px]">
            Built for high-trust healthcare environments
          </h2>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                <p.icon size={18} className="text-teal-300" />
              </div>
              <h3 className="mt-4 font-display font-bold text-white">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
