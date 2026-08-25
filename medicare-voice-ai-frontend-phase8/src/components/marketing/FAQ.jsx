import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const FAQS = [
  {
    q: "Is Medicare Voice AI secure for healthcare use?",
    a: "Yes. All data is encrypted in transit and at rest, access is controlled through role-based permissions, and every action is captured in an audit log.",
  },
  {
    q: "How does it integrate with my EHR?",
    a: "We offer direct native integrations with major EHRs like Epic, Cerner, and athenahealth. For others, we provide a secure API or sync via calendar.",
  },
  {
    q: "Can patients tell they're talking to an AI?",
    a: "Our voice models are tuned for medical terminology and natural conversation. While we disclose the AI nature for transparency, patients find the experience seamless and helpful.",
  },
  {
    q: "What happens if the AI can't answer a question?",
    a: "The system is trained to identify complex or urgent inquiries and can automatically route those calls to your human staff or triage them based on your protocols.",
  },
  {
    q: "How long does setup take?",
    a: "Most clinics are up and running in less than 10 minutes. You just need to route your phone number and connect your calendar.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
      <div className="text-center">
        <h2 className="font-display text-3xl font-bold text-[#0f172a] sm:text-[40px]">
          Frequently Asked Questions
        </h2>
        <p className="mt-4 text-lg text-on-surface-variant">
          Everything you need to know about our AI receptionist and its security & privacy practices.
        </p>
      </div>

      <div className="mt-12 space-y-3">
        {FAQS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={item.q} className="overflow-hidden rounded-xl border border-outline-variant bg-white">
              <button
                onClick={() => setOpenIndex(isOpen ? -1 : i)}
                className="focus-ring flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                aria-expanded={isOpen}
              >
                <span className="font-display text-base font-semibold text-on-surface">{item.q}</span>
                {isOpen ? <Minus size={18} className="shrink-0 text-on-surface-variant" /> : <Plus size={18} className="shrink-0 text-on-surface-variant" />}
              </button>
              {isOpen && (
                <div className="px-5 pb-4 text-sm leading-relaxed text-on-surface-variant">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-10 text-center">
        <a
          href="#contact"
          className="focus-ring inline-block rounded-lg border border-outline-variant px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
        >
          Still have questions? Contact Support
        </a>
      </div>
    </section>
  );
}
