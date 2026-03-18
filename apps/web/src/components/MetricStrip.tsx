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
      note: `${metrics.runningWorkflows} currently active`
    },
    {
      label: "Tasks Completed",
      value: metrics.tasksCompleted.toString(),
      note: `${metrics.pendingTasks} pending in queue`
    },
    {
      label: "Avg Handoff",
      value: formatDuration(metrics.averageHandoffMs),
      note: "Desk to desk travel time"
    },
    {
      label: "Avg Cycle",
      value: formatDuration(metrics.averageCycleMs),
      note: "Request to final validation"
    },
    {
      label: "Est Tokens",
      value: formatNumber(metrics.estimatedTotalTokens),
      note: "Summed across workflow steps"
    },
    {
      label: "Est I/O",
      value: `${formatNumber(metrics.estimatedInputTokens)} / ${formatNumber(
        metrics.estimatedOutputTokens
      )}`,
      note: "Input and output token estimate"
    }
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => (
        <article
          key={card.label}
          className="panel p-4"
        >
          <p className="pixel-label">{card.label}</p>
          <p className="mt-2 text-3xl font-bold text-ink">{card.value}</p>
          <p className="mt-2 text-sm text-ink/70">{card.note}</p>
        </article>
      ))}
    </section>
  );
}
