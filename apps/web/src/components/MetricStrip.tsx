import { formatDuration, formatNumber } from "../lib/format";
import type { MetricSnapshot } from "../types/contracts";

interface MetricStripProps {
  metrics: MetricSnapshot;
}

export function MetricStrip({ metrics }: MetricStripProps) {
  const cards = [
    {
      label: "Workflows",
      value: `${metrics.completedWorkflows}/${metrics.totalWorkflows}`,
      note: `${metrics.runningWorkflows} active now`,
      accent: "bg-teal/14"
    },
    {
      label: "Tasks Settled",
      value: metrics.tasksCompleted.toString(),
      note: `${metrics.pendingTasks} still queued`,
      accent: "bg-brass/14"
    },
    {
      label: "Approvals",
      value: metrics.pendingApprovals.toString(),
      note: "Release desk backlog",
      accent: "bg-coral/14"
    },
    {
      label: "Avg Handoff",
      value: formatDuration(metrics.averageHandoffMs),
      note: "Desk-to-desk packet travel",
      accent: "bg-mint/14"
    },
    {
      label: "Avg Cycle",
      value: formatDuration(metrics.averageCycleMs),
      note: "Prompt to final package",
      accent: "bg-[#83a0ff]/14"
    },
    {
      label: "Est Tokens",
      value: formatNumber(metrics.estimatedTotalTokens),
      note: `${formatNumber(metrics.estimatedInputTokens)} in / ${formatNumber(
        metrics.estimatedOutputTokens
      )} out`,
      accent: "bg-[#b992f8]/14"
    }
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => (
        <article
          key={card.label}
          className={`panel p-4 ${card.accent}`}
        >
          <p className="pixel-label">{card.label}</p>
          <p className="mt-2 text-3xl font-bold text-ink">{card.value}</p>
          <p className="mt-3 text-sm text-ink/68">{card.note}</p>
        </article>
      ))}
    </section>
  );
}
