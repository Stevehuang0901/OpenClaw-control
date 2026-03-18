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
        .slice(0, 6)
    : messages.slice(0, 6);

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="pixel-label">Collaboration</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">Desk radio</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/66">
            Lightweight collaboration view for the Office page. This stays focused
            on the current mission while the full ops timeline lives on Activity.
          </p>
        </div>
        <div className="rounded-none border-2 border-ink/15 bg-[#15101d] px-4 py-3 shadow-pixel">
          <p className="text-[10px] uppercase tracking-[0.24em] text-ink/48">Focus</p>
          <p className="mt-2 text-sm text-ink/72">
            {focusWorkflow ? focusWorkflow.summary : "No mission selected"}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {notes.length === 0 ? (
          <div className="rounded-none border-2 border-dashed border-ink/15 bg-[#110d18] p-4 text-sm text-ink/58">
            No collaboration notes yet. Submit a request and the crew radio will
            start showing handoffs, results, and desk updates here.
          </div>
        ) : null}

        {notes.map((message) => {
          const task = taskById.get(message.taskId);

          return (
            <article
              key={message.id}
              className="rounded-none border-2 border-ink/15 bg-[#14101c] p-4 shadow-pixel"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-none border-2 border-ink/15 bg-[#0f0c15] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-ink/52">
                      {message.kind}
                    </span>
                    {task ? (
                      <span className="text-[10px] uppercase tracking-[0.18em] text-ink/44">
                        {task.title}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm font-bold text-ink">
                    {agentById.get(message.fromAgentId) ?? "Gateway"} to{" "}
                    {agentById.get(message.toAgentId) ?? "Gateway"}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-ink/42">
                  {formatClock(message.timestamp)}
                </span>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-ink/74">
                {truncate(message.payload, 180)}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
