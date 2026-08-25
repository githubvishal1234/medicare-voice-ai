import { ShieldCheck, Lock, RefreshCw, BadgeCheck } from "lucide-react";

const ITEMS = [
  { icon: ShieldCheck, label: "Healthcare Ready" },
  { icon: BadgeCheck, label: "SOC 2 Type II" },
  { icon: Lock, label: "256-Bit SSL" },
  { icon: RefreshCw, label: "EHR Direct Sync" },
];

export default function TrustStrip() {
  return (
    <section className="border-y border-outline-variant bg-surface-low">
      <div className="mx-auto flex max-w-(--container-max) flex-wrap items-center justify-center gap-x-12 gap-y-4 px-5 py-8 sm:px-8">
        {ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm font-medium text-on-surface-variant">
            <item.icon size={17} />
            {item.label}
          </div>
        ))}
      </div>
    </section>
  );
}
