import type { CSSProperties } from "react";

import { truncate } from "../lib/format";
import { resolveAgentSceneState } from "../lib/office";
import { roleMeta } from "../types/contracts";
import type {
  AgentRecord,
  HandoffRecord,
  MessageRecord,
  TaskRecord,
  WorkflowRecord
} from "../types/contracts";

interface OfficeSceneProps {
  agents: AgentRecord[];
  workflows: WorkflowRecord[];
  handoffs: HandoffRecord[];
  messages: MessageRecord[];
}

export function OfficeScene({
  agents,
  workflows,
  handoffs,
  messages
}: OfficeSceneProps) {
  const tasks = workflows.flatMap((workflow) => workflow.tasks);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const activeRequests = workflows.filter(
    (workflow) => workflow.status !== "completed"
  ).length;
  const liveMessages = messages.slice(0, 4);

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b-2 border-ink/15 px-5 py-4">
        <div>
          <p className="pixel-label">Office Flow</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">
            Animated multi-agent floor
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink">
          <div className="rounded-none border-2 border-ink bg-paper px-3 py-2 shadow-pixel">
            {handoffs.length} packets in transit
          </div>
          <div className="rounded-none border-2 border-ink bg-white/70 px-3 py-2 shadow-pixel">
            {activeRequests} live requests
          </div>
        </div>
      </div>

      <div className="office-stage">
        <div className="office-wall" />
        <div className="office-sunbeam" />
        <div className="office-light office-light-left" />
        <div className="office-light office-light-right" />
        <div className="office-window office-window-left" />
        <div className="office-window office-window-right" />
        <div className="office-floor-path office-floor-path-top" />
        <div className="office-floor-path office-floor-path-bottom" />
        <div className="office-lounge-sign">Idle mode lounge</div>
        <div className="office-rug" />
        <div className="office-card-table" />
        <div className="office-card-deck" />
        <div className="office-mahjong-table" />
        <div className="office-arcade-cabinet" />
        <div className="office-beanbag" />
        <div className="office-plant office-plant-left" />
        <div className="office-plant office-plant-right" />

        {agents.map((agent) => {
          const activeTask =
            (agent.currentTaskId ? taskById.get(agent.currentTaskId) : null) ?? null;
          const roleColor = roleMeta[agent.role].accent;

          return (
            <div
              key={agent.id}
              className="office-desk-station"
              style={{
                left: `${agent.desk.x}%`,
                top: `${agent.desk.y}%`
              }}
            >
              <div
                className={`desk-shell office-desk-card ${
                  activeTask ? "office-desk-card-active" : ""
                }`}
              >
                <div className="desk-top">
                  <div
                    className="desk-monitor"
                    style={{ backgroundColor: roleColor }}
                  />
                  <div className="desk-mug" />
                </div>
                <div className="office-desk-screen">
                  <p className="text-xs font-bold text-ink">{agent.name}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-ink/55">
                    {roleMeta[agent.role].label}
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-ink/72">
                    {activeTask
                      ? truncate(activeTask.title, 54)
                      : "Idle loop, lounge privileges active."}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className={`status-light ${
                        agent.status === "thinking"
                          ? "status-light-active"
                          : agent.status === "handoff"
                            ? "status-light-handoff"
                            : ""
                      }`}
                    />
                    <span className="text-[10px] uppercase tracking-[0.18em] text-ink/65">
                      {agent.status}
                    </span>
                  </div>
                </div>
                <div className="desk-footer">
                  <span>{activeTask?.id ?? "lounge"}</span>
                  <span>{agent.completedTasks} done</span>
                </div>
              </div>
            </div>
          );
        })}

        {agents.map((agent, index) => {
          const activeTask =
            (agent.currentTaskId ? taskById.get(agent.currentTaskId) : null) ?? null;
          const scene = resolveAgentSceneState(
            agent,
            index,
            activeTask,
            handoffs,
            agents
          );

          return (
            <div
              key={`${agent.id}-actor`}
              className={`office-actor office-actor-${scene.pose}`}
              style={
                {
                  left: `${scene.x}%`,
                  top: `${scene.y}%`,
                  "--actor-accent": agent.accent
                } as CSSProperties
              }
            >
              {scene.bubble ? (
                <div className="office-bubble office-bubble-actor">
                  <span>{truncate(scene.bubble, 34)}</span>
                </div>
              ) : null}

              {scene.pose === "sleep" ? (
                <span className="office-emote">ZZ</span>
              ) : null}

              <div className="pixel-lobster">
                <span className="pixel-lobster-claw pixel-lobster-claw-left" />
                <span className="pixel-lobster-claw pixel-lobster-claw-right" />
                <span className="pixel-lobster-body" />
                <span className="pixel-lobster-tail" />
                <span className="pixel-lobster-eye pixel-lobster-eye-left" />
                <span className="pixel-lobster-eye pixel-lobster-eye-right" />
              </div>

              <div className="office-actor-caption">
                <span className="office-actor-name">{agent.name}</span>
                <span>{scene.activityLabel}</span>
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
                  "--start-y": `${fromAgent.desk.y + 9}%`,
                  "--mid-x": `${fromAgent.desk.x + (toAgent.desk.x - fromAgent.desk.x) * 0.4}%`,
                  "--mid-y": `${fromAgent.desk.y + 9 + (toAgent.desk.y - fromAgent.desk.y) * 0.4 - 6}%`,
                  "--end-x": `${toAgent.desk.x}%`,
                  "--end-y": `${toAgent.desk.y + 9}%`,
                  "--duration": `${handoff.durationMs}ms`
                } as CSSProperties
              }
            >
              <span>{packetLabel(taskById.get(handoff.taskId))}</span>
            </div>
          );
        })}

        <div className="office-radio">
          <div className="office-radio-header">
            <span className="pixel-label">Collab Radio</span>
            <span>{liveMessages.length} live notes</span>
          </div>
          <div className="office-radio-list">
            {liveMessages.length > 0 ? (
              liveMessages.map((message) => (
                <div key={message.id} className="office-radio-entry">
                  <span className="office-radio-route">
                    {agentById.get(message.fromAgentId)?.name ?? "Gateway"} to{" "}
                    {agentById.get(message.toAgentId)?.name ?? "Gateway"}
                  </span>
                  <span className="office-radio-copy">
                    {truncate(message.payload, 78)}
                  </span>
                </div>
              ))
            ) : (
              <div className="office-radio-entry">
                <span className="office-radio-copy">
                  The floor is quiet. Idle crew is playing cards, camping at the
                  arcade, and waiting for the next request.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const packetLabel = (task: TaskRecord | undefined) =>
  task ? `${task.role.slice(0, 3).toUpperCase()}` : "PKT";
