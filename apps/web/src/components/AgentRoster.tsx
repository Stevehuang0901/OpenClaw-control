import { truncate } from "../lib/format";
import { resolveAgentSceneState } from "../lib/office";
import { roleMeta } from "../types/contracts";
import type {
  AgentRecord,
  HandoffRecord,
  WorkflowRecord
} from "../types/contracts";

interface AgentRosterProps {
  agents: AgentRecord[];
  workflows: WorkflowRecord[];
  handoffs: HandoffRecord[];
}

export function AgentRoster({
  agents,
  workflows,
  handoffs
}: AgentRosterProps) {
  const tasks = workflows.flatMap((workflow) => workflow.tasks);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const workflowById = new Map(workflows.map((workflow) => [workflow.id, workflow]));
  const sortedAgents = [...agents].sort((left, right) => {
    const leftScore = left.status === "thinking" ? 0 : left.status === "handoff" ? 1 : 2;
    const rightScore = right.status === "thinking" ? 0 : right.status === "handoff" ? 1 : 2;
    return leftScore - rightScore;
  });

  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="pixel-label">Agents</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">Crew roster</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/66">
            Each card only keeps the essentials: what the agent is doing and
            which workflow it belongs to.
          </p>
        </div>
        <div className="rounded-none border-2 border-ink/15 bg-[#15101d] px-4 py-3 shadow-pixel">
          <p className="text-[10px] uppercase tracking-[0.24em] text-ink/48">
            Active desks
          </p>
          <p className="mt-2 text-2xl font-bold text-ink">
            {agents.filter((agent) => agent.status !== "idle").length}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {sortedAgents.map((agent, index) => {
          const task =
            (agent.currentTaskId ? taskById.get(agent.currentTaskId) : null) ?? null;
          const workflow = task ? workflowById.get(task.workflowId) ?? null : null;
          const scene = resolveAgentSceneState(
            agent,
            index,
            task,
            handoffs,
            agents
          );

          return (
            <article
              key={agent.id}
              className={`rounded-none border-2 p-4 shadow-pixel ${
                task ? "border-ink bg-[#1d1628]" : "border-ink/15 bg-[#14101c]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-ink">{agent.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-ink/58">
                    {roleMeta[agent.role].label}
                  </p>
                </div>
                <span
                  className={`rounded-none border-2 border-current px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
                    agent.status === "thinking"
                      ? "bg-brass/18 text-brass"
                      : agent.status === "handoff"
                        ? "bg-coral/18 text-coral"
                        : agent.status === "idle"
                          ? "bg-[#0f0c15] text-ink/68"
                          : "bg-mint/18 text-mint"
                  }`}
                >
                  {agent.status}
                </span>
              </div>

              <div className="mt-4 grid gap-2">
                <RosterLine
                  label="Now"
                  value={
                    task
                      ? `${task.title} (${task.status.replace("_", " ")})`
                      : scene.activityDetail
                  }
                />
                <RosterLine
                  label="Workflow"
                  value={
                    workflow
                      ? truncate(workflow.summary, 72)
                      : "No active workflow assigned"
                  }
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-ink/52">
                <span>{truncate(agent.id, 18)}</span>
                <span>{agent.completedTasks} completed</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RosterLine({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-none border-2 border-ink/12 bg-[#0f0c15] px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-ink/46">{label}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink/72">{value}</p>
    </div>
  );
}
