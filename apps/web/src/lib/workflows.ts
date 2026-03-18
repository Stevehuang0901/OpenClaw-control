import type { MessageRecord, WorkflowRecord } from "../types/contracts";

const settledStatuses = new Set(["done", "handed_off", "completed"]);

export const getWorkflowProgress = (workflow: WorkflowRecord) => {
  const totalTasks = workflow.tasks.length || 1;
  const completedTasks = workflow.tasks.filter((task) =>
    settledStatuses.has(task.status)
  ).length;
  const activeTask =
    workflow.tasks.find((task) => task.status === "in_progress") ?? null;
  const nextTask =
    workflow.tasks.find((task) => task.status === "pending") ?? null;
  const percent = Math.min(
    100,
    Math.round(((completedTasks + (activeTask ? 0.45 : 0)) / totalTasks) * 100)
  );

  return {
    totalTasks,
    completedTasks,
    activeTask,
    nextTask,
    percent
  };
};

export const buildWorkflowOutputPreview = (workflow: WorkflowRecord) => {
  if (workflow.finalOutput) {
    return workflow.finalOutput;
  }

  const completedOutputs = workflow.tasks.filter((task) => task.output);
  if (completedOutputs.length === 0) {
    return "No delivery packets yet. Dispatch a request and the crew will start assembling an output package here.";
  }

  return completedOutputs
    .map((task) => `${task.title}\n${task.output}`)
    .join("\n\n");
};

export const getWorkflowSignalLine = (workflow: WorkflowRecord) => {
  const progress = getWorkflowProgress(workflow);

  if (workflow.status === "completed") {
    return "Final package delivered and signed off by the validator desk.";
  }

  if (progress.activeTask) {
    return `${progress.activeTask.title} is underway at the ${progress.activeTask.role} desk.`;
  }

  if (progress.nextTask) {
    return `${progress.completedTasks}/${progress.totalTasks} steps wrapped. ${progress.nextTask.title} is queued next.`;
  }

  return "Gateway is ready to route the first packet.";
};

export const getWorkflowMessages = (
  workflow: WorkflowRecord,
  messages: MessageRecord[]
) =>
  messages
    .filter((message) => message.workflowId === workflow.id)
    .slice(0, 3);
