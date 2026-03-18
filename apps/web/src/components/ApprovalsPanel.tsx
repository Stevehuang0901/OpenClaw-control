import { useMemo, useState } from "react";

import { formatDateTime, formatPercent, truncate } from "../lib/format";
import type { ApprovalRecord, WorkflowRecord } from "../types/contracts";

interface ApprovalsPanelProps {
  approvals: ApprovalRecord[];
  workflows: WorkflowRecord[];
}

export function ApprovalsPanel({
  approvals,
  workflows
}: ApprovalsPanelProps) {
  const workflowById = useMemo(
    () => new Map(workflows.map((workflow) => [workflow.id, workflow])),
    [workflows]
  );
  const [reviewers, setReviewers] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const sortedApprovals = [...approvals].sort((left, right) => {
    if (left.status === right.status) {
      return right.createdAt.localeCompare(left.createdAt);
    }

    if (left.status === "pending") {
      return -1;
    }

    if (right.status === "pending") {
      return 1;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });

  const submitDecision = async (
    approval: ApprovalRecord,
    status: "approved" | "rejected"
  ) => {
    setBusyId(approval.id);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/approvals/${encodeURIComponent(approval.id)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status,
          reviewer: reviewers[approval.id] ?? "Mission Control",
          decisionNote: notes[approval.id] ?? ""
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({ error: "Request failed." }))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Unable to update approval.");
      }

      setStatusMessage(
        `${approval.title} ${status === "approved" ? "approved" : "rejected"}.`
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to update approval."
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="pixel-label">Approvals</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">Release desk</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/70">
            Final validator output now creates approval cards automatically. You can
            sign off or bounce a package with an operator note.
          </p>
        </div>
        <div className="rounded-none border-2 border-ink/15 bg-[#15101d] px-4 py-3 shadow-pixel">
          <p className="text-[10px] uppercase tracking-[0.24em] text-ink/48">
            Pending now
          </p>
          <p className="mt-2 text-3xl font-bold text-ink">
            {approvals.filter((approval) => approval.status === "pending").length}
          </p>
        </div>
      </div>

      {statusMessage ? (
        <div className="mt-4 rounded-none border-2 border-mint/50 bg-mint/12 px-4 py-3 text-sm text-mint">
          {statusMessage}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-none border-2 border-coral/50 bg-coral/10 px-4 py-3 text-sm text-coral">
          {error}
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        {sortedApprovals.length === 0 ? (
          <div className="rounded-none border-2 border-dashed border-ink/15 px-4 py-8 text-sm text-ink/55">
            No approval packets yet. Finish a workflow and the release desk will queue one here.
          </div>
        ) : null}

        {sortedApprovals.map((approval) => {
          const workflow = workflowById.get(approval.workflowId) ?? null;
          const reviewer = reviewers[approval.id] ?? "Mission Control";
          const note = notes[approval.id] ?? "";

          return (
            <article
              key={approval.id}
              className="rounded-none border-2 border-ink/15 bg-[#14101c] p-4 shadow-pixel"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-2xl">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-ink/45">
                    {approval.id}
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-ink">{approval.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/70">
                    {truncate(workflow?.prompt ?? approval.summary, 180)}
                  </p>
                </div>
                <span className={`approval-chip approval-chip-${approval.status}`}>
                  {approval.status}
                </span>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-none border-2 border-ink/15 bg-[#0f0c15] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs uppercase tracking-[0.18em] text-ink/52">
                      Confidence meter
                    </span>
                    <span className="text-xs font-bold text-ink">
                      {formatPercent(approval.confidence)}
                    </span>
                  </div>
                  <div className="mt-2 h-3 border-2 border-ink/20 bg-[#1b1526]">
                    <div
                      className="h-full bg-brass transition-[width] duration-500"
                      style={{ width: `${approval.confidence}%` }}
                    />
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-ink/68">
                    {approval.summary}
                  </p>
                </div>

                <div className="grid gap-2 text-xs uppercase tracking-[0.16em] text-ink/50">
                  <MetricLine label="Created" value={formatDateTime(approval.createdAt)} />
                  <MetricLine
                    label="Decision"
                    value={approval.decidedAt ? formatDateTime(approval.decidedAt) : "awaiting"}
                  />
                  <MetricLine label="Reviewer" value={approval.reviewer ?? reviewer} />
                  <MetricLine
                    label="Workflow"
                    value={workflow ? workflow.summary : approval.workflowId}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
                <input
                  value={reviewer}
                  onChange={(event) =>
                    setReviewers((current) => ({
                      ...current,
                      [approval.id]: event.target.value
                    }))
                  }
                  className="rounded-none border-2 border-ink/20 bg-[#0f0c15] px-4 py-3 text-sm text-ink shadow-pixel outline-none transition focus:border-teal"
                  placeholder="Reviewer name"
                />
                <textarea
                  value={note}
                  onChange={(event) =>
                    setNotes((current) => ({
                      ...current,
                      [approval.id]: event.target.value
                    }))
                  }
                  className="min-h-[88px] rounded-none border-2 border-ink/20 bg-[#0f0c15] px-4 py-3 text-sm leading-relaxed text-ink shadow-pixel outline-none transition focus:border-teal"
                  placeholder="Decision note, rollback guidance, or operator rationale..."
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-none border-2 border-ink bg-mint px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-[#08110c] shadow-pixel disabled:cursor-not-allowed disabled:bg-slate disabled:text-[#f0e5ca]/65"
                  disabled={busyId !== null}
                  onClick={() => void submitDecision(approval, "approved")}
                >
                  {busyId === approval.id ? "Saving..." : "Approve"}
                </button>
                <button
                  type="button"
                  className="rounded-none border-2 border-ink bg-coral px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-[#14090a] shadow-pixel disabled:cursor-not-allowed disabled:bg-slate disabled:text-[#f0e5ca]/65"
                  disabled={busyId !== null}
                  onClick={() => void submitDecision(approval, "rejected")}
                >
                  {busyId === approval.id ? "Saving..." : "Reject"}
                </button>
              </div>

              {approval.decisionNote ? (
                <div className="mt-4 rounded-none border-2 border-ink/15 bg-[#0f0c15] px-4 py-3 text-sm leading-relaxed text-ink/66">
                  {approval.decisionNote}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MetricLine({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-none border-2 border-ink/12 bg-[#0f0c15] px-3 py-2">
      <span>{label}</span>
      <span className="text-right text-ink/78">{value}</span>
    </div>
  );
}
