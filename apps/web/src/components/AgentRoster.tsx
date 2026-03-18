import { resolveAgentSceneState } from "../lib/office";
import { roleMeta } from "../types/contracts";
import type {
  AgentRecord,
  HandoffRecord,
  TaskRecord,
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

  return (
    <section className="panel p-5">
      <p className="pixel-label">Agents</p>
      <h2 className="mt-2 text-2xl font-bold text-ink">Desk roster</h2>
      <div className="mt-5 space-y-3">
        {agents.map((agent, index) => {
          const task =
            (agent.currentTaskId ? taskById.get(agent.currentTaskId) : null) ?? null;
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
                task ? "border-ink bg-white/80" : "border-ink bg-paper/75"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-ink">{agent.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-ink/60">
                    {roleMeta[agent.role].label}
                  </p>
                </div>
                <span
                  className={`rounded-none border-2 border-ink px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
                    agent.status === "thinking"
                      ? "bg-brass/20 text-brass"
                      : agent.status === "handoff"
                        ? "bg-coral/20 text-coral"
                        : "bg-mint/30 text-ink"
                  }`}
                >
                  {agent.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-ink/50">
                <span className="rounded-none border-2 border-ink/15 bg-white/60 px-2 py-1">
                  {scene.activityLabel}
                </span>
                <span>{roleMeta[agent.role].label}</span>
              </div>
              <p className="mt-3 text-sm text-ink/70">
                {task ? renderTaskLine(task) : scene.activityDetail}
              </p>
              <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-ink/55">
                <span>{agent.id}</span>
                <span>{agent.completedTasks} completed</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const renderTaskLine = (task: TaskRecord) =>
  `${task.title} for workflow ${task.workflowId.slice(0, 10)} is currently ${task.status.replace("_", " ")}.`;
