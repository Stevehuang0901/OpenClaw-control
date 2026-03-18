export const AGENT_ROLES = [
  "collector",
  "analyzer",
  "writer",
  "validator"
] as const;

export const TASK_STATUSES = [
  "pending",
  "in_progress",
  "done",
  "handed_off",
  "completed"
] as const;

export const AGENT_STATUSES = ["idle", "thinking", "handoff"] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export type WorkflowStatus = "queued" | "running" | "completed";
export type GatewayEventType =
  | "workflow_created"
  | "task_updated"
  | "message_logged"
  | "handoff_started"
  | "handoff_finished"
  | "workflow_completed"
  | "openclaw_status_updated"
  | "metrics_updated";

export interface DeskPosition {
  x: number;
  y: number;
}

export interface AgentRecord {
  id: string;
  name: string;
  role: AgentRole;
  token: string;
  status: AgentStatus;
  currentTaskId: string | null;
  completedTasks: number;
  accent: string;
  desk: DeskPosition;
}

export interface TaskHistoryEntry {
  status: TaskStatus;
  note: string;
  timestamp: string;
  actorId: string | null;
}

export interface TokenUsage {
  source: "reported" | "estimated";
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
}

export interface TaskRecord {
  id: string;
  workflowId: string;
  title: string;
  description: string;
  role: AgentRole;
  order: number;
  ownerAgentId: string | null;
  dependencyTaskId: string | null;
  status: TaskStatus;
  output: string | null;
  startedAt: string | null;
  completedAt: string | null;
  handoffAt: string | null;
  usage: TokenUsage | null;
  history: TaskHistoryEntry[];
}

export interface WorkflowRecord {
  id: string;
  prompt: string;
  summary: string;
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
  finalOutput: string | null;
  usage: TokenUsage | null;
  tasks: TaskRecord[];
}

export type MessageKind = "info" | "handoff" | "result";

export interface MessageRecord {
  id: string;
  workflowId: string;
  taskId: string;
  fromAgentId: string;
  toAgentId: string;
  kind: MessageKind;
  payload: string;
  reasoning: string | null;
  timestamp: string;
}

export interface HandoffRecord {
  id: string;
  workflowId: string;
  taskId: string;
  fromAgentId: string;
  toAgentId: string;
  payload: string;
  startedAt: string;
  durationMs: number;
}

export interface MetricSnapshot {
  totalWorkflows: number;
  completedWorkflows: number;
  runningWorkflows: number;
  tasksCompleted: number;
  pendingTasks: number;
  averageHandoffMs: number;
  averageCycleMs: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
}

export interface OpenClawProviderWindow {
  label: string;
  usedPercent: number;
  resetAt: number | null;
}

export interface OpenClawProviderUsage {
  provider: string;
  displayName: string;
  plan: string | null;
  windows: OpenClawProviderWindow[];
}

export interface OpenClawSessionUsage {
  agentId: string;
  key: string;
  kind: string;
  sessionId: string;
  updatedAt: number;
  ageMs: number | null;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  totalTokensFresh: boolean;
  remainingTokens: number | null;
  percentUsed: number | null;
  model: string | null;
  contextTokens: number | null;
}

export interface OpenClawGatewayStatus {
  mode: string | null;
  url: string | null;
  reachable: boolean;
  connectLatencyMs: number | null;
  error: string | null;
}

export interface OpenClawUsageTotals {
  recentSessionCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  averagePercentUsed: number;
}

export interface OpenClawStatusSnapshot {
  available: boolean;
  source: "cli" | "unavailable";
  updatedAt: string | null;
  error: string | null;
  providers: OpenClawProviderUsage[];
  recentSessions: OpenClawSessionUsage[];
  totals: OpenClawUsageTotals;
  gateway: OpenClawGatewayStatus;
}

export interface OpenClawSkillMissing {
  bins: string[];
  anyBins: string[];
  env: string[];
  config: string[];
  os: string[];
}

export interface OpenClawSkillRecord {
  name: string;
  description: string;
  emoji?: string;
  eligible: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  source: string;
  bundled: boolean;
  homepage?: string;
  primaryEnv?: string;
  missing: OpenClawSkillMissing;
}

export interface OpenClawSkillsSnapshot {
  workspaceDir: string;
  managedSkillsDir: string;
  skills: OpenClawSkillRecord[];
}

export interface ClawHubCatalogItem {
  slug: string;
  displayName: string;
  summary: string;
  latestVersion: string | null;
  ownerHandle: string | null;
  updatedAt: string | null;
  downloads: number | null;
  installsCurrent: number | null;
  installsAllTime: number | null;
  stars: number | null;
  score: number | null;
  installed: boolean;
}

export interface ClawHubCatalogResponse {
  query: string | null;
  items: ClawHubCatalogItem[];
}

export interface SkillInstallResult {
  ok: boolean;
  slug: string;
  version: string | null;
  managedSkillsDir: string;
  installPath: string;
  message: string;
}

export interface ManagedSkillRecord {
  slug: string;
  version: string | null;
  installPath: string;
  hasSkillFile: boolean;
}

export interface ManagedSkillsSnapshot {
  managedSkillsDir: string;
  workdir: string;
  skills: ManagedSkillRecord[];
}

export interface SkillActionResult {
  ok: boolean;
  slug: string;
  version: string | null;
  managedSkillsDir: string;
  installPath: string;
  message: string;
}

export interface SkillSecuritySummary {
  status: string | null;
  hasWarnings: boolean;
  guidance: string | null;
  summary: string | null;
  checkedAt: string | null;
}

export interface SkillDetailRecord {
  slug: string;
  displayName: string;
  summary: string;
  ownerHandle: string | null;
  latestVersion: string | null;
  changelog: string | null;
  updatedAt: string | null;
  skillMdContent: string | null;
  installed: boolean;
  installPath: string | null;
  source: "catalog" | "managed";
  security: SkillSecuritySummary | null;
}

export interface SystemSnapshot {
  generatedAt: string;
  agents: AgentRecord[];
  workflows: WorkflowRecord[];
  messages: MessageRecord[];
  handoffs: HandoffRecord[];
  metrics: MetricSnapshot;
  openclaw: OpenClawStatusSnapshot;
}

export interface GatewayEvent<T = unknown> {
  type: GatewayEventType;
  timestamp: string;
  data: T;
}

export interface CreateWorkflowInput {
  prompt: string;
}

export const emptyTokenUsage = (): TokenUsage => ({
  source: "estimated",
  inputTokens: 0,
  outputTokens: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0
});

export const emptyOpenClawStatus = (): OpenClawStatusSnapshot => ({
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
});

export const roleMeta: Record<
  AgentRole,
  { label: string; accent: string; baseDurationMs: number }
> = {
  collector: {
    label: "Data Collector",
    accent: "#58a6a6",
    baseDurationMs: 1900
  },
  analyzer: {
    label: "Analyzer",
    accent: "#f29f58",
    baseDurationMs: 2400
  },
  writer: {
    label: "Writer",
    accent: "#e36d67",
    baseDurationMs: 2200
  },
  validator: {
    label: "Validator",
    accent: "#91c46c",
    baseDurationMs: 1700
  }
};
