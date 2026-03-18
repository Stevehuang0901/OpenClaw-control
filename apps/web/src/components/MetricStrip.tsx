import { formatDuration } from "../lib/format";
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
    }
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
