import { startTransition, useEffect, useState } from "react";
import { io } from "socket.io-client";

import { AgentRoster } from "./components/AgentRoster";
import { ApprovalsPanel } from "./components/ApprovalsPanel";
import { EventFeed } from "./components/EventFeed";
import { GatewayOpsPanel } from "./components/GatewayOpsPanel";
import { MetricStrip } from "./components/MetricStrip";
import { MissionControlPanel } from "./components/MissionControlPanel";
import { OpenClawUsagePanel } from "./components/OpenClawUsagePanel";
import { OfficeStoryPanel } from "./components/OfficeStoryPanel";
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

const starterPrompt =
  "Build a full OpenClaw-style multi-agent system with a dark pixel office, playful idle animations, approvals, token tracking, and a final delivery output.";

const pageMeta: Record<
  DashboardPage,
  { kicker: string; title: string; description: string }
> = {
  office: {
    kicker: "Office",
    title: "Live office floor",
    description:
      "Main workspace for entering tasks, watching the crew move, and seeing the current delivery form in real time."
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
  const [prompt, setPrompt] = useState(starterPrompt);
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

    const socket =
      window.location.port === "5173"
        ? io(`${window.location.protocol}//${window.location.hostname}:8787`, {
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
    onRestoreStarter: () => setPrompt(starterPrompt),
    onSelectWorkflow: setSelectedWorkflowId,
    onSubmit: () => {
      void submitWorkflow(prompt);
    }
  });

  return (
    <div className="min-h-screen bg-[#09070d] px-3 py-4 text-ink sm:px-4 lg:px-5">
      <div className="mx-auto grid max-w-[1700px] gap-6 lg:grid-cols-[252px_minmax(0,1fr)]">
        <OperationsSidebar
          activePage={activePage}
          approvals={snapshot.approvals}
          connected={connected}
          metrics={snapshot.metrics}
          openclaw={snapshot.openclaw}
          workflows={snapshot.workflows}
          onSelectPage={navigateToPage}
        />

        <main className="space-y-6">
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

          {content}
        </main>
      </div>
    </div>
  );
}

function HeaderCard({
  label,
  value,
  note
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="rounded-none border-2 border-ink/12 bg-[#15101d] px-4 py-4 shadow-pixel">
      <p className="text-[10px] uppercase tracking-[0.24em] text-ink/48">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      <p className="mt-3 text-sm text-ink/60">{note}</p>
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
        <div className="space-y-6">
          <MissionControlPanel
            connected={connected}
            error={error}
            messages={snapshot.messages}
            prompt={prompt}
            selectedWorkflowId={selectedWorkflowId}
            submitting={submitting}
            workflows={snapshot.workflows}
            onPromptChange={onPromptChange}
            onRestoreStarter={onRestoreStarter}
            onSelectWorkflow={onSelectWorkflow}
            onSubmit={onSubmit}
          />

          <OfficeStoryPanel
            agents={snapshot.agents}
            approvals={snapshot.approvals}
            messages={snapshot.messages}
            selectedWorkflowId={selectedWorkflowId}
            workflows={snapshot.workflows}
          />

          <OfficeScene
            agents={snapshot.agents}
            approvals={snapshot.approvals}
            selectedWorkflowId={selectedWorkflowId}
            workflows={snapshot.workflows}
            handoffs={snapshot.handoffs}
            messages={snapshot.messages}
          />

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <AgentRoster
              agents={snapshot.agents}
              workflows={snapshot.workflows}
              handoffs={snapshot.handoffs}
            />
            <EventFeed
              agents={snapshot.agents}
              approvals={snapshot.approvals}
              events={events}
              messages={snapshot.messages}
              workflows={snapshot.workflows}
            />
          </div>
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
