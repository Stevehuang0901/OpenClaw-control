import {
  emptyOpenClawStatus,
  emptyTokenUsage,
  roleMeta,
  type AgentRecord,
  type AgentRole,
  type ApprovalRecord,
  type ApprovalStatus,
  type GatewayEvent,
  type GatewayEventType,
  type HandoffRecord,
  type MessageRecord,
  type MetricSnapshot,
  type OpenClawStatusSnapshot,
  type SystemSnapshot,
  type TaskHistoryEntry,
  type TaskRecord,
  type TokenUsage,
  type WorkflowRecord
} from "../../../../packages/shared/src/index";

type EventListener = (event: GatewayEvent) => void;
type SnapshotListener = (snapshot: SystemSnapshot) => void;

interface GatewayOptions {
  durationMultiplier?: number;
  handoffDurationMs?: number;
  executor?: TaskExecutor | null;
}

export interface TaskExecutionResult {
  output: string;
  usage: TokenUsage | null;
  note?: string | null;
}

export interface TaskExecutor {
  runTask(input: {
    workflow: WorkflowRecord;
    task: TaskRecord;
    agent: AgentRecord;
  }): Promise<TaskExecutionResult>;
}

const workflowBlueprint: Array<{
  role: AgentRole;
  title: string;
  buildDescription: (prompt: string) => string;
}> = [
  {
    role: "collector",
    title: "Collect project context",
    buildDescription: (prompt) =>
      `Extract goals, constraints, deliverables, and important nouns from "${prompt}".`
  },
  {
    role: "analyzer",
    title: "Build execution strategy",
    buildDescription: (prompt) =>
      `Convert collected context into an ordered plan, identify dependencies, and outline risks for "${prompt}".`
  },
  {
    role: "writer",
    title: "Draft implementation package",
    buildDescription: (prompt) =>
      `Turn the analyzed plan into a deliverable package that moves "${prompt}" toward completion.`
  },
  {
    role: "validator",
    title: "Validate release readiness",
    buildDescription: (prompt) =>
      `Check the deliverable against the original request, note any gaps, and prepare a ship recommendation for "${prompt}".`
  }
];

export class Gateway {
  private readonly agents = new Map<string, AgentRecord>();
  private readonly workflows = new Map<string, WorkflowRecord>();
  private readonly eventListeners = new Set<EventListener>();
  private readonly snapshotListeners = new Set<SnapshotListener>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  private readonly options: {
    durationMultiplier: number;
    handoffDurationMs: number;
    executor: TaskExecutor | null;
  };

  private messages: MessageRecord[] = [];
  private handoffs: HandoffRecord[] = [];
  private approvals: ApprovalRecord[] = [];
  private completedHandoffDurations: number[] = [];
  private openclawStatus: OpenClawStatusSnapshot = emptyOpenClawStatus();

  constructor(seed: AgentRecord[], options?: GatewayOptions) {
    for (const agent of seed) {
      this.agents.set(agent.id, structuredClone(agent));
    }

    this.options = {
      durationMultiplier: options?.durationMultiplier ?? 1,
      handoffDurationMs: options?.handoffDurationMs ?? 1400,
      executor: options?.executor ?? null
    };
  }

  subscribe(onEvent: EventListener, onSnapshot?: SnapshotListener) {
    this.eventListeners.add(onEvent);
    if (onSnapshot) {
      this.snapshotListeners.add(onSnapshot);
    }

    return () => {
      this.eventListeners.delete(onEvent);
      if (onSnapshot) {
        this.snapshotListeners.delete(onSnapshot);
      }
    };
  }

  getSnapshot(): SystemSnapshot {
    const workflows = Array.from(this.workflows.values()).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );
    const agents = Array.from(this.agents.values()).sort((left, right) =>
      left.name.localeCompare(right.name)
    );
    const approvals = [...this.approvals].sort((left, right) => {
      if (left.status === right.status) {
        return right.createdAt.localeCompare(left.createdAt);
      }

      if (left.status === "pending") {
        return -1;
      }

      if (right.status === "pending") {
        return 1;
      }

      return right.createdAt.localeCompare(left.createdAt);
    });

    return {
      generatedAt: timestamp(),
      agents: structuredClone(agents),
      workflows: structuredClone(workflows),
      approvals: structuredClone(approvals),
      messages: structuredClone(this.messages.slice(0, 48)),
      handoffs: structuredClone(this.handoffs),
      metrics: this.computeMetrics(workflows),
      openclaw: structuredClone(this.openclawStatus)
    };
  }

  setOpenClawStatus(status: OpenClawStatusSnapshot) {
    this.openclawStatus = structuredClone(status);
    this.emit("openclaw_status_updated", status);
  }

  updateApproval(input: {
    approvalId: string;
    status: ApprovalStatus;
    reviewer?: string | null;
    decisionNote?: string | null;
  }) {
    const approval = this.approvals.find((entry) => entry.id === input.approvalId);

    if (!approval) {
      return null;
    }

    const decidedAt = timestamp();
    approval.status = input.status;
    approval.decidedAt = decidedAt;
    approval.reviewer = input.reviewer?.trim() || "Mission Control";
    approval.decisionNote = input.decisionNote?.trim() || null;

    const workflow = this.workflows.get(approval.workflowId);
    if (workflow) {
      workflow.updatedAt = decidedAt;
    }

    const message: MessageRecord = {
      id: createId("msg"),
      workflowId: approval.workflowId,
      taskId: approval.taskId,
      fromAgentId: "gateway",
      toAgentId: "gateway",
      kind: "info",
      payload: `${approval.title} ${input.status} by ${approval.reviewer}.`,
      reasoning: approval.decisionNote,
      timestamp: decidedAt
    };

    this.messages = [message, ...this.messages].slice(0, 48);

    this.emit("message_logged", message);
    this.emit("approval_updated", approval);

    return structuredClone(approval);
  }

  submitWorkflow(prompt: string): WorkflowRecord {
    const trimmedPrompt = prompt.trim();
    const workflowId = createId("wf");
    const createdAt = timestamp();

    const tasks = workflowBlueprint.map((step, index) => {
      const taskId = createId("task");
      return {
        id: taskId,
        workflowId,
        title: step.title,
        description: step.buildDescription(trimmedPrompt),
        role: step.role,
        order: index + 1,
        ownerAgentId: null,
        dependencyTaskId: index === 0 ? null : "",
        status: "pending",
        output: null,
        startedAt: null,
        completedAt: null,
        handoffAt: null,
        usage: null,
        history: [
          this.buildHistoryEntry(
            "pending",
            "Task created and queued at the gateway.",
            null,
            createdAt
          )
        ]
      } satisfies TaskRecord;
    });

    for (let index = 1; index < tasks.length; index += 1) {
      tasks[index].dependencyTaskId = tasks[index - 1].id;
    }

    const workflow: WorkflowRecord = {
      id: workflowId,
      prompt: trimmedPrompt,
      summary: summarisePrompt(trimmedPrompt),
      status: "queued",
      createdAt,
      updatedAt: createdAt,
      finalOutput: null,
      usage: null,
      tasks
    };

    this.workflows.set(workflow.id, workflow);
    this.emit("workflow_created", workflow);
    this.dispatchReadyTasks();

    return structuredClone(workflow);
  }

  bootstrapDemo() {
    const demos = [
      "Launch a retro control room dashboard for a multi-agent build request.",
      "Prepare a release package for a customer onboarding automation workflow."
    ];

    demos.forEach((prompt, index) => {
      const delay = 800 + index * 3200;
      const timer = setTimeout(() => {
        this.submitWorkflow(prompt);
        this.timers.delete(timer);
      }, delay);
      this.timers.add(timer);
    });
  }

  private dispatchReadyTasks() {
    const workflows = Array.from(this.workflows.values()).sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );

    for (const workflow of workflows) {
      for (const task of workflow.tasks) {
        if (task.status !== "pending") {
          continue;
        }

        if (!this.isTaskReady(workflow, task)) {
          continue;
        }

        const agent = this.findIdleAgent(task.role);
        if (!agent) {
          continue;
        }

        this.assignTask(workflow.id, task.id, agent.id);
      }
    }
  }

  private assignTask(workflowId: string, taskId: string, agentId: string) {
    const workflow = this.workflows.get(workflowId);
    const agent = this.agents.get(agentId);

    if (!workflow || !agent) {
      return;
    }

    const task = workflow.tasks.find((entry) => entry.id === taskId);
    if (!task || task.status !== "pending") {
      return;
    }

    const startedAt = timestamp();
    const dependency = task.dependencyTaskId
      ? workflow.tasks.find((entry) => entry.id === task.dependencyTaskId) ?? null
      : null;

    if (dependency && dependency.status === "handed_off") {
      dependency.status = "completed";
      dependency.completedAt = dependency.completedAt ?? startedAt;
      dependency.history.push(
        this.buildHistoryEntry(
          "completed",
          `${agent.name} acknowledged the handoff and finalized the previous step.`,
          agent.id,
          startedAt
        )
      );
    }

    task.ownerAgentId = agent.id;
    task.status = "in_progress";
    task.startedAt = startedAt;
    task.history.push(
      this.buildHistoryEntry(
        "in_progress",
        `${agent.name} picked up the task from the gateway.`,
        agent.id,
        startedAt
      )
    );

    agent.status = "thinking";
    agent.currentTaskId = task.id;

    workflow.status = "running";
    workflow.updatedAt = startedAt;

    this.emit("task_updated", {
      workflowId,
      taskId,
      agentId,
      status: "in_progress"
    });

    if (this.options.executor) {
      void this.executeTask(workflowId, taskId, agentId);
      return;
    }

    const duration = this.resolveTaskDuration(task.role);
    const timer = setTimeout(() => {
      this.completeTask(workflowId, taskId, agentId);
      this.timers.delete(timer);
    }, duration);
    this.timers.add(timer);
  }

  private async executeTask(workflowId: string, taskId: string, agentId: string) {
    const workflow = this.workflows.get(workflowId);
    const agent = this.agents.get(agentId);

    if (!workflow || !agent || !this.options.executor) {
      return;
    }

    const task = workflow.tasks.find((entry) => entry.id === taskId);
    if (!task || task.status !== "in_progress") {
      return;
    }

    try {
      const result = await this.options.executor.runTask({
        workflow: structuredClone(workflow),
        task: structuredClone(task),
        agent: structuredClone(agent)
      });

      this.completeTask(workflowId, taskId, agentId, result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "OpenClaw execution failed.";

      this.completeTask(workflowId, taskId, agentId, {
        output: this.generateTaskOutput(workflow, task),
        usage: this.estimateTaskUsage(workflow, task),
        note: `Fell back to the built-in simulator after OpenClaw failed: ${message}`
      });
    }
  }

  private completeTask(
    workflowId: string,
    taskId: string,
    agentId: string,
    execution?: TaskExecutionResult
  ) {
    const workflow = this.workflows.get(workflowId);
    const agent = this.agents.get(agentId);

    if (!workflow || !agent) {
      return;
    }

    const task = workflow.tasks.find((entry) => entry.id === taskId);
    if (!task || task.status !== "in_progress") {
      return;
    }

    const completedAt = timestamp();
    task.status = "done";
    task.completedAt = completedAt;
    task.output = execution?.output ?? this.generateTaskOutput(workflow, task);
    task.usage = execution?.usage ?? this.estimateTaskUsage(workflow, task);
    task.history.push(
      this.buildHistoryEntry(
        "done",
        [
          `${agent.name} finished the ${task.role} step and prepared a payload.`,
          execution?.note ?? null
        ]
          .filter(Boolean)
          .join(" "),
        agent.id,
        completedAt
      )
    );

    agent.status = "handoff";
    agent.completedTasks += 1;
    workflow.usage = this.aggregateWorkflowUsage(workflow);
    workflow.updatedAt = completedAt;

    this.emit("task_updated", {
      workflowId,
      taskId,
      agentId,
      status: "done"
    });

    const nextTask = workflow.tasks.find(
      (candidate) => candidate.order === task.order + 1
    );

    const timer = setTimeout(() => {
      if (nextTask) {
        this.handoffTask(workflowId, task.id, nextTask.id, agent.id);
      } else {
        this.completeWorkflow(workflowId, task.id, agent.id);
      }

      this.timers.delete(timer);
    }, Math.max(180, Math.round(320 * this.options.durationMultiplier)));
    this.timers.add(timer);
  }

  private handoffTask(
    workflowId: string,
    taskId: string,
    nextTaskId: string,
    fromAgentId: string
  ) {
    const workflow = this.workflows.get(workflowId);
    const fromAgent = this.agents.get(fromAgentId);

    if (!workflow || !fromAgent) {
      return;
    }

    const task = workflow.tasks.find((entry) => entry.id === taskId);
    const nextTask = workflow.tasks.find((entry) => entry.id === nextTaskId);
    const toAgent = nextTask ? this.findPreferredAgent(nextTask.role) : null;

    if (!task || !nextTask || !toAgent) {
      return;
    }

    const handoffAt = timestamp();
    task.status = "handed_off";
    task.handoffAt = handoffAt;
    task.history.push(
      this.buildHistoryEntry(
        "handed_off",
        `${fromAgent.name} handed the package to ${toAgent.name}.`,
        fromAgent.id,
        handoffAt
      )
    );

    fromAgent.status = "idle";
    fromAgent.currentTaskId = null;
    workflow.updatedAt = handoffAt;

    const handoff: HandoffRecord = {
      id: createId("handoff"),
      workflowId,
      taskId,
      fromAgentId: fromAgent.id,
      toAgentId: toAgent.id,
      payload: task.output ?? "Task output pending",
      startedAt: handoffAt,
      durationMs: this.options.handoffDurationMs
    };

    const message: MessageRecord = {
      id: createId("msg"),
      workflowId,
      taskId,
      fromAgentId: fromAgent.id,
      toAgentId: toAgent.id,
      kind: "handoff",
      payload: task.output ?? "Task output pending",
      reasoning: `Gateway routed the finished ${task.role} output to the ${nextTask.role} desk.`,
      timestamp: handoffAt
    };

    this.handoffs = [handoff, ...this.handoffs].slice(0, 12);
    this.messages = [message, ...this.messages].slice(0, 48);

    this.emit("message_logged", message);
    this.emit("handoff_started", handoff);
    this.emit("task_updated", {
      workflowId,
      taskId,
      agentId: fromAgent.id,
      status: "handed_off"
    });

    const timer = setTimeout(() => {
      this.handoffs = this.handoffs.filter((entry) => entry.id !== handoff.id);
      this.completedHandoffDurations = [
        handoff.durationMs,
        ...this.completedHandoffDurations
      ].slice(0, 64);
      this.emit("handoff_finished", handoff);
      this.dispatchReadyTasks();
      this.timers.delete(timer);
    }, handoff.durationMs);
    this.timers.add(timer);
  }

  private completeWorkflow(workflowId: string, finalTaskId: string, agentId: string) {
    const workflow = this.workflows.get(workflowId);
    const agent = this.agents.get(agentId);

    if (!workflow || !agent) {
      return;
    }

    const task = workflow.tasks.find((entry) => entry.id === finalTaskId);
    if (!task) {
      return;
    }

    const completedAt = timestamp();
    task.status = "completed";
    task.completedAt = completedAt;
    task.history.push(
      this.buildHistoryEntry(
        "completed",
        `${agent.name} published the final approval and closed the workflow.`,
        agent.id,
        completedAt
      )
    );

    workflow.status = "completed";
    workflow.updatedAt = completedAt;
    workflow.finalOutput =
      task.usage?.source === "reported" && task.output
        ? task.output
        : this.generateFinalOutput(workflow);
    workflow.usage = this.aggregateWorkflowUsage(workflow);

    agent.status = "idle";
    agent.currentTaskId = null;

    const message: MessageRecord = {
      id: createId("msg"),
      workflowId,
      taskId: task.id,
      fromAgentId: agent.id,
      toAgentId: "gateway",
      kind: "result",
      payload: workflow.finalOutput,
      reasoning: "Gateway compiled the workflow package and marked it ready for delivery.",
      timestamp: completedAt
    };

    this.messages = [message, ...this.messages].slice(0, 48);
    const approval = this.buildApprovalRecord(workflow, task, completedAt);
    this.approvals = [approval, ...this.approvals].slice(0, 64);

    this.emit("message_logged", message);
    this.emit("workflow_completed", workflow);
    this.emit("approval_updated", approval);
    this.dispatchReadyTasks();
  }

  private isTaskReady(workflow: WorkflowRecord, task: TaskRecord) {
    if (!task.dependencyTaskId) {
      return true;
    }

    const dependency = workflow.tasks.find(
      (entry) => entry.id === task.dependencyTaskId
    );
    if (!dependency) {
      return false;
    }

    return dependency.status === "handed_off" || dependency.status === "completed";
  }

  private findIdleAgent(role: AgentRole) {
    return Array.from(this.agents.values())
      .filter((agent) => agent.role === role && agent.status === "idle")
      .sort((left, right) => left.completedTasks - right.completedTasks)[0];
  }

  private findPreferredAgent(role: AgentRole) {
    return (
      this.findIdleAgent(role) ??
      Array.from(this.agents.values()).find((agent) => agent.role === role) ??
      null
    );
  }

  private emit<T>(type: GatewayEventType, data: T) {
    const event: GatewayEvent<T> = {
      type,
      timestamp: timestamp(),
      data: structuredClone(data)
    };

    for (const listener of this.eventListeners) {
      listener(event);
    }

    const snapshot = this.getSnapshot();
    for (const listener of this.snapshotListeners) {
      listener(snapshot);
    }

    if (type !== "metrics_updated") {
      const metricEvent: GatewayEvent<MetricSnapshot> = {
        type: "metrics_updated",
        timestamp: timestamp(),
        data: snapshot.metrics
      };

      for (const listener of this.eventListeners) {
        listener(metricEvent);
      }
    }
  }

  private computeMetrics(workflows: WorkflowRecord[]): MetricSnapshot {
    const tasks = workflows.flatMap((workflow) => workflow.tasks);
    const completedWorkflows = workflows.filter(
      (workflow) => workflow.status === "completed"
    );

    const cycleDurations = completedWorkflows.map((workflow) => {
      const endAt = workflow.updatedAt;
      return new Date(endAt).getTime() - new Date(workflow.createdAt).getTime();
    });

    return {
      totalWorkflows: workflows.length,
      completedWorkflows: completedWorkflows.length,
      runningWorkflows: workflows.filter((workflow) => workflow.status === "running")
        .length,
      tasksCompleted: tasks.filter((task) =>
        ["done", "handed_off", "completed"].includes(task.status)
      ).length,
      pendingTasks: tasks.filter((task) => task.status === "pending").length,
      pendingApprovals: this.approvals.filter(
        (approval) => approval.status === "pending"
      ).length,
      averageHandoffMs: average(this.completedHandoffDurations),
      averageCycleMs: average(cycleDurations),
      estimatedInputTokens: sumUsage(workflows, "inputTokens"),
      estimatedOutputTokens: sumUsage(workflows, "outputTokens"),
      estimatedTotalTokens: sumUsage(workflows, "totalTokens")
    };
  }

  private resolveTaskDuration(role: AgentRole) {
    const base = roleMeta[role].baseDurationMs * this.options.durationMultiplier;
    const spread = Math.max(90, Math.round(450 * this.options.durationMultiplier));
    return Math.round(base + Math.random() * spread);
  }

  private generateTaskOutput(workflow: WorkflowRecord, task: TaskRecord) {
    const dependencyText = task.dependencyTaskId
      ? workflow.tasks.find((entry) => entry.id === task.dependencyTaskId)?.output ?? ""
      : "";

    const nouns = extractKeywords(workflow.prompt);
    const keywordLine = nouns.length > 0 ? nouns.join(", ") : workflow.summary;

    switch (task.role) {
      case "collector":
        return `Collected targets: ${keywordLine}. Captured the main deliverable, release pressure, and visibility requirements from the request.`;
      case "analyzer":
        return `Planned execution lanes around ${keywordLine}. Dependencies were mapped, risky edges were flagged, and the workflow was sequenced for parallel handoffs. Source notes: ${dependencyText}`;
      case "writer":
        return `Drafted the implementation package for ${workflow.summary}. Included UI, orchestration, and monitoring details. Upstream analysis: ${dependencyText}`;
      case "validator":
        return `Validated the package against the original request. Confirmed role coverage, real-time visibility, and ship readiness. Final check input: ${dependencyText}`;
      default:
        return `Completed ${task.title}.`;
    }
  }

  private generateFinalOutput(workflow: WorkflowRecord) {
    return [
      `Workflow ${workflow.id} is ready for delivery.`,
      `Request: ${workflow.prompt}`,
      "Outcome:",
      ...workflow.tasks.map((task) => `- ${task.title}: ${task.output ?? "No output"}`)
    ].join("\n");
  }

  private buildHistoryEntry(
    status: TaskRecord["status"],
    note: string,
    actorId: string | null,
    stamp: string
  ): TaskHistoryEntry {
    return {
      status,
      note,
      actorId,
      timestamp: stamp
    };
  }

  private estimateTaskUsage(workflow: WorkflowRecord, task: TaskRecord): TokenUsage {
    const dependencyOutput = task.dependencyTaskId
      ? workflow.tasks.find((entry) => entry.id === task.dependencyTaskId)?.output ?? ""
      : "";

    const inputChars =
      workflow.prompt.length + task.description.length + dependencyOutput.length;
    const outputChars = (task.output ?? "").length;
    const inputTokens = estimateTokens(inputChars);
    const outputTokens = estimateTokens(outputChars);
    const cacheRead = dependencyOutput
      ? Math.max(0, Math.round(estimateTokens(dependencyOutput.length) * 0.35))
      : 0;

    return {
      source: "estimated",
      inputTokens,
      outputTokens,
      cacheRead,
      cacheWrite: 0,
      totalTokens: inputTokens + outputTokens + cacheRead
    };
  }

  private aggregateWorkflowUsage(workflow: WorkflowRecord): TokenUsage {
    const usages = workflow.tasks
      .map((task) => task.usage)
      .filter((usage): usage is TokenUsage => usage !== null);

    if (usages.length === 0) {
      return emptyTokenUsage();
    }

    return usages.reduce<TokenUsage>(
      (total, usage) => ({
        source: usage.source,
        inputTokens: total.inputTokens + usage.inputTokens,
        outputTokens: total.outputTokens + usage.outputTokens,
        cacheRead: total.cacheRead + usage.cacheRead,
        cacheWrite: total.cacheWrite + usage.cacheWrite,
        totalTokens: total.totalTokens + usage.totalTokens
      }),
      emptyTokenUsage()
    );
  }

  private buildApprovalRecord(
    workflow: WorkflowRecord,
    task: TaskRecord,
    createdAt: string
  ): ApprovalRecord {
    return {
      id: createId("approval"),
      workflowId: workflow.id,
      taskId: task.id,
      title: `Ship ${workflow.summary}`,
      summary:
        task.output?.slice(0, 240) ??
        `Validator completed ${workflow.summary} and prepared the release package.`,
      status: "pending",
      confidence: this.computeApprovalConfidence(workflow, task),
      createdAt,
      decidedAt: null,
      decisionNote: null,
      reviewer: null
    };
  }

  private computeApprovalConfidence(workflow: WorkflowRecord, task: TaskRecord) {
    const allTasksSettled = workflow.tasks.every((entry) =>
      ["done", "handed_off", "completed"].includes(entry.status)
    );
    const usageBonus = task.usage?.source === "reported" ? 10 : 0;
    const outputBonus = task.output ? Math.min(8, Math.round(task.output.length / 180)) : 0;
    const settledBonus = allTasksSettled ? 6 : 0;

    return Math.max(58, Math.min(97, 72 + usageBonus + outputBonus + settledBonus));
  }
}

export const buildGateway = (seed: AgentRecord[], options?: GatewayOptions) =>
  new Gateway(seed, options);

const average = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
};

const sumUsage = (workflows: WorkflowRecord[], key: keyof TokenUsage) =>
  workflows.reduce((total, workflow) => {
    const value = workflow.usage?.[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);

const summarisePrompt = (prompt: string) =>
  prompt.length > 68 ? `${prompt.slice(0, 65)}...` : prompt;

const extractKeywords = (prompt: string) => {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 4 &&
        !["build", "launch", "project", "ready", "multi", "agent"].includes(word)
    );

  return Array.from(new Set(words)).slice(0, 4);
};

const timestamp = () => new Date().toISOString();

const estimateTokens = (charCount: number) => Math.max(0, Math.round(charCount / 4));

const createId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
