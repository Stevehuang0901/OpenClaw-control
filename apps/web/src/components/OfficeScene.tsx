import type { CSSProperties } from "react";

import { roleMeta } from "../types/contracts";
import type {
  AgentRecord,
  HandoffRecord,
  TaskRecord,
  WorkflowRecord
} from "../types/contracts";

interface OfficeSceneProps {
  agents: AgentRecord[];
  workflows: WorkflowRecord[];
  handoffs: HandoffRecord[];
}

export function OfficeScene({
  agents,
  workflows,
  handoffs
}: OfficeSceneProps) {
  const tasks = workflows.flatMap((workflow) => workflow.tasks);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b-2 border-ink/15 px-5 py-4">
        <div>
          <p className="pixel-label">Office Flow</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">
            Live gateway handoffs
          </h2>
        </div>
        <div className="rounded-none border-2 border-ink bg-paper px-3 py-2 text-xs text-ink shadow-pixel">
          {handoffs.length} packets in transit
        </div>
      </div>

      <div className="office-stage">
        <div className="office-wall" />
        <div className="office-window office-window-left" />
        <div className="office-window office-window-right" />
        <div className="office-rug" />

        {agents.map((agent) => {
          const activeTask =
            (agent.currentTaskId ? taskById.get(agent.currentTaskId) : null) ?? null;
          const roleColor = roleMeta[agent.role].accent;

          return (
            <div
              key={agent.id}
              className="office-agent"
              style={{
                left: `${agent.desk.x}%`,
                top: `${agent.desk.y}%`
              }}
            >
              {activeTask ? (
                <div className="office-bubble">
                  <span>{activeTask.title}</span>
                </div>
              ) : null}

              <div className="desk-shell">
                <div className="desk-top">
                  <div
                    className="desk-monitor"
                    style={{ backgroundColor: roleColor }}
                  />
                  <div className="desk-mug" />
                </div>
                <div className="desk-avatar-row">
                  <div
                    className={`desk-avatar ${
                      agent.status === "thinking"
                        ? "avatar-thinking"
                        : agent.status === "handoff"
                          ? "avatar-handoff"
                          : ""
                    }`}
                    style={
                      {
                        "--avatar-accent": agent.accent
                      } as CSSProperties
                    }
                  />
                  <div className="desk-info">
                    <p className="text-sm font-bold text-ink">{agent.name}</p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-ink/60">
                      {roleMeta[agent.role].label}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`status-light ${
                          agent.status === "thinking"
                            ? "status-light-active"
                            : agent.status === "handoff"
                              ? "status-light-handoff"
                              : ""
                        }`}
                      />
                      <span className="text-[10px] uppercase tracking-[0.2em] text-ink/70">
                        {agent.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="desk-footer">
                  <span>{activeTask?.id ?? "waiting"}</span>
                  <span>{agent.completedTasks} done</span>
                </div>
              </div>
            </div>
          );
        })}

        {handoffs.map((handoff) => {
          const fromAgent = agentById.get(handoff.fromAgentId);
          const toAgent = agentById.get(handoff.toAgentId);

          if (!fromAgent || !toAgent) {
            return null;
          }

          return (
            <div
              key={handoff.id}
              className="task-packet"
              style={
                {
                  "--start-x": `${fromAgent.desk.x}%`,
                  "--start-y": `${fromAgent.desk.y}%`,
                  "--delta-x": `${toAgent.desk.x - fromAgent.desk.x}%`,
                  "--delta-y": `${toAgent.desk.y - fromAgent.desk.y}%`,
                  "--duration": `${handoff.durationMs}ms`
                } as CSSProperties
              }
            >
              <span>{packetLabel(taskById.get(handoff.taskId))}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const packetLabel = (task: TaskRecord | undefined) =>
  task ? `${task.role.slice(0, 3).toUpperCase()}` : "PKT";
