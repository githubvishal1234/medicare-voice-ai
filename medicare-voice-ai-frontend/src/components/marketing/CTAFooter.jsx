import { useNavigate } from "react-router-dom";
import Logo from "../Logo";

export function CTA() {
  const navigate = useNavigate();
  return (
    <section className="bg-[#0f172a] py-20">
      <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
        <h2 className="font-display text-3xl font-bold text-white sm:text-[40px]">
          Ready to Transform Your Practice's Front Desk?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/60">
          Deploy an autonomous medical receptionist in minutes. Seamlessly integrate with your
          existing phone system and EHR.
        </p>
        <button
          onClick={() => navigate("/app")}
          className="focus-ring mt-8 rounded-lg px-7 py-3.5 text-sm font-semibold text-white shadow-sm hover:brightness-110"
          style={{ backgroundColor: "#059669" }}
        >
          Start 14-Day Free Trial
        </button>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-surface-low py-12">
      <div className="mx-auto flex max-w-(--container-max) flex-col items-center gap-6 px-5 text-center sm:px-8 lg:flex-row lg:justify-between lg:text-left">
        <div>
          <Logo />
          <p className="mt-2 text-sm text-on-surface-variant">
            © 2024 Medicare Voice AI. All rights reserved. Healthcare Ready.
          </p>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-on-surface-variant">
          <a href="#privacy" className="focus-ring rounded-sm hover:text-on-surface">Privacy Policy</a>
          <a href="#terms" className="focus-ring rounded-sm hover:text-on-surface">Terms of Service</a>
          <a href="#security" className="focus-ring rounded-sm hover:text-on-surface">Security Compliance</a>
          <a href="#contact" className="focus-ring rounded-sm hover:text-on-surface">Contact Sales</a>
        </nav>
      </div>
    </footer>
  );
}
