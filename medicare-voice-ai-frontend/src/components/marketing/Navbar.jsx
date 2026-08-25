import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Logo from "../Logo";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#integration", label: "Integration" },
  { href: "#security", label: "Security" },
  { href: "#pricing", label: "Pricing" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant/70 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-(--container-max) items-center justify-between px-5 py-4 sm:px-8">
        <Link to="/" className="focus-ring rounded-md">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="focus-ring rounded-sm text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <button
            onClick={() => navigate("/app")}
            className="focus-ring rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate("/app")}
            className="focus-ring rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110"
            style={{ backgroundColor: "#059669" }}
          >
            Book a Live Demo
          </button>
        </div>

        <button
          className="focus-ring rounded-md p-2 text-on-surface lg:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-outline-variant bg-white px-5 py-4 lg:hidden">
          <nav className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="focus-ring rounded-md px-2 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={() => navigate("/app")}
              className="focus-ring rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold hover:bg-surface-container"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate("/app")}
              className="focus-ring rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: "#059669" }}
            >
              Book a Live Demo
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
