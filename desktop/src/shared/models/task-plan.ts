export type TaskItemStatus =
  "pending" | "in_progress" | "completed" | "skipped";

export interface TaskItem {
  id: number;
  position: number;
  subject: string;
  detail: string;
  status: TaskItemStatus;
  updatedAt: string;
}

export interface TaskPlan {
  id: number;
  conversationId: number | null;
  executionId: number | null;
  items: TaskItem[];
  updatedAt: string;
}
