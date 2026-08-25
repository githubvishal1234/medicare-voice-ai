import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Logo from "../../components/Logo";
import { Card, Button } from "../../components/ui";
import { useAdminAuth } from "../../lib/adminAuth";
import { ApiError } from "../../lib/adminApi";

export default function AdminLogin() {
  const { signIn } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-low px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <Card className="p-6">
          <h1 className="font-display text-xl font-bold text-on-surface">Platform Admin</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Restricted access. Sign in with your super admin account.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-on-surface">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="focus-ring w-full rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/70"
                placeholder="you@platform.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-on-surface">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="focus-ring w-full rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/70"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
            )}

            <Button type="submit" disabled={submitting} className="w-full" style={{ backgroundColor: "#0f172a" }}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
