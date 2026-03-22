import { Suspense, lazy, useEffect, useMemo, useState } from "react";

import "./office-scene.css";

import { toPlainText, truncate } from "../lib/format";
import {
  buildIdleSceneAssignments,
  getIdleSceneProgram,
  getNextIdleSceneProgram,
  resolveAgentSceneState,
  type AgentSceneState,
  type IdleSceneAssignments,
  type IdleSceneProgram,
  type SceneRoom
} from "../lib/office";
import { getWorkflowProgress } from "../lib/workflows";
import { roleMeta } from "../types/contracts";
import { formatOverlayRoomStatus } from "./officeWorldOverlay";
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
  onSelectWorkflow?: (workflowId: string) => void;
}

interface RoomActorDescriptor {
  agent: AgentRecord;
  activeTask: TaskRecord | null;
  scene: AgentSceneState;
}

interface ActivitySession {
  startedAt: number;
  endsAt: number;
  officeIsQuiet: boolean;
  program: IdleSceneProgram;
  assignments: IdleSceneAssignments;
  idleAgentSignature: string;
}

export function OfficeScene({
  agents,
  approvals,
  selectedWorkflowId,
  workflows,
  handoffs,
  messages,
  onSelectWorkflow
}: OfficeSceneProps) {
  const [sceneNow, setSceneNow] = useState(() => Date.now());
  const [activitySession, setActivitySession] = useState<ActivitySession | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<SceneRoom | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSceneNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const deskLayout = buildDeskLayout(agents);
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
  const headerTitle = "Live office scene";
  const headerDetail = focusTask
    ? `${focusAgent?.name ?? "A desk"} is handling ${truncate(focusTask.title, 38)}.`
    : officeMood.detail;
  const footerSignal = focusTask
    ? `${focusAgent?.name ?? "Desk"} on ${truncate(focusTask.title, 24)}`
    : latestRadioNote
      ? truncate(toPlainText(latestRadioNote.payload), 64)
      : focusApproval
        ? `${focusApproval.status} approval on deck`
        : `${officeMood.label} · waiting for the next packet`;
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
  const activeRoom = selectedRoom ?? spotlightRoom;
  const workStatus = formatOverlayRoomStatus("work", visibleRoomActors.work.length);
  const coffeeStatus = formatOverlayRoomStatus("coffee", visibleRoomActors.coffee.length);
  const cardsStatus = formatOverlayRoomStatus("cards", visibleRoomActors.cards.length);
  const napStatus = formatOverlayRoomStatus("nap", visibleRoomActors.nap.length);
  const mahjongStatus = formatOverlayRoomStatus("mahjong", visibleRoomActors.mahjong.length);
  const worldZones = [
    {
      room: "work" as SceneRoom,
      label: "Work floor",
      status: workStatus.label,
      statusTone: workStatus.tone,
      active: activeRoom === "work"
    },
    {
      room: "coffee" as SceneRoom,
      label: "Tea pantry",
      status: coffeeStatus.label,
      statusTone: coffeeStatus.tone,
      active: activeRoom === "coffee"
    },
    {
      room: "cards" as SceneRoom,
      label: "Screening lounge",
      status: cardsStatus.label,
      statusTone: cardsStatus.tone,
      active: activeRoom === "cards"
    },
    {
      room: "nap" as SceneRoom,
      label: "Quiet pod",
      status: napStatus.label,
      statusTone: napStatus.tone,
      active: activeRoom === "nap"
    },
    {
      room: "mahjong" as SceneRoom,
      label: "Mahjong room",
      status: mahjongStatus.label,
      statusTone: mahjongStatus.tone,
      active: activeRoom === "mahjong"
    }
  ];
  const roomZoneByRoom = new Map(worldZones.map((zone) => [zone.room, zone]));
  const worldAgents = agentScenes.map(({ agent, scene }) => ({
    id: agent.id,
    name: agent.name,
    accent: agent.accent,
    role: agent.role,
    status: agent.status,
    scene
  }));
  const worldDesks = agentScenes.map(({ agent, scene }) => ({
    id: agent.id,
    name: agent.name,
    accent: agent.accent,
    role: agent.role,
    desk: agent.desk,
    active:
      focusAgent?.id === agent.id ||
      celebrationAgent?.id === agent.id ||
      agent.status !== "idle" ||
      scene.pose === "desk" ||
      scene.pose === "working"
  }));
  const selectedAgentDescriptor =
    agentScenes.find((entry) => entry.agent.id === selectedAgentId) ?? null;
  const selectedZone = roomZoneByRoom.get(activeRoom) ?? worldZones[0];
  const selectedRoomRoster = visibleRoomActors[activeRoom].map((entry) => entry.agent.name);
  const selectedAgentRoom = selectedAgentDescriptor
    ? roomZoneByRoom.get(selectedAgentDescriptor.scene.room ?? "work")
    : null;
  const selectedRoomCopy = buildRoomFocusCopy({
    room: activeRoom,
    roomLabel: selectedZone?.label ?? "Work floor",
    roomStatus: selectedZone?.status ?? "open",
    occupantNames: selectedRoomRoster,
    focusAgentName: focusAgent?.name ?? null,
    focusTaskTitle: focusTask?.title ?? null,
    officeMoodDetail: officeMood.detail,
    roomConversation: spotlightRoom === activeRoom ? roomConversation : null
  });
  const selectedAgentStateLabel = selectedAgentDescriptor
    ? selectedAgentDescriptor.agent.status === "thinking"
      ? "working"
      : selectedAgentDescriptor.agent.status === "handoff"
        ? "handoff"
        : "idle"
    : null;
  const roomWorkflowIdByRoom = useMemo(
    () =>
      ({
        work:
          visibleRoomActors.work.find((entry) => entry.activeTask)?.activeTask?.workflowId ??
          (spotlightRoom === "work" ? focusWorkflow?.id ?? null : null),
        coffee:
          visibleRoomActors.coffee.find((entry) => entry.activeTask)?.activeTask?.workflowId ??
          (spotlightRoom === "coffee" ? focusWorkflow?.id ?? null : null),
        cards:
          visibleRoomActors.cards.find((entry) => entry.activeTask)?.activeTask?.workflowId ??
          (spotlightRoom === "cards" ? focusWorkflow?.id ?? null : null),
        nap:
          visibleRoomActors.nap.find((entry) => entry.activeTask)?.activeTask?.workflowId ??
          (spotlightRoom === "nap" ? focusWorkflow?.id ?? null : null),
        mahjong:
          visibleRoomActors.mahjong.find((entry) => entry.activeTask)?.activeTask?.workflowId ??
          (spotlightRoom === "mahjong" ? focusWorkflow?.id ?? null : null)
      }) satisfies Record<SceneRoom, string | null>,
    [focusWorkflow?.id, spotlightRoom, visibleRoomActors]
  );

  useEffect(() => {
    setSelectedRoom((current) => current ?? spotlightRoom);
  }, [spotlightRoom]);

  useEffect(() => {
    setSelectedAgentId((current) => {
      const currentDescriptor =
        (current
          ? agentScenes.find((entry) => entry.agent.id === current) ?? null
          : null);

      if (selectedRoom) {
        const roomLead = visibleRoomActors[selectedRoom][0] ?? null;

        if (!roomLead) {
          return null;
        }

        if (currentDescriptor?.scene.room === selectedRoom) {
          return currentDescriptor.agent.id;
        }

        return roomLead.agent.id;
      }

      if (currentDescriptor) {
        return currentDescriptor.agent.id;
      }

      return focusAgent?.id ?? celebrationAgent?.id ?? agentScenes[0]?.agent.id ?? null;
    });
  }, [agentScenes, celebrationAgent?.id, focusAgent?.id, selectedRoom, visibleRoomActors]);

  const handleSelectRoom = (room: SceneRoom) => {
    setSelectedRoom(room);
    const roomLead = visibleRoomActors[room][0];

    if (roomLead) {
      setSelectedAgentId(roomLead.agent.id);
    } else {
      setSelectedAgentId(null);
    }

    const workflowId = roomWorkflowIdByRoom[room];

    if (workflowId) {
      onSelectWorkflow?.(workflowId);
    }
  };

  const handleSelectAgent = (agentId: string) => {
    const nextAgent = agentScenes.find((entry) => entry.agent.id === agentId) ?? null;
    setSelectedAgentId(agentId);

    if (nextAgent) {
      setSelectedRoom(nextAgent.scene.room ?? "work");

      if (nextAgent.activeTask?.workflowId) {
        onSelectWorkflow?.(nextAgent.activeTask.workflowId);
      }
    }
  };

  return (
    <section className="panel overflow-hidden oc-floor-panel">
      <div className="oc-floor-stage">
        <div className="oc-floor-header">
          <div>
            <p className="oc-floor-kicker">Office telemetry</p>
            <h2 className="oc-floor-title">{headerTitle}</h2>
            <p className="oc-floor-copy">{headerDetail}</p>
          </div>

          <div className="oc-floor-actions">
            <div className="oc-floor-stats">
              <StatusPill
                label={busyAgents > 0 ? `${busyAgents} busy` : "idle floor"}
                tone="neutral"
              />
              <StatusPill label={`${activeRequests} runs`} tone="good" />
              <StatusPill label={`${handoffs.length} handoffs`} tone="warn" />
            </div>
          </div>
        </div>

        <div className="oc-floor-chip-row">
          {sceneAgents.map((agent) => (
            <button
              key={`${agent.id}-chip`}
              type="button"
              className={`oc-floor-chip oc-floor-chip-${agent.status} ${selectedAgentId === agent.id ? "is-selected" : ""}`}
              onClick={() => handleSelectAgent(agent.id)}
              aria-pressed={selectedAgentId === agent.id}
            >
              <span className="oc-floor-chip-dot" style={{ backgroundColor: agent.accent }} />
              <span className="oc-floor-chip-name">{agent.name}</span>
              <span className="oc-floor-chip-state">
                {agent.status === "thinking"
                  ? "working"
                  : agent.status === "handoff"
                    ? "handoff"
                    : "idle"}
              </span>
            </button>
          ))}
        </div>

        <div className="oc-floor-room-strip" aria-label="Office room focus">
          {worldZones.map((zone) => (
            <button
              key={zone.room}
              type="button"
              className={`oc-floor-room-button ${zone.active ? "is-active" : ""}`}
              onClick={() => handleSelectRoom(zone.room)}
              aria-pressed={zone.active}
            >
              <span className="oc-floor-room-button-label">{zone.label}</span>
              <strong className="oc-floor-room-button-status">{zone.status}</strong>
            </button>
          ))}
        </div>

        <div className="oc-floor-map">
          <Suspense
            fallback={
              <div className="oc-world3d-shell oc-world3d-loading" aria-hidden="true">
                <div className="oc-world3d-loading-frame">
                  <div className="oc-world3d-loading-grid" />
                </div>
              </div>
            }
          >
            <OfficeWorld3D
              agents={worldAgents}
              desks={worldDesks}
              zones={worldZones}
              conversation={roomConversation}
              selectedAgentId={selectedAgentId}
              onSelectRoom={handleSelectRoom}
              onSelectAgent={handleSelectAgent}
            />
          </Suspense>
        </div>

        <div className="oc-floor-focus-grid">
          <section className="oc-floor-focus-card">
            <div className="oc-floor-focus-head">
              <div>
                <p className="oc-floor-focus-kicker">Room Focus</p>
                <h3 className="oc-floor-focus-title">{selectedZone?.label ?? "Work floor"}</h3>
              </div>
              <span className="oc-floor-focus-status">{selectedZone?.status ?? "open"}</span>
            </div>
            <p className="oc-floor-focus-copy">{selectedRoomCopy}</p>
            <div className="oc-floor-focus-tags">
              {selectedRoomRoster.length > 0 ? (
                selectedRoomRoster.map((name) => (
                  <span key={`${activeRoom}-${name}`} className="oc-floor-focus-tag">
                    {name}
                  </span>
                ))
              ) : (
                <span className="oc-floor-focus-empty">No one is sitting in this room right now.</span>
              )}
            </div>
          </section>

          <section className="oc-floor-focus-card">
            <div className="oc-floor-focus-head">
              <div>
                <p className="oc-floor-focus-kicker">Agent Focus</p>
                <h3 className="oc-floor-focus-title">
                  {selectedAgentDescriptor?.agent.name ?? "No desk selected"}
                </h3>
              </div>
              <span className="oc-floor-focus-status">
                {selectedAgentStateLabel ?? "standby"}
              </span>
            </div>

            {selectedAgentDescriptor ? (
              <>
                <p className="oc-floor-focus-copy">
                  {selectedAgentDescriptor.activeTask
                    ? `${selectedAgentDescriptor.agent.name} is handling ${truncate(selectedAgentDescriptor.activeTask.title, 58)} from the ${selectedAgentRoom?.label ?? "work floor"}.`
                    : `${selectedAgentDescriptor.agent.name} is staged in the ${selectedAgentRoom?.label ?? "work floor"} and ready for the next packet.`}
                </p>
                <div className="oc-floor-focus-meta">
                  <span>{roleMeta[selectedAgentDescriptor.agent.role].label}</span>
                  <span>{selectedAgentDescriptor.agent.completedTasks} completed</span>
                  <span>
                    {selectedAgentDescriptor.activeTask
                      ? packetLabel(selectedAgentDescriptor.activeTask)
                      : "Standby"}
                  </span>
                </div>
              </>
            ) : (
              <p className="oc-floor-focus-empty">
                {selectedRoom && visibleRoomActors[selectedRoom].length === 0
                  ? "No crew is parked in this room right now."
                  : "Select a desk chip or click a work-floor station to inspect that agent."}
              </p>
            )}
          </section>
        </div>

        <div className="oc-floor-footer">
          <span className="oc-floor-kicker">Signal</span>
          <strong>{footerSignal}</strong>
        </div>
      </div>
    </section>
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

const buildRoomFocusCopy = ({
  room,
  roomLabel,
  roomStatus,
  occupantNames,
  focusAgentName,
  focusTaskTitle,
  officeMoodDetail,
  roomConversation
}: {
  room: SceneRoom;
  roomLabel: string;
  roomStatus: string;
  occupantNames: string[];
  focusAgentName: string | null;
  focusTaskTitle: string | null;
  officeMoodDetail: string;
  roomConversation: string | null;
}) => {
  if (room === "work" && focusTaskTitle) {
    return `${focusAgentName ?? "The active desk"} is driving ${truncate(focusTaskTitle, 56)} while the rest of the floor stays in reserve.`;
  }

  if (roomConversation) {
    return truncate(roomConversation, 90);
  }

  if (occupantNames.length > 0) {
    if (occupantNames.length === 1) {
      return `${occupantNames[0]} is posted in the ${roomLabel.toLowerCase()} right now.`;
    }

    if (occupantNames.length === 2) {
      return `${occupantNames[0]} and ${occupantNames[1]} are holding in the ${roomLabel.toLowerCase()}.`;
    }

    return `${occupantNames[0]}, ${occupantNames[1]}, and ${occupantNames.length - 2} others are spread across the ${roomLabel.toLowerCase()}.`;
  }

  if (room === "work") {
    return officeMoodDetail;
  }

  return `${roomLabel} is currently ${roomStatus}, with no one parked there right now.`;
};

const buildDeskLayout = (agents: AgentRecord[]) => {
  if (agents.length === 0) {
    return {} as Record<string, { x: number; y: number }>;
  }

  const columns = getDeskColumnCount(agents.length);
  const rows = Math.ceil(agents.length / columns);
  const rowYPositions = distributePositions(
    rows,
    rows === 1 ? 46 : rows === 2 ? 26 : 22,
    rows === 1 ? 46 : rows === 2 ? 74 : rows === 3 ? 74 : 80
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

const distributePositions = (count: number, start: number, end: number) => {
  if (count <= 1) {
    return [(start + end) / 2];
  }

  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, index) => start + step * index);
};
