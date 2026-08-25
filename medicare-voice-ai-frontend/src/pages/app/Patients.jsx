import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRight, Search, Users } from "lucide-react";
import AppShell from "../../components/AppShell";
import { Card, Chip, Skeleton, EmptyState, ErrorState } from "../../components/ui";
import * as api from "../../lib/api";

export default function Patients() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("search") || "");
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Stay in sync with the URL (the AppShell topbar search navigates here
  // with a `search` param) without fighting the user's own typing in the
  // input below.
  useEffect(() => {
    const fromUrl = searchParams.get("search") || "";
    setQuery(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("search")]);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const handle = setTimeout(() => {
      api
        .listPatients(query || undefined)
        .then((data) => {
          if (cancelled) return;
          setPatients(data);
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setError(true);
          setLoading(false);
        });
    }, 250); // debounce search
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  useEffect(() => {
    return load();
  }, [load]);

  function handleQueryChange(value) {
    setQuery(value);
    setSearchParams(value ? { search: value } : {}, { replace: true });
  }

  return (
    <AppShell title="Patients" subtitle="Every patient your AI receptionist has interacted with.">
      <div className="relative mb-4 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          type="text"
          placeholder="Search by name or MRN..."
          className="focus-ring w-full rounded-full border border-outline-variant bg-surface-lowest py-2.5 pl-9 pr-4 text-sm placeholder:text-on-surface-variant/70"
        />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState detail="We couldn't load your patients." onRetry={load} className="py-20" />
        ) : patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No patients found"
            detail={query ? `No results for "${query}" — try a different name or MRN.` : "No patients yet."}
          />
        ) : (
          <div className="divide-y divide-outline-variant">
            {patients.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/app/patients/${p.id}`)}
                className="focus-ring flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-low"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0f172a] text-sm font-semibold text-white">
                  {p.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-on-surface">{p.name}</p>
                  <p className="truncate text-xs text-on-surface-variant">{p.mrn} · {p.doctor}</p>
                </div>
                <Chip tone="success">{p.status}</Chip>
                <ChevronRight size={18} className="text-on-surface-variant" />
              </button>
            ))}
          </div>
        )}
      </Card>
    </AppShell>
  );
}