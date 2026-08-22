export type TaskItemStatus =
  "pending" | "in_progress" | "completed" | "skipped";

export interface TaskItem {
  id: string;
  position: number;
  subject: string;
  detail: string;
  status: TaskItemStatus;
  updatedAt: string;
}

export interface TaskPlan {
  id: string;
  conversationId: string | null;
  executionId: string | null;
  items: TaskItem[];
  updatedAt: string;
}
