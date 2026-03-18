import { useEffect, useState } from "react";

import { formatDateTime, formatNumber, truncate } from "../lib/format";
import type {
  ClawHubCatalogItem,
  ClawHubCatalogResponse,
  ManagedSkillsSnapshot,
  OpenClawSkillsSnapshot,
  SkillActionResult,
  SkillDetailRecord,
  SkillInstallResult
} from "../types/contracts";

const emptySkills: OpenClawSkillsSnapshot = {
  workspaceDir: "",
  managedSkillsDir: "",
  skills: []
};

const emptyManaged: ManagedSkillsSnapshot = {
  managedSkillsDir: "",
  workdir: "",
  skills: []
};

const quickQueries = ["calendar", "github", "automation", "finance"];

export function SkillMarketplacePanel() {
  const [skills, setSkills] = useState<OpenClawSkillsSnapshot>(emptySkills);
  const [managed, setManaged] = useState<ManagedSkillsSnapshot>(emptyManaged);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClawHubCatalogItem[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [loadingManaged, setLoadingManaged] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SkillDetailRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const otherLocalSkills = skills.skills.filter(
    (skill) =>
      !skill.bundled &&
      !managed.skills.some((managedSkill) => managedSkill.slug === skill.name)
  );
  const readySkills = skills.skills.filter((skill) => skill.eligible).length;

  useEffect(() => {
    void refreshAll();
  }, []);

  const refreshAll = async () => {
    await Promise.all([refreshLocalSkills(), refreshManagedSkills()]);
  };

  const refreshLocalSkills = async () => {
    setLoadingSkills(true);

    try {
      const response = await fetch("/api/skills/openclaw");
      if (!response.ok) {
        throw new Error("Failed to load local skills.");
      }

      const data = (await response.json()) as OpenClawSkillsSnapshot;
      setError(null);
      setSkills(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load skills.");
    } finally {
      setLoadingSkills(false);
    }
  };

  const refreshManagedSkills = async () => {
    setLoadingManaged(true);

    try {
      const response = await fetch("/api/skills/managed");
      if (!response.ok) {
        throw new Error("Failed to load managed skills.");
      }

      const data = (await response.json()) as ManagedSkillsSnapshot;
      setError(null);
      setManaged(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load managed skills."
      );
    } finally {
      setLoadingManaged(false);
    }
  };

  const runSearch = async (nextQuery: string) => {
    const trimmed = nextQuery.trim();
    setQuery(trimmed);
    setSearching(true);
    setError(null);

    try {
      if (!trimmed) {
        setResults([]);
        return;
      }

      const response = await fetch(
        `/api/skills/catalog?query=${encodeURIComponent(trimmed)}&limit=8`
      );
      if (!response.ok) {
        throw new Error("ClawHub search failed.");
      }

      const data = (await response.json()) as ClawHubCatalogResponse;
      setResults(data.items);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const installSkill = async (item: ClawHubCatalogItem) => {
    setBusyKey(`install:${item.slug}`);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/skills/install", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slug: item.slug,
          version: item.latestVersion
        })
      });

      const result = (await parseActionResponse<SkillInstallResult>(response)) as SkillInstallResult;
      setStatusMessage(result.message);
      await refreshAll();

      if (query.trim()) {
        await runSearch(query);
      }
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : "Install failed.");
    } finally {
      setBusyKey(null);
    }
  };

  const updateSkill = async (slug: string, version?: string | null) => {
    setBusyKey(`update:${slug}`);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/skills/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slug,
          version: version ?? undefined
        })
      });

      const result = (await parseActionResponse<SkillActionResult>(response)) as SkillActionResult;
      setStatusMessage(result.message);
      await refreshAll();

      if (detail?.slug === slug && detail.source === "managed") {
        await loadManagedDetail(slug);
      }
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Update failed.");
    } finally {
      setBusyKey(null);
    }
  };

  const uninstallSkill = async (slug: string) => {
    setBusyKey(`uninstall:${slug}`);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/skills/uninstall", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slug
        })
      });

      const result = (await parseActionResponse<SkillActionResult>(response)) as SkillActionResult;
      setStatusMessage(result.message);
      await refreshAll();

      if (detail?.slug === slug && detail.source === "managed") {
        setDetail(null);
      }

      if (query.trim()) {
        await runSearch(query);
      }
    } catch (uninstallError) {
      setError(uninstallError instanceof Error ? uninstallError.message : "Uninstall failed.");
    } finally {
      setBusyKey(null);
    }
  };

  const loadCatalogDetail = async (slug: string) => {
    setDetailLoading(true);
    setDetailError(null);

    try {
      const response = await fetch(`/api/skills/catalog/${encodeURIComponent(slug)}`);
      if (!response.ok) {
        throw new Error("Failed to load skill detail.");
      }

      const data = (await response.json()) as SkillDetailRecord;
      setDetail(data);
    } catch (loadError) {
      setDetailError(
        loadError instanceof Error ? loadError.message : "Unable to load skill detail."
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const loadManagedDetail = async (slug: string) => {
    setDetailLoading(true);
    setDetailError(null);

    try {
      const response = await fetch(`/api/skills/managed/${encodeURIComponent(slug)}`);
      if (!response.ok) {
        throw new Error("Failed to load installed skill content.");
      }

      const data = (await response.json()) as SkillDetailRecord;
      setDetail(data);
    } catch (loadError) {
      setDetailError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load installed skill content."
      );
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="pixel-label">Skill Market</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">
            Manage ClawHub skills end to end
          </h2>
        </div>
        <button
          type="button"
          className="rounded-none border-2 border-ink/15 bg-[#15101d] px-3 py-2 text-xs uppercase tracking-[0.18em] text-ink shadow-pixel"
          onClick={() => void refreshAll()}
        >
          Refresh
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <StatCard
          label="Ready skills"
          value={formatNumber(readySkills)}
          note="OpenClaw reports these as eligible now."
        />
        <StatCard
          label="Managed installs"
          value={formatNumber(managed.skills.length)}
          note={`Stored in ${truncate(managed.managedSkillsDir || "~/.openclaw/skills", 42)}`}
        />
      </div>

      <form
        className="mt-5 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch(query);
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1 rounded-none border-2 border-ink/20 bg-[#0f0c15] px-4 py-3 text-sm text-ink shadow-pixel outline-none transition focus:border-teal"
            placeholder="Search ClawHub skills like calendar, github, automation..."
          />
          <button
            type="submit"
            className="rounded-none border-2 border-ink bg-coral px-5 py-3 text-sm font-bold uppercase tracking-[0.2em] text-[#14090a] shadow-pixel"
            disabled={searching}
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickQueries.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded-none border-2 border-ink/15 bg-[#14101c] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-ink/70"
              onClick={() => void runSearch(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </form>

      {statusMessage ? (
        <div className="mt-4 rounded-none border-2 border-teal bg-teal/10 px-4 py-3 text-sm text-teal">
          {statusMessage}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-none border-2 border-coral bg-coral/10 px-4 py-3 text-sm text-coral">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-ink/55">
              Managed installs
            </p>
            <div className="mt-3 space-y-3">
              {loadingManaged ? (
                <EmptyState message="Loading managed skills..." />
              ) : null}

              {!loadingManaged && managed.skills.length === 0 ? (
                <EmptyState message="No ClawHub-managed installs yet. Search below and install one." />
              ) : null}

              {managed.skills.map((skill) => (
                <article
                  key={skill.slug}
                  className="rounded-none border-2 border-ink/15 bg-[#14101c] p-4 shadow-pixel"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-ink">{skill.slug}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink/50">
                        {skill.version ?? "unknown version"}
                      </p>
                    </div>
                    <span className="rounded-none border-2 border-mint/45 bg-mint/15 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-mint">
                      installed
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-ink/65">
                    {truncate(skill.installPath, 84)}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <ActionButton
                      label="View SKILL.md"
                      tone="paper"
                      disabled={!skill.hasSkillFile || detailLoading}
                      onClick={() => void loadManagedDetail(skill.slug)}
                    />
                    <ActionButton
                      label={
                        busyKey === `update:${skill.slug}` ? "Updating..." : "Update"
                      }
                      tone="teal"
                      disabled={busyKey !== null}
                      onClick={() => void updateSkill(skill.slug, skill.version)}
                    />
                    <ActionButton
                      label={
                        busyKey === `uninstall:${skill.slug}`
                          ? "Removing..."
                          : "Uninstall"
                      }
                      tone="coral"
                      disabled={busyKey !== null}
                      onClick={() => void uninstallSkill(skill.slug)}
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-ink/55">
              Search results
            </p>
            <div className="mt-3 space-y-3">
              {!searching && query.trim() && results.length === 0 ? (
                <EmptyState message={`No catalog matches for "${query}".`} />
              ) : null}

              {!query.trim() ? (
                <EmptyState message="Search ClawHub to fetch installable skills, inspect SKILL.md, and install them into OpenClaw." />
              ) : null}

              {results.map((item) => (
                <article
                  key={item.slug}
                  className="rounded-none border-2 border-ink/15 bg-[#14101c] p-4 shadow-pixel"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-ink">{item.displayName}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink/50">
                        {item.slug}
                        {item.ownerHandle ? ` by ${item.ownerHandle}` : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-none border-2 px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                        item.installed
                          ? "border-mint/45 bg-mint/15 text-mint"
                          : "border-ink/20 bg-[#0f0c15] text-ink"
                      }`}
                    >
                      {item.installed ? "installed" : "catalog"}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-ink/75">
                    {truncate(item.summary, 180)}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs uppercase tracking-[0.16em] text-ink/55">
                    <span>Version {item.latestVersion ?? "--"}</span>
                    <span>Score {item.score?.toFixed(3) ?? "--"}</span>
                    <span>Downloads {formatNumber(item.downloads ?? 0)}</span>
                    <span>Stars {formatNumber(item.stars ?? 0)}</span>
                    <span>Installs {formatNumber(item.installsCurrent ?? 0)}</span>
                    <span>Updated {formatDateTime(item.updatedAt)}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <ActionButton
                      label="View SKILL.md"
                      tone="paper"
                      disabled={detailLoading}
                      onClick={() => void loadCatalogDetail(item.slug)}
                    />
                    <ActionButton
                      label={
                        busyKey === `install:${item.slug}` ? "Installing..." : "Install"
                      }
                      tone="teal"
                      disabled={item.installed || busyKey !== null}
                      onClick={() => void installSkill(item)}
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-ink/55">
              Other local skills
            </p>
            <div className="mt-3 space-y-3">
              {loadingSkills ? <EmptyState message="Loading OpenClaw skill inventory..." /> : null}

              {!loadingSkills && otherLocalSkills.length === 0 ? (
                <EmptyState message="No other local workspace or personal skills were detected." />
              ) : null}

              {otherLocalSkills.map((skill) => (
                <article
                  key={skill.name}
                  className="rounded-none border-2 border-ink/15 bg-[#14101c] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-ink">{skill.name}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink/50">
                        {skill.source}
                      </p>
                    </div>
                    <span
                      className={`rounded-none border-2 px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                        skill.eligible
                          ? "border-mint/45 bg-mint/15 text-mint"
                          : "border-brass/45 bg-brass/14 text-brass"
                      }`}
                    >
                      {skill.eligible ? "ready" : "needs setup"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-ink/70">{truncate(skill.description, 140)}</p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ink/55">Skill inspector</p>
          <div className="mt-3">
            {detailLoading ? <EmptyState message="Loading skill detail..." /> : null}

            {detailError ? (
              <div className="rounded-none border-2 border-coral bg-coral/10 px-4 py-3 text-sm text-coral">
                {detailError}
              </div>
            ) : null}

            {!detailLoading && !detailError && !detail ? (
              <EmptyState message="Choose View SKILL.md on any installed or catalog skill to inspect its content here." />
            ) : null}

            {detail ? (
              <article className="rounded-none border-2 border-ink/15 bg-[#14101c] p-4 shadow-pixel">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-bold text-ink">{detail.displayName}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink/50">
                      {detail.slug} · {detail.source}
                    </p>
                  </div>
                  <span
                    className={`rounded-none border-2 px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                      detail.installed
                        ? "border-mint/45 bg-mint/15 text-mint"
                        : "border-ink/20 bg-[#0f0c15] text-ink"
                    }`}
                  >
                    {detail.installed ? "installed" : "catalog"}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-ink/75">{detail.summary}</p>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs uppercase tracking-[0.16em] text-ink/55">
                  <span>Version {detail.latestVersion ?? "--"}</span>
                  <span>Updated {formatDateTime(detail.updatedAt)}</span>
                  <span>Owner {detail.ownerHandle ?? "--"}</span>
                  <span>{detail.installPath ? truncate(detail.installPath, 36) : "remote only"}</span>
                </div>

                {detail.security ? (
                  <div className="mt-4 rounded-none border-2 border-brass/45 bg-brass/10 p-3 text-sm text-ink/75">
                    <p className="text-xs uppercase tracking-[0.18em] text-ink/55">
                      Security check
                    </p>
                    <p className="mt-2">
                      Status: {detail.security.status ?? "--"}
                      {detail.security.hasWarnings ? " · warnings present" : ""}
                    </p>
                    {detail.security.summary ? (
                      <p className="mt-2">{truncate(detail.security.summary, 180)}</p>
                    ) : null}
                    {detail.security.guidance ? (
                      <p className="mt-2 text-xs text-ink/60">
                        {truncate(detail.security.guidance, 220)}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {detail.changelog ? (
                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-ink/55">
                      Changelog
                    </p>
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-none border-2 border-ink/15 bg-[#0f0c15] p-3 text-sm text-ink/75">
                      {detail.changelog}
                    </pre>
                  </div>
                ) : null}

                <div className="mt-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-ink/55">
                    SKILL.md
                  </p>
                  <pre className="mt-2 max-h-[34rem] overflow-auto whitespace-pre-wrap rounded-none border-2 border-ink/15 bg-[#0f0c15] p-4 text-sm leading-relaxed text-ink">
                    {detail.skillMdContent ?? "No SKILL.md content was available."}
                  </pre>
                </div>
              </article>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  note: string;
}

function StatCard({ label, value, note }: StatCardProps) {
  return (
    <div className="rounded-none border-2 border-ink/15 bg-[#14101c] p-3 shadow-pixel">
      <p className="text-[10px] uppercase tracking-[0.22em] text-ink/55">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      <p className="mt-2 text-xs text-ink/65">{note}</p>
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  tone: "teal" | "coral" | "paper";
  disabled: boolean;
  onClick: () => void;
}

function ActionButton({ label, tone, disabled, onClick }: ActionButtonProps) {
  const toneClasses =
    tone === "teal"
      ? "bg-teal text-[#071111]"
      : tone === "coral"
        ? "bg-coral text-[#14090a]"
        : "bg-[#15101d] text-ink";

  return (
    <button
      type="button"
      className={`rounded-none border-2 border-ink px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] shadow-pixel disabled:cursor-not-allowed disabled:bg-slate disabled:text-ink/40 ${toneClasses}`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-none border-2 border-dashed border-ink/15 bg-[#110d18] p-4 text-sm text-ink/60">
      {message}
    </div>
  );
}

const parseActionResponse = async <T,>(response: Response) => {
  if (!response.ok) {
    const data = (await response.json().catch(() => ({ error: "Request failed." }))) as {
      error?: string;
    };
    throw new Error(data.error ?? "Request failed.");
  }

  return (await response.json()) as T;
};
