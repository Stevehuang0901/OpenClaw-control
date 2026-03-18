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
}

export interface SystemSnapshot {
  generatedAt: string;
  agents: AgentRecord[];
  workflows: WorkflowRecord[];
  messages: MessageRecord[];
  handoffs: HandoffRecord[];
  metrics: MetricSnapshot;
}

export interface GatewayEvent<T = unknown> {
  type: GatewayEventType;
  timestamp: string;
  data: T;
}

export interface CreateWorkflowInput {
  prompt: string;
}

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
