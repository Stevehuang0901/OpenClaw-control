import { Component, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Html, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

import type { AgentSceneState, SceneFacing, ScenePose, SceneRoom } from "../lib/office";
import bedSingleModelUrl from "../assets/kenney-furniture/bedSingle.stl?url";
import benchCushionLowModelUrl from "../assets/kenney-furniture/benchCushionLow.stl?url";
import bookcaseClosedWideModelUrl from "../assets/kenney-furniture/bookcaseClosedWide.stl?url";
import booksModelUrl from "../assets/kenney-furniture/books.stl?url";
import cabinetTelevisionModelUrl from "../assets/kenney-furniture/cabinetTelevision.stl?url";
import chairDeskModelUrl from "../assets/kenney-furniture/chairDesk.stl?url";
import chairRoundedModelUrl from "../assets/kenney-furniture/chairRounded.stl?url";
import coatRackStandingModelUrl from "../assets/kenney-furniture/coatRackStanding.stl?url";
import computerKeyboardModelUrl from "../assets/kenney-furniture/computerKeyboard.stl?url";
import computerMouseModelUrl from "../assets/kenney-furniture/computerMouse.stl?url";
import computerScreenModelUrl from "../assets/kenney-furniture/computerScreen.stl?url";
import deskModelUrl from "../assets/kenney-furniture/desk.stl?url";
import hoodModernModelUrl from "../assets/kenney-furniture/hoodModern.stl?url";
import kitchenBarModelUrl from "../assets/kenney-furniture/kitchenBar.stl?url";
import kitchenCabinetDrawerModelUrl from "../assets/kenney-furniture/kitchenCabinetDrawer.stl?url";
import kitchenCabinetUpperDoubleModelUrl from "../assets/kenney-furniture/kitchenCabinetUpperDouble.stl?url";
import kitchenCoffeeMachineModelUrl from "../assets/kenney-furniture/kitchenCoffeeMachine.stl?url";
import kitchenFridgeLargeModelUrl from "../assets/kenney-furniture/kitchenFridgeLarge.stl?url";
import kitchenMicrowaveModelUrl from "../assets/kenney-furniture/kitchenMicrowave.stl?url";
import kitchenSinkModelUrl from "../assets/kenney-furniture/kitchenSink.stl?url";
import lampSquareFloorModelUrl from "../assets/kenney-furniture/lampSquareFloor.stl?url";
import laptopModelUrl from "../assets/kenney-furniture/laptop.stl?url";
import loungeChairRelaxModelUrl from "../assets/kenney-furniture/loungeChairRelax.stl?url";
import loungeSofaLongModelUrl from "../assets/kenney-furniture/loungeSofaLong.stl?url";
import rugRectangleModelUrl from "../assets/kenney-furniture/rugRectangle.stl?url";
import rugRoundedModelUrl from "../assets/kenney-furniture/rugRounded.stl?url";
import sideTableModelUrl from "../assets/kenney-furniture/sideTable.stl?url";
import sideTableDrawersModelUrl from "../assets/kenney-furniture/sideTableDrawers.stl?url";
import speakerModelUrl from "../assets/kenney-furniture/speaker.stl?url";
import stoolBarModelUrl from "../assets/kenney-furniture/stoolBar.stl?url";
import tableCoffeeGlassModelUrl from "../assets/kenney-furniture/tableCoffeeGlass.stl?url";
import televisionModernModelUrl from "../assets/kenney-furniture/televisionModern.stl?url";
import trashcanModelUrl from "../assets/kenney-furniture/trashcan.stl?url";

interface WorldAgentDescriptor {
  id: string;
  name: string;
  accent: string;
  role: string;
  scene: AgentSceneState;
}

interface WorldDeskDescriptor {
  id: string;
  name: string;
  accent: string;
  role: string;
  desk: {
    x: number;
    y: number;
  };
  active: boolean;
}

interface WorldZoneDescriptor {
  room: SceneRoom;
  label: string;
  status: string;
  active: boolean;
}

type OfficeRenderMode = "auto" | "3d" | "plan";

interface OfficeWorld3DProps {
  agents: WorldAgentDescriptor[];
  desks: WorldDeskDescriptor[];
  zones: WorldZoneDescriptor[];
  spotlightLabel: string;
  spotlightDetail: string;
  conversation: string | null;
  renderMode?: OfficeRenderMode;
}

type Vec3 = [number, number, number];

type RoomMeta = {
  center: Vec3;
  size: Vec3;
  badge: Vec3;
  floor: string;
  floorActive: string;
};

type AnchorMode = "floor" | "seat" | "bed" | "desk";

type ActivityAnchor = {
  roomX: number;
  roomY: number;
  world: Vec3;
  facing?: SceneFacing;
  scale?: number;
  yaw?: number;
  mode?: AnchorMode;
  accessWorld?: Vec3;
  surfaceHeight?: number;
};

type WorldAgentTarget = {
  id: string;
  name: string;
  accent: string;
  room: SceneRoom;
  pose: ScenePose;
  facing: SceneFacing;
  world: Vec3;
  scale: number;
  targetKey: string;
  yaw?: number;
  mode: AnchorMode;
  accessWorld: Vec3;
  surfaceHeight: number;
};

type RenderWorldAgent = WorldAgentTarget & {
  renderPose: ScenePose;
  renderFacing: SceneFacing;
  isMoving: boolean;
};

type WorldMotion = {
  path: Vec3[];
  segmentLengths: number[];
  totalLength: number;
  startedAt: number;
  durationMs: number;
  target: WorldAgentTarget;
};

const lobsterLegOffsets = [-0.28, 0.02, 0.32] as const;
const lobsterLegPhaseOffsets = [0, 0.9, 1.8] as const;
const lobsterTailSegmentOffsets = [0.0, 0.18, 0.34] as const;
const house = {
  center: [1.2, 0, 4.9] as Vec3,
  size: [22.4, 0.3, 15.6] as Vec3,
  wallHeight: 3.1
};

const worldRooms: Record<SceneRoom, RoomMeta> = {
  work: {
    center: [-2.5, 0.05, 1.2],
    size: [13.8, 0.08, 6.5],
    badge: [-7.5, 1.42, -0.4],
    floor: "#4a4235",
    floorActive: "#565044"
  },
  coffee: {
    center: [8.0, 0.05, 1.3],
    size: [4.6, 0.08, 6.5],
    badge: [7.0, 1.38, -0.4],
    floor: "#433730",
    floorActive: "#4d4037"
  },
  cards: {
    center: [-8.2, 0.05, 9.15],
    size: [5.3, 0.08, 4.8],
    badge: [-9.8, 1.34, 7.1],
    floor: "#27313b",
    floorActive: "#313c47"
  },
  nap: {
    center: [0.0, 0.05, 9.15],
    size: [5.8, 0.08, 4.8],
    badge: [-0.8, 1.34, 7.1],
    floor: "#30394b",
    floorActive: "#384457"
  },
  mahjong: {
    center: [8.2, 0.05, 9.15],
    size: [5.5, 0.08, 4.8],
    badge: [7.0, 1.34, 7.1],
    floor: "#24342f",
    floorActive: "#2d4039"
  }
};

const corridorGraph = {
  mainWest: [-8.2, 0.05, 4.1] as Vec3,
  mainCenter: [0.1, 0.05, 4.1] as Vec3,
  mainEast: [5.2, 0.05, 4.1] as Vec3,
  cardsDoor: [-8.2, 0.05, 6.9] as Vec3,
  napDoor: [0.0, 0.05, 6.9] as Vec3,
  mahjongDoor: [8.2, 0.05, 6.9] as Vec3,
  coffeeDoor: [5.2, 0.05, 1.8] as Vec3
};

const roomActivityAnchors: Partial<Record<SceneRoom, ActivityAnchor[]>> = {
  coffee: [
    {
      roomX: 34,
      roomY: 28,
      world: [7.08, 0.05, 2.16],
      facing: "right",
      yaw: -Math.PI / 2,
      scale: 0.96,
      mode: "floor"
    },
    {
      roomX: 52,
      roomY: 58,
      world: [8.58, 0.05, 2.18],
      facing: "left",
      yaw: Math.PI / 2,
      scale: 0.96,
      mode: "floor"
    }
  ],
  cards: [
    {
      roomX: 35,
      roomY: 30,
      world: [-10.28, 0.05, 9.94],
      accessWorld: [-10.28, 0.05, 9.14],
      yaw: 0,
      scale: 1,
      mode: "seat",
      surfaceHeight: 0.44
    },
    {
      roomX: 65,
      roomY: 30,
      world: [-6.12, 0.05, 9.94],
      accessWorld: [-6.12, 0.05, 9.14],
      yaw: 0,
      scale: 1,
      mode: "seat",
      surfaceHeight: 0.44
    }
  ],
  nap: [
    {
      roomX: 56,
      roomY: 24,
      world: [0.42, 0.05, 10.06],
      accessWorld: [2.48, 0.05, 10.74],
      yaw: -Math.PI / 2,
      scale: 1,
      mode: "bed",
      surfaceHeight: 0.8
    }
  ],
  mahjong: [
    {
      roomX: 50,
      roomY: 64,
      world: [8.2, 0.05, 7.98],
      accessWorld: [8.2, 0.05, 8.58],
      yaw: Math.PI,
      scale: 0.92,
      mode: "seat",
      surfaceHeight: 0.48
    },
    {
      roomX: 16,
      roomY: 38,
      world: [6.24, 0.05, 10.02],
      accessWorld: [6.9, 0.05, 10.02],
      yaw: -Math.PI / 2,
      scale: 0.92,
      mode: "seat",
      surfaceHeight: 0.48
    },
    {
      roomX: 84,
      roomY: 38,
      world: [10.16, 0.05, 10.02],
      accessWorld: [9.5, 0.05, 10.02],
      yaw: Math.PI / 2,
      scale: 0.92,
      mode: "seat",
      surfaceHeight: 0.48
    },
    {
      roomX: 50,
      roomY: 12,
      world: [8.2, 0.05, 12.0],
      accessWorld: [8.2, 0.05, 11.42],
      yaw: 0,
      scale: 0.92,
      mode: "seat",
      surfaceHeight: 0.48
    }
  ]
};

const roomLabelOffsets: Partial<Record<SceneRoom, string>> = {
  cards: "translate(-52%, -8%)",
  nap: "translate(-50%, -8%)",
  mahjong: "translate(-52%, -8%)"
};

let rectAreaLightsReady = false;
const preparedStlGeometryCache = new Map<string, THREE.BufferGeometry>();

class OfficeWorldCanvasBoundary extends Component<
  {
    fallback: ReactNode;
    children: ReactNode;
  },
  {
    hasError: boolean;
  }
> {
  state = {
    hasError: false
  };

  static getDerivedStateFromError() {
    return {
      hasError: true
    };
  }

  componentDidCatch(error: unknown) {
    console.error("OfficeWorld3D canvas render failed", error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export function OfficeWorld3D({
  agents,
  desks,
  zones,
  spotlightLabel,
  spotlightDetail,
  conversation,
  renderMode = "auto"
}: OfficeWorld3DProps) {
  const supportsWebGL = useMemo(() => detectWebGLSupport(), []);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const prefersPlanView = useMemo(() => {
    if (renderMode === "plan") {
      return true;
    }

    if (renderMode === "3d") {
      return false;
    }

    if (typeof window === "undefined") {
      return false;
    }

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const lowCoreCount = typeof navigator !== "undefined" && navigator.hardwareConcurrency <= 6;
    const lowMemory =
      typeof navigator !== "undefined" &&
      "deviceMemory" in navigator &&
      typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory === "number" &&
      ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;

    return Boolean(reducedMotion || lowCoreCount || lowMemory);
  }, [renderMode]);
  const targetAgents = useMemo(() => buildWorldAgentTargets(agents, desks), [agents, desks]);
  const [renderAgents, setRenderAgents] = useState<Record<string, RenderWorldAgent>>({});
  const motionsRef = useRef<Record<string, WorldMotion>>({});
  const previousTargetsRef = useRef<Record<string, WorldAgentTarget>>({});
  const fallbackNode = (
    <OfficeWorldFallback zones={zones} agents={Object.values(renderAgents)} desks={desks} />
  );

  useEffect(() => {
    const now = performance.now();

    setRenderAgents((current) => {
      const next = { ...current };
      const liveIds = new Set(targetAgents.map((agent) => agent.id));

      for (const target of targetAgents) {
        const previousTarget = previousTargetsRef.current[target.id];

        if (!previousTarget) {
          const path = buildInitialWorldPath(target);
          const totalLength = measureWorldPath(path);
          previousTargetsRef.current[target.id] = target;

          if (totalLength < 0.24) {
            next[target.id] = toRenderWorldAgent(target);
            continue;
          }

          motionsRef.current[target.id] = createWorldMotion(target, path, now);
          next[target.id] = {
            ...target,
            world: path[0] ?? target.world,
            renderPose: "walk",
            renderFacing: resolveWorldFacing(path, 0),
            isMoving: true
          };
          continue;
        }

        if (previousTarget.targetKey === target.targetKey) {
          next[target.id] = {
            ...(next[target.id] ?? toRenderWorldAgent(target)),
            ...target,
            renderPose: next[target.id]?.renderPose ?? target.pose,
            renderFacing: next[target.id]?.renderFacing ?? target.facing,
            isMoving: next[target.id]?.isMoving ?? false
          };
          previousTargetsRef.current[target.id] = target;
          continue;
        }

        const currentMotion = motionsRef.current[target.id];
        const startWorld = currentMotion
          ? sampleWorldPath(currentMotion, now)
          : previousTarget.mode === "seat" || previousTarget.mode === "bed"
            ? previousTarget.accessWorld
            : next[target.id]?.world ?? previousTarget.world;
        const startRoom = currentMotion?.target.room ?? previousTarget.room;
        const path = buildWorldWalkPath(
          startWorld,
          target.world,
          startRoom,
          target.room,
          currentMotion?.target.mode ?? previousTarget.mode,
          target.mode,
          currentMotion?.target.accessWorld ?? previousTarget.accessWorld,
          target.accessWorld
        );
        const totalLength = measureWorldPath(path);
        previousTargetsRef.current[target.id] = target;

        if (totalLength < 0.24) {
          delete motionsRef.current[target.id];
          next[target.id] = toRenderWorldAgent(target);
          continue;
        }

        motionsRef.current[target.id] = createWorldMotion(target, path, now);
        next[target.id] = {
          ...target,
          world: startWorld,
          renderPose: "walk",
          renderFacing: resolveWorldFacing(path, 0),
          isMoving: true
        };
      }

      for (const agentId of Object.keys(next)) {
        if (!liveIds.has(agentId) && !motionsRef.current[agentId]) {
          delete next[agentId];
          delete previousTargetsRef.current[agentId];
        }
      }

      return next;
    });
  }, [targetAgents]);

  useEffect(() => {
    if (Object.keys(motionsRef.current).length === 0) {
      return;
    }

    let frame = 0;

    const tick = () => {
      const now = performance.now();
      let hasActiveMotion = false;

      setRenderAgents((current) => {
        const next = { ...current };

        for (const [agentId, motion] of Object.entries(motionsRef.current)) {
          const progress = Math.min(1, (now - motion.startedAt) / motion.durationMs);
          const world = progress >= 1 ? motion.target.world : sampleWorldPath(motion, now);
          const done = progress >= 1;

          next[agentId] = {
            ...motion.target,
            world,
            renderPose: done ? motion.target.pose : "walk",
            renderFacing: done ? motion.target.facing : resolveWorldFacing(motion.path, progress),
            isMoving: !done
          };

          if (done) {
            delete motionsRef.current[agentId];
          } else {
            hasActiveMotion = true;
          }
        }

        return next;
      });

      if (hasActiveMotion) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [targetAgents]);

  const canvasReady = supportsWebGL && !webglUnavailable && !prefersPlanView;
  const sceneAgentList = useMemo(() => Object.values(renderAgents), [renderAgents]);

  return (
    <div className="oc-world3d-shell">
      {!canvasReady ? (
        fallbackNode
      ) : (
        <OfficeWorldCanvasBoundary fallback={fallbackNode}>
          <Canvas
            shadows
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
            camera={{ position: [1.2, 18, -4], fov: 50, near: 0.1, far: 80 }}
            style={{ position: "absolute", inset: 0, borderRadius: "inherit" }}
            onCreated={({ gl: renderer, camera }) => {
              renderer.setClearColor(new THREE.Color("#0c1218"));
              camera.lookAt(1.2, 0, 5);
              camera.updateProjectionMatrix();
            }}
          >
            <CameraRig />
            <OfficeWorldScene
              agents={sceneAgentList}
              desks={desks}
              zones={zones}
            />
          </Canvas>
        </OfficeWorldCanvasBoundary>
      )}

      <WorldOverlay spotlightLabel={spotlightLabel} spotlightDetail={spotlightDetail} conversation={conversation} />
    </div>
  );
}

function WorldOverlay({
  spotlightLabel: _spotlightLabel,
  spotlightDetail: _spotlightDetail,
  conversation
}: Pick<OfficeWorld3DProps, "spotlightLabel" | "spotlightDetail" | "conversation">) {
  return (
    <div className="oc-world3d-overlay">
      {conversation ? <div className="oc-world3d-chat">{conversation}</div> : null}
    </div>
  );
}

const planRoomOrder: SceneRoom[] = ["work", "coffee", "cards", "nap", "mahjong"];
const houseMinX = house.center[0] - house.size[0] / 2;
const houseMinZ = house.center[2] - house.size[2] / 2;
const planPaddingX = 0.055;
const planPaddingZ = 0.06;

const normalizePlanX = (worldX: number) =>
  planPaddingX + ((worldX - houseMinX) / house.size[0]) * (1 - planPaddingX * 2);

const normalizePlanZ = (worldZ: number) =>
  planPaddingZ + ((worldZ - houseMinZ) / house.size[2]) * (1 - planPaddingZ * 2);

const buildPlanRectStyle = (center: Vec3, size: Vec3) => ({
  left: `${normalizePlanX(center[0] - size[0] / 2) * 100}%`,
  top: `${normalizePlanZ(center[2] - size[2] / 2) * 100}%`,
  width: `${(size[0] / house.size[0]) * (1 - planPaddingX * 2) * 100}%`,
  height: `${(size[2] / house.size[2]) * (1 - planPaddingZ * 2) * 100}%`
});

const projectWorldToPlan = (world: Vec3) => ({
  left: `${clamp(normalizePlanX(world[0]), 0.04, 0.96) * 100}%`,
  top: `${clamp(normalizePlanZ(world[2]), 0.06, 0.94) * 100}%`
});

const projectWorldToRoom = (room: SceneRoom, world: Vec3) => {
  const meta = worldRooms[room];
  const roomMinX = meta.center[0] - meta.size[0] / 2;
  const roomMinZ = meta.center[2] - meta.size[2] / 2;

  return {
    left: `${clamp((world[0] - roomMinX) / meta.size[0], 0.08, 0.92) * 100}%`,
    top: `${clamp((world[2] - roomMinZ) / meta.size[2], 0.08, 0.92) * 100}%`
  };
};

const roomToneClass: Record<SceneRoom, string> = {
  work: "is-work",
  coffee: "is-coffee",
  cards: "is-cards",
  nap: "is-nap",
  mahjong: "is-mahjong"
};

function OfficeWorldScene({
  desks,
  zones,
  agents
}: {
  desks: WorldDeskDescriptor[];
  zones: WorldZoneDescriptor[];
  agents: RenderWorldAgent[];
}) {
  return (
    <>
      <SceneEnvironment />
      <color attach="background" args={["#0a0f16"]} />
      <fog attach="fog" args={["#0a0f16", 28, 58]} />
      {/* Raised ambient for overall visibility */}
      <ambientLight intensity={0.52} />
      <hemisphereLight args={["#5a7590", "#080c12", 0.48]} />
      {/* Main directional (sun-like key light) */}
      <directionalLight
        castShadow
        intensity={0.82}
        color="#a8bfd4"
        position={[14, 22, 8]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      {/* Warm fill from below to soften harsh shadows */}
      <directionalLight intensity={0.18} color="#d4a670" position={[-6, -2, 4]} />
      {/* Room-specific accent lights */}
      <pointLight position={[-2.2, 4.3, 1.6]} intensity={12} color="#d8a774" distance={22} decay={2} />
      <pointLight position={[-8.2, 3.4, 9.6]} intensity={5} color="#7ca6d8" distance={13} decay={1.8} />
      <pointLight position={[0.0, 3.2, 9.9]} intensity={4.6} color="#8d80c8" distance={13} decay={1.8} />
      <pointLight position={[8.2, 3.5, 9.8]} intensity={5} color="#8cc99a" distance={13} decay={1.8} />
      {/* Work area ceiling panel */}
      <rectAreaLight
        width={10.4}
        height={2.3}
        intensity={9}
        color="#c48957"
        position={[-2.4, 3.18, 1.2]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      {/* Tea pantry warm glow */}
      <rectAreaLight
        width={2.8}
        height={3.8}
        intensity={5.4}
        color="#d2a472"
        position={[8.16, 2.88, 1.38]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <group position={[0, 0, 0]}>
        <OuterGround />
        <OfficeShell />
        <InteriorFloor />
        <CorridorNetwork />
        {zones.map((zone) => (
          <RoomFloor key={zone.room} zone={zone} />
        ))}
        <Suspense fallback={null}>
          <WorkArea desks={desks} />
          <ScreeningLounge />
          <NapRoom />
          <TeaPantry />
          <MahjongRoom />
        </Suspense>
        <Plants />
        {zones.map((zone) => (
          <RoomBadge key={`${zone.room}-badge`} zone={zone} />
        ))}
        {agents.map((agent) => (
          <LobsterActor key={agent.id} agent={agent} />
        ))}
      </group>
    </>
  );
}

function SceneEnvironment() {
  const { gl, scene } = useThree();

  useEffect(() => {
    if (!rectAreaLightsReady) {
      RectAreaLightUniformsLib.init();
      rectAreaLightsReady = true;
    }

    const previousEnvironment = scene.environment;
    const previousToneMapping = gl.toneMapping;
    const previousToneMappingExposure = gl.toneMappingExposure;
    const previousOutputColorSpace = gl.outputColorSpace;
    const pmremGenerator = new THREE.PMREMGenerator(gl);
    const environment = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(environment, 0.08);

    scene.environment = envTarget.texture;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 0.72;

    return () => {
      scene.environment = previousEnvironment;
      gl.toneMapping = previousToneMapping;
      gl.toneMappingExposure = previousToneMappingExposure;
      gl.outputColorSpace = previousOutputColorSpace;
      envTarget.dispose();
      environment.dispose();
      pmremGenerator.dispose();
    };
  }, [gl, scene]);

  return null;
}

function CameraRig() {
  const { camera } = useThree();
  const initialized = useRef(false);

  useFrame(() => {
    if (!initialized.current) {
      camera.position.set(1.2, 18, -4);
      camera.lookAt(1.2, 0, 5.5);
      camera.updateProjectionMatrix();
      initialized.current = true;
    }
  });

  return null;
}

function OfficeWorldFallback({
  zones,
  agents,
  desks
}: {
  zones: WorldZoneDescriptor[];
  agents: RenderWorldAgent[];
  desks: WorldDeskDescriptor[];
}) {
  const roomOrder: SceneRoom[] = ["work", "coffee", "cards", "nap", "mahjong"];
  const zoneByRoom = new Map(zones.map((zone) => [zone.room, zone]));
  const embeddedAgents = agents.filter((agent) => !agent.isMoving && (agent.room !== "work" || agent.mode === "desk"));
  const embeddedIds = new Set(embeddedAgents.map((agent) => agent.id));
  const overlayAgents = agents.filter((agent) => !embeddedIds.has(agent.id));
  const embeddedAgentsByRoom = roomOrder.reduce<Record<SceneRoom, RenderWorldAgent[]>>(
    (acc, room) => ({
      ...acc,
      [room]: embeddedAgents.filter((agent) => agent.room === room)
    }),
    {
      work: [],
      coffee: [],
      cards: [],
      nap: [],
      mahjong: []
    }
  );

  return (
    <div className="oc-world-plan" role="img" aria-label="OpenClaw office floor plan">
      <div className="oc-world-plan-house">
        <div className="oc-world-plan-floor" />
        <div className="oc-world-plan-corridor is-main" style={buildPlanRectStyle([0.0, 0, 4.1], [18.4, 0, 1.28])} />
        <div className="oc-world-plan-corridor is-vertical" style={buildPlanRectStyle([5.2, 0, 1.4], [1.22, 0, 7.4])} />
        <div className="oc-world-plan-corridor is-branch" style={buildPlanRectStyle([-8.2, 0, 6.55], [1.12, 0, 3.88])} />
        <div className="oc-world-plan-corridor is-branch" style={buildPlanRectStyle([0.0, 0, 6.55], [1.12, 0, 3.88])} />
        <div className="oc-world-plan-corridor is-branch" style={buildPlanRectStyle([8.2, 0, 6.55], [1.12, 0, 3.88])} />

        {planRoomOrder.map((room) => {
          const zone = zoneByRoom.get(room);
          const meta = worldRooms[room];

          return (
            <section
              key={room}
              className={`oc-world-plan-room ${roomToneClass[room]} ${zone?.active ? "is-active" : ""}`}
              style={buildPlanRectStyle(meta.center, meta.size)}
            >
              <header className="oc-world-plan-room-header">
                <strong>{zone?.label ?? room}</strong>
                <span>{zone?.status ?? "open"}</span>
              </header>

              <div className="oc-world-plan-room-content">
                {room === "work" ? <PlanWorkRoom desks={desks} agents={embeddedAgentsByRoom.work} /> : null}
                {room === "coffee" ? <PlanTeaPantryRoom agents={embeddedAgentsByRoom.coffee} /> : null}
                {room === "cards" ? <PlanScreeningRoom agents={embeddedAgentsByRoom.cards} /> : null}
                {room === "nap" ? <PlanNapRoom agents={embeddedAgentsByRoom.nap} /> : null}
                {room === "mahjong" ? <PlanMahjongRoom agents={embeddedAgentsByRoom.mahjong} /> : null}
              </div>
            </section>
          );
        })}

        <div className="oc-world-agent-layer">
          {overlayAgents.map((agent) => (
            <WorldAgentToken key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PlanWorkRoom({
  desks,
  agents
}: {
  desks: WorldDeskDescriptor[];
  agents: RenderWorldAgent[];
}) {
  const deskAgentById = new Map(agents.map((agent) => [agent.id, agent]));

  return (
    <div className="oc-plan-stage oc-plan-stage-work">
      <div className="oc-plan-stage-wall" />
      <div className="oc-plan-stage-floor" />
      <div className="oc-plan-stage-lightwash" />
      <div className="oc-plan-work-windowband" />
      <div className="oc-plan-work-wallband" />
      <div className="oc-plan-work-aisle" />
      {desks.slice(0, 6).map((desk) => {
        const world = mapDeskToWorld(desk.desk);
        const position = projectWorldToRoom("work", world);

        return (
          <div
            key={desk.id}
            className={`oc-plan-desk ${desk.active ? "is-active" : ""}`}
            style={{ left: position.left, top: position.top }}
          >
            <div className="oc-plan-desk-surface" />
            <div className="oc-plan-desk-monitor" />
            <div className="oc-plan-desk-monitor is-secondary" />
            <div className="oc-plan-desk-dock" />
            <div className="oc-plan-desk-keyboard" />
            <div className="oc-plan-desk-mouse" />
            <div className="oc-plan-desk-laptop" />
            <div className="oc-plan-desk-lamp" />
            <div className="oc-plan-desk-chair" />
            {deskAgentById.has(desk.id) ? (
              <RoomStageActor agent={deskAgentById.get(desk.id)!} roomClass="workdesk" fixedPosition />
            ) : null}
            <span>{desk.name}</span>
          </div>
        );
      })}
      <div className="oc-plan-work-credenza" />
      <div className="oc-plan-work-shelf" />
      <div className="oc-plan-work-plant" />
    </div>
  );
}

function PlanTeaPantryRoom({
  agents
}: {
  agents: RenderWorldAgent[];
}) {
  return (
    <div className="oc-plan-stage oc-plan-stage-pantry">
      <div className="oc-plan-stage-wall" />
      <div className="oc-plan-stage-floor" />
      <div className="oc-plan-stage-lightwash" />
      <div className="oc-plan-pantry-backsplash" />
      <div className="oc-plan-pantry-upper" />
      <div className="oc-plan-pantry-counter is-left" />
      <div className="oc-plan-pantry-counter is-center" />
      <div className="oc-plan-pantry-counter is-right" />
      <div className="oc-plan-pantry-bar" />
      <div className="oc-plan-pantry-fridge" />
      <div className="oc-plan-pantry-sink" />
      <div className="oc-plan-pantry-mugs" />
      <div className="oc-plan-pantry-stool is-left" />
      <div className="oc-plan-pantry-stool is-right" />
      {agents.map((agent) => (
        <RoomStageActor key={agent.id} agent={agent} roomClass="pantry" />
      ))}
    </div>
  );
}

function PlanScreeningRoom({
  agents
}: {
  agents: RenderWorldAgent[];
}) {
  return (
    <div className="oc-plan-stage oc-plan-stage-screening">
      <div className="oc-plan-stage-wall" />
      <div className="oc-plan-stage-floor" />
      <div className="oc-plan-stage-lightwash" />
      <div className="oc-plan-screen-glow" />
      <div className="oc-plan-screen" />
      <div className="oc-plan-screen-console" />
      <div className="oc-plan-speaker is-left" />
      <div className="oc-plan-speaker is-right" />
      <div className="oc-plan-sofa" />
      <div className="oc-plan-lounge-chair is-left" />
      <div className="oc-plan-lounge-chair is-right" />
      <div className="oc-plan-coffee-table" />
      {agents.map((agent) => (
        <RoomStageActor key={agent.id} agent={agent} roomClass="screening" />
      ))}
    </div>
  );
}

function PlanNapRoom({
  agents
}: {
  agents: RenderWorldAgent[];
}) {
  return (
    <div className="oc-plan-stage oc-plan-stage-nap">
      <div className="oc-plan-stage-wall" />
      <div className="oc-plan-stage-floor" />
      <div className="oc-plan-stage-lightwash" />
      <div className="oc-plan-nap-headboard" />
      <div className="oc-plan-bed-frame">
        <div className="oc-plan-bed-pillow" />
        <div className="oc-plan-bed-blanket" />
      </div>
      <div className="oc-plan-bedside" />
      <div className="oc-plan-floor-lamp" />
      <div className="oc-plan-nap-bench" />
      {agents.map((agent) => (
        <RoomStageActor key={agent.id} agent={agent} roomClass="nap" />
      ))}
    </div>
  );
}

function PlanMahjongRoom({
  agents
}: {
  agents: RenderWorldAgent[];
}) {
  return (
    <div className="oc-plan-stage oc-plan-stage-mahjong">
      <div className="oc-plan-stage-wall" />
      <div className="oc-plan-stage-floor" />
      <div className="oc-plan-stage-lightwash" />
      <div className="oc-plan-mahjong-panel" />
      <div className="oc-plan-mahjong-table" />
      <div className="oc-plan-mahjong-felt" />
      <div className="oc-plan-mahjong-tiles is-north" />
      <div className="oc-plan-mahjong-tiles is-south" />
      <div className="oc-plan-mahjong-tiles is-east" />
      <div className="oc-plan-mahjong-tiles is-west" />
      <div className="oc-plan-mahjong-chair is-north" />
      <div className="oc-plan-mahjong-chair is-south" />
      <div className="oc-plan-mahjong-chair is-east" />
      <div className="oc-plan-mahjong-chair is-west" />
      <div className="oc-plan-mahjong-sideboard" />
      <div className="oc-plan-mahjong-lamp" />
      {agents.map((agent) => (
        <RoomStageActor key={agent.id} agent={agent} roomClass="mahjong" />
      ))}
    </div>
  );
}

function RoomStageActor({
  agent,
  roomClass,
  fixedPosition = false
}: {
  agent: RenderWorldAgent;
  roomClass: string;
  fixedPosition?: boolean;
}) {
  const position = projectWorldToRoom(agent.room, agent.world);

  return (
    <div
      className={`oc-world-agent oc-plan-room-actor oc-plan-room-actor-${roomClass} oc-world-pose-${agent.renderPose} ${fixedPosition ? "is-fixed" : ""}`}
      style={
        fixedPosition
          ? ({
              "--oc-world-scale": agent.scale.toString(),
              "--oc-agent-accent": agent.accent
            } as CSSProperties)
          : ({
              left: position.left,
              top: position.top,
              "--oc-world-scale": agent.scale.toString(),
              "--oc-agent-accent": agent.accent
            } as CSSProperties)
      }
    >
      <div className={`oc-world-agent-orient oc-world-facing-${agent.renderFacing}`}>
        <div className="oc-world-agent-sprite">
          <WorldLobsterSprite />
        </div>
      </div>
    </div>
  );
}

function WorldAgentToken({
  agent
}: {
  agent: RenderWorldAgent;
}) {
  const position = projectWorldToPlan(agent.world);

  return (
    <div
      className={`oc-world-agent oc-world-pose-${agent.renderPose}`}
      style={
        {
          left: position.left,
          top: position.top,
          "--oc-world-scale": agent.scale.toString(),
          "--oc-agent-accent": agent.accent
        } as CSSProperties
      }
    >
      <div className={`oc-world-agent-orient oc-world-facing-${agent.renderFacing}`}>
        <div className="oc-world-agent-sprite">
          <WorldLobsterSprite />
        </div>
      </div>
    </div>
  );
}

function WorldLobsterSprite() {
  return (
    <svg viewBox="0 0 72 72" className="oc-world-lobster-svg" aria-hidden="true">
      <ellipse className="oc-world-lobster-shadow" cx="36" cy="63" rx="18" ry="6" />
      <g className="oc-world-lobster-legs oc-world-lobster-legs-left">
        <path d="M24 43 C18 44 15 47 12 51" />
        <path d="M25 47 C19 49 16 53 14 57" />
      </g>
      <g className="oc-world-lobster-legs oc-world-lobster-legs-right">
        <path d="M48 43 C54 44 57 47 60 51" />
        <path d="M47 47 C53 49 56 53 58 57" />
      </g>
      <g className="oc-world-lobster-claw-group oc-world-lobster-claw-group-left">
        <path d="M17 30 C12 28 11 22 15 19 C19 16 24 18 25 23 C26 28 22 31 17 30 Z" />
        <path d="M24 28 C21 30 20 33 20 36" />
      </g>
      <g className="oc-world-lobster-claw-group oc-world-lobster-claw-group-right">
        <path d="M55 30 C60 28 61 22 57 19 C53 16 48 18 47 23 C46 28 50 31 55 30 Z" />
        <path d="M48 28 C51 30 52 33 52 36" />
      </g>
      <path className="oc-world-lobster-tail" d="M29 51 C24 54 24 61 30 64 C34 66 38 66 42 64 C48 61 48 54 43 51 Z" />
      <ellipse className="oc-world-lobster-body" cx="36" cy="39" rx="16" ry="14" />
      <ellipse className="oc-world-lobster-belly" cx="36" cy="45" rx="11" ry="8" />
      <ellipse className="oc-world-lobster-head" cx="36" cy="24" rx="12" ry="10" />
      <ellipse className="oc-world-lobster-highlight" cx="31" cy="33" rx="6" ry="4" />
      <path className="oc-world-lobster-eye-stalk" d="M31 12 L30 5" />
      <path className="oc-world-lobster-eye-stalk" d="M41 12 L42 5" />
      <circle className="oc-world-lobster-eye-dot" cx="30" cy="5" r="2.4" />
      <circle className="oc-world-lobster-eye-dot" cx="42" cy="5" r="2.4" />
    </svg>
  );
}

function OuterGround() {
  return (
    <group>
      {/* Distant ground */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[house.center[0], -0.32, house.center[2]]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#060a0e" roughness={1} />
      </mesh>
      {/* Pavement around building */}
      <Block
        position={[house.center[0], -0.24, house.center[2]]}
        size={[house.size[0] + 4, 0.16, house.size[2] + 4]}
        color="#0e1418"
        roughness={0.98}
        receiveShadow
      />
    </group>
  );
}

function OfficeShell() {
  const hx = house.size[0] / 2;
  const hz = house.size[2] / 2;
  const cx = house.center[0];
  const cz = house.center[2];
  const wh = house.wallHeight;
  const wallThick = 0.2;

  return (
    <group>
      {/* ===== CONTINUOUS FLOOR SLAB ===== */}
      {/* This is the main building floor - one solid piece */}
      <Block
        position={[cx, -0.08, cz]}
        size={[house.size[0], 0.16, house.size[2]]}
        color="#1e2830"
        roughness={0.96}
        receiveShadow
      />
      {/* Floor surface - slightly lighter, continuous across the whole building */}
      <Block
        position={[cx, 0.01, cz]}
        size={[house.size[0] - 0.4, 0.02, house.size[2] - 0.4]}
        color="#28323c"
        roughness={0.94}
        receiveShadow
      />

      {/* ===== EXTERIOR WALLS (4 sides, fully enclosed) ===== */}
      {/* North wall (front, with windows) */}
      <Block
        position={[cx, wh / 2, cz - hz]}
        size={[house.size[0] + wallThick, wh, wallThick]}
        color="#2a3542"
        roughness={0.92}
        receiveShadow
      />
      {/* South wall (back) */}
      <Block
        position={[cx, wh / 2, cz + hz]}
        size={[house.size[0] + wallThick, wh, wallThick]}
        color="#252f3a"
        roughness={0.92}
        receiveShadow
      />
      {/* West wall (left) */}
      <Block
        position={[cx - hx, wh / 2, cz]}
        size={[wallThick, wh, house.size[2]]}
        color="#2d3844"
        roughness={0.92}
        receiveShadow
      />
      {/* East wall (right) */}
      <Block
        position={[cx + hx, wh / 2, cz]}
        size={[wallThick, wh, house.size[2]]}
        color="#293440"
        roughness={0.92}
        receiveShadow
      />

      {/* ===== CEILING EDGE STRIPS (architectural cutaway - only visible at edges) ===== */}
      {/* North ceiling overhang (visible from camera angle) */}
      <Block
        position={[cx, wh - 0.06, cz - hz + 0.8]}
        size={[house.size[0] - 0.2, 0.1, 1.4]}
        color="#1a2230"
        roughness={0.98}
      />
      {/* West ceiling overhang */}
      <Block
        position={[cx - hx + 0.6, wh - 0.06, cz]}
        size={[1.0, 0.1, house.size[2] - 0.4]}
        color="#182030"
        roughness={0.98}
      />
      {/* East ceiling overhang */}
      <Block
        position={[cx + hx - 0.6, wh - 0.06, cz]}
        size={[1.0, 0.1, house.size[2] - 0.4]}
        color="#182030"
        roughness={0.98}
      />

      {/* ===== BASEBOARDS along all walls ===== */}
      {/* North */}
      <Baseboard position={[cx, 0.1, cz - hz + 0.2]} size={[house.size[0] - 1, 0.14, 0.1]} />
      {/* South */}
      <Baseboard position={[cx, 0.1, cz + hz - 0.2]} size={[house.size[0] - 1, 0.14, 0.1]} />
      {/* West */}
      <Baseboard position={[cx - hx + 0.2, 0.1, cz]} size={[0.1, 0.14, house.size[2] - 1]} />
      {/* East */}
      <Baseboard position={[cx + hx - 0.2, 0.1, cz]} size={[0.1, 0.14, house.size[2] - 1]} />

      {/* ===== WINDOWS (north wall) ===== */}
      <WindowRibbon position={[-3.8, 1.8, cz - hz + 0.02]} width={3.8} />
      <WindowRibbon position={[1.2, 1.8, cz - hz + 0.02]} width={3.8} />
      <WindowRibbon position={[7.6, 1.8, cz - hz + 0.02]} width={2.8} />

      {/* ===== INTERIOR PARTITION WALLS ===== */}

      {/* --- Main corridor wall (separating front row from back row) --- */}
      {/* This wall runs east-west across the building with 3 doorways */}
      {/* Segment: west wall to cards doorway */}
      <Block position={[cx - hx + 1.6, wh * 0.35, 5.1]} size={[3.0, wh * 0.7, 0.14]} color="#323e4a" roughness={0.9} />
      {/* Segment: cards doorway to nap doorway */}
      <Block position={[-4.1, wh * 0.35, 5.1]} size={[6.8, wh * 0.7, 0.14]} color="#323e4a" roughness={0.9} />
      {/* Segment: nap doorway to mahjong doorway */}
      <Block position={[4.1, wh * 0.35, 5.1]} size={[6.8, wh * 0.7, 0.14]} color="#323e4a" roughness={0.9} />
      {/* Segment: mahjong doorway to east wall */}
      <Block position={[cx + hx - 1.6, wh * 0.35, 5.1]} size={[3.0, wh * 0.7, 0.14]} color="#323e4a" roughness={0.9} />

      {/* --- Work/Coffee vertical partition --- */}
      <Block position={[5.5, wh * 0.38, 1.2]} size={[0.14, wh * 0.75, 5.0]} color="#303c48" roughness={0.9} />

      {/* --- Cards/Nap vertical partition --- */}
      <Block position={[-3.05, wh * 0.35, 9.15]} size={[0.14, wh * 0.7, 4.6]} color="#303c48" roughness={0.9} />

      {/* --- Nap/Mahjong vertical partition --- */}
      <Block position={[5.45, wh * 0.35, 9.15]} size={[0.14, wh * 0.7, 4.6]} color="#303c48" roughness={0.9} />

      {/* ===== DOOR TRIMS ===== */}
      <DoorTrim position={[-8.2, 0.62, 5.1]} width={1.5} />
      <DoorTrim position={[0.0, 0.62, 5.1]} width={1.5} />
      <DoorTrim position={[8.2, 0.62, 5.1]} width={1.5} />
      <DoorTrim position={[5.42, 0.68, 1.72]} width={1.2} depth />

      {/* ===== GLASS PARTITIONS (decorative) ===== */}
      <GlassRail position={[8.9, 0.7, 3.1]} size={[4.5, 1.0, 0.08]} />
    </group>
  );
}

function InteriorFloor() {
  // The main floor is now in OfficeShell. This just adds corridor accents.
  return (
    <group>
      {/* Corridor floor accent strip - runs east-west */}
      <RoundedBlock
        position={[house.center[0], 0.026, 4.1]}
        size={[house.size[0] - 1.0, 0.008, 1.6]}
        color="#333d48"
        roughness={0.92}
        radius={0.06}
      />
      {/* Corridor center line */}
      <RoundedBlock
        position={[house.center[0], 0.032, 4.1]}
        size={[house.size[0] - 1.4, 0.003, 0.12]}
        color="#4a5662"
        roughness={0.6}
        radius={0.03}
      />
    </group>
  );
}

function CorridorNetwork() {
  // Floor is now continuous in OfficeShell. Corridors only need doorway floor accents.
  return (
    <group>
      {/* Doorway threshold accents - show where doors are */}
      <RoundedBlock position={[-8.2, 0.028, 5.1]} size={[1.6, 0.008, 0.5]} color="#3a4550" roughness={0.88} radius={0.04} />
      <RoundedBlock position={[0.0, 0.028, 5.1]} size={[1.6, 0.008, 0.5]} color="#3a4550" roughness={0.88} radius={0.04} />
      <RoundedBlock position={[8.2, 0.028, 5.1]} size={[1.6, 0.008, 0.5]} color="#3a4550" roughness={0.88} radius={0.04} />
      <RoundedBlock position={[5.42, 0.028, 1.72]} size={[0.5, 0.008, 1.4]} color="#3a4550" roughness={0.88} radius={0.04} />
    </group>
  );
}

function RoomFloor({
  zone
}: {
  zone: WorldZoneDescriptor;
}) {
  const room = worldRooms[zone.room];
  const edgeColor =
    zone.room === "work"
      ? "#615648"
      : zone.room === "coffee"
        ? "#5b4f46"
        : zone.room === "cards"
          ? "#445460"
          : zone.room === "nap"
            ? "#52617c"
            : "#3c564a";
  const fillColor = zone.active
    ? zone.room === "work"
      ? "#544b3e"
      : zone.room === "coffee"
        ? "#4a3d35"
        : zone.room === "cards"
          ? "#33414d"
          : zone.room === "nap"
            ? "#44506a"
            : "#305045"
    : zone.room === "work"
      ? "#4b4338"
      : zone.room === "coffee"
        ? "#40342d"
        : zone.room === "cards"
          ? "#2c3843"
          : zone.room === "nap"
            ? "#39445a"
            : "#28443b";
  const rugColor = zone.room === "work"
    ? "#75644f"
    : zone.room === "coffee"
      ? "#6d5c50"
      : zone.room === "cards"
        ? "#3d4d5a"
        : zone.room === "nap"
          ? "#596987"
          : "#35594d";

  return (
    <group>
      {/* Room floor area - thin overlay on the continuous building floor */}
      <RoundedBlock
        position={[room.center[0], 0.024, room.center[2]]}
        size={[room.size[0] - 0.3, 0.006, room.size[2] - 0.3]}
        color={fillColor}
        roughness={0.96}
        receiveShadow
        radius={0.08}
      />
      {/* Room rug / carpet area */}
      <RoundedBlock
        position={[room.center[0], 0.03, room.center[2]]}
        size={[room.size[0] - 1.2, 0.004, room.size[2] - 1.2]}
        color={rugColor}
        roughness={0.92}
        radius={0.06}
      />
    </group>
  );
}

function WorkArea({
  desks
}: {
  desks: WorldDeskDescriptor[];
}) {
  return (
    <group>
      <Block position={[-2.5, 0.07, 1.2]} size={[12.8, 0.01, 0.34]} color="#3c4249" roughness={1} />
      <Block position={[-2.5, 0.07, 2.86]} size={[12.8, 0.01, 0.26]} color="#343a43" roughness={1} />
      {desks.map((desk) => {
        const [x, y, z] = mapDeskToWorld(desk.desk);
        return <DeskCluster key={desk.id} position={[x, y, z]} active={desk.active} />;
      })}
      <Bookcase position={[4.18, 0.02, 2.96]} scale={[3.3, 1.7, 1.34]} />
      <CoatRack position={[4.98, 0.02, 2.3]} />
      <TrashCan position={[3.44, 0.02, 3.04]} />
      <Plant position={[5.24, 0.12, 3.2]} scale={0.84} />
    </group>
  );
}

function ScreeningLounge() {
  return (
    <group>
      <RugModel position={[-8.2, 0.048, 10.14]} rotation={[0, Math.PI, 0]} scale={[6.8, 1.08, 5.5]} color="#22313b" roughness={0.94} url={rugRoundedModelUrl} />
      {/* TV console / stand first, then TV on top */}
      <TelevisionConsole position={[-8.2, 0.04, 7.52]} />
      <FurnitureModel
        url={televisionModernModelUrl}
        position={[-8.2, 0.72, 7.42]}
        rotation={[0, Math.PI, 0]}
        scale={[5.8, 1.42, 0.54]}
        color="#131a21"
        roughness={0.34}
        emissive="#1f3b52"
        emissiveIntensity={0.32}
      />
      {/* Speakers flanking the TV */}
      <SpeakerTower position={[-10.28, 0.04, 7.52]} />
      <SpeakerTower position={[-6.12, 0.04, 7.52]} />
      {/* Sofa centered behind coffee table */}
      <Sofa position={[-8.2, 0.04, 10.48]} />
      {/* Relax chairs on either side */}
      <RelaxChair position={[-10.28, 0.04, 9.94]} rotationY={Math.PI / 10} />
      <RelaxChair position={[-6.12, 0.04, 9.94]} rotationY={-Math.PI / 10} />
      {/* Coffee table between TV and sofa */}
      <FurnitureModel
        url={tableCoffeeGlassModelUrl}
        position={[-8.2, 0.04, 9.08]}
        rotation={[0, Math.PI, 0]}
        scale={[2.8, 1.12, 2.2]}
        color="#d6cbbb"
        roughness={0.42}
        metalness={0.08}
      />
      <SideCabinet position={[-10.28, 0.02, 11.32]} scale={[1.9, 1.04, 0.94]} />
      <FloorLamp position={[-6.08, 0.04, 11.28]} />
      <FurnitureModel
        url={booksModelUrl}
        position={[-10.28, 0.66, 11.28]}
        rotation={[0, Math.PI / 4, 0]}
        scale={[1.24, 1.24, 1.24]}
        color="#d9ccb8"
        roughness={0.84}
      />
    </group>
  );
}

function NapRoom() {
  return (
    <group>
      <RugModel position={[0.04, 0.044, 10.06]} scale={[6.4, 1.02, 4.7]} color="#455676" roughness={0.96} url={rugRectangleModelUrl} />
      <RoundedBlock position={[0, 1.22, 7.18]} size={[4.6, 0.1, 0.2]} color="#a49a89" roughness={0.84} />
      <FurnitureModel
        url={bedSingleModelUrl}
        position={[0.18, 0.06, 10.02]}
        rotation={[0, 0, 0]}
        scale={[3.02, 1.54, 2.62]}
        color="#dbcdbb"
        roughness={0.9}
      />
      <RoundedBlock position={[0.96, 0.56, 10.08]} size={[1.66, 0.08, 0.92]} color="#496487" roughness={0.72} />
      <RoundedBlock position={[-1.18, 0.64, 9.58]} size={[0.86, 0.08, 0.64]} color="#f0ebe2" roughness={0.9} />
      <SideCabinet position={[2.74, 0.02, 11.42]} scale={[1.82, 0.94, 0.92]} />
      <FurnitureModel
        url={benchCushionLowModelUrl}
        position={[-1.84, 0.02, 10.84]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[2.48, 1.14, 1.54]}
        color="#7f654e"
        roughness={0.86}
      />
      <FloorLamp position={[2.2, 0.04, 9.1]} />
      <FurnitureModel
        url={booksModelUrl}
        position={[2.76, 0.68, 11.38]}
        rotation={[0, Math.PI / 8, 0]}
        scale={[1.08, 1.08, 1.08]}
        color="#ddd4c6"
        roughness={0.84}
      />
    </group>
  );
}

function TeaPantry() {
  return (
    <group>
      <RugModel position={[8.0, 0.044, 1.22]} scale={[4.8, 1.02, 6.0]} color="#55463b" roughness={0.98} url={rugRectangleModelUrl} />
      <FurnitureModel
        url={kitchenBarModelUrl}
        position={[8.05, 0.04, 3.18]}
        rotation={[0, Math.PI, 0]}
        scale={[13.4, 1.86, 3.08]}
        color="#654b3a"
        roughness={0.88}
      />
      <FurnitureModel
        url={kitchenCabinetDrawerModelUrl}
        position={[6.86, 0.04, -1.88]}
        rotation={[0, Math.PI, 0]}
        scale={[3.56, 1.8, 1.76]}
        color="#654b3a"
        roughness={0.88}
      />
      <FurnitureModel
        url={kitchenSinkModelUrl}
        position={[8.06, 0.04, -1.88]}
        rotation={[0, Math.PI, 0]}
        scale={[3.56, 1.8, 1.76]}
        color="#664b39"
        roughness={0.86}
      />
      <FurnitureModel
        url={kitchenCabinetDrawerModelUrl}
        position={[9.28, 0.04, -1.88]}
        rotation={[0, Math.PI, 0]}
        scale={[3.56, 1.8, 1.76]}
        color="#654b3a"
        roughness={0.88}
      />
      <FurnitureModel
        url={kitchenCabinetUpperDoubleModelUrl}
        position={[7.34, 1.42, -1.98]}
        rotation={[0, Math.PI, 0]}
        scale={[3.3, 1.82, 1.46]}
        color="#5e4636"
        roughness={0.84}
      />
      <FurnitureModel
        url={kitchenCabinetUpperDoubleModelUrl}
        position={[8.92, 1.42, -1.98]}
        rotation={[0, Math.PI, 0]}
        scale={[3.3, 1.82, 1.46]}
        color="#5e4636"
        roughness={0.84}
      />
      <FurnitureModel
        url={hoodModernModelUrl}
        position={[8.1, 1.74, -1.86]}
        rotation={[0, Math.PI, 0]}
        scale={[2.1, 1.6, 1.6]}
        color="#cfd5d8"
        roughness={0.32}
        metalness={0.12}
      />
      <FurnitureModel
        url={kitchenCoffeeMachineModelUrl}
        position={[7.56, 0.84, 2.62]}
        rotation={[0, Math.PI, 0]}
        scale={[2.1, 1.64, 1.86]}
        color="#3f3b37"
        roughness={0.64}
        metalness={0.1}
      />
      <FurnitureModel
        url={kitchenFridgeLargeModelUrl}
        position={[9.68, 0.04, -0.88]}
        rotation={[0, Math.PI, 0]}
        scale={[2.26, 2.34, 1.84]}
        color="#d8e0e5"
        roughness={0.32}
        metalness={0.08}
      />
      <FurnitureModel
        url={kitchenMicrowaveModelUrl}
        position={[9.18, 0.88, -1.44]}
        rotation={[0, Math.PI, 0]}
        scale={[1.66, 1.34, 1.34]}
        color="#d8dfdf"
        roughness={0.34}
        metalness={0.12}
      />
      <ShelfCups position={[6.54, 2.1, -1.96]} />
      <Plant position={[6.48, 0.12, 3.08]} scale={0.72} />
      <TrashCan position={[9.82, 0.02, 2.96]} scale={[0.92, 0.92, 0.92]} />
      <BarStool position={[7.12, 0.02, 1.62]} />
      <BarStool position={[8.76, 0.02, 1.64]} />
      <mesh castShadow position={[8.06, 0.92, 2.82]}>
        <torusGeometry args={[0.12, 0.02, 8, 18]} />
        <meshStandardMaterial color="#d9d8d3" roughness={0.4} metalness={0.12} />
      </mesh>
    </group>
  );
}

function MahjongRoom() {
  return (
    <group>
      <RugModel position={[8.18, 0.044, 10.0]} scale={[6.4, 1.04, 4.8]} color="#31473f" roughness={0.98} url={rugRectangleModelUrl} />
      <RoundedBlock position={[8.2, 0.44, 10.0]} size={[4.12, 0.84, 2.26]} color="#46362e" roughness={0.92} castShadow />
      <RoundedBlock position={[8.2, 0.8, 9.92]} size={[3.48, 0.1, 1.78]} color="#184037" roughness={0.78} />
      <TileRack position={[8.2, 0.92, 9.18]} rotation={[0, 0, 0]} />
      <TileRack position={[8.2, 0.92, 10.74]} rotation={[0, Math.PI, 0]} />
      <TileRack position={[7.34, 0.92, 9.96]} rotation={[0, Math.PI / 2, 0]} />
      <TileRack position={[9.06, 0.92, 9.96]} rotation={[0, -Math.PI / 2, 0]} />
      <SideCabinet position={[10.24, 0.02, 8.48]} scale={[2.06, 0.94, 0.9]} />
      <RoundedBlock position={[10.08, 1.14, 8.72]} size={[0.9, 1.12, 0.14]} color="#9fb8c7" roughness={0.26} transparent opacity={0.36} />
      <Bookcase position={[6.52, 0.02, 8.62]} rotationY={0} scale={[2.26, 1.58, 0.94]} />
      <MahjongChair position={[8.2, 0.02, 8.02]} rotationY={Math.PI} />
      <MahjongChair position={[6.26, 0.02, 10.02]} rotationY={Math.PI / 2} />
      <MahjongChair position={[10.14, 0.02, 10.02]} rotationY={-Math.PI / 2} />
      <MahjongChair position={[8.2, 0.02, 11.84]} rotationY={0} />
      <PendantLamp position={[8.2, 2.66, 10.0]} />
      <GlassRail position={[10.5, 0.82, 7.12]} size={[2.1, 1.3, 0.08]} />
      <RoundedBlock position={[6.56, 0.82, 7.16]} size={[1.6, 1.0, 0.1]} color="#6d503c" roughness={0.9} />
    </group>
  );
}

function Plants() {
  return (
    <group>
      <Plant position={[-9.78, 0.12, 11.86]} scale={0.9} />
      <Plant position={[10.52, 0.12, 11.82]} scale={0.9} />
      <Plant position={[5.18, 0.12, 5.82]} scale={1} />
    </group>
  );
}

function RoomBadge({
  zone
}: {
  zone: WorldZoneDescriptor;
}) {
  const room = worldRooms[zone.room];

  return (
    <Html
      position={[room.badge[0], room.badge[1], room.badge[2]]}
      center
      transform
      sprite
      style={{ transform: roomLabelOffsets[zone.room] ?? "translate(-50%, -12%)", pointerEvents: "none" }}
    >
      <div className="oc-world-room-badge">
        <span className="oc-world-room-badge-label">{zone.label}</span>
        <span className={`oc-world-room-badge-status ${zone.active ? "is-active" : ""}`}>{zone.status}</span>
      </div>
    </Html>
  );
}

function LobsterActor({
  agent
}: {
  agent: RenderWorldAgent;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const shellRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftClawRef = useRef<THREE.Group>(null);
  const rightClawRef = useRef<THREE.Group>(null);
  const tailRefs = useRef<Array<THREE.Group | null>>([]);
  const antennaRefs = useRef<Array<THREE.Group | null>>([]);
  const leftLegUpperRefs = useRef<Array<THREE.Group | null>>([]);
  const leftLegLowerRefs = useRef<Array<THREE.Group | null>>([]);
  const rightLegUpperRefs = useRef<Array<THREE.Group | null>>([]);
  const rightLegLowerRefs = useRef<Array<THREE.Group | null>>([]);
  const shadowRef = useRef<THREE.Mesh>(null);
  const mugRef = useRef<THREE.Group>(null);
  const remoteRef = useRef<THREE.Group>(null);
  const tileRef = useRef<THREE.Group>(null);
  const sleepPuffsRef = useRef<THREE.Group>(null);
  const accentColor = useMemo(() => new THREE.Color(agent.accent), [agent.accent]);
  const motionSeed = useMemo(() => (hashSeed(agent.id) % 2000) / 2000, [agent.id]);
  const desiredWorldRef = useRef(new THREE.Vector3(...agent.world));
  const previousWorldRef = useRef(new THREE.Vector3(...agent.world));
  const locomotionRef = useRef({
    speed: 0,
    phase: motionSeed * Math.PI * 2
  });

  useFrame((state, delta) => {
    const root = rootRef.current;
    const body = bodyRef.current;
    const shell = shellRef.current;
    const head = headRef.current;
    const leftClaw = leftClawRef.current;
    const rightClaw = rightClawRef.current;
    const shadow = shadowRef.current;

    if (!root || !body || !shell || !head || !leftClaw || !rightClaw || !shadow) {
      return;
    }

    const ambientSample = sampleAmbientWorld(agent, state.clock.elapsedTime + motionSeed * 4);
    desiredWorldRef.current.set(...ambientSample.world);
    if (agent.isMoving || agent.renderPose === "walk") {
      root.position.lerp(desiredWorldRef.current, 1 - Math.exp(-delta * 14));
    } else if (agent.mode === "seat" || agent.mode === "bed") {
      root.position.lerp(desiredWorldRef.current, 1 - Math.exp(-delta * 12));
    } else {
      root.position.lerp(desiredWorldRef.current, 1 - Math.exp(-delta * 16));
    }
    const targetScale = new THREE.Vector3(agent.scale, agent.scale, agent.scale);
    root.scale.lerp(targetScale, 1 - Math.exp(-delta * 6));

    const targetYaw =
      !agent.isMoving && typeof agent.yaw === "number"
        ? agent.yaw
        : resolveFacingYaw(ambientSample.facing);
    root.rotation.y = THREE.MathUtils.damp(root.rotation.y, targetYaw, 8, delta);

    const distanceTravelled = root.position.distanceTo(previousWorldRef.current);
    previousWorldRef.current.copy(root.position);
    const rawSpeed = distanceTravelled / Math.max(delta, 0.0001);
    locomotionRef.current.speed = THREE.MathUtils.damp(locomotionRef.current.speed, rawSpeed, 10, delta);
    const locomotionAmount = THREE.MathUtils.clamp(locomotionRef.current.speed / 1.7, 0, 1);
    locomotionRef.current.phase += delta * (2.2 + locomotionAmount * 8.6);

    const time = state.clock.elapsedTime + motionSeed * Math.PI;
    const walkPhase = locomotionRef.current.phase;
    const walkWave = Math.sin(walkPhase);
    const idleWave = Math.sin(time * 2.4);
    const activeWave = Math.sin(time * 6.2);
    const deskWave = Math.sin(time * 10.8);
    const chatWave = Math.sin(time * 4.8 + motionSeed * 4);
    const propWave = Math.sin(time * 3.6 + motionSeed * 6);
    const seatLift = Math.max(0, (agent.surfaceHeight - agent.world[1]) / Math.max(agent.scale, 0.01));
    const walkLift = Math.max(0, Math.sin(walkPhase)) * 0.024;
    const walkSway = Math.sin(walkPhase * 0.5) * 0.012;
    const mug = mugRef.current;
    const remote = remoteRef.current;
    const tile = tileRef.current;
    const sleepPuffs = sleepPuffsRef.current;
    const animateLegSet = (
      upperRefs: Array<THREE.Group | null>,
      lowerRefs: Array<THREE.Group | null>,
      side: -1 | 1,
      mode: "walk" | "idle" | "seat" | "sleep" | "stand"
    ) => {
      lobsterLegOffsets.forEach((_, index) => {
        const upper = upperRefs[index];
        const lower = lowerRefs[index];

        if (!upper || !lower) {
          return;
        }

        const phase = walkPhase + lobsterLegPhaseOffsets[index] + (side === -1 ? 0 : Math.PI);
        const stride = Math.sin(phase);
        const lift = Math.max(0, Math.cos(phase));
        const walkMix = Math.min(locomotionAmount, 1);

        if (mode === "walk") {
          // Natural walking gait with stride blending
          const strideAmount = stride * 0.18 * (0.3 + walkMix * 0.7);
          upper.rotation.set(0.28 + strideAmount, 0, side * (0.84 - lift * 0.06 * walkMix));
          lower.position.set(side * 0.14, -0.12 + lift * 0.02 * walkMix, 0.02);
          lower.rotation.set(-0.48 - Math.max(0, -stride) * 0.28 * walkMix, 0, side * 0.1);
        } else if (mode === "seat") {
          // Legs tucked under body when sitting
          const breathe = Math.sin(time * 1.2 + index * 0.6 + side) * 0.02;
          upper.rotation.set(-0.14 + breathe, 0, side * 0.96);
          lower.position.set(side * 0.12, -0.1, 0.02);
          lower.rotation.set(-0.76, 0, side * 0.06);
        } else if (mode === "sleep") {
          // Legs relaxed, slightly curled
          upper.rotation.set(0.06, 0, side * 0.68);
          lower.position.set(side * 0.1, -0.08, 0.01);
          lower.rotation.set(-0.36, 0, side * 0.04);
        } else if (mode === "stand") {
          // Standing with weight shift
          const shift = Math.sin(time * 1.8 + index * 0.7 + side) * 0.04;
          upper.rotation.set(0.2 + shift, 0, side * 0.9);
          lower.position.set(side * 0.14, -0.12, 0.02);
          lower.rotation.set(-0.46, 0, side * 0.1);
        } else {
          // Idle - subtle movement
          const idle = Math.sin(time * 1.4 + index * 0.6 + side) * 0.025;
          upper.rotation.set(0.22 + idle, 0, side * 0.86);
          lower.position.set(side * 0.14, -0.12, 0.02);
          lower.rotation.set(-0.42, 0, side * 0.1);
        }
      });
    };

    // Reset body to default standing pose
    body.position.set(0, 0.38, 0);
    body.rotation.set(0, 0, 0);
    shell.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    leftClaw.rotation.set(0, 0, 0.28);
    rightClaw.rotation.set(0, 0, -0.28);
    shadow.position.set(0, 0.02, 0);
    shadow.scale.set(0.88, 1, 0.68);
    (shadow.material as THREE.MeshBasicMaterial).opacity = 0.18;

    antennaRefs.current.forEach((antenna, index) => {
      if (!antenna) {
        return;
      }

      const side = index === 0 ? -1 : 1;
      antenna.rotation.set(0.16 + idleWave * 0.04, side * 0.14, side * (0.24 + idleWave * 0.05));
    });

    tailRefs.current.forEach((segment, index) => {
      if (!segment) {
        return;
      }

      segment.rotation.set(-0.12 - index * 0.08 + idleWave * 0.02, 0, 0);
    });

    if (mug) {
      mug.position.set(0.5, 0.18, -0.02);
      mug.rotation.set(0, 0, -0.12);
    }
    if (remote) {
      remote.position.set(0.32, 0.08, 0.06);
      remote.rotation.set(0.1, 0, 0.18);
    }
    if (tile) {
      tile.position.set(0.06, 0.1, -0.08);
      tile.rotation.set(0.08, 0, 0.08);
    }
    if (sleepPuffs) {
      sleepPuffs.position.set(-0.14, 0.72, -0.12);
      sleepPuffs.rotation.set(0, 0, 0);
      sleepPuffs.scale.setScalar(1);
    }

    if (agent.renderPose === "walk" || locomotionAmount > 0.08) {
      // === WALKING POSE ===
      const walkIntensity = Math.min(locomotionAmount, 1);
      body.position.y = 0.32 + walkLift * walkIntensity;
      body.position.x = walkSway * walkIntensity;
      body.rotation.z = walkWave * 0.018 * walkIntensity;
      body.rotation.x = 0.06 + Math.abs(walkWave) * 0.018 * walkIntensity;
      shell.rotation.x = 0.06 + Math.abs(walkWave) * 0.014 * walkIntensity;
      head.rotation.x = 0.04 + walkWave * 0.02 * walkIntensity;
      leftClaw.rotation.set(-0.1 * walkIntensity, 0, 0.22 + walkWave * 0.12 * walkIntensity);
      rightClaw.rotation.set(-0.1 * walkIntensity, 0, -0.22 - walkWave * 0.12 * walkIntensity);
      shadow.scale.set(0.86 + Math.abs(walkWave) * 0.02, 1, 0.72 + Math.abs(walkWave) * 0.03);
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.22;
      animateLegSet(leftLegUpperRefs.current, leftLegLowerRefs.current, -1, "walk");
      animateLegSet(rightLegUpperRefs.current, rightLegLowerRefs.current, 1, "walk");
      tailRefs.current.forEach((segment, index) => {
        if (!segment) return;
        segment.rotation.x = -0.1 - index * 0.06 - Math.abs(walkWave) * (0.015 + index * 0.008) * walkIntensity;
      });
      antennaRefs.current.forEach((antenna, index) => {
        if (!antenna) return;
        const s = index === 0 ? -1 : 1;
        antenna.rotation.set(0.1 + Math.abs(walkWave) * 0.03, s * (0.1 + walkWave * 0.04), s * (0.2 + walkWave * 0.06));
      });
    } else if (agent.renderPose === "working" || agent.renderPose === "desk" || agent.mode === "desk") {
      // === DESK WORK POSE ===
      const typingPhase = Math.sin(time * 3.4);
      body.position.set(0, seatLift + 0.02 + deskWave * 0.005, -0.04);
      body.rotation.x = -0.34;
      body.rotation.z = deskWave * 0.008;
      shell.rotation.x = -0.16;
      head.rotation.x = -0.12 + Math.sin(time * 1.4) * 0.03;
      leftClaw.rotation.set(-0.3, 0, 0.36 + Math.sin(typingPhase) * 0.1);
      rightClaw.rotation.set(-0.3, 0, -0.36 - Math.sin(typingPhase + 0.4) * 0.1);
      shadow.scale.set(0.72, 1, 0.52);
      shadow.position.y = 0.01;
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.14;
      animateLegSet(leftLegUpperRefs.current, leftLegLowerRefs.current, -1, "seat");
      animateLegSet(rightLegUpperRefs.current, rightLegLowerRefs.current, 1, "seat");
    } else if (agent.renderPose === "mahjong") {
      // === MAHJONG POSE ===
      body.position.set(0, seatLift + 0.04 + activeWave * 0.008, 0.06);
      body.rotation.x = -0.28;
      body.rotation.y = Math.sin(time * 0.8) * 0.03;
      body.rotation.z = activeWave * 0.006;
      shell.rotation.x = -0.12;
      head.rotation.x = -0.06;
      head.rotation.y = Math.sin(time * 1.2) * 0.06;
      leftClaw.rotation.set(-0.24, 0, 0.44 + Math.max(0, activeWave) * 0.14);
      rightClaw.rotation.set(-0.18, 0, -0.44 - Math.max(0, -activeWave) * 0.14);
      shadow.scale.set(0.76, 1, 0.58);
      shadow.position.y = 0.01;
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.16;
      animateLegSet(leftLegUpperRefs.current, leftLegLowerRefs.current, -1, "seat");
      animateLegSet(rightLegUpperRefs.current, rightLegLowerRefs.current, 1, "seat");
      if (tile) {
        tile.position.set(0.04, 0.06 + Math.max(0, activeWave) * 0.04, -0.14);
        tile.rotation.set(0.08, propWave * 0.14, 0.06 + propWave * 0.03);
      }
    } else if (agent.renderPose === "game") {
      // === CARD GAME POSE ===
      body.position.set(0, seatLift + 0.06 + idleWave * 0.008, 0.1);
      body.rotation.x = -0.14;
      body.rotation.z = idleWave * 0.01;
      shell.rotation.x = -0.04;
      head.rotation.y = chatWave * 0.06;
      leftClaw.rotation.set(-0.14, 0, 0.2 + Math.max(0, chatWave) * 0.06);
      rightClaw.rotation.set(0.02, 0, -0.24 - Math.max(0, -chatWave) * 0.08);
      shadow.scale.set(0.82, 1, 0.58);
      shadow.position.y = 0.01;
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.12;
      animateLegSet(leftLegUpperRefs.current, leftLegLowerRefs.current, -1, "seat");
      animateLegSet(rightLegUpperRefs.current, rightLegLowerRefs.current, 1, "seat");
      if (remote) {
        remote.position.set(0.3, 0.08 + Math.max(0, propWave) * 0.015, 0.08);
        remote.rotation.set(0.1, 0, 0.14 + propWave * 0.06);
      }
    } else if (agent.renderPose === "coffee") {
      // === COFFEE BREAK POSE (standing, chatting) ===
      const weightShift = Math.sin(time * 0.9) * 0.012;
      body.position.set(weightShift, 0.32 + idleWave * 0.01, 0.02);
      body.rotation.y = chatWave * 0.12;
      body.rotation.z = -0.04 + idleWave * 0.015;
      shell.rotation.z = -0.02 + idleWave * 0.008;
      head.rotation.y = chatWave * 0.08;
      head.rotation.x = Math.sin(time * 1.6 + motionSeed) * 0.03;
      leftClaw.rotation.set(-0.04, 0, 0.26 + Math.max(0, chatWave) * 0.14);
      rightClaw.rotation.set(0.06, 0, -0.38 - Math.max(0, -chatWave) * 0.12);
      shadow.scale.setScalar(0.86);
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.22;
      animateLegSet(leftLegUpperRefs.current, leftLegLowerRefs.current, -1, "stand");
      animateLegSet(rightLegUpperRefs.current, rightLegLowerRefs.current, 1, "stand");
      if (mug) {
        mug.position.set(0.42, 0.14 + Math.max(0, propWave) * 0.015, -0.02);
        mug.rotation.set(0, 0, -0.1 + propWave * 0.06);
      }
    } else if (agent.renderPose === "sleep") {
      // === SLEEPING POSE (lying on side, curled) ===
      const breathe = Math.sin(time * 0.7);
      body.position.set(-0.06, 0.06 + seatLift, 0.06);
      body.rotation.z = -1.48 + breathe * 0.06;
      body.rotation.y = 0.14;
      body.rotation.x = 0.06 + breathe * 0.03;
      shell.rotation.z = -0.06 + breathe * 0.03;
      head.rotation.z = -0.1;
      head.rotation.x = breathe * 0.02;
      leftClaw.rotation.z = 0.2 + Math.sin(time * 0.9 + 1) * 0.04;
      rightClaw.rotation.z = -0.18 - Math.sin(time * 0.9) * 0.05;
      shadow.scale.set(0.92, 1, 0.58);
      shadow.position.y = 0.005;
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.06;
      animateLegSet(leftLegUpperRefs.current, leftLegLowerRefs.current, -1, "sleep");
      animateLegSet(rightLegUpperRefs.current, rightLegLowerRefs.current, 1, "sleep");
      tailRefs.current.forEach((segment, index) => {
        if (!segment) return;
        segment.rotation.x = -0.18 - index * 0.05 - breathe * 0.03;
      });
      if (sleepPuffs) {
        sleepPuffs.position.set(-0.16, 0.72 + Math.max(0, idleWave) * 0.04, -0.1);
        sleepPuffs.rotation.z = 0.06 + Math.sin(time * 1.0) * 0.02;
        sleepPuffs.scale.setScalar(0.88 + Math.max(0, idleWave) * 0.14);
      }
    } else if (agent.mode === "seat") {
      // === GENERIC SEATED POSE ===
      body.position.set(0, seatLift + 0.06 + idleWave * 0.01, 0.04);
      body.rotation.x = -0.12;
      shell.rotation.x = -0.04;
      head.rotation.y = Math.sin(time * 0.7 + motionSeed * 3) * 0.06;
      leftClaw.rotation.z = 0.24 + Math.max(0, activeWave) * 0.06;
      rightClaw.rotation.z = -0.24 - Math.max(0, -activeWave) * 0.06;
      shadow.scale.set(0.74, 1, 0.58);
      shadow.position.y = 0.01;
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.12;
      animateLegSet(leftLegUpperRefs.current, leftLegLowerRefs.current, -1, "seat");
      animateLegSet(rightLegUpperRefs.current, rightLegLowerRefs.current, 1, "seat");
    } else {
      // === IDLE STANDING POSE ===
      body.position.y = 0.34 + idleWave * 0.016;
      body.rotation.z = idleWave * 0.012;
      shell.rotation.z = idleWave * 0.008;
      head.rotation.y = Math.sin(time * 0.6 + motionSeed * 5) * 0.05;
      leftClaw.rotation.z = 0.32 + Math.max(0, activeWave) * 0.1;
      rightClaw.rotation.z = -0.32 - Math.max(0, -activeWave) * 0.1;
      shadow.scale.setScalar(0.84 + Math.abs(idleWave) * 0.03);
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.2;
      animateLegSet(leftLegUpperRefs.current, leftLegLowerRefs.current, -1, "idle");
      animateLegSet(rightLegUpperRefs.current, rightLegLowerRefs.current, 1, "idle");
    }
  });

  return (
    <group ref={rootRef} position={agent.world} scale={agent.scale}>
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <circleGeometry args={[0.5, 28]} />
        <meshBasicMaterial color="#111217" transparent opacity={0.22} />
      </mesh>
      <group ref={bodyRef} position={[0, 0.38, 0]}>
        {lobsterLegOffsets.map((offset, index) => (
          <LobsterLeg
            key={`left-leg-${agent.id}-${offset}`}
            side={-1}
            offset={offset}
            upperRef={(node) => {
              leftLegUpperRefs.current[index] = node;
            }}
            lowerRef={(node) => {
              leftLegLowerRefs.current[index] = node;
            }}
          />
        ))}
        {lobsterLegOffsets.map((offset, index) => (
          <LobsterLeg
            key={`right-leg-${agent.id}-${offset}`}
            side={1}
            offset={offset}
            upperRef={(node) => {
              rightLegUpperRefs.current[index] = node;
            }}
            lowerRef={(node) => {
              rightLegLowerRefs.current[index] = node;
            }}
          />
        ))}
        {agent.renderPose === "coffee" ? (
          <group ref={mugRef}>
            <CoffeeMug />
          </group>
        ) : null}
        {agent.renderPose === "game" ? (
          <group ref={remoteRef}>
            <RemoteProp />
          </group>
        ) : null}
        {agent.renderPose === "mahjong" ? (
          <group ref={tileRef}>
            <MahjongTileProp />
          </group>
        ) : null}
        {agent.renderPose === "sleep" ? (
          <group ref={sleepPuffsRef}>
            <SleepPuffs />
          </group>
        ) : null}
        {/* === TAIL === */}
        <group position={[0, 0.14, 0.3]}>
          {lobsterTailSegmentOffsets.map((offset, index) => (
            <group
              key={`tail-${agent.id}-${offset}`}
              ref={(node) => {
                tailRefs.current[index] = node;
              }}
              position={[0, 0, offset]}
            >
              <mesh castShadow position={[0, 0.02, 0]} scale={[0.58 - index * 0.09, 0.22 - index * 0.02, 0.36]}>
                <sphereGeometry args={[0.28, 16, 14]} />
                <meshStandardMaterial color="#bf5c52" roughness={0.68} metalness={0.08} />
              </mesh>
            </group>
          ))}
          {/* Tail fan (telson) */}
          <mesh castShadow position={[0, 0.02, 0.48]} rotation={[Math.PI / 2, 0, 0]} scale={[0.88, 0.9, 1.0]}>
            <coneGeometry args={[0.16, 0.34, 10]} />
            <meshStandardMaterial color="#b64c45" roughness={0.7} metalness={0.06} />
          </mesh>
          {/* Uropods (side flaps) */}
          <mesh castShadow position={[-0.1, 0.01, 0.44]} rotation={[Math.PI / 2, 0.22, -0.18]} scale={[0.48, 0.86, 0.72]}>
            <coneGeometry args={[0.1, 0.22, 8]} />
            <meshStandardMaterial color="#be5a50" roughness={0.68} metalness={0.06} />
          </mesh>
          <mesh castShadow position={[0.1, 0.01, 0.44]} rotation={[Math.PI / 2, -0.22, 0.18]} scale={[0.48, 0.86, 0.72]}>
            <coneGeometry args={[0.1, 0.22, 8]} />
            <meshStandardMaterial color="#be5a50" roughness={0.68} metalness={0.06} />
          </mesh>
        </group>
        {/* === SHELL (carapace) === */}
        <group ref={shellRef}>
          {/* Main carapace */}
          <mesh castShadow position={[0, 0.2, -0.02]} scale={[0.86, 0.58, 1.28]}>
            <sphereGeometry args={[0.36, 20, 16]} />
            <meshStandardMaterial color="#d06c61" roughness={0.58} metalness={0.12} />
          </mesh>
          {/* Carapace ridge */}
          <mesh castShadow position={[0, 0.28, -0.06]} scale={[0.62, 0.28, 0.86]}>
            <sphereGeometry args={[0.26, 16, 14]} />
            <meshStandardMaterial color="#e89a8f" roughness={0.48} metalness={0.08} />
          </mesh>
          {/* Belly (ventral) */}
          <mesh castShadow position={[0, 0.08, 0.02]} scale={[0.72, 0.3, 0.88]}>
            <sphereGeometry args={[0.26, 16, 14]} />
            <meshStandardMaterial color="#f1c0b5" roughness={0.78} />
          </mesh>
          {/* Dorsal ridge accent */}
          <mesh castShadow position={[0, 0.3, 0.12]} scale={[0.44, 0.14, 0.36]}>
            <sphereGeometry args={[0.18, 12, 12]} />
            <meshStandardMaterial color="#cf6b60" roughness={0.64} metalness={0.1} />
          </mesh>
        </group>
        {/* === HEAD (cephalon) === */}
        <group ref={headRef} position={[0, 0.16, -0.44]}>
          {/* Main head */}
          <mesh castShadow position={[0, 0.06, 0]} scale={[0.72, 0.48, 0.64]}>
            <sphereGeometry args={[0.24, 18, 14]} />
            <meshStandardMaterial color="#cf695f" roughness={0.58} metalness={0.1} />
          </mesh>
          {/* Rostrum (snout) */}
          <mesh castShadow position={[0, 0.04, -0.14]} scale={[0.38, 0.18, 0.22]}>
            <sphereGeometry args={[0.16, 14, 12]} />
            <meshStandardMaterial color="#ba5148" roughness={0.66} metalness={0.08} />
          </mesh>
          {/* Mouth parts */}
          <mesh castShadow position={[0, -0.02, -0.1]} scale={[0.28, 0.08, 0.14]}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <meshStandardMaterial color="#964038" roughness={0.72} />
          </mesh>
        </group>
        {/* === CLAWS === */}
        <group ref={leftClawRef} position={[-0.38, 0.18, -0.16]}>
          <Claw side={-1} />
        </group>
        <group ref={rightClawRef} position={[0.38, 0.18, -0.16]}>
          <Claw side={1} />
        </group>
        {/* === EYES & ANTENNAE === */}
        <EyeStalk side={-1} accentColor={accentColor} />
        <EyeStalk side={1} accentColor={accentColor} />
        <Antenna
          side={-1}
          refCallback={(node) => {
            antennaRefs.current[0] = node;
          }}
        />
        <Antenna
          side={1}
          refCallback={(node) => {
            antennaRefs.current[1] = node;
          }}
        />
      </group>
    </group>
  );
}

function DeskCluster({
  position,
  active
}: {
  position: Vec3;
  active: boolean;
}) {
  return (
    <group position={position}>
      <FurnitureModel
        url={deskModelUrl}
        position={[0, 0.05, 0.02]}
        rotation={[0, Math.PI, 0]}
        scale={[3.96, 1.88, 1.48]}
        color="#6a4f40"
        roughness={0.9}
      />
      <FurnitureModel
        url={chairDeskModelUrl}
        position={[0, 0.03, 0.72]}
        rotation={[0, 0, 0]}
        scale={[1.52, 1.7, 1.12]}
        color="#51657a"
        roughness={0.76}
      />
      <FurnitureModel
        url={computerScreenModelUrl}
        position={[-0.24, 0.46, -0.18]}
        rotation={[0, Math.PI, 0]}
        scale={[3.8, 1.65, 0.82]}
        color="#161d25"
        roughness={0.3}
        emissive={active ? "#8ebbf4" : "#263949"}
        emissiveIntensity={active ? 0.3 : 0.08}
      />
      <FurnitureModel
        url={computerScreenModelUrl}
        position={[0.24, 0.46, -0.2]}
        rotation={[0, Math.PI - 0.12, 0]}
        scale={[3.52, 1.58, 0.78]}
        color="#161d25"
        roughness={0.3}
        emissive={active ? "#8ebbf4" : "#263949"}
        emissiveIntensity={active ? 0.26 : 0.08}
      />
      <FurnitureModel
        url={computerKeyboardModelUrl}
        position={[0, 0.43, 0.18]}
        rotation={[0, Math.PI, 0]}
        scale={[4.4, 0.08, 4.6]}
        color="#d2c4b0"
        roughness={0.88}
      />
      <FurnitureModel
        url={computerMouseModelUrl}
        position={[0.34, 0.435, 0.18]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[2.8, 0.3, 2.8]}
        color="#d9d0c1"
        roughness={0.88}
      />
      <FurnitureModel
        url={laptopModelUrl}
        position={[-0.42, 0.43, 0.12]}
        rotation={[0, Math.PI - 0.38, 0]}
        scale={[1.8, 1.22, 1.48]}
        color="#abb7c6"
        roughness={0.38}
        metalness={0.1}
      />
      <RoundedBlock position={[0.52, 0.58, -0.02]} size={[0.08, 0.26, 0.08]} color="#34424e" roughness={0.52} castShadow />
      <RoundedBlock position={[0.52, 0.74, -0.02]} size={[0.14, 0.04, 0.14]} color="#f0ca7a" roughness={0.48} emissive="#f0ca7a" emissiveIntensity={0.2} castShadow />
      {active ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0.36]}>
          <ringGeometry args={[0.22, 0.34, 32]} />
          <meshBasicMaterial color="#7cc497" transparent opacity={0.22} />
        </mesh>
      ) : null}
    </group>
  );
}

function Sofa({
  position
}: {
  position: Vec3;
}) {
  return (
    <group position={position}>
      <FurnitureModel
        url={loungeSofaLongModelUrl}
        position={[0, 0.05, 0]}
        rotation={[0, Math.PI, 0]}
        scale={[4.56, 1.52, 1.92]}
        color="#4e6a84"
        roughness={0.72}
      />
    </group>
  );
}

function Credenza({
  position
}: {
  position: Vec3;
}) {
  return (
    <group position={position}>
      <FurnitureModel
        url={sideTableModelUrl}
        position={[0, 0.02, 0]}
        rotation={[0, Math.PI, 0]}
        scale={[6.8, 1.6, 1.8]}
        color="#5a4334"
        roughness={0.88}
      />
    </group>
  );
}

function TelevisionConsole({
  position
}: {
  position: Vec3;
}) {
  return (
    <group position={position}>
      <FurnitureModel
        url={cabinetTelevisionModelUrl}
        position={[0, 0.02, 0]}
        rotation={[0, Math.PI, 0]}
        scale={[4.3, 1.3, 1.56]}
        color="#5c4636"
        roughness={0.88}
      />
    </group>
  );
}

function SpeakerTower({
  position
}: {
  position: Vec3;
}) {
  return (
    <group position={position}>
      <FurnitureModel
        url={speakerModelUrl}
        position={[0, 0.02, 0]}
        rotation={[0, Math.PI, 0]}
        scale={[1.84, 1.84, 1.84]}
        color="#212830"
        roughness={0.58}
      />
    </group>
  );
}

function RelaxChair({
  position,
  rotationY = 0
}: {
  position: Vec3;
  rotationY?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <FurnitureModel
        url={loungeChairRelaxModelUrl}
        position={[0, 0.02, 0]}
        rotation={[0, Math.PI, 0]}
        scale={[3.3, 1.62, 3.3]}
        color="#566a79"
        roughness={0.72}
      />
    </group>
  );
}

function OfficeChair({
  position
}: {
  position: Vec3;
}) {
  return (
    <group position={position}>
      <FurnitureModel
        url={chairDeskModelUrl}
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
        scale={[1.46, 1.62, 1.08]}
        color="#51657a"
        roughness={0.74}
      />
    </group>
  );
}

function MahjongChair({
  position,
  rotationY = 0
}: {
  position: Vec3;
  rotationY?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <FurnitureModel
        url={chairRoundedModelUrl}
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
        scale={[3.0, 1.62, 3.0]}
        color="#566d84"
        roughness={0.74}
      />
    </group>
  );
}

function BarStool({
  position
}: {
  position: Vec3;
}) {
  return (
    <group position={position}>
      <FurnitureModel
        url={stoolBarModelUrl}
        position={[0, 0, 0]}
        rotation={[0, Math.PI, 0]}
        scale={[2.16, 1.56, 2.16]}
        color="#6b8093"
        roughness={0.72}
      />
    </group>
  );
}

function FloorLamp({
  position
}: {
  position: Vec3;
}) {
  return (
    <group position={position}>
      <FurnitureModel
        url={lampSquareFloorModelUrl}
        position={[0, 0.02, 0]}
        rotation={[0, Math.PI, 0]}
        scale={[2.1, 1.92, 2.1]}
        color="#d6d3ca"
        roughness={0.48}
        metalness={0.08}
      />
    </group>
  );
}

function Bookcase({
  position,
  rotationY = Math.PI,
  scale = [2.34, 1.5, 1.0] as Vec3
}: {
  position: Vec3;
  rotationY?: number;
  scale?: Vec3;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <FurnitureModel
        url={bookcaseClosedWideModelUrl}
        position={[0, 0.02, 0]}
        scale={scale}
        color="#5a4334"
        roughness={0.88}
      />
    </group>
  );
}

function SideCabinet({
  position,
  rotationY = Math.PI,
  scale = [2.08, 0.96, 0.94] as Vec3
}: {
  position: Vec3;
  rotationY?: number;
  scale?: Vec3;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <FurnitureModel
        url={sideTableDrawersModelUrl}
        position={[0, 0.02, 0]}
        scale={scale}
        color="#5f4636"
        roughness={0.88}
      />
    </group>
  );
}

function CoatRack({
  position
}: {
  position: Vec3;
}) {
  return (
    <group position={position}>
      <FurnitureModel
        url={coatRackStandingModelUrl}
        position={[0, 0.02, 0]}
        rotation={[0, Math.PI, 0]}
        scale={[2.0, 1.88, 2.0]}
        color="#8f6c50"
        roughness={0.86}
      />
    </group>
  );
}

function TrashCan({
  position,
  scale = [1, 1, 1] as Vec3
}: {
  position: Vec3;
  scale?: Vec3;
}) {
  return (
    <group position={position}>
      <FurnitureModel
        url={trashcanModelUrl}
        position={[0, 0.02, 0]}
        rotation={[0, Math.PI, 0]}
        scale={scale}
        color="#697985"
        roughness={0.66}
        metalness={0.08}
      />
    </group>
  );
}

function RugModel({
  position,
  rotation = [0, 0, 0],
  scale = [1, 1, 1] as Vec3,
  color,
  roughness = 0.96,
  url
}: {
  position: Vec3;
  rotation?: [number, number, number];
  scale?: Vec3;
  color: string;
  roughness?: number;
  url: string;
}) {
  return (
    <FurnitureModel
      url={url}
      position={position}
      rotation={rotation}
      scale={scale}
      color={color}
      roughness={roughness}
      castShadow={false}
      receiveShadow
    />
  );
}

function DeskMonitor({
  position,
  rotation = [0, 0, 0],
  active
}: {
  position: Vec3;
  rotation?: [number, number, number];
  active: boolean;
}) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBlock position={[0, 0.2, 0]} size={[0.54, 0.34, 0.04]} color="#0d141b" roughness={0.28} castShadow />
      <RoundedBlock
        position={[0, 0.2, 0.02]}
        size={[0.46, 0.26, 0.01]}
        color={active ? "#8ebbf4" : "#5c6e81"}
        roughness={0.18}
        emissive={active ? "#8ebbf4" : "#263949"}
        emissiveIntensity={active ? 0.44 : 0.12}
      />
      <mesh castShadow position={[0, 0.08, -0.01]}>
        <cylinderGeometry args={[0.03, 0.04, 0.16, 10]} />
        <meshStandardMaterial color="#525f6a" roughness={0.56} metalness={0.18} />
      </mesh>
      <RoundedBlock position={[0, 0, 0.02]} size={[0.18, 0.02, 0.08]} color="#646f77" roughness={0.62} castShadow />
    </group>
  );
}

function ShelfCups({
  position
}: {
  position: Vec3;
}) {
  return (
    <group position={position}>
      <Block position={[0, 0, 0]} size={[0.18, 0.28, 0.18]} color="#efe3d1" roughness={0.9} />
      <Block position={[0.34, 0, 0.02]} size={[0.18, 0.34, 0.18]} color="#9fd0da" roughness={0.9} />
      <Block position={[0.68, 0, -0.02]} size={[0.18, 0.3, 0.18]} color="#f3c58d" roughness={0.9} />
      <Block position={[1.02, 0, 0]} size={[0.18, 0.36, 0.18]} color="#f5ead6" roughness={0.9} />
    </group>
  );
}

function Plant({
  position,
  scale = 1
}: {
  position: Vec3;
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      <Block position={[0, 0.12, 0]} size={[0.58, 0.22, 0.58]} color="#8b6445" roughness={0.94} castShadow />
      {[
        [-0.16, 0.42, 0],
        [0.08, 0.56, -0.06],
        [0.24, 0.38, -0.12],
        [0, 0.3, 0.18]
      ].map((offset, index) => (
        <mesh key={`${position.join("-")}-${index}`} castShadow position={[offset[0], offset[1], offset[2]]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color={index % 2 === 0 ? "#73c889" : "#5ca96f"} roughness={0.82} />
        </mesh>
      ))}
    </group>
  );
}

function WindowRibbon({
  position,
  width
}: {
  position: Vec3;
  width: number;
}) {
  return (
    <group position={position}>
      <Block position={[0, 0, 0]} size={[width, 1.4, 0.08]} color="#253748" roughness={0.16} metalness={0.08} emissive="#33506a" emissiveIntensity={0.18} transparent opacity={0.58} />
      <Block position={[0, 0, 0.05]} size={[width, 0.06, 0.08]} color="#546879" roughness={0.7} />
    </group>
  );
}

function Divider({
  position,
  size
}: {
  position: Vec3;
  size: Vec3;
}) {
  return (
    <Block position={position} size={size} color="#39444d" roughness={0.9} castShadow />
  );
}

function Baseboard({
  position,
  size
}: {
  position: Vec3;
  size: Vec3;
}) {
  return <Block position={position} size={size} color="#4a5660" roughness={0.68} />;
}

function DoorTrim({
  position,
  width,
  depth = false
}: {
  position: Vec3;
  width: number;
  depth?: boolean;
}) {
  return (
    <group position={position}>
      <Block
        position={depth ? [0, 0.64, -width / 2 + 0.06] : [-width / 2 + 0.06, 0.64, 0]}
        size={[0.12, 1.28, 0.12]}
        color="#81909d"
        roughness={0.54}
        castShadow
      />
      <Block
        position={depth ? [0, 0.64, width / 2 - 0.06] : [width / 2 - 0.06, 0.64, 0]}
        size={[0.12, 1.28, 0.12]}
        color="#81909d"
        roughness={0.54}
        castShadow
      />
      <Block
        position={[0, 1.28, 0]}
        size={depth ? [0.12, 0.12, width] : [width, 0.12, 0.12]}
        color="#8b98a4"
        roughness={0.5}
        castShadow
      />
    </group>
  );
}

function GlassRail({
  position,
  size
}: {
  position: Vec3;
  size: Vec3;
}) {
  return (
    <Block
      position={position}
      size={size}
      color="#6d8294"
      roughness={0.18}
      metalness={0.08}
      transparent
      opacity={0.22}
    />
  );
}

function PathPlate({
  position,
  size,
  color = "#c8d6de"
}: {
  position: Vec3;
  size: Vec3;
  color?: string;
}) {
  return (
    <Block position={position} size={size} color={color} roughness={0.96} receiveShadow />
  );
}

function EyeStalk({
  side,
  accentColor
}: {
  side: -1 | 1;
  accentColor: THREE.Color;
}) {
  return (
    <group position={[side * 0.14, 0.52, -0.62]} rotation={[0.1, 0, side * 0.16]}>
      {/* Stalk */}
      <mesh castShadow position={[0, 0.1, 0]} rotation={[0.12, 0, 0]}>
        <capsuleGeometry args={[0.02, 0.2, 4, 10]} />
        <meshStandardMaterial color="#4a2927" roughness={0.46} metalness={0.06} />
      </mesh>
      {/* Eye ball */}
      <mesh castShadow position={[0, 0.24, 0.02]} scale={[1.0, 0.96, 0.88]}>
        <sphereGeometry args={[0.088, 14, 14]} />
        <meshStandardMaterial color={accentColor} roughness={0.24} metalness={0.1} />
      </mesh>
      {/* White of eye */}
      <mesh castShadow position={[0.02 * side, 0.25, 0.08]}>
        <sphereGeometry args={[0.038, 12, 12]} />
        <meshStandardMaterial color="#fffaf2" roughness={0.16} />
      </mesh>
      {/* Pupil */}
      <mesh castShadow position={[0.035 * side, 0.255, 0.1]}>
        <sphereGeometry args={[0.013, 10, 10]} />
        <meshStandardMaterial color="#161617" roughness={0.1} />
      </mesh>
    </group>
  );
}

function Antenna({
  side,
  refCallback
}: {
  side: -1 | 1;
  refCallback?: (node: THREE.Group | null) => void;
}) {
  return (
    <group ref={refCallback} position={[side * 0.14, 0.46, -0.62]} rotation={[0.18, side * 0.1, side * 0.22]}>
      {/* Base segment */}
      <mesh castShadow position={[side * 0.1, 0.1, -0.06]} rotation={[0.26, 0, side * 0.16]}>
        <capsuleGeometry args={[0.012, 0.34, 4, 8]} />
        <meshStandardMaterial color="#7f3f39" roughness={0.6} metalness={0.04} />
      </mesh>
      {/* Tip segment */}
      <mesh castShadow position={[side * 0.22, 0.26, -0.2]} rotation={[0.32, 0, side * 0.12]}>
        <capsuleGeometry args={[0.006, 0.26, 4, 8]} />
        <meshStandardMaterial color="#964941" roughness={0.62} />
      </mesh>
    </group>
  );
}

function CoffeeMug() {
  return (
    <group>
      <RoundedBlock position={[0, 0.02, 0]} size={[0.12, 0.14, 0.1]} color="#e6dfd2" roughness={0.78} castShadow radius={0.02} />
      <mesh castShadow position={[0.08, 0.02, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.03, 0.01, 8, 16]} />
        <meshStandardMaterial color="#e6dfd2" roughness={0.72} />
      </mesh>
      <mesh position={[-0.01, 0.11, 0]}>
        <sphereGeometry args={[0.016, 8, 8]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

function RemoteProp() {
  return (
    <group>
      <RoundedBlock position={[0, 0.02, 0]} size={[0.16, 0.06, 0.08]} color="#2d3338" roughness={0.54} castShadow radius={0.02} />
      <RoundedBlock position={[0.03, 0.04, 0.01]} size={[0.04, 0.01, 0.03]} color="#5c7da1" roughness={0.32} emissive="#5c7da1" emissiveIntensity={0.16} radius={0.01} />
    </group>
  );
}

function MahjongTileProp() {
  return (
    <group>
      <RoundedBlock position={[0, 0.02, 0]} size={[0.12, 0.16, 0.04]} color="#ece5da" roughness={0.88} castShadow radius={0.015} />
      <RoundedBlock position={[0, 0.03, 0.022]} size={[0.06, 0.08, 0.004]} color="#6a4e38" roughness={0.72} radius={0.004} />
    </group>
  );
}

function SleepPuffs() {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshStandardMaterial color="#f6f7fb" transparent opacity={0.18} />
      </mesh>
      <mesh position={[0.12, 0.14, 0]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshStandardMaterial color="#f6f7fb" transparent opacity={0.14} />
      </mesh>
      <mesh position={[0.22, 0.28, 0]}>
        <sphereGeometry args={[0.03, 10, 10]} />
        <meshStandardMaterial color="#f6f7fb" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

function Claw({
  side
}: {
  side: -1 | 1;
}) {
  return (
    <group>
      {/* Upper arm (merus) */}
      <mesh castShadow position={[side * 0.12, -0.02, -0.06]} rotation={[0.18, 0, side * 0.32]}>
        <capsuleGeometry args={[0.044, 0.24, 4, 10]} />
        <meshStandardMaterial color="#bf564d" roughness={0.62} metalness={0.08} />
      </mesh>
      {/* Wrist joint */}
      <mesh castShadow position={[side * 0.22, 0.02, -0.18]} scale={[0.9, 0.7, 0.85]}>
        <sphereGeometry args={[0.065, 12, 12]} />
        <meshStandardMaterial color="#c45f54" roughness={0.58} metalness={0.06} />
      </mesh>
      {/* Claw palm (propodus) */}
      <mesh castShadow position={[side * 0.28, 0.04, -0.28]} scale={[1.0, 0.72, 0.92]}>
        <sphereGeometry args={[0.11, 14, 14]} />
        <meshStandardMaterial color="#d36f62" roughness={0.54} metalness={0.1} />
      </mesh>
      {/* Upper finger (fixed) */}
      <group position={[side * 0.34, 0.08, -0.38]} rotation={[0.1, 0, side * 0.06]}>
        <mesh castShadow position={[side * 0.02, 0.03, -0.02]} rotation={[0.12, 0, side * 0.28]}>
          <capsuleGeometry args={[0.024, 0.16, 4, 8]} />
          <meshStandardMaterial color="#cf685d" roughness={0.58} metalness={0.06} />
        </mesh>
      </group>
      {/* Lower finger (dactyl) */}
      <group position={[side * 0.34, 0.0, -0.38]} rotation={[-0.08, 0, side * 0.06]}>
        <mesh castShadow position={[side * 0.02, -0.03, -0.02]} rotation={[-0.16, 0, side * 0.22]}>
          <capsuleGeometry args={[0.022, 0.14, 4, 8]} />
          <meshStandardMaterial color="#cf685d" roughness={0.58} metalness={0.06} />
        </mesh>
      </group>
    </group>
  );
}

function LobsterLeg({
  side,
  offset,
  upperRef,
  lowerRef
}: {
  side: -1 | 1;
  offset: number;
  upperRef?: (node: THREE.Group | null) => void;
  lowerRef?: (node: THREE.Group | null) => void;
}) {
  return (
    <group ref={upperRef} position={[side * 0.2, 0.04, offset]} rotation={[0.26, 0, side * 0.88]}>
      {/* Upper leg (coxa + basis) */}
      <mesh castShadow position={[side * 0.06, -0.03, 0.01]} rotation={[0.36, 0, side * 0.14]}>
        <capsuleGeometry args={[0.018, 0.26, 4, 8]} />
        <meshStandardMaterial color="#8f413c" roughness={0.62} metalness={0.06} />
      </mesh>
      {/* Knee joint */}
      <mesh castShadow position={[side * 0.12, -0.1, 0.01]}>
        <sphereGeometry args={[0.024, 8, 8]} />
        <meshStandardMaterial color="#7a3834" roughness={0.6} />
      </mesh>
      <group ref={lowerRef} position={[side * 0.14, -0.12, 0.02]} rotation={[-0.48, 0, side * 0.1]}>
        {/* Lower leg (propodus) */}
        <mesh castShadow position={[side * 0.06, -0.06, 0]} rotation={[0.16, 0, side * 0.12]}>
          <capsuleGeometry args={[0.014, 0.2, 4, 8]} />
          <meshStandardMaterial color="#733632" roughness={0.64} metalness={0.04} />
        </mesh>
        {/* Foot tip (dactylus) */}
        <mesh castShadow position={[side * 0.12, -0.14, 0.01]} rotation={[0.08, 0, side * 0.08]}>
          <capsuleGeometry args={[0.008, 0.06, 4, 6]} />
          <meshStandardMaterial color="#552927" roughness={0.68} />
        </mesh>
      </group>
    </group>
  );
}

function Block({
  position,
  size,
  color,
  roughness = 0.8,
  metalness = 0.05,
  emissive,
  emissiveIntensity = 0,
  transparent = false,
  opacity = 1,
  castShadow = false,
  receiveShadow = false
}: {
  position: Vec3;
  size: Vec3;
  color: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  return (
    <mesh position={position} castShadow={castShadow} receiveShadow={receiveShadow}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        transparent={transparent}
        opacity={opacity}
      />
    </mesh>
  );
}

function RoundedBlock({
  position,
  size,
  color,
  roughness = 0.8,
  metalness = 0.05,
  emissive,
  emissiveIntensity = 0,
  transparent = false,
  opacity = 1,
  castShadow = false,
  receiveShadow = false,
  radius = 0.08
}: {
  position: Vec3;
  size: Vec3;
  color: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  radius?: number;
}) {
  const safeRadius = Math.min(radius, size[0] * 0.24, size[1] * 0.24, size[2] * 0.24);

  return (
    <RoundedBox
      args={size}
      radius={safeRadius}
      smoothness={4}
      position={position}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        transparent={transparent}
        opacity={opacity}
      />
    </RoundedBox>
  );
}

function FurnitureModel({
  url,
  position,
  rotation = [0, 0, 0],
  scale = 1,
  color,
  roughness = 0.8,
  metalness = 0.05,
  emissive,
  emissiveIntensity = 0,
  castShadow = true,
  receiveShadow = false
}: {
  url: string;
  position: Vec3;
  rotation?: [number, number, number];
  scale?: number | Vec3;
  color: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const sourceGeometry = useLoader(STLLoader, url);
  const geometry = useMemo(() => {
    const cached = preparedStlGeometryCache.get(url);

    if (cached) {
      return cached;
    }

    const prepared = sourceGeometry.clone();

    prepared.rotateX(-Math.PI / 2);
    prepared.computeVertexNormals();
    prepared.computeBoundingBox();

    const box = prepared.boundingBox;

    if (box) {
      const centerX = (box.min.x + box.max.x) / 2;
      const centerZ = (box.min.z + box.max.z) / 2;
      prepared.translate(-centerX, -box.min.y, -centerZ);
    }

    preparedStlGeometryCache.set(url, prepared);
    return prepared;
  }, [sourceGeometry, url]);

  const resolvedScale = Array.isArray(scale) ? scale : [scale, scale, scale];

  return (
    <mesh
      geometry={geometry}
      position={position}
      rotation={rotation}
      scale={resolvedScale as [number, number, number]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

function TileRack({
  position,
  rotation = [0, 0, 0]
}: {
  position: Vec3;
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBlock position={[0, 0, 0]} size={[0.88, 0.08, 0.18]} color="#715842" roughness={0.88} castShadow />
      {Array.from({ length: 6 }).map((_, index) => (
        <RoundedBlock
          key={`tile-${position.join("-")}-${index}`}
          position={[-0.28 + index * 0.112, 0.08, 0.01]}
          size={[0.08, 0.12, 0.03]}
          color={index % 2 === 0 ? "#ece6dc" : "#ddd5c7"}
          roughness={0.88}
          castShadow
          radius={0.02}
        />
      ))}
    </group>
  );
}

function PendantLamp({
  position
}: {
  position: Vec3;
}) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, -0.34, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.68, 10]} />
        <meshStandardMaterial color="#d7dad4" roughness={0.36} metalness={0.2} />
      </mesh>
      <RoundedBlock
        position={[0, -0.78, 0]}
        size={[0.88, 0.12, 0.88]}
        color="#efe7d7"
        roughness={0.56}
        emissive="#efe7d7"
        emissiveIntensity={0.22}
        castShadow
      />
    </group>
  );
}

const mapDeskToWorld = (desk: { x: number; y: number }): Vec3 => {
  const meta = worldRooms.work;
  const x = meta.center[0] + ((desk.x / 100) - 0.5) * 9.8;
  const z = meta.center[2] + ((desk.y / 100) - 0.5) * 4.4;

  return [x, 0.05, z];
};

const buildWorldAgentTargets = (
  agents: WorldAgentDescriptor[],
  desks: WorldDeskDescriptor[]
): WorldAgentTarget[] => {
  const anchoredAgents = resolveAnchoredAgents(agents);
  const deskByAgentId = new Map(desks.map((desk) => [desk.id, desk]));

  return agents.map((agent) => {
    const anchored = anchoredAgents.get(agent.id);
    const workPlacement = resolveWorkPosePlacement(agent.scene, deskByAgentId.get(agent.id) ?? null);
    const room = agent.scene.room ?? "work";
    const mode = anchored?.mode ?? workPlacement?.mode ?? inferAnchorMode(agent.scene);
    const rawWorld = anchored?.world ?? workPlacement?.world ?? mapSceneToWorld(agent.scene);
    const world = projectWorldToAnchor(room, rawWorld, mode, agent.scene.pose);
    const scale = resolveWorldScale(agent.scene, anchored?.mode ?? workPlacement?.mode ?? "floor", anchored?.scale ?? 1);
    const accessWorld =
      projectAccessPoint(
        room,
        anchored?.accessWorld ??
          workPlacement?.accessWorld ??
          resolveAccessWorld(world, room, mode),
        mode
      );
    const surfaceHeight =
      anchored?.surfaceHeight ??
      workPlacement?.surfaceHeight ??
      world[1];

    return {
      id: agent.id,
      name: agent.name,
      accent: agent.accent,
      room,
      pose: agent.scene.pose,
      facing: anchored?.facing ?? workPlacement?.facing ?? agent.scene.facing,
      world,
      scale,
      yaw: anchored?.yaw ?? workPlacement?.yaw,
      mode,
      accessWorld,
      surfaceHeight,
      targetKey: [
        room,
        agent.scene.pose,
        mode,
        Math.round(world[0] * 100),
        Math.round(world[1] * 100),
        Math.round(world[2] * 100),
        Math.round(accessWorld[0] * 100),
        Math.round(accessWorld[2] * 100),
        Math.round(surfaceHeight * 100),
        Math.round((anchored?.yaw ?? workPlacement?.yaw ?? 0) * 100)
      ].join(":")
    };
  });
};

const toRenderWorldAgent = (target: WorldAgentTarget): RenderWorldAgent => ({
  ...target,
  renderPose: target.pose,
  renderFacing: target.facing,
  isMoving: false
});

const mapSceneToWorld = (scene: AgentSceneState): Vec3 => {
  const room = scene.room ?? "work";

  if (room === "work") {
    const transitPlacement = resolveWorkTransitPlacement(scene);

    if (transitPlacement) {
      return projectWorldToAnchor(room, transitPlacement, "floor", scene.pose);
    }

    const x = worldRooms.work.center[0] + ((scene.x / 100) - 0.5) * 9.8;
    const z = worldRooms.work.center[2] + ((scene.y / 100) - 0.5) * 4.4;
    return projectWorldToAnchor(room, [x, 0.05, z], inferAnchorMode(scene), scene.pose);
  }

  const meta = worldRooms[room];
  const x = meta.center[0] + (((scene.roomX ?? 50) / 100) - 0.5) * (meta.size[0] - 1.1);
  const z = meta.center[2] + (0.5 - ((scene.roomY ?? 30) / 100)) * (meta.size[2] - 1.1);
  return projectWorldToAnchor(room, [x, 0.05, z], inferAnchorMode(scene), scene.pose);
};

const resolveWorkPosePlacement = (
  scene: AgentSceneState,
  desk: WorldDeskDescriptor | null
):
  | {
      world: Vec3;
      accessWorld: Vec3;
      yaw?: number;
      facing: SceneFacing;
      mode: AnchorMode;
      surfaceHeight: number;
    }
  | null => {
  if (scene.room !== "work" || (scene.pose !== "working" && scene.pose !== "desk")) {
    return null;
  }

  const [deskX, , deskZ] = desk ? mapDeskToWorld(desk.desk) : mapSceneToWorld(scene);
  const world: Vec3 = [deskX, 0.05, deskZ + 0.88];
  const accessWorld: Vec3 = [deskX, 0.05, deskZ + 1.46];

  return {
    world,
    accessWorld,
    yaw: 0,
    facing: "front",
    mode: "desk",
    surfaceHeight: 0.52
  };
};

const resolveWorkTransitPlacement = (scene: AgentSceneState): Vec3 | null => {
  if (scene.room !== "work" || (scene.pose !== "walk" && scene.pose !== "handoff")) {
    return null;
  }

  const x = worldRooms.work.center[0] + ((scene.x / 100) - 0.5) * 9.6;
  const laneZ =
    scene.y <= 38
      ? -0.18
      : scene.y >= 60
        ? 3.48
        : 1.52;

  return [x, 0.05, laneZ];
};

const projectWorldToAnchor = (
  room: SceneRoom,
  world: Vec3,
  mode: AnchorMode,
  pose: ScenePose
): Vec3 => {
  const y = corridorGraph.mainCenter[1];

  if (mode === "seat" || mode === "bed") {
    return world;
  }

  if (room === "work") {
    const safeZ =
      mode === "desk"
        ? clamp(world[2], 0.5, 3.9)
        : pose === "walk" || pose === "handoff"
          ? world[2] <= 0.5
            ? -0.18
            : world[2] >= 2.5
              ? 3.48
              : 1.52
          : clamp(world[2], -0.18, 3.48);

    return [clamp(world[0], -8.05, 4.45), y, safeZ];
  }

  if (room === "coffee") {
    const candidates: Vec3[] = [
      [7.02, y, 2.14],
      [8.98, y, 2.12],
      [6.74, y, 1.5]
    ];

    return pickNearestWorldPoint(world, candidates);
  }

  return world;
};

const projectAccessPoint = (room: SceneRoom, accessWorld: Vec3, mode: AnchorMode): Vec3 => {
  if (mode === "seat" || mode === "bed") {
    return accessWorld;
  }

  return projectWorldToAnchor(room, accessWorld, "floor", "walk");
};

const inferAnchorMode = (scene: AgentSceneState): AnchorMode => {
  if (scene.pose === "sleep") {
    return "bed";
  }

  if (scene.pose === "mahjong" || scene.pose === "game") {
    return "seat";
  }

  if (scene.pose === "desk" || scene.pose === "working") {
    return "desk";
  }

  return "floor";
};

const resolveAccessWorld = (world: Vec3, room: SceneRoom, mode: AnchorMode): Vec3 => {
  if (mode === "floor" || mode === "desk") {
    return [world[0], corridorGraph.mainCenter[1], world[2]];
  }

  if (room === "cards") {
    return [world[0], corridorGraph.mainCenter[1], 11.2];
  }

  if (room === "nap") {
    return [2.36, corridorGraph.mainCenter[1], 10.42];
  }

  return [world[0], corridorGraph.mainCenter[1], world[2]];
};

const resolveWorldScale = (scene: AgentSceneState, mode: AnchorMode, anchorScale = 1) => {
  const baseScale =
    scene.pose === "sleep"
      ? 0.68
      : mode === "desk"
        ? 0.62
      : mode === "seat"
        ? 0.66
      : scene.room === "work"
        ? scene.pose === "working" || scene.pose === "desk"
          ? 0.64
          : 0.72
        : scene.pose === "mahjong" || scene.pose === "game"
          ? 0.68
          : 0.72;

  return baseScale * anchorScale;
};

const resolveAnchoredAgents = (agents: WorldAgentDescriptor[]) => {
  const placements = new Map<
    string,
    {
      world: Vec3;
      facing?: SceneFacing;
      scale?: number;
      yaw?: number;
      mode?: AnchorMode;
      accessWorld?: Vec3;
      surfaceHeight?: number;
    }
  >();

  (Object.entries(roomActivityAnchors) as [SceneRoom, ActivityAnchor[]][])
    .filter((entry): entry is [SceneRoom, ActivityAnchor[]] => Boolean(entry[1]?.length))
    .forEach(([room, anchors]) => {
      const roomAgents = agents
        .filter((agent) => agent.scene.room === room)
        .sort((left, right) => {
          const leftY = left.scene.roomY ?? 50;
          const rightY = right.scene.roomY ?? 50;

          if (leftY !== rightY) {
            return rightY - leftY;
          }

          const leftX = left.scene.roomX ?? 50;
          const rightX = right.scene.roomX ?? 50;

          if (leftX !== rightX) {
            return leftX - rightX;
          }

          return left.name.localeCompare(right.name);
        });
      const availableAnchors = [...anchors];

      roomAgents.forEach((agent) => {
        if (availableAnchors.length === 0) {
          return;
        }

        const targetX = agent.scene.roomX ?? 50;
        const targetY = agent.scene.roomY ?? 50;
        let bestIndex = 0;
        let bestDistance = Number.POSITIVE_INFINITY;

        availableAnchors.forEach((anchor, index) => {
          const distance = Math.hypot(targetX - anchor.roomX, targetY - anchor.roomY);

          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
          }
        });

        const [anchor] = availableAnchors.splice(bestIndex, 1);

        if (anchor) {
          placements.set(agent.id, {
            world: anchor.world,
            facing: anchor.facing,
            scale: anchor.scale,
            yaw: anchor.yaw,
            mode: anchor.mode,
            accessWorld: anchor.accessWorld,
            surfaceHeight: anchor.surfaceHeight
          });
        }
      });
    });

  return placements;
};

const createWorldMotion = (target: WorldAgentTarget, path: Vec3[], startedAt: number): WorldMotion => ({
  path,
  segmentLengths: buildWorldSegmentLengths(path),
  totalLength: measureWorldPath(path),
  startedAt,
  durationMs: resolveWorldMotionDuration(measureWorldPath(path), target.id, path),
  target
});

const buildInitialWorldPath = (target: WorldAgentTarget): Vec3[] =>
  compressWorldPath([
    getRoomSpawnPoint(target.room, target.accessWorld),
    getRoomEntryWaypoint(target.room, target.accessWorld),
    target.accessWorld,
    resolveMotionArrivalPoint(target.world, target.mode, target.accessWorld)
  ]);

const buildWorldWalkPath = (
  start: Vec3,
  end: Vec3,
  startRoom: SceneRoom,
  endRoom: SceneRoom,
  startMode: AnchorMode,
  endMode: AnchorMode,
  startAccess: Vec3,
  endAccess: Vec3
): Vec3[] => {
  const startTravel = resolveTravelPoint(start, startMode, startAccess);
  const endTravel = resolveTravelPoint(end, endMode, endAccess);
  const arrivalPoint = resolveMotionArrivalPoint(end, endMode, endAccess);
  const roomExit = getRoomExitWaypoint(startRoom, startTravel);
  const roomEntry = getRoomEntryWaypoint(endRoom, endTravel);

  if (startRoom === endRoom) {
    return compressWorldPath([
      start,
      startTravel,
      ...buildRoomTravelRoute(startRoom, startTravel, endTravel),
      endTravel,
      arrivalPoint
    ]);
  }

  return compressWorldPath([
    start,
    startTravel,
    ...buildRoomTravelRoute(startRoom, startTravel, roomExit),
    roomExit,
    ...buildCorridorRoute(startRoom, endRoom),
    roomEntry,
    ...buildRoomTravelRoute(endRoom, roomEntry, endTravel),
    endTravel,
    arrivalPoint
  ]);
};

const buildCorridorRoute = (startRoom: SceneRoom, endRoom: SceneRoom): Vec3[] => {
  const startHub = resolveRoomHub(startRoom);
  const endHub = resolveRoomHub(endRoom);
  const route: Vec3[] = [];

  if (!sameWorldPoint(startHub, endHub)) {
    route.push(startHub);
  }

  if (Math.abs(startHub[0] - endHub[0]) > 0.05) {
    route.push([endHub[0], corridorGraph.mainCenter[1], startHub[2]]);
  }

  if (Math.abs(startHub[2] - endHub[2]) > 0.05) {
    route.push([endHub[0], corridorGraph.mainCenter[1], endHub[2]]);
  }

  return route;
};

const resolveRoomHub = (room: SceneRoom): Vec3 => {
  if (room === "cards") {
    return corridorGraph.mainWest;
  }

  if (room === "coffee") {
    return corridorGraph.mainEast;
  }

  if (room === "nap") {
    return [corridorGraph.napDoor[0], corridorGraph.mainCenter[1], corridorGraph.cardsDoor[2]];
  }

  if (room === "mahjong") {
    return [corridorGraph.mahjongDoor[0], corridorGraph.mainCenter[1], corridorGraph.cardsDoor[2]];
  }

  return corridorGraph.mainCenter;
};

const getRoomExitWaypoint = (room: SceneRoom, world: Vec3): Vec3 => {
  if (room === "work") {
    return [clamp(world[0], -8.4, 4.8), corridorGraph.mainCenter[1], corridorGraph.mainCenter[2]];
  }

  if (room === "cards") {
    return corridorGraph.cardsDoor;
  }

  if (room === "nap") {
    return corridorGraph.napDoor;
  }

  if (room === "mahjong") {
    return corridorGraph.mahjongDoor;
  }

  return corridorGraph.coffeeDoor;
};

const getRoomEntryWaypoint = (room: SceneRoom, world: Vec3): Vec3 => {
  if (room === "work") {
    return [clamp(world[0], -8.4, 4.8), corridorGraph.mainCenter[1], corridorGraph.mainCenter[2]];
  }

  if (room === "cards") {
    return [-8.2, corridorGraph.mainCenter[1], 8.58];
  }

  if (room === "nap") {
    return [2.36, corridorGraph.mainCenter[1], 8.76];
  }

  if (room === "mahjong") {
    return [8.2, corridorGraph.mainCenter[1], 8.58];
  }

  return [6.62, corridorGraph.mainCenter[1], 2.48];
};

const getRoomSpawnPoint = (room: SceneRoom, world: Vec3): Vec3 => {
  if (room === "work") {
    return [clamp(world[0], -8.4, 4.8), corridorGraph.mainCenter[1], corridorGraph.mainCenter[2]];
  }

  if (room === "cards") {
    return [corridorGraph.cardsDoor[0], corridorGraph.cardsDoor[1], corridorGraph.cardsDoor[2] - 1.6];
  }

  if (room === "nap") {
    return [corridorGraph.napDoor[0], corridorGraph.napDoor[1], corridorGraph.napDoor[2] - 1.6];
  }

  if (room === "mahjong") {
    return [corridorGraph.mahjongDoor[0], corridorGraph.mahjongDoor[1], corridorGraph.mahjongDoor[2] - 1.6];
  }

  return [corridorGraph.coffeeDoor[0], corridorGraph.coffeeDoor[1], corridorGraph.coffeeDoor[2] + 1.6];
};

const resolveTravelPoint = (world: Vec3, mode: AnchorMode, accessWorld: Vec3): Vec3 =>
  mode === "floor" || mode === "desk" ? world : accessWorld;

const resolveMotionArrivalPoint = (world: Vec3, mode: AnchorMode, accessWorld: Vec3): Vec3 =>
  mode === "seat" || mode === "bed" ? accessWorld : world;

const buildRoomTravelRoute = (room: SceneRoom, from: Vec3, to: Vec3): Vec3[] => {
  const y = corridorGraph.mainCenter[1];

  if (sameWorldPoint(from, to)) {
    return [];
  }

  if (room === "work") {
    const aisleZ = 3.36;
    return compactWorldRoute([
      [from[0], y, aisleZ],
      [to[0], y, aisleZ]
    ]);
  }

  if (room === "coffee") {
    const serviceX = 6.74;
    const prepZ = 2.24;
    return compactWorldRoute([
      [serviceX, y, clamp(from[2], 1.06, 2.88)],
      [serviceX, y, prepZ],
      [to[0], y, prepZ]
    ]);
  }

  if (room === "cards") {
    const northLaneZ = 8.58;
    const seatApproachZ = 10.42;
    const westLaneX = -10.46;
    const eastLaneX = -5.94;
    const thresholdZ = 9.4;
    const resolveSideX = (point: Vec3) => (point[0] <= -8.2 ? westLaneX : eastLaneX);
    const fromDeep = from[2] > thresholdZ;
    const toDeep = to[2] > thresholdZ;
    const fromRoute = fromDeep
      ? [
          [resolveSideX(from), y, from[2]] as Vec3,
          [resolveSideX(from), y, northLaneZ] as Vec3
        ]
      : [[from[0], y, northLaneZ] as Vec3];
    const toRoute = toDeep
      ? [
          [resolveSideX(to), y, northLaneZ] as Vec3,
          [resolveSideX(to), y, seatApproachZ] as Vec3,
          [to[0], y, to[2]] as Vec3
        ]
      : [[to[0], y, northLaneZ] as Vec3];

    return compactWorldRoute([
      ...fromRoute,
      ...toRoute
    ]);
  }

  if (room === "nap") {
    const bedsideX = 2.36;
    const bedsideZ = 10.42;
    return compactWorldRoute([
      [bedsideX, y, from[2]],
      [bedsideX, y, to[2]]
    ]);
  }

  const centerX = 8.2;
  const northLaneZ = 8.58;
  const southLaneZ = 11.42;
  const westLaneX = 6.9;
  const eastLaneX = 9.5;
  const routeToNorthSpine = (point: Vec3) => {
    if (point[2] <= 9.7) {
      return compactWorldRoute([
        [point[0], y, northLaneZ],
        [centerX, y, northLaneZ]
      ]);
    }

    if (point[0] <= 7.18) {
      return compactWorldRoute([
        [westLaneX, y, point[2]],
        [westLaneX, y, northLaneZ],
        [centerX, y, northLaneZ]
      ]);
    }

    if (point[0] >= 9.22) {
      return compactWorldRoute([
        [eastLaneX, y, point[2]],
        [eastLaneX, y, northLaneZ],
        [centerX, y, northLaneZ]
      ]);
    }

    return compactWorldRoute([
      [centerX, y, southLaneZ],
      [eastLaneX, y, southLaneZ],
      [eastLaneX, y, northLaneZ],
      [centerX, y, northLaneZ]
    ]);
  };
  const fromSpine = routeToNorthSpine(from);
  const toSpine = routeToNorthSpine(to).slice().reverse();

  return compactWorldRoute([...fromSpine, ...toSpine]);
};

const buildWorldSegmentLengths = (path: Vec3[]) =>
  path.slice(1).map((point, index) => measureWorldDistance(path[index], point));

const measureWorldDistance = (left: Vec3, right: Vec3) =>
  Math.hypot(right[0] - left[0], right[2] - left[2]);

const pickNearestWorldPoint = (origin: Vec3, candidates: Vec3[]) =>
  candidates.reduce((best, candidate) =>
    measureWorldDistance(origin, candidate) < measureWorldDistance(origin, best) ? candidate : best
  );

const measureWorldPath = (path: Vec3[]) =>
  path.slice(1).reduce((total, point, index) => total + measureWorldDistance(path[index], point), 0);

const sampleWorldPath = (motion: WorldMotion, now: number): Vec3 => {
  const progress = easeInOutCubic(Math.min(1, (now - motion.startedAt) / motion.durationMs));
  const travelled = motion.totalLength * progress;
  let covered = 0;

  for (let index = 0; index < motion.segmentLengths.length; index += 1) {
    const segmentLength = motion.segmentLengths[index] ?? 0;
    const segmentStart = motion.path[index];
    const segmentEnd = motion.path[index + 1];

    if (!segmentStart || !segmentEnd) {
      continue;
    }

    if (travelled <= covered + segmentLength || index === motion.segmentLengths.length - 1) {
      const segmentProgress = segmentLength < 0.001 ? 1 : (travelled - covered) / segmentLength;

      return [
        interpolate(segmentStart[0], segmentEnd[0], segmentProgress),
        interpolate(segmentStart[1], segmentEnd[1], segmentProgress),
        interpolate(segmentStart[2], segmentEnd[2], segmentProgress)
      ];
    }

    covered += segmentLength;
  }

  return motion.target.world;
};

const resolveWorldFacing = (path: Vec3[], progress: number): SceneFacing => {
  if (path.length < 2) {
    return "front";
  }

  const clampedProgress = Math.min(0.999, Math.max(0, progress));
  const segmentIndex = Math.min(path.length - 2, Math.floor(clampedProgress * (path.length - 1)));
  const start = path[segmentIndex];
  const end = path[segmentIndex + 1];

  if (!start || !end) {
    return "front";
  }

  if (Math.abs(end[0] - start[0]) > Math.abs(end[2] - start[2])) {
    return end[0] >= start[0] ? "right" : "left";
  }

  return "front";
};

const resolveWorldMotionDuration = (distance: number, agentId: string, path: Vec3[]) => {
  const turns = Math.max(0, path.length - 2);
  const strideVariance = (hashSeed(agentId) % 160) - 80;

  return Math.max(1000, Math.round(distance * 240 + turns * 220 + strideVariance));
};

const compressWorldPath = (path: Vec3[]) =>
  path.filter((point, index, all) => index === 0 || !sameWorldPoint(point, all[index - 1]));

const compactWorldRoute = (path: Vec3[]) =>
  path.filter((point, index, all) => {
    if (index === 0) {
      return true;
    }

    const previous = all[index - 1];
    return previous ? !sameWorldPoint(point, previous) : true;
  });

const sameWorldPoint = (left: Vec3, right: Vec3) =>
  Math.abs(left[0] - right[0]) < 0.01 &&
  Math.abs(left[1] - right[1]) < 0.01 &&
  Math.abs(left[2] - right[2]) < 0.01;

const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;

const interpolate = (from: number, to: number, progress: number) => from + (to - from) * progress;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hashSeed = (value: string) => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
};

const resolveFacingYaw = (facing: SceneFacing) =>
  facing === "left" ? Math.PI * 0.55 : facing === "right" ? -Math.PI * 0.55 : 0;

const samplePatrolRoute = (
  path: Vec3[],
  speed: number,
  time: number
): { world: Vec3; facing: SceneFacing } => {
  if (path.length < 2) {
    return {
      world: path[0] ?? [0, 0.05, 0],
      facing: "front"
    };
  }

  const segmentLengths = buildWorldSegmentLengths(path);
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);

  if (totalLength < 0.001) {
    return {
      world: path[0] ?? [0, 0.05, 0],
      facing: "front"
    };
  }

  const pingPongCycle = (time * speed) % (totalLength * 2);
  const isForward = pingPongCycle <= totalLength;
  const travelled = isForward ? pingPongCycle : totalLength * 2 - pingPongCycle;
  let covered = 0;

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index] ?? 0;
    const segmentStart = path[index];
    const segmentEnd = path[index + 1];

    if (!segmentStart || !segmentEnd) {
      continue;
    }

    if (travelled <= covered + segmentLength || index === segmentLengths.length - 1) {
      const segmentProgress = segmentLength < 0.001 ? 1 : (travelled - covered) / segmentLength;
      const world: Vec3 = [
        interpolate(segmentStart[0], segmentEnd[0], segmentProgress),
        interpolate(segmentStart[1], segmentEnd[1], segmentProgress),
        interpolate(segmentStart[2], segmentEnd[2], segmentProgress)
      ];

      const facingPath: Vec3[] = isForward ? [segmentStart, segmentEnd] : [segmentEnd, segmentStart];

      return {
        world,
        facing: resolveWorldFacing(facingPath, segmentProgress)
      };
    }

    covered += segmentLength;
  }

  return {
    world: path[path.length - 1] ?? path[0] ?? [0, 0.05, 0],
    facing: "front"
  };
};

const buildIdlePatrolPath = (agent: RenderWorldAgent): Vec3[] => {
  if (agent.room !== "work") {
    return [agent.world];
  }

  const laneZ = agent.world[2] <= 0.5 ? -0.18 : agent.world[2] >= 2.5 ? 3.48 : 1.52;
  const leftX = clamp(agent.world[0] - 1.18, -8.05, 4.45);
  const rightX = clamp(agent.world[0] + 1.18, -8.05, 4.45);

  return [
    [leftX, agent.world[1], laneZ],
    [rightX, agent.world[1], laneZ]
  ];
};

const sampleAmbientWorld = (agent: RenderWorldAgent, time: number): { world: Vec3; facing: SceneFacing } => {
  if (agent.isMoving) {
    return {
      world: agent.world,
      facing: agent.renderFacing
    };
  }

  if (agent.mode === "seat" || agent.mode === "bed") {
    return {
      world: agent.world,
      facing: agent.renderFacing
    };
  }

  if (agent.renderPose === "walk") {
    const patrolPath = buildIdlePatrolPath(agent);

    return samplePatrolRoute(patrolPath, 0.38, time);
  }

  if (agent.renderPose === "coffee") {
    return {
      world: agent.world,
      facing: agent.renderFacing
    };
  }

  if (agent.renderPose === "game") {
    return {
      world: agent.world,
      facing: agent.renderFacing
    };
  }

  return {
    world: agent.world,
    facing: agent.renderFacing
  };
};

const detectWebGLSupport = () => {
  if (typeof document === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
};
