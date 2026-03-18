import { useEffect, useState, type CSSProperties } from "react";

import "./office-scene.css";

import { truncate } from "../lib/format";
import {
  resolveAgentSceneState,
  type AgentSceneState,
  type SceneRoom
} from "../lib/office";
import { getWorkflowProgress } from "../lib/workflows";
import { roleMeta } from "../types/contracts";
import type {
  AgentRecord,
  ApprovalRecord,
  HandoffRecord,
  MessageRecord,
  TaskRecord,
  WorkflowRecord
} from "../types/contracts";

interface OfficeSceneProps {
  agents: AgentRecord[];
  approvals: ApprovalRecord[];
  selectedWorkflowId: string | null;
  workflows: WorkflowRecord[];
  handoffs: HandoffRecord[];
  messages: MessageRecord[];
}

const officeDeskLayout: Record<string, { x: number; y: number }> = {
  "agent-scout": { x: 22, y: 26 },
  "agent-ember": { x: 50, y: 26 },
  "agent-atlas": { x: 78, y: 26 },
  "agent-prism": { x: 22, y: 65 },
  "agent-quill": { x: 50, y: 65 },
  "agent-sentinel": { x: 78, y: 65 }
};

interface RoomActorDescriptor {
  agent: AgentRecord;
  activeTask: TaskRecord | null;
  scene: AgentSceneState;
}

type LeisureRoom = Exclude<SceneRoom, "work">;

export function OfficeScene({
  agents,
  approvals,
  selectedWorkflowId,
  workflows,
  handoffs,
  messages
}: OfficeSceneProps) {
  const [sceneTick, setSceneTick] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSceneTick(Date.now());
    }, 7000);

    return () => window.clearInterval(interval);
  }, []);

  const sceneAgents = agents.map((agent) => ({
    ...agent,
    desk: officeDeskLayout[agent.id] ?? agent.desk
  }));
  const tasks = workflows.flatMap((workflow) => workflow.tasks);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const agentById = new Map(sceneAgents.map((agent) => [agent.id, agent]));
  const focusWorkflow =
    workflows.find((workflow) => workflow.id === selectedWorkflowId) ??
    workflows.find((workflow) => workflow.status === "running") ??
    workflows[0] ??
    null;
  const focusProgress = focusWorkflow ? getWorkflowProgress(focusWorkflow) : null;
  const focusTask = focusProgress?.activeTask ?? null;
  const focusNextTask = focusProgress?.nextTask ?? null;
  const focusApproval =
    focusWorkflow
      ? approvals.find((approval) => approval.workflowId === focusWorkflow.id) ?? null
      : null;
  const focusAgent =
    focusTask?.ownerAgentId
      ? agentById.get(focusTask.ownerAgentId) ?? null
      : null;
  const latestApproved =
    [...approvals]
      .filter((approval) => approval.status === "approved" && approval.decidedAt)
      .sort((left, right) =>
        (right.decidedAt ?? "").localeCompare(left.decidedAt ?? "")
      )[0] ?? null;
  const celebrationWorkflow = latestApproved
    ? workflows.find((workflow) => workflow.id === latestApproved.workflowId) ?? null
    : null;
  const celebrationTask =
    latestApproved && celebrationWorkflow
      ? celebrationWorkflow.tasks.find((task) => task.id === latestApproved.taskId) ?? null
      : null;
  const celebrationAgent =
    celebrationTask?.ownerAgentId
      ? agentById.get(celebrationTask.ownerAgentId) ?? null
      : sceneAgents.find((agent) => agent.role === "validator") ?? null;
  const activeRequests = workflows.filter(
    (workflow) => workflow.status !== "completed"
  ).length;
  const busyAgents = sceneAgents.filter((agent) => agent.status !== "idle").length;
  const floorIsQuiet = !focusTask && !focusNextTask && activeRequests === 0;
  const liveMessages = messages.slice(0, 2);
  const latestRadioNote = liveMessages[0] ?? null;
  const leisureCycle: Array<{
    room: LeisureRoom;
    label: string;
    detail: string;
  }> = [
    {
      room: "cards",
      label: "Cards break",
      detail: "Two lobsters are shuffling a quick hand in the game room."
    },
    {
      room: "mahjong",
      label: "Mahjong round",
      detail: "The tile table is active while the queue stays quiet."
    },
    {
      room: "coffee",
      label: "Coffee reset",
      detail: "Someone drifted to the tea pantry for a quick recharge."
    },
    {
      room: "nap",
      label: "Nap pod",
      detail: "The quiet suite is in use for a short recovery break."
    }
  ];
  const leisureMoment = leisureCycle[Math.floor(sceneTick / 7000) % leisureCycle.length];
  const officeMood = latestApproved
    ? {
        room: "work" as SceneRoom,
        label: "Release approved",
        detail: "The validator desk just cleared a release package."
      }
    : focusTask
      ? {
          room: "work" as SceneRoom,
          label: "Heads down",
          detail: "The active desk is moving the current request through the office."
        }
      : focusNextTask
        ? {
            room: "work" as SceneRoom,
            label: "Standby queue",
            detail: "The next packet is lined up and ready for the next handoff."
          }
        : leisureMoment;
  const spotlightRoom = officeMood.room;
  const headerTitle = focusWorkflow
    ? truncate(focusWorkflow.summary, 48)
    : "Waiting for the next mission";
  const headerDetail = focusTask
    ? `${focusAgent?.name ?? "A desk"} is handling ${truncate(focusTask.title, 38)}.`
    : officeMood.detail;
  const agentScenes = sceneAgents.map((agent, index) => {
    const activeTask =
      (agent.currentTaskId ? taskById.get(agent.currentTaskId) : null) ?? null;
    const scene = resolveAgentSceneState(
      agent,
      index,
      activeTask,
      handoffs,
      sceneAgents,
      floorIsQuiet ? sceneTick : 0
    );

    return {
      agent,
      activeTask,
      scene
    };
  });
  const roomActors = {
    work: agentScenes.filter((entry) => entry.scene.room === "work"),
    cards: agentScenes.filter((entry) => entry.scene.room === "cards"),
    coffee: agentScenes.filter((entry) => entry.scene.room === "coffee"),
    nap: agentScenes.filter((entry) => entry.scene.room === "nap"),
    mahjong: agentScenes.filter((entry) => entry.scene.room === "mahjong")
  } satisfies Record<SceneRoom, RoomActorDescriptor[]>;

  return (
    <section className="panel overflow-hidden oc-floor-panel">
      <div className="oc-floor-stage">
        <div className="oc-floor-header">
          <div>
            <p className="oc-floor-kicker">OpenClaw office map</p>
            <h2 className="oc-floor-title">{headerTitle}</h2>
            <p className="oc-floor-copy">{headerDetail}</p>
          </div>

          <div className="oc-floor-stats">
            <StatusPill label={busyAgents > 0 ? `${busyAgents} busy` : "quiet"} tone="neutral" />
            <StatusPill label={`${activeRequests} live`} tone="good" />
            <StatusPill label={`${handoffs.length} packets`} tone="warn" />
          </div>
        </div>

        <div className="oc-floor-chip-row">
          {sceneAgents.map((agent) => (
            <div key={`${agent.id}-chip`} className={`oc-floor-chip oc-floor-chip-${agent.status}`}>
              <span className="oc-floor-chip-dot" style={{ backgroundColor: agent.accent }} />
              <span className="oc-floor-chip-name">{agent.name}</span>
              <span className="oc-floor-chip-state">
                {agent.status === "thinking"
                  ? "working"
                  : agent.status === "handoff"
                    ? "handoff"
                    : "idle"}
              </span>
            </div>
          ))}
        </div>

        <div className="oc-floor-map">
          <div className="oc-floor-grid">
            <Workroom
              entries={agentScenes}
              actors={roomActors.work}
              handoffs={handoffs}
              taskById={taskById}
              agentById={agentById}
              focusAgentId={focusAgent?.id ?? null}
              spotlightLabel={officeMood.label}
              spotlightDetail={officeMood.detail}
              celebrationAgent={celebrationAgent}
              active={spotlightRoom === "work"}
            />
            <CoffeePantryRoom actors={roomActors.coffee} active={spotlightRoom === "coffee"} />
            <CardsRoom actors={roomActors.cards} active={spotlightRoom === "cards"} />
            <NapRoom actors={roomActors.nap} active={spotlightRoom === "nap"} />
            <MahjongRoom actors={roomActors.mahjong} active={spotlightRoom === "mahjong"} />
          </div>
        </div>

        <div className="oc-floor-footer">
          <span className="oc-floor-kicker">Signal</span>
          <strong>
            {focusTask
              ? `${focusAgent?.name ?? "Desk"} on ${truncate(focusTask.title, 24)}`
              : latestRadioNote
                ? truncate(latestRadioNote.payload, 64)
                : focusApproval
                  ? `${focusApproval.status} approval on deck`
                  : `${officeMood.label} · waiting for the next packet`}
          </strong>
        </div>
      </div>
    </section>
  );
}

function Workroom({
  entries,
  actors,
  handoffs,
  taskById,
  agentById,
  focusAgentId,
  spotlightLabel,
  spotlightDetail,
  celebrationAgent,
  active
}: {
  entries: RoomActorDescriptor[];
  actors: RoomActorDescriptor[];
  handoffs: HandoffRecord[];
  taskById: Map<string, TaskRecord>;
  agentById: Map<string, AgentRecord>;
  focusAgentId: string | null;
  spotlightLabel: string;
  spotlightDetail: string;
  celebrationAgent: AgentRecord | null;
  active: boolean;
}) {
  return (
    <section className={`oc-room oc-room-work ${active ? "is-active" : ""}`}>
      <RoomHeader
        kicker="Main office"
        title="Work floor"
        status={actors.length > 0 ? `${actors.length} live` : "standby"}
        active={active}
      />

      <div className="oc-room-brief">
        <strong>{spotlightLabel}</strong>
        <span>{spotlightDetail}</span>
      </div>

      <span className="oc-room-door oc-room-door-bottom" />

      <div className="oc-workroom-canvas">
        <div className="oc-workroom-gridlines" />

        {entries.map(({ agent, activeTask }) => (
          <div
            key={agent.id}
            className={`oc-work-desk ${activeTask ? "is-active" : ""}`}
            style={
              {
                left: `${agent.desk.x}%`,
                top: `${agent.desk.y}%`,
                "--desk-accent": roleMeta[agent.role].accent
              } as CSSProperties
            }
          >
            <span className="oc-work-desk-shadow" />
            <div className="oc-work-desk-shell">
              <span className="oc-work-desk-monitor" />
              <span className="oc-work-desk-keyboard" />
              <span className="oc-work-desk-mouse" />
              <span className="oc-work-desk-mug" />
              <span className="oc-work-desk-chair" />
            </div>
            <div className="oc-work-desk-tag">
              <strong>{agent.name}</strong>
              <span>{activeTask ? packetLabel(activeTask) : truncate(roleMeta[agent.role].label, 16)}</span>
            </div>
          </div>
        ))}

        {celebrationAgent ? (
          <div
            className="oc-workroom-halo"
            style={
              {
                left: `${celebrationAgent.desk.x}%`,
                top: `${celebrationAgent.desk.y + 12}%`
              } as CSSProperties
            }
          />
        ) : null}

        <div className="oc-work-actor-layer">
          {actors.map(({ agent, scene }) => {
            const emphasize =
              scene.pose === "handoff" ||
              focusAgentId === agent.id ||
              celebrationAgent?.id === agent.id;

            return (
              <div
                key={`${agent.id}-work-actor`}
                className={`oc-work-actor oc-work-actor-${scene.pose} oc-facing-${scene.facing}`}
                style={
                  {
                    left: `${scene.x}%`,
                    top: `${scene.y}%`,
                    "--actor-accent": agent.accent
                  } as CSSProperties
                }
              >
                {scene.bubble && scene.pose === "handoff" ? (
                  <span className="oc-work-actor-bubble">{truncate(scene.bubble, 18)}</span>
                ) : null}
                <div className="oc-work-actor-sprite">
                  <LobsterSprite />
                </div>
                {emphasize ? <span className="oc-work-actor-label">{agent.name}</span> : null}
              </div>
            );
          })}
        </div>

        {handoffs.map((handoff) => {
          const fromAgent = agentById.get(handoff.fromAgentId);
          const toAgent = agentById.get(handoff.toAgentId);

          if (!fromAgent || !toAgent) {
            return null;
          }

          return (
            <div
              key={handoff.id}
              className="oc-packet"
              style={
                {
                  "--start-x": `${fromAgent.desk.x}%`,
                  "--start-y": `${fromAgent.desk.y + 11}%`,
                  "--mid-x": `${fromAgent.desk.x + (toAgent.desk.x - fromAgent.desk.x) * 0.4}%`,
                  "--mid-y": `${fromAgent.desk.y + 11 + (toAgent.desk.y - fromAgent.desk.y) * 0.4 - 8}%`,
                  "--end-x": `${toAgent.desk.x}%`,
                  "--end-y": `${toAgent.desk.y + 11}%`,
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

function CoffeePantryRoom({
  actors,
  active
}: {
  actors: RoomActorDescriptor[];
  active: boolean;
}) {
  return (
    <section className={`oc-room oc-room-coffee ${active ? "is-active" : ""}`}>
      <RoomHeader
        kicker="Tea pantry"
        title="Refill bar"
        status={active ? "active" : actors.length > 0 ? `${actors.length} inside` : "open"}
        active={active}
      />
      <span className="oc-room-door oc-room-door-bottom" />
      <span className="oc-pantry-shelf" />
      <span className="oc-pantry-fridge" />
      <span className="oc-pantry-plant" />
      <IdleActorLayer actors={actors} room="coffee" />
      <div className="oc-pantry-counter">
        <span className="oc-pantry-machine" />
        <span className="oc-pantry-cups" />
        <span className="oc-pantry-stool" />
      </div>
    </section>
  );
}

function CardsRoom({
  actors,
  active
}: {
  actors: RoomActorDescriptor[];
  active: boolean;
}) {
  return (
    <section className={`oc-room oc-room-cards ${active ? "is-active" : ""}`}>
      <RoomHeader
        kicker="Game room"
        title="Cards club"
        status={active ? "active" : actors.length > 0 ? `${actors.length} inside` : "open"}
        active={active}
      />
      <span className="oc-room-door oc-room-door-top" />
      <span className="oc-cards-lamp" />
      <span className="oc-cards-poster" />
      <IdleActorLayer actors={actors} room="cards" />
      <div className="oc-cards-table">
        <span className="oc-cards-chair oc-cards-chair-top" />
        <span className="oc-cards-chair oc-cards-chair-left" />
        <span className="oc-cards-chair oc-cards-chair-right" />
        <span className="oc-cards-card oc-cards-card-left" />
        <span className="oc-cards-card oc-cards-card-right" />
        <span className="oc-cards-chip oc-cards-chip-green" />
        <span className="oc-cards-chip oc-cards-chip-amber" />
      </div>
    </section>
  );
}

function NapRoom({
  actors,
  active
}: {
  actors: RoomActorDescriptor[];
  active: boolean;
}) {
  return (
    <section className={`oc-room oc-room-nap ${active ? "is-active" : ""}`}>
      <RoomHeader
        kicker="Quiet suite"
        title="Nap pod"
        status={active ? "active" : actors.length > 0 ? `${actors.length} inside` : "open"}
        active={active}
      />
      <span className="oc-room-door oc-room-door-top" />
      <span className="oc-nap-curtain" />
      <span className="oc-nap-lamp" />
      <span className="oc-nap-side-table" />
      <IdleActorLayer actors={actors} room="nap" />
      <div className="oc-nap-bed">
        <span className="oc-nap-pillow" />
        <span className="oc-nap-blanket" />
      </div>
    </section>
  );
}

function MahjongRoom({
  actors,
  active
}: {
  actors: RoomActorDescriptor[];
  active: boolean;
}) {
  return (
    <section className={`oc-room oc-room-mahjong ${active ? "is-active" : ""}`}>
      <RoomHeader
        kicker="Play room"
        title="Mahjong den"
        status={active ? "active" : actors.length > 0 ? `${actors.length} inside` : "open"}
        active={active}
      />
      <span className="oc-room-door oc-room-door-top" />
      <span className="oc-mahjong-rack" />
      <span className="oc-mahjong-lantern" />
      <IdleActorLayer actors={actors} room="mahjong" />
      <div className="oc-mahjong-table">
        <span className="oc-mahjong-chair oc-mahjong-chair-top" />
        <span className="oc-mahjong-chair oc-mahjong-chair-left" />
        <span className="oc-mahjong-chair oc-mahjong-chair-right" />
        <span className="oc-mahjong-tile oc-mahjong-tile-a" />
        <span className="oc-mahjong-tile oc-mahjong-tile-b" />
        <span className="oc-mahjong-tile oc-mahjong-tile-c" />
      </div>
    </section>
  );
}

function IdleActorLayer({
  actors,
  room
}: {
  actors: RoomActorDescriptor[];
  room: LeisureRoom;
}) {
  return (
    <div className={`oc-idle-actor-layer oc-idle-actor-layer-${room}`}>
      {actors.map(({ agent, scene }) => (
        <div
          key={`${agent.id}-${room}`}
          className={`oc-idle-actor oc-idle-actor-${scene.pose} oc-facing-${scene.facing}`}
          style={
            {
              left: `${scene.roomX ?? 50}%`,
              bottom: `${scene.roomY ?? 12}%`,
              "--actor-accent": agent.accent
            } as CSSProperties
          }
        >
          {scene.pose === "sleep" ? <span className="oc-idle-emote">ZZ</span> : null}
          <div className="oc-idle-actor-sprite">
            <LobsterSprite />
          </div>
        </div>
      ))}
    </div>
  );
}

function LobsterSprite() {
  return (
    <div className="oc-lobster">
      <span className="oc-lobster-shadow" />
      <span className="oc-lobster-tail" />
      <span className="oc-lobster-body" />
      <span className="oc-lobster-shell-shine" />
      <span className="oc-lobster-head" />
      <span className="oc-lobster-claw oc-lobster-claw-left" />
      <span className="oc-lobster-claw oc-lobster-claw-right" />
      <span className="oc-lobster-leg oc-lobster-leg-a" />
      <span className="oc-lobster-leg oc-lobster-leg-b" />
      <span className="oc-lobster-leg oc-lobster-leg-c" />
      <span className="oc-lobster-leg oc-lobster-leg-d" />
      <span className="oc-lobster-eye oc-lobster-eye-left" />
      <span className="oc-lobster-eye oc-lobster-eye-right" />
    </div>
  );
}

function RoomHeader({
  kicker,
  title,
  status,
  active
}: {
  kicker: string;
  title: string;
  status: string;
  active: boolean;
}) {
  return (
    <div className="oc-room-header">
      <div className="oc-room-heading">
        <span className="oc-room-kicker">{kicker}</span>
        <strong className="oc-room-title">{title}</strong>
      </div>
      <span className={`oc-room-status ${active ? "is-active" : ""}`}>{status}</span>
    </div>
  );
}

function StatusPill({
  label,
  tone
}: {
  label: string;
  tone: "good" | "warn" | "neutral";
}) {
  return <span className={`oc-floor-pill oc-floor-pill-${tone}`}>{label}</span>;
}

const packetLabel = (task: TaskRecord | undefined) =>
  task ? `${task.role.slice(0, 3).toUpperCase()}` : "PKT";
