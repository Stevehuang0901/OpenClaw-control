import { startTransition, useEffect, useState } from "react";
import { io } from "socket.io-client";

import { AgentRoster } from "./components/AgentRoster";
import { ApprovalsPanel } from "./components/ApprovalsPanel";
import { EventFeed } from "./components/EventFeed";
import { GatewayOpsPanel } from "./components/GatewayOpsPanel";
import { MetricStrip } from "./components/MetricStrip";
import { MissionControlPanel } from "./components/MissionControlPanel";
import { OpenClawUsagePanel } from "./components/OpenClawUsagePanel";
import { OfficeCommandDeck } from "./components/OfficeCommandDeck";
import { OverviewDeck } from "./components/OverviewDeck";
import {
  OperationsSidebar,
  type DashboardPage
} from "./components/OperationsSidebar";
import { SkillMarketplacePanel } from "./components/SkillMarketplacePanel";
import { OfficeScene } from "./components/OfficeScene";
import { TaskBoardPanel } from "./components/TaskBoardPanel";
import { WorkflowPanel } from "./components/WorkflowPanel";
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
    kicker: "Mission",
    title: "Control the run, then inspect the office",
    description:
      "Start from the mission brief and workflow state first. The office map stays available, but it should support the work instead of overwhelming it."
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

    const socketTarget =
      window.location.port === "5173" || window.location.port === "5174" || window.location.port === "5175"
        ? `${window.location.protocol}//${window.location.hostname}:8791`
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
    <div className="min-h-screen bg-[#09070d] px-3 py-4 text-ink sm:px-4 lg:px-5">
      <div className="mx-auto grid max-w-[1720px] gap-4 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,1fr)]">
        <OperationsSidebar
          activePage={activePage}
          approvals={snapshot.approvals}
          connected={connected}
          metrics={snapshot.metrics}
          openclaw={snapshot.openclaw}
          workflows={snapshot.workflows}
          onSelectPage={navigateToPage}
        />

        <main className={isOfficePage ? "space-y-3" : "space-y-6"}>
          {isOfficePage ? null : (
            <header className="panel overflow-hidden">
              <div className="grid gap-5 px-5 py-5 xl:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <p className="pixel-label">{hero.kicker}</p>
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
                  />
                  <HeaderCard
                    label="Approvals"
                    value={String(snapshot.metrics.pendingApprovals)}
                    note="Release packages waiting"
                  />
                  <HeaderCard
                    label="OpenClaw"
                    value={snapshot.openclaw.available ? "live" : "cold"}
                    note={
                      snapshot.openclaw.gateway.reachable
                        ? "Gateway reachable"
                        : "Probe recommended"
                    }
                  />
                </div>
              </div>
            </header>
          )}

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
  compact = false
}: {
  label: string;
  value: string;
  note: string;
  compact?: boolean;
}) {
  return (
    <article
      className={`rounded-none border-2 border-ink/12 bg-[#15101d] shadow-pixel ${
        compact ? "px-3 py-3" : "px-4 py-4"
      }`}
    >
      <p
        className={`uppercase tracking-[0.24em] text-ink/48 ${
          compact ? "text-[9px]" : "text-[10px]"
        }`}
      >
        {label}
      </p>
      <p className={`mt-2 font-bold text-ink ${compact ? "text-xl" : "text-2xl"}`}>
        {value}
      </p>
      <p className={`mt-3 text-ink/60 ${compact ? "text-xs" : "text-sm"}`}>{note}</p>
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
        <div className="space-y-4">
          <section className="panel overflow-hidden">
            <div className="grid gap-4 px-4 py-4 xl:grid-cols-[1.25fr_0.75fr] xl:px-5 xl:py-5">
              <div>
                <p className="pixel-label">Office / Mission Control</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                  Real-time control room, not just a pretty diorama
                </h1>
                <p className="mt-4 max-w-4xl text-sm leading-relaxed text-ink/70 sm:text-base">
                  The office view now separates awareness from control: 3D shows spatial state,
                  while the workflow deck below handles queue, blockers, approvals, and crew load.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                <HeaderCard
                  label="Workflows"
                  value={String(snapshot.workflows.length)}
                  note={`${snapshot.metrics.runningWorkflows} currently moving`}
                  compact
                />
                <HeaderCard
                  label="Busy desks"
                  value={String(snapshot.agents.filter((agent) => agent.status !== "idle").length)}
                  note="agents doing active work"
                  compact
                />
                <HeaderCard
                  label="Approvals"
                  value={String(snapshot.metrics.pendingApprovals)}
                  note="packages waiting for review"
                  compact
                />
              </div>
            </div>
          </section>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.66fr)_minmax(332px,392px)]">
            <OfficeScene
              agents={snapshot.agents}
              approvals={snapshot.approvals}
              selectedWorkflowId={selectedWorkflowId}
              workflows={snapshot.workflows}
              handoffs={snapshot.handoffs}
              messages={snapshot.messages}
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

          <OfficeCommandDeck
            agents={snapshot.agents}
            approvals={snapshot.approvals}
            messages={snapshot.messages}
            openclaw={snapshot.openclaw}
            selectedWorkflowId={selectedWorkflowId}
            workflows={snapshot.workflows}
            onSelectWorkflow={onSelectWorkflow}
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
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-none border-2 border-ink/12 bg-[#15101d] px-3 py-2 shadow-pixel">
      <p className="text-[9px] uppercase tracking-[0.22em] text-ink/46">{label}</p>
      <p className="mt-1 text-sm font-bold uppercase tracking-[0.08em] text-ink">
        {value}
      </p>
    </div>
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
