import { startTransition, useEffect, useState } from "react";
import { io } from "socket.io-client";

import { AgentRoster } from "./components/AgentRoster";
import { ApprovalsPanel } from "./components/ApprovalsPanel";
import { EventFeed } from "./components/EventFeed";
import { GatewayOpsPanel } from "./components/GatewayOpsPanel";
import { MetricStrip } from "./components/MetricStrip";
import { MissionControlPanel } from "./components/MissionControlPanel";
import { OpenClawUsagePanel } from "./components/OpenClawUsagePanel";
import { OverviewDeck } from "./components/OverviewDeck";
import {
  OperationsSidebar,
  type DashboardPage
} from "./components/OperationsSidebar";
import { SkillMarketplacePanel } from "./components/SkillMarketplacePanel";
import { OfficeScene } from "./components/OfficeScene";
import { TaskBoardPanel } from "./components/TaskBoardPanel";
import { WorkflowPanel } from "./components/WorkflowPanel";
import { formatNumber, truncate } from "./lib/format";
import { getWorkflowProgress } from "./lib/workflows";
import type { GatewayEvent, SystemSnapshot } from "./types/contracts";

const defaultPage: DashboardPage = "office";

const emptySnapshot: SystemSnapshot = {
  generatedAt: new Date(0).toISOString(),
  agents: [],
  workflows: [],
  approvals: [],
  messages: [],
  handoffs: [],
  metrics: {
    totalWorkflows: 0,
    completedWorkflows: 0,
    runningWorkflows: 0,
    tasksCompleted: 0,
    pendingTasks: 0,
    pendingApprovals: 0,
    averageHandoffMs: 0,
    averageCycleMs: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    estimatedTotalTokens: 0
  },
  openclaw: {
    available: false,
    source: "unavailable",
    updatedAt: null,
    error: null,
    providers: [],
    recentSessions: [],
    totals: {
      recentSessionCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      averagePercentUsed: 0
    },
    gateway: {
      mode: null,
      url: null,
      reachable: false,
      connectLatencyMs: null,
      error: null
    }
  }
};

const samplePrompt =
  "Build a full OpenClaw-style multi-agent system with a dark pixel office, playful idle animations, approvals, token tracking, and a final delivery output.";

const pageMeta: Record<
  DashboardPage,
  { kicker: string; title: string; description: string }
> = {
  office: {
    kicker: "Command Center",
    title: "Run the workflow like a real control room",
    description:
      "Route the brief, watch who is active, and keep approvals plus delivery output in one working surface. The office map should explain the system, not drown it."
  },
  dashboard: {
    kicker: "Dashboard",
    title: "Operations overview",
    description:
      "A cleaner overview page for metrics, task board state, workflow trace, and crew readiness."
  },
  activity: {
    kicker: "Activity",
    title: "Realtime feed",
    description:
      "Message traffic and system events in one place, without mixing every other panel into the same screen."
  },
  approvals: {
    kicker: "Approvals",
    title: "Release desk",
    description:
      "Review validator output, approve or reject packages, and keep approval work isolated from the main office floor."
  },
  operations: {
    kicker: "Operations",
    title: "Gateway and usage",
    description:
      "Probe gateways, inspect OpenClaw status, and monitor provider windows and token activity."
  },
  skills: {
    kicker: "Skills",
    title: "Marketplace",
    description:
      "Manage skill discovery, installs, updates, and SKILL.md inspection from a dedicated tools view."
  }
};

export default function App() {
  const [snapshot, setSnapshot] = useState<SystemSnapshot>(emptySnapshot);
  const [events, setEvents] = useState<GatewayEvent[]>([]);
  const [prompt, setPrompt] = useState("");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<DashboardPage>(() =>
    typeof window === "undefined" ? defaultPage : resolvePage(window.location.hash)
  );
  const [connected, setConnected] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const syncPageFromHash = () => {
      setActivePage(resolvePage(window.location.hash));
    };

    const loadInitialState = async () => {
      try {
        const response = await fetch("/api/state");
        if (!response.ok) {
          throw new Error("Failed to load gateway state.");
        }

        const data = (await response.json()) as SystemSnapshot;
        if (!mounted) {
          return;
        }

        startTransition(() => {
          setSnapshot(data);
        });
      } catch (loadError) {
        if (!mounted) {
          return;
        }

        setError(
          loadError instanceof Error ? loadError.message : "Unable to load state."
        );
      }
    };

    syncPageFromHash();
    window.addEventListener("hashchange", syncPageFromHash);
    void loadInitialState();

    const socketTarget = import.meta.env.DEV
      ? import.meta.env.VITE_API_ORIGIN ??
        `${window.location.protocol}//${window.location.hostname}:8811`
      : undefined;

    const socket = socketTarget
      ? io(socketTarget, {
          transports: ["websocket"]
        })
      : io({
          transports: ["websocket"]
        });

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("snapshot", (nextSnapshot: SystemSnapshot) => {
      startTransition(() => {
        setSnapshot(nextSnapshot);
      });
    });

    socket.on("event", (event: GatewayEvent) => {
      startTransition(() => {
        setEvents((current) => [event, ...current].slice(0, 40));
      });
    });

    return () => {
      mounted = false;
      window.removeEventListener("hashchange", syncPageFromHash);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activePage]);

  useEffect(() => {
    if (snapshot.workflows.length === 0) {
      if (selectedWorkflowId !== null) {
        setSelectedWorkflowId(null);
      }
      return;
    }

    if (
      !selectedWorkflowId ||
      !snapshot.workflows.some((workflow) => workflow.id === selectedWorkflowId)
    ) {
      setSelectedWorkflowId(snapshot.workflows[0].id);
    }
  }, [selectedWorkflowId, snapshot.workflows]);

  const focusWorkflow = getFocusWorkflow(snapshot.workflows, selectedWorkflowId);
  const focusProgress = focusWorkflow ? getWorkflowProgress(focusWorkflow) : null;

  useEffect(() => {
    const qaWindow = window as Window & {
      advanceTime?: (ms: number) => Promise<void>;
      render_game_to_text?: () => string;
    };

    qaWindow.advanceTime = async (ms: number) => {
      const duration = Math.max(0, Math.round(ms));
      if (duration === 0) {
        return;
      }

      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), duration);
      });
    };

    qaWindow.render_game_to_text = () =>
      JSON.stringify({
        coordinate_system: "screen ui, top-left origin, CSS pixels",
        page: activePage,
        connected,
        prompt_characters: prompt.length,
        workflow_count: snapshot.workflows.length,
        pending_approvals: snapshot.metrics.pendingApprovals,
        running_workflows: snapshot.metrics.runningWorkflows,
        selected_workflow: focusWorkflow
          ? {
              id: focusWorkflow.id,
              summary: focusWorkflow.summary,
              status: focusWorkflow.status,
              progress_percent: focusProgress?.percent ?? 0
            }
          : null,
        office_view:
          activePage === "office"
            ? {
                render_mode:
                  typeof window === "undefined"
                    ? "plan"
                    : window.localStorage.getItem("clawcontrol.office-render-mode-v3") ??
                      "plan",
                visible_sections: [
                  "page_header",
                  "office_scene",
                  "dispatch_panel",
                  "delivery_preview"
                ]
              }
            : null
      });

    return () => {
      delete qaWindow.advanceTime;
      delete qaWindow.render_game_to_text;
    };
  }, [
    activePage,
    connected,
    focusProgress?.percent,
    focusWorkflow,
    prompt.length,
    snapshot.metrics.pendingApprovals,
    snapshot.metrics.runningWorkflows,
    snapshot.workflows.length
  ]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.closest("input, textarea, select, [contenteditable='true']") !== null ||
        target.isContentEditable);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "f" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();

      if (document.fullscreenElement) {
        void document.exitFullscreen();
        return;
      }

      void document.documentElement.requestFullscreen?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const submitWorkflow = async (nextPrompt: string) => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: nextPrompt
        })
      });

      if (!response.ok) {
        throw new Error("The gateway rejected the workflow request.");
      }

      const workflow = (await response.json()) as { id: string };
      setSelectedWorkflowId(workflow.id);
      setPrompt("");
      navigateToPage("office");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create workflow."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const navigateToPage = (page: DashboardPage) => {
    setActivePage(page);
    if (typeof window !== "undefined" && window.location.hash !== `#${page}`) {
      window.location.hash = page;
    }
  };

  const hero = pageMeta[activePage];
  const isOfficePage = activePage === "office";
  const content = renderPageContent({
    activePage,
    connected,
    error,
    events,
    prompt,
    selectedWorkflowId,
    snapshot,
    submitting,
    onPromptChange: setPrompt,
    onRestoreStarter: () => setPrompt(samplePrompt),
    onSelectWorkflow: setSelectedWorkflowId,
    onSubmit: () => {
      void submitWorkflow(prompt);
    }
  });

  return (
    <div className="min-h-screen px-3 py-3 text-ink sm:px-4 lg:px-5">
      <div className="mx-auto grid max-w-[1680px] gap-4 lg:grid-cols-[246px_minmax(0,1fr)]">
        <div className="order-2 lg:order-1">
          <OperationsSidebar
            activePage={activePage}
            approvals={snapshot.approvals}
            connected={connected}
            metrics={snapshot.metrics}
            openclaw={snapshot.openclaw}
            workflows={snapshot.workflows}
            onSelectPage={navigateToPage}
          />
        </div>

        <main className={`${isOfficePage ? "space-y-4" : "space-y-6"} order-1 min-w-0 lg:order-2`}>
          <header className="panel overflow-hidden">
            {isOfficePage ? (
              <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="pixel-label">{hero.kicker}</p>
                    <HeaderPill
                      label={connected ? "Gateway" : "Gateway"}
                      value={connected ? "Linked" : "Offline"}
                      tone={connected ? "good" : "warn"}
                    />
                    <HeaderPill
                      label="Focus"
                      value={focusProgress ? `${focusProgress.percent}%` : "Idle"}
                      tone={focusProgress?.activeTask ? "good" : "neutral"}
                    />
                  </div>
                  <h1 className="mt-3 text-[1.45rem] font-bold leading-tight text-ink sm:text-[1.7rem]">
                    Live office control
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/66">
                    {focusWorkflow
                      ? truncate(focusWorkflow.summary, 116)
                      : "Dispatch from the right rail and use the floor scene as live telemetry."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <HeaderPill
                    label="Queued"
                    value={String(snapshot.workflows.length)}
                    tone="neutral"
                  />
                  <HeaderPill
                    label="Approvals"
                    value={String(snapshot.metrics.pendingApprovals)}
                    tone={snapshot.metrics.pendingApprovals > 0 ? "warn" : "neutral"}
                  />
                  <HeaderPill
                    label="Tokens"
                    value={formatNumber(snapshot.metrics.estimatedTotalTokens)}
                    tone="neutral"
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 px-5 py-5 xl:grid-cols-[1.08fr_0.92fr]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="pixel-label">{hero.kicker}</p>
                  </div>
                  <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
                    {hero.title}
                  </h1>
                  <p className="mt-4 max-w-4xl text-base leading-relaxed text-ink/70">
                    {hero.description}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <HeaderCard
                    label="Gateway"
                    value={connected ? "online" : "offline"}
                    note={`${snapshot.metrics.runningWorkflows} workflows moving`}
                    accent={connected ? "good" : "warn"}
                  />
                  <HeaderCard
                    label="Approvals"
                    value={String(snapshot.metrics.pendingApprovals)}
                    note="Release packages waiting"
                    accent={snapshot.metrics.pendingApprovals > 0 ? "warn" : "neutral"}
                  />
                  <HeaderCard
                    label="OpenClaw"
                    value={snapshot.openclaw.available ? "live" : "cold"}
                    note={
                      snapshot.openclaw.gateway.reachable
                        ? "Gateway reachable"
                        : "Probe recommended"
                    }
                    accent={snapshot.openclaw.gateway.reachable ? "good" : "warn"}
                  />
                </div>
              </div>
            )}
          </header>

          {content}
        </main>
      </div>
    </div>
  );
}

function HeaderCard({
  label,
  value,
  note,
  compact = false,
  accent = "neutral"
}: {
  label: string;
  value: string;
  note: string;
  compact?: boolean;
  accent?: "good" | "warn" | "neutral";
}) {
  const accentClass =
    accent === "good"
      ? "bg-mint/90"
      : accent === "warn"
        ? "bg-brass/90"
        : "bg-white/35";

  return (
    <article
      className={`overflow-hidden rounded-[24px] border border-white/10 bg-white/5 ${
        compact ? "px-3.5 py-3" : "px-4 py-4"
      }`}
    >
      <span className={`block h-1 w-12 rounded-full ${accentClass}`} />
      <p
        className={`uppercase tracking-[0.24em] text-ink/46 ${
          compact ? "text-[9px]" : "text-[10px]"
        }`}
      >
        {label}
      </p>
      <p
        className={`font-bold leading-none text-ink ${
          compact ? "mt-2 text-[1.65rem]" : "mt-3 text-[2.35rem]"
        }`}
      >
        {value}
      </p>
      <p
        className={`leading-relaxed text-ink/60 ${
          compact ? "mt-2 text-[11px]" : "mt-3 text-sm"
        }`}
      >
        {note}
      </p>
    </article>
  );
}

function renderPageContent(input: {
  activePage: DashboardPage;
  connected: boolean;
  error: string | null;
  events: GatewayEvent[];
  prompt: string;
  selectedWorkflowId: string | null;
  snapshot: SystemSnapshot;
  submitting: boolean;
  onPromptChange: (value: string) => void;
  onRestoreStarter: () => void;
  onSelectWorkflow: (workflowId: string) => void;
  onSubmit: () => void;
}) {
  const {
    activePage,
    connected,
    error,
    events,
    prompt,
    selectedWorkflowId,
    snapshot,
    submitting,
    onPromptChange,
    onRestoreStarter,
    onSelectWorkflow,
    onSubmit
  } = input;

  switch (activePage) {
    case "office":
      return (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.52fr)_minmax(340px,0.82fr)]">
          <OfficeScene
            agents={snapshot.agents}
            approvals={snapshot.approvals}
            selectedWorkflowId={selectedWorkflowId}
            workflows={snapshot.workflows}
            handoffs={snapshot.handoffs}
            messages={snapshot.messages}
            onSelectWorkflow={onSelectWorkflow}
          />

          <MissionControlPanel
            connected={connected}
            error={error}
            prompt={prompt}
            selectedWorkflowId={selectedWorkflowId}
            submitting={submitting}
            workflows={snapshot.workflows}
            onPromptChange={onPromptChange}
            onRestoreStarter={onRestoreStarter}
            onSubmit={onSubmit}
          />
        </div>
      );

    case "dashboard":
      return (
        <div className="space-y-6">
          <OverviewDeck
            agents={snapshot.agents}
            approvals={snapshot.approvals}
            openclaw={snapshot.openclaw}
            selectedWorkflowId={selectedWorkflowId}
            workflows={snapshot.workflows}
          />
          <MetricStrip metrics={snapshot.metrics} />
          <div className="grid gap-6 2xl:grid-cols-[1.28fr_0.72fr]">
            <TaskBoardPanel
              approvals={snapshot.approvals}
              agents={snapshot.agents}
              selectedWorkflowId={selectedWorkflowId}
              workflows={snapshot.workflows}
              onSelectWorkflow={onSelectWorkflow}
            />
            <AgentRoster
              agents={snapshot.agents}
              workflows={snapshot.workflows}
              handoffs={snapshot.handoffs}
            />
          </div>
          <WorkflowPanel
            workflows={snapshot.workflows}
            agents={snapshot.agents}
            selectedWorkflowId={selectedWorkflowId}
            onSelectWorkflow={onSelectWorkflow}
          />
        </div>
      );

    case "activity":
      return (
        <div className="space-y-6">
          <WorkflowPanel
            workflows={snapshot.workflows}
            agents={snapshot.agents}
            selectedWorkflowId={selectedWorkflowId}
            onSelectWorkflow={onSelectWorkflow}
          />
          <EventFeed
            agents={snapshot.agents}
            approvals={snapshot.approvals}
            events={events}
            messages={snapshot.messages}
            workflows={snapshot.workflows}
          />
        </div>
      );

    case "approvals":
      return (
        <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
          <WorkflowPanel
            workflows={snapshot.workflows}
            agents={snapshot.agents}
            selectedWorkflowId={selectedWorkflowId}
            onSelectWorkflow={onSelectWorkflow}
          />
          <ApprovalsPanel
            approvals={snapshot.approvals}
            workflows={snapshot.workflows}
          />
        </div>
      );

    case "operations":
      return (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <GatewayOpsPanel openclaw={snapshot.openclaw} />
          <OpenClawUsagePanel openclaw={snapshot.openclaw} />
        </div>
      );

    case "skills":
      return <SkillMarketplacePanel />;

    default:
      return null;
  }
}

function HeaderPill({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "border-mint/35 bg-mint/10 text-mint"
      : tone === "warn"
        ? "border-brass/35 bg-brass/10 text-brass"
        : "border-white/10 bg-white/5 text-ink/72";

  return (
    <div className={`rounded-full border px-3 py-2 ${toneClass}`}>
      <p className="text-[9px] uppercase tracking-[0.22em] text-current opacity-70">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-bold uppercase tracking-[0.08em] text-current">
        {value}
      </p>
    </div>
  );
}

function getFocusWorkflow(
  workflows: SystemSnapshot["workflows"],
  selectedWorkflowId: string | null
) {
  return (
    workflows.find((workflow) => workflow.id === selectedWorkflowId) ??
    workflows.find((workflow) => workflow.status === "running") ??
    workflows[0] ??
    null
  );
}

function resolvePage(hash: string): DashboardPage {
  const normalized = hash.replace(/^#/, "");
  if (
    normalized === "office" ||
    normalized === "dashboard" ||
    normalized === "activity" ||
    normalized === "approvals" ||
    normalized === "operations" ||
    normalized === "skills"
  ) {
    return normalized;
  }

  return defaultPage;
}
