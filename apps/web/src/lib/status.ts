import type { TaskStatus } from "../types/contracts";

export const taskStatusTone: Record<TaskStatus, string> = {
  pending: "bg-slate/20 text-slate",
  in_progress: "bg-brass/20 text-brass",
  done: "bg-teal/20 text-teal",
  handed_off: "bg-coral/20 text-coral",
  completed: "bg-mint/30 text-ink"
};

export const taskStatusLabel: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
  handed_off: "Handed Off",
  completed: "Completed"
};
