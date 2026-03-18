import { formatClock, truncate } from "../lib/format";
import type { AgentRecord, MessageRecord, WorkflowRecord } from "../types/contracts";

interface CollaborationPanelProps {
  agents: AgentRecord[];
  messages: MessageRecord[];
  selectedWorkflowId: string | null;
  workflows: WorkflowRecord[];
}

export function CollaborationPanel({
  agents,
  messages,
  selectedWorkflowId,
  workflows
}: CollaborationPanelProps) {
  const focusWorkflow =
    workflows.find((workflow) => workflow.id === selectedWorkflowId) ??
    workflows.find((workflow) => workflow.status === "running") ??
    workflows[0] ??
    null;
  const agentById = new Map(agents.map((agent) => [agent.id, agent.name]));
  const taskById = new Map(
    workflows.flatMap((workflow) => workflow.tasks).map((task) => [task.id, task])
  );
  const notes = focusWorkflow
    ? messages
        .filter((message) => message.workflowId === focusWorkflow.id)
        .slice(0, 4)
    : messages.slice(0, 4);

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="pixel-label">Desk Radio</p>
          <h2 className="mt-2 text-xl font-bold text-ink">Live collaboration feed</h2>
        </div>
        <span className="rounded-none border-2 border-ink/15 bg-[#15101d] px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-ink/62 shadow-pixel">
          {notes.length} live notes
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {notes.length === 0 ? (
          <div className="rounded-none border-2 border-dashed border-ink/15 bg-[#110d18] p-4 text-sm text-ink/58">
            No desk radio traffic yet.
          </div>
        ) : null}

        {notes.map((message) => {
          const task = taskById.get(message.taskId);

          return (
            <article
              key={message.id}
              className="rounded-none border-2 border-ink/15 bg-[#14101c] p-3 shadow-pixel"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="rounded-none border-2 border-ink/15 bg-[#0f0c15] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-ink/52">
                    {message.kind}
                  </span>
                  <p className="text-sm font-bold text-ink">
                    {agentById.get(message.fromAgentId) ?? "Gateway"} to{" "}
                    {agentById.get(message.toAgentId) ?? "Gateway"}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-ink/42">
                  {formatClock(message.timestamp)}
                </span>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-ink/74">
                {truncate(message.payload, 180)}
              </p>
              {task ? (
                <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-ink/42">
                  {task.title}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
