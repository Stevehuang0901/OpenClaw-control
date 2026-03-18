import { Fragment } from "react";

import { formatClock, formatNumber, truncate } from "../lib/format";
import { taskStatusLabel, taskStatusTone } from "../lib/status";
import {
  buildWorkflowOutputPreview,
  getWorkflowProgress,
  getWorkflowSignalLine
} from "../lib/workflows";
import type { AgentRecord, WorkflowRecord } from "../types/contracts";

interface WorkflowPanelProps {
  workflows: WorkflowRecord[];
  agents: AgentRecord[];
  selectedWorkflowId: string | null;
  onSelectWorkflow: (workflowId: string) => void;
}

export function WorkflowPanel({
  workflows,
  agents,
  selectedWorkflowId,
  onSelectWorkflow
}: WorkflowPanelProps) {
  const agentById = new Map(agents.map((agent) => [agent.id, agent.name]));

  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="pixel-label">Workflow Trace</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">Request drill-down</h2>
        </div>
        <span className="rounded-none border-2 border-ink/15 bg-[#15101d] px-3 py-2 text-xs uppercase tracking-[0.2em] text-ink shadow-pixel">
          {workflows.length} requests
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {workflows.length === 0 ? (
          <div className="rounded-none border-2 border-dashed border-ink/15 p-8 text-center text-sm text-ink/58">
            Submit a prompt to light up the floor and populate the trace board.
          </div>
        ) : null}

        {workflows.map((workflow) => {
          const progress = getWorkflowProgress(workflow);

          return (
            <article
              key={workflow.id}
              className={`rounded-none border-2 p-4 shadow-pixel transition ${
                workflow.id === selectedWorkflowId
                  ? "border-ink bg-[#21192c]"
                  : "border-ink/15 bg-[#14101c]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button
                  type="button"
                  className="max-w-3xl text-left"
                  onClick={() => onSelectWorkflow(workflow.id)}
                >
                  <p className="text-xs uppercase tracking-[0.25em] text-ink/48">
                    {workflow.id}
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-ink">
                    {workflow.summary}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/72">
                    {workflow.prompt}
                  </p>
                </button>

                <div className="text-right text-xs uppercase tracking-[0.18em] text-ink/55">
                  <div>{workflow.status}</div>
                  <div className="mt-2">Updated {formatClock(workflow.updatedAt)}</div>
                  <div className="mt-2">
                    {workflow.usage
                      ? `${formatNumber(workflow.usage.totalTokens)} tok`
                      : "--"}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-ink/52">
                  <span>{getWorkflowSignalLine(workflow)}</span>
                  <span>{progress.percent}%</span>
                </div>
                <div className="mt-2 h-4 border-2 border-ink/20 bg-[#0f0c15]">
                  <div
                    className="h-full bg-brass transition-[width] duration-500"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {workflow.tasks.map((task, index) => (
                  <Fragment key={task.id}>
                    <div className="min-w-[160px] rounded-none border-2 border-ink/15 bg-[#0f0c15] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-ink">{task.title}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-ink/50">
                            {agentById.get(task.ownerAgentId ?? "") ?? "Gateway queue"}
                          </p>
                        </div>
                        <span
                          className={`rounded-none border-2 border-current px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${taskStatusTone[task.status]}`}
                        >
                          {taskStatusLabel[task.status]}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-ink/68">
                        {truncate(task.output ?? task.description, 120)}
                      </p>
                    </div>
                    {index < workflow.tasks.length - 1 ? (
                      <span className="text-xs uppercase tracking-[0.25em] text-ink/38">
                        handoff
                      </span>
                    ) : null}
                  </Fragment>
                ))}
              </div>

              {workflow.id === selectedWorkflowId ? (
                <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-none border-2 border-ink/15 bg-[#0f0c15] p-4">
                    <p className="pixel-label">Workflow trace</p>
                    <div className="mt-3 space-y-3">
                      {workflow.tasks.map((task) => {
                        const latestHistory = task.history[task.history.length - 1];

                        return (
                          <div
                            key={`${task.id}-trace`}
                            className="rounded-none border-2 border-ink/12 bg-[#15101d] p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-ink">
                                  {task.title}
                                </p>
                                <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-ink/48">
                                  {task.role}
                                </p>
                              </div>
                              <span className="text-[10px] uppercase tracking-[0.18em] text-ink/42">
                                {latestHistory ? formatClock(latestHistory.timestamp) : "--"}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-relaxed text-ink/68">
                              {latestHistory?.note ?? task.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-none border-2 border-teal/50 bg-teal/10 p-4 text-sm leading-relaxed text-ink">
                    <p className="pixel-label text-teal">
                      {workflow.finalOutput ? "Final output" : "Current build"}
                    </p>
                    <pre className="mt-3 max-h-[460px] overflow-auto whitespace-pre-wrap font-sans text-ink/86">
                      {buildWorkflowOutputPreview(workflow)}
                    </pre>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
