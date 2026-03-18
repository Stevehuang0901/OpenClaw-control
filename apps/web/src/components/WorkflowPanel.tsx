import { formatClock, truncate } from "../lib/format";
import { taskStatusLabel, taskStatusTone } from "../lib/status";
import type { AgentRecord, WorkflowRecord } from "../types/contracts";

interface WorkflowPanelProps {
  workflows: WorkflowRecord[];
  agents: AgentRecord[];
}

export function WorkflowPanel({ workflows, agents }: WorkflowPanelProps) {
  const agentById = new Map(agents.map((agent) => [agent.id, agent.name]));

  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="pixel-label">Task Queue</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">
            Workflow timeline
          </h2>
        </div>
        <span className="rounded-none border-2 border-ink bg-paper px-3 py-2 text-xs uppercase tracking-[0.2em] text-ink shadow-pixel">
          {workflows.length} requests
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {workflows.length === 0 ? (
          <div className="rounded-none border-2 border-dashed border-ink/30 p-8 text-center text-sm text-ink/70">
            Submit a prompt to watch the office light up.
          </div>
        ) : null}

        {workflows.map((workflow) => (
          <article
            key={workflow.id}
            className="rounded-none border-2 border-ink bg-paper/75 p-4 shadow-pixel"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-ink/55">
                  {workflow.id}
                </p>
                <h3 className="mt-2 text-lg font-bold text-ink">
                  {workflow.summary}
                </h3>
                <p className="mt-2 max-w-3xl text-sm text-ink/75">
                  {workflow.prompt}
                </p>
              </div>
              <div className="text-right text-xs uppercase tracking-[0.18em] text-ink/60">
                <div>{workflow.status}</div>
                <div className="mt-2">Updated {formatClock(workflow.updatedAt)}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {workflow.tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-none border-2 border-ink/15 bg-white/60 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-ink">{task.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/55">
                        {task.role}
                      </p>
                    </div>
                    <span
                      className={`rounded-none border-2 border-current px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${taskStatusTone[task.status]}`}
                    >
                      {taskStatusLabel[task.status]}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink/75">
                    {task.output
                      ? truncate(task.output, 140)
                      : truncate(task.description, 140)}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-ink/55">
                    <span>{agentById.get(task.ownerAgentId ?? "") ?? "Gateway queue"}</span>
                    <span>{formatClock(task.completedAt ?? task.startedAt)}</span>
                  </div>
                </div>
              ))}
            </div>

            {workflow.finalOutput ? (
              <div className="mt-4 rounded-none border-2 border-teal bg-teal/10 p-4 text-sm leading-relaxed text-ink">
                <p className="pixel-label text-teal">Final output</p>
                <pre className="mt-3 whitespace-pre-wrap font-sans">
                  {workflow.finalOutput}
                </pre>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
