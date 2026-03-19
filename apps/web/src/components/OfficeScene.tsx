import { Suspense, lazy, useEffect, useMemo, useState, type CSSProperties } from "react";

import "./office-scene.css";

import { truncate } from "../lib/format";
import {
  buildIdleSceneAssignments,
  getIdleSceneProgram,
  getNextIdleSceneProgram,
  resolveAgentSceneState,
  type AgentSceneState,
  type IdleSceneAssignments,
  type IdleSceneProgram,
  type SceneFacing,
  type SceneRoom
} from "../lib/office";
import { projectLeisurePlacement } from "../lib/officeProjection";
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

const OfficeWorld3D = lazy(async () => {
  const module = await import("./OfficeWorld3D");
  return {
    default: module.OfficeWorld3D
  };
});

interface OfficeSceneProps {
  agents: AgentRecord[];
  approvals: ApprovalRecord[];
  selectedWorkflowId: string | null;
  workflows: WorkflowRecord[];
  handoffs: HandoffRecord[];
  messages: MessageRecord[];
}

interface RoomActorDescriptor {
  agent: AgentRecord;
  activeTask: TaskRecord | null;
  scene: AgentSceneState;
}

interface SceneBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface SceneLayoutSnapshot {
  rooms: Partial<Record<SceneRoom, SceneBounds>>;
  layers: Partial<Record<SceneRoom, SceneBounds>>;
}

interface ScenePoint {
  x: number;
  y: number;
}

interface MovingActorDescriptor {
  id: string;
  name: string;
  accent: string;
  startedAt: number;
  durationMs: number;
  path: ScenePoint[];
  targetScene: AgentSceneState;
}

interface ActivitySession {
  startedAt: number;
  endsAt: number;
  officeIsQuiet: boolean;
  program: IdleSceneProgram;
  assignments: IdleSceneAssignments;
  idleAgentSignature: string;
}

type LeisureRoom = Exclude<SceneRoom, "work">;
type OfficeRenderMode = "plan" | "3d";

const officeRenderModeStorageKey = "clawcontrol.office-render-mode";

export function OfficeScene({
  agents,
  approvals,
  selectedWorkflowId,
  workflows,
  handoffs,
  messages
}: OfficeSceneProps) {
  const [sceneNow, setSceneNow] = useState(() => Date.now());
  const [activitySession, setActivitySession] = useState<ActivitySession | null>(null);
  const [renderMode, setRenderMode] = useState<OfficeRenderMode>(() => {
    if (typeof window === "undefined") {
      return "plan";
    }

    const stored = window.localStorage.getItem(officeRenderModeStorageKey);
    return stored === "3d" ? "3d" : "plan";
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSceneNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(officeRenderModeStorageKey, renderMode);
  }, [renderMode]);

  const deskLayout = buildDeskLayout(agents);
  const deskScale = getDeskScale(agents.length);
  const sceneAgents = agents.map((agent) => ({
    ...agent,
    desk: deskLayout[agent.id] ?? agent.desk
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
  const handoffAgents = new Set(
    handoffs.flatMap((handoff) => [handoff.fromAgentId, handoff.toAgentId])
  );
  const idleAgentCount = sceneAgents.filter(
    (agent) => agent.status === "idle" && !agent.currentTaskId && !handoffAgents.has(agent.id)
  ).length;
  const idleSceneAgents = sceneAgents.filter(
    (agent) => agent.status === "idle" && !agent.currentTaskId && !handoffAgents.has(agent.id)
  );
  const idleAgentSignature = idleSceneAgents.map((agent) => agent.id).join("|");
  const liveMessages = messages.slice(0, 2);
  const latestRadioNote = liveMessages[0] ?? null;

  useEffect(() => {
    setActivitySession((current) => {
      const now = Date.now();
      const currentIsValid =
        current &&
        current.officeIsQuiet === floorIsQuiet &&
        current.idleAgentSignature === idleAgentSignature &&
        idleAgentCount >= current.program.minIdleAgents &&
        now < current.endsAt;

      if (currentIsValid) {
        return current;
      }

      const nextProgram = getNextIdleSceneProgram(
        current?.program.key ?? null,
        floorIsQuiet,
        idleAgentCount
      );

      if (!nextProgram) {
        return current;
      }

      return {
        startedAt: now,
        endsAt: now + nextProgram.durationMs,
        officeIsQuiet: floorIsQuiet,
        program: nextProgram,
        assignments: buildIdleSceneAssignments(idleSceneAgents, nextProgram),
        idleAgentSignature
      };
    });
  }, [sceneNow, floorIsQuiet, idleAgentCount, idleAgentSignature]);

  const currentIdleProgram =
    activitySession?.program ??
    getNextIdleSceneProgram(null, floorIsQuiet, idleAgentCount) ??
    getIdleSceneProgram(sceneNow, floorIsQuiet, idleAgentCount);
  const currentIdleAssignments =
    activitySession &&
    activitySession.program.key === currentIdleProgram.key &&
    activitySession.idleAgentSignature === idleAgentSignature
      ? activitySession.assignments
      : buildIdleSceneAssignments(idleSceneAgents, currentIdleProgram);
  const conversationIndex = activitySession
    ? Math.floor((sceneNow - activitySession.startedAt) / 12000)
    : 0;
  const roomConversation =
    currentIdleProgram.conversation[conversationIndex % currentIdleProgram.conversation.length] ?? null;
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
        : currentIdleProgram;
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
      sceneNow,
      floorIsQuiet,
      idleAgentCount,
      currentIdleProgram,
      currentIdleAssignments
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
  const visibleRoomActors = roomActors;
  const worldZones = [
    {
      room: "work" as SceneRoom,
      label: "Work floor",
      status: visibleRoomActors.work.length > 0 ? `${visibleRoomActors.work.length} live` : "standby",
      active: spotlightRoom === "work"
    },
    {
      room: "coffee" as SceneRoom,
      label: "Tea pantry",
      status: formatLeisureRoomStatus("coffee", visibleRoomActors.coffee.length, spotlightRoom === "coffee"),
      active: spotlightRoom === "coffee"
    },
    {
      room: "cards" as SceneRoom,
      label: "Screening lounge",
      status: formatLeisureRoomStatus("cards", visibleRoomActors.cards.length, spotlightRoom === "cards"),
      active: spotlightRoom === "cards"
    },
    {
      room: "nap" as SceneRoom,
      label: "Quiet pod",
      status: formatLeisureRoomStatus("nap", visibleRoomActors.nap.length, spotlightRoom === "nap"),
      active: spotlightRoom === "nap"
    },
    {
      room: "mahjong" as SceneRoom,
      label: "Mahjong room",
      status: formatLeisureRoomStatus("mahjong", visibleRoomActors.mahjong.length, spotlightRoom === "mahjong"),
      active: spotlightRoom === "mahjong"
    }
  ];
  const worldAgents = agentScenes.map(({ agent, scene }) => ({
    id: agent.id,
    name: agent.name,
    accent: agent.accent,
    role: agent.role,
    scene
  }));
  const worldDesks = sceneAgents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    accent: agent.accent,
    role: agent.role,
    desk: agent.desk,
    active: focusAgent?.id === agent.id || celebrationAgent?.id === agent.id || agent.status !== "idle"
  }));
  const renderModeLabel = renderMode === "3d" ? "3D scene" : "Fast floor plan";
  const renderModeNote = useMemo(
    () =>
      renderMode === "3d"
        ? "Full 3D office with lighting and animated furniture."
        : "Lightweight plan view for faster load and smoother control.",
    [renderMode]
  );

  return (
    <section className="panel overflow-hidden oc-floor-panel">
      <div className="oc-floor-stage">
        <div className="oc-floor-header">
          <div>
            <p className="oc-floor-kicker">ClawControl office</p>
            <h2 className="oc-floor-title">{headerTitle}</h2>
            <p className="oc-floor-copy">{headerDetail}</p>
          </div>

          <div className="oc-floor-actions">
            <div className="oc-floor-stats">
              <StatusPill label={busyAgents > 0 ? `${busyAgents} busy` : "quiet"} tone="neutral" />
              <StatusPill label={`${activeRequests} live`} tone="good" />
              <StatusPill label={`${handoffs.length} packets`} tone="warn" />
            </div>
            <div className="oc-floor-view-toggle" role="tablist" aria-label="Office render mode">
              <button
                type="button"
                className={`oc-floor-view-button ${renderMode === "plan" ? "is-active" : ""}`}
                onClick={() => setRenderMode("plan")}
              >
                Fast plan
              </button>
              <button
                type="button"
                className={`oc-floor-view-button ${renderMode === "3d" ? "is-active" : ""}`}
                onClick={() => setRenderMode("3d")}
              >
                3D scene
              </button>
            </div>
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
          <div className="oc-floor-mode-banner">
            <strong>{renderModeLabel}</strong>
            <span>{renderModeNote}</span>
          </div>

          <Suspense
            fallback={
              <div className="oc-world3d-shell oc-world3d-loading">
                <div className="oc-world3d-loading-card">
                  <strong>Loading Office Map</strong>
                  <span>Bringing the 3D office online and reconnecting every room.</span>
                </div>
              </div>
            }
          >
            <OfficeWorld3D
              agents={worldAgents}
              desks={worldDesks}
              zones={worldZones}
              spotlightLabel={officeMood.label}
              spotlightDetail={officeMood.detail}
              conversation={roomConversation}
              renderMode={renderMode}
            />
          </Suspense>
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
  active,
  deskScale,
  conversation,
  roomRef,
  actorLayerRef
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
  deskScale: number;
  conversation: string | null;
  roomRef: (node: HTMLElement | null) => void;
  actorLayerRef: (node: HTMLDivElement | null) => void;
}) {
  return (
    <section className={`oc-room oc-room-work ${active ? "is-active" : ""}`} ref={roomRef}>
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
      {conversation ? <RoomConversation copy={conversation} /> : null}

      <span className="oc-room-door oc-room-door-bottom" />

      <div className="oc-workroom-canvas">
        <span className="oc-workroom-backwall" />
        <span className="oc-workroom-window oc-workroom-window-left" />
        <span className="oc-workroom-window oc-workroom-window-center" />
        <span className="oc-workroom-window oc-workroom-window-right" />
        <span className="oc-workroom-floor" />
        <div className="oc-workroom-gridlines" />
        <span className="oc-workroom-aisle" />
        <span className="oc-workroom-console" />
        <span className="oc-workroom-planter oc-workroom-planter-left" />
        <span className="oc-workroom-planter oc-workroom-planter-right" />

        {entries.map(({ agent, activeTask }) => (
          <div
            key={agent.id}
            className={`oc-work-desk ${activeTask ? "is-active" : ""}`}
            style={
              {
                left: `${agent.desk.x}%`,
                top: `${agent.desk.y}%`,
                "--desk-accent": roleMeta[agent.role].accent,
                "--desk-scale": deskScale,
                "--desk-depth": `${(agent.desk.y / 100).toFixed(3)}`,
                zIndex: Math.round(18 + agent.desk.y * 2)
              } as CSSProperties
            }
          >
            <span className="oc-work-desk-shadow" />
            <div className="oc-work-desk-shell">
              <span className="oc-work-desk-monitor" />
              <span className="oc-work-desk-arm" />
              <span className="oc-work-desk-speaker oc-work-desk-speaker-left" />
              <span className="oc-work-desk-speaker oc-work-desk-speaker-right" />
              <span className="oc-work-desk-notebook" />
              <span className="oc-work-desk-lamp" />
              <span className="oc-work-desk-keyboard" />
              <span className="oc-work-desk-mouse" />
              <span className="oc-work-desk-mug" />
              <span className="oc-work-desk-chair" />
              <span className="oc-work-desk-drawer" />
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

        <div className="oc-work-actor-layer" ref={actorLayerRef}>
          {actors.map(({ agent, scene }) => {
            const emphasize =
              scene.pose === "handoff" ||
              focusAgentId === agent.id ||
              celebrationAgent?.id === agent.id;

            return (
              <div
                key={`${agent.id}-work-actor`}
                className={`oc-work-actor oc-work-actor-${scene.pose} oc-facing-${scene.facing}`}
                style={buildWorkActorStyle(agent.id, agent.accent, scene, {
                  left: `${scene.x}%`,
                  top: `${scene.y}%`
                })}
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
  active,
  conversation,
  roomRef,
  actorLayerRef
}: {
  actors: RoomActorDescriptor[];
  active: boolean;
  conversation: string | null;
  roomRef: (node: HTMLElement | null) => void;
  actorLayerRef: (node: HTMLDivElement | null) => void;
}) {
  return (
    <section className={`oc-room oc-room-coffee ${active ? "is-active" : ""}`} ref={roomRef}>
      <RoomHeader
        kicker="Pantry"
        title="Tea pantry"
        status={formatLeisureRoomStatus("coffee", actors.length, active)}
        active={active}
      />
      {conversation ? <RoomConversation copy={conversation} /> : null}
      <span className="oc-room-door oc-room-door-bottom" />
      <span className="oc-pantry-upper-cabinet" />
      <span className="oc-pantry-sink" />
      <span className="oc-pantry-shelf" />
      <span className="oc-pantry-fridge" />
      <span className="oc-pantry-watercooler" />
      <span className="oc-pantry-plant" />
      <IdleActorLayer actors={actors} room="coffee" layerRef={actorLayerRef} />
      <div className="oc-pantry-counter">
        <span className="oc-pantry-machine" />
        <span className="oc-pantry-kettle" />
        <span className="oc-pantry-beans" />
        <span className="oc-pantry-cups" />
        <span className="oc-pantry-stool" />
      </div>
    </section>
  );
}

function CardsRoom({
  actors,
  active,
  conversation,
  roomRef,
  actorLayerRef
}: {
  actors: RoomActorDescriptor[];
  active: boolean;
  conversation: string | null;
  roomRef: (node: HTMLElement | null) => void;
  actorLayerRef: (node: HTMLDivElement | null) => void;
}) {
  return (
    <section className={`oc-room oc-room-cards ${active ? "is-active" : ""}`} ref={roomRef}>
      <RoomHeader
        kicker="Media lounge"
        title="Screening lounge"
        status={formatLeisureRoomStatus("cards", actors.length, active)}
        active={active}
      />
      {conversation ? <RoomConversation copy={conversation} /> : null}
      <span className="oc-room-door oc-room-door-top" />
      <span className="oc-cards-lamp" />
      <span className="oc-cards-wall-panel" />
      <span className="oc-cards-poster" />
      <span className="oc-cards-screen" />
      <span className="oc-cards-speaker oc-cards-speaker-left" />
      <span className="oc-cards-speaker oc-cards-speaker-right" />
      <span className="oc-cards-rug" />
      <span className="oc-cards-side-table" />
      <span className="oc-cards-media-console" />
      <IdleActorLayer actors={actors} room="cards" layerRef={actorLayerRef} />
      <div className="oc-cards-table">
        <span className="oc-cards-chair oc-cards-chair-top" />
        <span className="oc-cards-chair oc-cards-chair-left" />
        <span className="oc-cards-chair oc-cards-chair-right" />
        <span className="oc-cards-console" />
        <span className="oc-cards-ottoman" />
        <span className="oc-cards-tray" />
        <span className="oc-cards-cup oc-cards-cup-left" />
        <span className="oc-cards-cup oc-cards-cup-right" />
      </div>
    </section>
  );
}

function NapRoom({
  actors,
  active,
  conversation,
  roomRef,
  actorLayerRef
}: {
  actors: RoomActorDescriptor[];
  active: boolean;
  conversation: string | null;
  roomRef: (node: HTMLElement | null) => void;
  actorLayerRef: (node: HTMLDivElement | null) => void;
}) {
  return (
    <section className={`oc-room oc-room-nap ${active ? "is-active" : ""}`} ref={roomRef}>
      <RoomHeader
        kicker="Focus suite"
        title="Quiet pod"
        status={formatLeisureRoomStatus("nap", actors.length, active)}
        active={active}
      />
      {conversation ? <RoomConversation copy={conversation} /> : null}
      <span className="oc-room-door oc-room-door-top" />
      <span className="oc-nap-curtain" />
      <span className="oc-nap-lamp" />
      <span className="oc-nap-side-table" />
      <span className="oc-nap-headboard" />
      <span className="oc-nap-slippers" />
      <IdleActorLayer actors={actors} room="nap" layerRef={actorLayerRef} />
      <div className="oc-nap-bed">
        <span className="oc-nap-pillow" />
        <span className="oc-nap-blanket" />
      </div>
    </section>
  );
}

function MahjongRoom({
  actors,
  active,
  conversation,
  roomRef,
  actorLayerRef
}: {
  actors: RoomActorDescriptor[];
  active: boolean;
  conversation: string | null;
  roomRef: (node: HTMLElement | null) => void;
  actorLayerRef: (node: HTMLDivElement | null) => void;
}) {
  return (
    <section className={`oc-room oc-room-mahjong ${active ? "is-active" : ""}`} ref={roomRef}>
      <RoomHeader
        kicker="Leisure room"
        title="Mahjong room"
        status={formatLeisureRoomStatus("mahjong", actors.length, active)}
        active={active}
      />
      {conversation ? <RoomConversation copy={conversation} /> : null}
      <span className="oc-room-door oc-room-door-top" />
      <span className="oc-mahjong-window" />
      <span className="oc-mahjong-rack" />
      <span className="oc-mahjong-lantern" />
      <span className="oc-mahjong-overhead" />
      <span className="oc-mahjong-sideboard" />
      <span className="oc-mahjong-teaset" />
      <IdleActorLayer actors={actors} room="mahjong" layerRef={actorLayerRef} />
      <div className="oc-mahjong-table">
        <span className="oc-mahjong-chair oc-mahjong-chair-top" />
        <span className="oc-mahjong-chair oc-mahjong-chair-left" />
        <span className="oc-mahjong-chair oc-mahjong-chair-right" />
        <span className="oc-mahjong-chair oc-mahjong-chair-bottom" />
        <span className="oc-mahjong-tile oc-mahjong-tile-a" />
        <span className="oc-mahjong-tile oc-mahjong-tile-b" />
        <span className="oc-mahjong-tile oc-mahjong-tile-c" />
        <span className="oc-mahjong-tile oc-mahjong-tile-d" />
      </div>
    </section>
  );
}

function CorridorNetwork({
  layoutSnapshot
}: {
  layoutSnapshot: SceneLayoutSnapshot;
}) {
  const workDoor = getRoomDoorPoint("work", layoutSnapshot.rooms);
  const coffeeDoor = getRoomDoorPoint("coffee", layoutSnapshot.rooms);
  const cardsDoor = getRoomDoorPoint("cards", layoutSnapshot.rooms);
  const napDoor = getRoomDoorPoint("nap", layoutSnapshot.rooms);
  const mahjongDoor = getRoomDoorPoint("mahjong", layoutSnapshot.rooms);
  const corridorY = getCorridorY(layoutSnapshot.rooms);

  if (!workDoor || !coffeeDoor || !cardsDoor || !napDoor || !mahjongDoor) {
    return null;
  }

  const path = [
    `M ${workDoor.x} ${workDoor.y}`,
    `L ${workDoor.x} ${corridorY}`,
    `L ${coffeeDoor.x} ${corridorY}`,
    `L ${coffeeDoor.x} ${coffeeDoor.y}`,
    `M ${cardsDoor.x} ${cardsDoor.y}`,
    `L ${cardsDoor.x} ${corridorY}`,
    `L ${mahjongDoor.x} ${corridorY}`,
    `L ${mahjongDoor.x} ${mahjongDoor.y}`,
    `M ${napDoor.x} ${napDoor.y}`,
    `L ${napDoor.x} ${corridorY}`
  ].join(" ");

  return (
    <svg className="oc-floor-network" preserveAspectRatio="none" aria-hidden="true">
      <path className="oc-floor-network-path oc-floor-network-glow" d={path} />
      <path className="oc-floor-network-path" d={path} />
    </svg>
  );
}

function IdleActorLayer({
  actors,
  room,
  layerRef
}: {
  actors: RoomActorDescriptor[];
  room: LeisureRoom;
  layerRef?: (node: HTMLDivElement | null) => void;
}) {
  return (
    <div className={`oc-idle-actor-layer oc-idle-actor-layer-${room}`} ref={layerRef}>
      {actors.map(({ agent, scene }) => {
        const placement = projectLeisurePlacement(room, scene);

        return (
          <div
            key={`${agent.id}-${room}`}
            className={`oc-idle-actor oc-idle-actor-${scene.pose} oc-facing-${scene.facing}`}
            style={buildIdleActorStyle(room, agent.id, agent.accent, scene, {
              left: `${placement.left}%`,
              bottom: `${placement.bottom}%`
            })}
          >
            {scene.pose === "sleep" ? <span className="oc-idle-emote">ZZ</span> : null}
            <div className="oc-idle-actor-sprite">
              <LobsterSprite />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LobsterSprite() {
  return (
    <div className="oc-lobster">
      <svg viewBox="0 0 72 72" className="oc-lobster-svg" aria-hidden="true">
        <ellipse className="oc-lobster-shadow-ellipse" cx="36" cy="63" rx="18" ry="6" />
        <g className="oc-lobster-legs oc-lobster-legs-left">
          <path d="M24 43 C18 44 15 47 12 51" />
          <path d="M25 47 C19 49 16 53 14 57" />
        </g>
        <g className="oc-lobster-legs oc-lobster-legs-right">
          <path d="M48 43 C54 44 57 47 60 51" />
          <path d="M47 47 C53 49 56 53 58 57" />
        </g>
        <g className="oc-lobster-claw-group oc-lobster-claw-group-left">
          <path
            className="oc-lobster-claw-shape"
            d="M17 30 C12 28 11 22 15 19 C19 16 24 18 25 23 C26 28 22 31 17 30 Z"
          />
          <path className="oc-lobster-arm" d="M24 28 C21 30 20 33 20 36" />
        </g>
        <g className="oc-lobster-claw-group oc-lobster-claw-group-right">
          <path
            className="oc-lobster-claw-shape"
            d="M55 30 C60 28 61 22 57 19 C53 16 48 18 47 23 C46 28 50 31 55 30 Z"
          />
          <path className="oc-lobster-arm" d="M48 28 C51 30 52 33 52 36" />
        </g>
        <g className="oc-lobster-tail-group">
          <path
            className="oc-lobster-tail-fin"
            d="M29 51 C24 54 24 61 30 64 C34 66 38 66 42 64 C48 61 48 54 43 51 Z"
          />
        </g>
        <g className="oc-lobster-shell-group">
          <ellipse className="oc-lobster-body-shell" cx="36" cy="39" rx="16" ry="14" />
          <ellipse className="oc-lobster-belly" cx="36" cy="45" rx="11" ry="8" />
          <ellipse className="oc-lobster-head-shell" cx="36" cy="24" rx="12" ry="10" />
          <ellipse className="oc-lobster-shell-highlight" cx="31" cy="33" rx="6" ry="4" />
          <path className="oc-lobster-face-line" d="M31 24 C34 26 38 26 41 24" />
        </g>
        <g className="oc-lobster-eye-group">
          <path className="oc-lobster-eye-stalk" d="M31 12 L30 5" />
          <path className="oc-lobster-eye-stalk" d="M41 12 L42 5" />
          <circle className="oc-lobster-eye-dot" cx="30" cy="5" r="2.4" />
          <circle className="oc-lobster-eye-dot" cx="42" cy="5" r="2.4" />
        </g>
      </svg>
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

function RoomConversation({
  copy
}: {
  copy: string;
}) {
  return <div className="oc-room-chat">{copy}</div>;
}

const packetLabel = (task: TaskRecord | undefined) =>
  task ? `${task.role.slice(0, 3).toUpperCase()}` : "PKT";

const formatLeisureRoomStatus = (
  room: LeisureRoom,
  actorCount: number,
  active: boolean
) => {
  if (active) {
    if (room === "mahjong" && actorCount >= 4) {
      return "table live";
    }

    return room === "cards" ? "screening" : "active";
  }

  if (room === "mahjong") {
    return actorCount >= 4 ? "4 at table" : "open";
  }

  if (room === "nap") {
    return actorCount > 0 ? "occupied" : "open";
  }

  if (room === "cards") {
    return actorCount > 1 ? `${actorCount} seated` : actorCount === 1 ? "1 seated" : "open";
  }

  return actorCount > 0 ? `${actorCount} inside` : "open";
};

const buildDeskLayout = (agents: AgentRecord[]) => {
  if (agents.length === 0) {
    return {} as Record<string, { x: number; y: number }>;
  }

  const columns = getDeskColumnCount(agents.length);
  const rows = Math.ceil(agents.length / columns);
  const rowYPositions = distributePositions(
    rows,
    rows === 1 ? 46 : rows === 2 ? 30 : 22,
    rows === 1 ? 46 : rows === 2 ? 64 : rows === 3 ? 74 : 80
  );
  const layout: Record<string, { x: number; y: number }> = {};

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const rowAgents = agents.slice(rowIndex * columns, rowIndex * columns + columns);
    const rowXPositions = distributePositions(
      rowAgents.length,
      rowAgents.length <= 2 ? 28 : rowAgents.length === 3 ? 18 : rowAgents.length === 4 ? 14 : 11,
      rowAgents.length <= 2 ? 72 : rowAgents.length === 3 ? 82 : rowAgents.length === 4 ? 86 : 89
    );

    rowAgents.forEach((agent, columnIndex) => {
      layout[agent.id] = {
        x: rowXPositions[columnIndex],
        y: rowYPositions[rowIndex]
      };
    });
  }

  return layout;
};

const getDeskColumnCount = (agentCount: number) => {
  if (agentCount <= 1) {
    return 1;
  }

  if (agentCount <= 2) {
    return 2;
  }

  if (agentCount <= 3) {
    return 3;
  }

  if (agentCount <= 4) {
    return 2;
  }

  if (agentCount <= 6) {
    return 3;
  }

  if (agentCount <= 9) {
    return 4;
  }

  if (agentCount <= 12) {
    return 5;
  }

  return 6;
};

const getDeskScale = (agentCount: number) => {
  if (agentCount <= 2) {
    return 1.06;
  }

  if (agentCount <= 4) {
    return 1.02;
  }

  if (agentCount <= 6) {
    return 0.98;
  }

  if (agentCount <= 8) {
    return 0.88;
  }

  if (agentCount <= 10) {
    return 0.8;
  }

  if (agentCount <= 12) {
    return 0.72;
  }

  return 0.64;
};

const distributePositions = (count: number, start: number, end: number) => {
  if (count <= 1) {
    return [(start + end) / 2];
  }

  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, index) => start + step * index);
};

const didSceneTargetChange = (left: AgentSceneState, right: AgentSceneState) => {
  if (
    left.room !== right.room ||
    left.pose !== right.pose ||
    left.facing !== right.facing ||
    left.bubble !== right.bubble
  ) {
    return true;
  }

  const leftX = left.room === "work" ? left.x : left.roomX ?? 50;
  const rightX = right.room === "work" ? right.x : right.roomX ?? 50;
  const leftY = left.room === "work" ? left.y : left.roomY ?? 12;
  const rightY = right.room === "work" ? right.y : right.roomY ?? 12;

  return Math.abs(leftX - rightX) > 0.5 || Math.abs(leftY - rightY) > 0.5;
};

const sceneToGlobalPoint = (
  scene: AgentSceneState,
  snapshot: SceneLayoutSnapshot
): ScenePoint | null => {
  const room = scene.room ?? "work";
  const layer = snapshot.layers[room];

  if (!layer) {
    return null;
  }

  if (room === "work") {
    return {
      x: layer.left + (scene.x / 100) * layer.width,
      y: layer.top + (scene.y / 100) * layer.height + 18
    };
  }

  const placement = projectLeisurePlacement(room, scene);

  return {
    x: layer.left + (placement.left / 100) * layer.width,
    y: layer.top + layer.height - (placement.bottom / 100) * layer.height
  };
};

const buildWalkPath = (
  fromScene: AgentSceneState,
  toScene: AgentSceneState,
  snapshot: SceneLayoutSnapshot,
  startPoint: ScenePoint,
  endPoint: ScenePoint
) => {
  const sameRoom = (fromScene.room ?? "work") === (toScene.room ?? "work");

  const basePath = sameRoom
    ? [startPoint, endPoint]
    : (() => {
        const fromRoom = fromScene.room ?? "work";
        const toRoom = toScene.room ?? "work";
        const sourceDoor = getRoomDoorPoint(fromRoom, snapshot.rooms);
        const targetDoor = getRoomDoorPoint(toRoom, snapshot.rooms);
        const corridorY = getCorridorY(snapshot.rooms);

        if (!sourceDoor || !targetDoor) {
          return [startPoint, endPoint];
        }

        return [
          startPoint,
          sourceDoor,
          { x: sourceDoor.x, y: corridorY },
          { x: targetDoor.x, y: corridorY },
          targetDoor,
          endPoint
        ];
      })();

  return compactPath(smoothWalkPath(compactPath(basePath, 4)), 2.5);
};

const getRoomDoorPoint = (
  room: SceneRoom,
  rooms: Partial<Record<SceneRoom, SceneBounds>>
): ScenePoint | null => {
  const bounds = rooms[room];

  if (!bounds) {
    return null;
  }

  if (room === "work" || room === "coffee") {
    return {
      x: bounds.left + bounds.width * 0.5,
      y: bounds.top + bounds.height - 12
    };
  }

  return {
    x: bounds.left + bounds.width * 0.5,
    y: bounds.top + 12
  };
};

const getCorridorY = (rooms: Partial<Record<SceneRoom, SceneBounds>>) => {
  const workBounds = rooms.work;
  const cardsBounds = rooms.cards;

  if (!workBounds || !cardsBounds) {
    return 320;
  }

  return workBounds.top + workBounds.height + (cardsBounds.top - (workBounds.top + workBounds.height)) * 0.5;
};

const smoothWalkPath = (path: ScenePoint[]) => {
  if (path.length <= 2) {
    return path;
  }

  const smoothed: ScenePoint[] = [path[0]];

  for (let index = 1; index < path.length - 1; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    const next = path[index + 1];
    const incoming = { x: current.x - previous.x, y: current.y - previous.y };
    const outgoing = { x: next.x - current.x, y: next.y - current.y };
    const incomingLength = Math.hypot(incoming.x, incoming.y);
    const outgoingLength = Math.hypot(outgoing.x, outgoing.y);

    if (incomingLength < 1 || outgoingLength < 1) {
      smoothed.push(current);
      continue;
    }

    const incomingUnit = {
      x: incoming.x / incomingLength,
      y: incoming.y / incomingLength
    };
    const outgoingUnit = {
      x: outgoing.x / outgoingLength,
      y: outgoing.y / outgoingLength
    };
    const alignment = incomingUnit.x * outgoingUnit.x + incomingUnit.y * outgoingUnit.y;

    if (alignment > 0.96) {
      smoothed.push(current);
      continue;
    }

    const cornerRadius = Math.min(20, incomingLength * 0.34, outgoingLength * 0.34);

    if (cornerRadius < 4) {
      smoothed.push(current);
      continue;
    }

    const curveStart = {
      x: current.x - incomingUnit.x * cornerRadius,
      y: current.y - incomingUnit.y * cornerRadius
    };
    const curveEnd = {
      x: current.x + outgoingUnit.x * cornerRadius,
      y: current.y + outgoingUnit.y * cornerRadius
    };
    const segments = Math.max(3, Math.round(cornerRadius / 6));

    smoothed.push(curveStart);

    for (let segment = 1; segment < segments; segment += 1) {
      const t = segment / segments;
      const inverse = 1 - t;
      smoothed.push({
        x:
          inverse * inverse * curveStart.x +
          2 * inverse * t * current.x +
          t * t * curveEnd.x,
        y:
          inverse * inverse * curveStart.y +
          2 * inverse * t * current.y +
          t * t * curveEnd.y
      });
    }

    smoothed.push(curveEnd);
  }

  smoothed.push(path[path.length - 1]);
  return smoothed;
};

const compactPath = (points: ScenePoint[], minimumDistance = 6) => {
  const compacted: ScenePoint[] = [];

  for (const point of points) {
    const previous = compacted[compacted.length - 1];

    if (!previous || distanceBetweenPoints(previous, point) > minimumDistance) {
      compacted.push(point);
    }
  }

  return compacted;
};

const measurePathDistance = (path: ScenePoint[]) => {
  let totalDistance = 0;

  for (let index = 1; index < path.length; index += 1) {
    totalDistance += distanceBetweenPoints(path[index - 1], path[index]);
  }

  return totalDistance;
};

const samplePathPoint = (path: ScenePoint[], progress: number) => {
  if (path.length <= 1) {
    return path[0] ?? { x: 0, y: 0 };
  }

  const totalDistance = measurePathDistance(path);

  if (totalDistance <= 0) {
    return path[path.length - 1];
  }

  let travel = totalDistance * progress;

  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const segmentLength = distanceBetweenPoints(start, end);

    if (travel <= segmentLength) {
      const ratio = segmentLength === 0 ? 1 : travel / segmentLength;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio
      };
    }

    travel -= segmentLength;
  }

  return path[path.length - 1];
};

const deriveWalkFacing = (path: ScenePoint[], progress: number): SceneFacing => {
  if (path.length <= 1) {
    return "front";
  }

  const totalDistance = measurePathDistance(path);
  let travel = totalDistance * progress;

  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const segmentLength = distanceBetweenPoints(start, end);

    if (travel <= segmentLength) {
      const deltaX = end.x - start.x;
      return Math.abs(deltaX) < 6 ? "front" : deltaX >= 0 ? "right" : "left";
    }

    travel -= segmentLength;
  }

  const tailSegment = path[path.length - 1].x - path[path.length - 2].x;
  return Math.abs(tailSegment) < 6 ? "front" : tailSegment >= 0 ? "right" : "left";
};

const resolveActorPaceFactor = (actorId: string) => {
  const seed = hashSeed(actorId);
  return 0.92 + ((seed >>> 5) % 7) * 0.03;
};

const countPathTurns = (path: ScenePoint[]) => {
  if (path.length <= 2) {
    return 0;
  }

  let turns = 0;

  for (let index = 1; index < path.length - 1; index += 1) {
    const before = path[index - 1];
    const pivot = path[index];
    const after = path[index + 1];
    const incoming = { x: pivot.x - before.x, y: pivot.y - before.y };
    const outgoing = { x: after.x - pivot.x, y: after.y - pivot.y };
    const incomingLength = Math.hypot(incoming.x, incoming.y);
    const outgoingLength = Math.hypot(outgoing.x, outgoing.y);

    if (incomingLength < 2 || outgoingLength < 2) {
      continue;
    }

    const cosine =
      (incoming.x * outgoing.x + incoming.y * outgoing.y) /
      (incomingLength * outgoingLength);
    const clampedCosine = clamp(cosine, -1, 1);
    const angle = Math.acos(clampedCosine);

    if (angle > Math.PI / 6) {
      turns += 1;
    }
  }

  return turns;
};

const resolveMotionDuration = (distance: number, path: ScenePoint[], actorId: string) => {
  const paceFactor = resolveActorPaceFactor(actorId);
  const turnPenalty = countPathTurns(path) * 120;
  const baseDuration = distance * (11.2 * paceFactor);
  return clamp(Math.round(baseDuration + turnPenalty), 1250, 5600);
};

const easeInOutSine = (value: number) => {
  const clamped = clamp(value, 0, 1);
  return -(Math.cos(Math.PI * clamped) - 1) / 2;
};

const getMotionProgress = (descriptor: MovingActorDescriptor, now: number) => {
  const linearProgress = clamp((now - descriptor.startedAt) / descriptor.durationMs, 0, 1);
  return easeInOutSine(linearProgress);
};

const distanceBetweenPoints = (left: ScenePoint, right: ScenePoint) =>
  Math.hypot(right.x - left.x, right.y - left.y);

const buildActorStyle = (
  actorId: string,
  accent: string,
  position: Record<string, string>
) =>
  ({
    ...position,
    "--actor-accent": accent,
    ...getActorMotionVars(actorId)
  } as CSSProperties);

const buildWorkActorStyle = (
  actorId: string,
  accent: string,
  scene: AgentSceneState,
  position: Record<string, string>
) => {
  const depth = clamp((scene.y - 28) / 48, 0, 1);
  const scale =
    scene.pose === "desk" || scene.pose === "working"
      ? 1.06 + depth * 0.08
      : scene.pose === "handoff"
        ? 1.03 + depth * 0.09
        : 1 + depth * 0.1;
  const yShift =
    scene.pose === "desk" || scene.pose === "working"
      ? -9
      : scene.pose === "handoff"
        ? -6
        : -3;

  return {
    ...buildActorStyle(actorId, accent, position),
    "--oc-actor-scale": scale.toFixed(3),
    "--oc-actor-y-shift": `${yShift}px`,
    "--oc-ground-width": `${30 + depth * 10}px`,
    "--oc-ground-height": `${9 + depth * 2}px`,
    "--oc-ground-opacity": (0.12 + depth * 0.08).toFixed(3),
    "--oc-ground-blur": `${5 + depth * 1.6}px`,
    zIndex: Math.round(120 + scene.y * 2)
  } as CSSProperties;
};

const buildIdleActorStyle = (
  room: LeisureRoom,
  actorId: string,
  accent: string,
  scene: AgentSceneState,
  position: Record<string, string>
) => {
  const roomDepth = clamp((scene.roomY ?? 12) / 52, 0, 1);
  const baseScale =
    room === "coffee"
      ? 1.12
      : room === "nap"
        ? scene.pose === "sleep"
          ? 1.04
          : 1.12
        : room === "mahjong"
          ? 1.18
          : 1.1;
  const loungeScale = room === "cards" ? 1.18 : baseScale;
  const scale = loungeScale - roomDepth * 0.07;
  const yShift =
    scene.pose === "game"
      ? -2
      : scene.pose === "mahjong"
        ? -2
        : scene.pose === "coffee"
          ? -1
          : scene.pose === "sleep"
            ? 0
            : -1;

  return {
    ...buildActorStyle(actorId, accent, position),
    "--oc-actor-scale": scale.toFixed(3),
    "--oc-actor-y-shift": `${yShift}px`,
    "--oc-actor-z": `${((1 - roomDepth) * 18).toFixed(2)}px`,
    "--oc-ground-width": `${26 + (1 - roomDepth) * 12}px`,
    "--oc-ground-height": `${8 + (1 - roomDepth) * 3}px`,
    "--oc-ground-opacity": (0.1 + (1 - roomDepth) * 0.1).toFixed(3),
    "--oc-ground-blur": `${4.6 + (1 - roomDepth) * 2.2}px`,
    zIndex: Math.round(14 + (1 - roomDepth) * 10)
  } as CSSProperties;
};

const getActorMotionVars = (seedKey: string) => {
  const seed = hashSeed(seedKey);

  return {
    "--oc-motion-delay": `${-(seed % 3200)}ms`,
    "--oc-idle-duration": `${(3200 + (seed % 900)) / 1000}s`,
    "--oc-desk-duration": `${(2200 + (seed % 650)) / 1000}s`,
    "--oc-bob-duration": `${(1700 + (seed % 450)) / 1000}s`,
    "--oc-table-duration": `${(1380 + (seed % 220)) / 1000}s`,
    "--oc-sip-duration": `${(1480 + (seed % 220)) / 1000}s`,
    "--oc-sleep-duration": `${(2200 + (seed % 360)) / 1000}s`,
    "--oc-gait-duration": `${(820 + (seed % 180)) / 1000}s`,
    "--oc-handoff-duration": `${(720 + (seed % 140)) / 1000}s`,
    "--oc-step-x": `${(1.3 + ((seed >>> 1) % 5) * 0.24).toFixed(2)}px`,
    "--oc-step-x-reverse": `${(-1.05 - ((seed >>> 3) % 5) * 0.2).toFixed(2)}px`,
    "--oc-step-y": `${(-2.8 - ((seed >>> 5) % 5) * 0.28).toFixed(2)}px`,
    "--oc-step-y-soft": `${(-1.7 - ((seed >>> 7) % 4) * 0.18).toFixed(2)}px`,
    "--oc-body-lift": `${(-1.5 - ((seed >>> 9) % 5) * 0.22).toFixed(2)}px`,
    "--oc-body-dip": `${(0.7 + ((seed >>> 11) % 4) * 0.16).toFixed(2)}px`,
    "--oc-tilt-forward": `${(3.4 + ((seed >>> 13) % 5) * 0.45).toFixed(2)}deg`,
    "--oc-tilt-back": `${(-2.6 - ((seed >>> 15) % 5) * 0.38).toFixed(2)}deg`,
    "--oc-tail-swing": `${(4.6 + ((seed >>> 17) % 5) * 0.58).toFixed(2)}deg`,
    "--oc-eye-tilt": `${(1.4 + ((seed >>> 19) % 4) * 0.26).toFixed(2)}deg`,
    "--oc-claw-lift": `${(8.5 + ((seed >>> 21) % 5) * 1.3).toFixed(2)}deg`,
    "--oc-claw-drop": `${(-6.4 - ((seed >>> 23) % 5) * 1.1).toFixed(2)}deg`,
    "--oc-shadow-squash": `${(0.86 + ((seed >>> 25) % 4) * 0.02).toFixed(2)}`,
    "--oc-shadow-stretch": `${(1.04 + ((seed >>> 27) % 4) * 0.02).toFixed(2)}`
  };
};

const hashSeed = (value: string) => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
