import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PLANS = [
  {
    name: "Starter",
    tagline: "For solo practices",
    price: "$199",
    period: "/mo",
    features: ["500 minutes included", "Healthcare Ready", "1 EHR integration"],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Professional",
    tagline: "For growing clinics",
    price: "$499",
    period: "/mo",
    features: ["2,000 minutes included", "Unlimited EHR integrations", "Priority support", "Custom AI voice"],
    cta: "Get Started",
    highlight: true,
  },
  {
    name: "Enterprise",
    tagline: "For hospitals & networks",
    price: "Custom",
    period: "",
    features: ["Unlimited minutes", "Dedicated account manager", "White-labeling", "Custom security protocols"],
    cta: "Contact Sales",
    highlight: false,
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  return (
    <section id="pricing" className="mx-auto max-w-(--container-max) px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold text-[#0f172a] sm:text-[40px]">
          Transparent Pricing for Clinics of All Sizes
        </h2>
        <p className="mt-4 text-lg text-on-surface-variant">
          Choose the plan that fits your practice's volume and integration needs.
        </p>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`relative rounded-2xl border bg-white p-8 ${
              plan.highlight
                ? "border-2 shadow-[0_10px_30px_rgba(15,23,42,0.1)]"
                : "border-outline-variant shadow-[0_4px_20px_rgba(15,23,42,0.05)]"
            }`}
            style={plan.highlight ? { borderColor: "#059669" } : undefined}
          >
            {plan.highlight && (
              <span
                className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: "#059669" }}
              >
                Best Value
              </span>
            )}
            <h3 className="font-display text-lg font-bold text-on-surface">{plan.name}</h3>
            <p className="mt-1 text-sm text-on-surface-variant">{plan.tagline}</p>
            <p className="mt-6 font-display text-4xl font-extrabold text-on-surface">
              {plan.price}
              {plan.period && <span className="text-base font-medium text-on-surface-variant">{plan.period}</span>}
            </p>

            <ul className="mt-6 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-on-surface">
                  <Check size={16} className="mt-0.5 shrink-0" style={{ color: "#059669" }} />
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => navigate("/app")}
              className={`focus-ring mt-8 w-full rounded-lg py-3 text-sm font-semibold transition ${
                plan.highlight ? "text-white hover:brightness-110" : "border border-[#0f172a] text-[#0f172a] hover:bg-surface-container"
              }`}
              style={plan.highlight ? { backgroundColor: "#059669" } : undefined}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
