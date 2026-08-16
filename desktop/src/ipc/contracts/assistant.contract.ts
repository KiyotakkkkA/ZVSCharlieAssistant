import type {
  MemoryChangeEvent,
  MemorySnapshot,
} from "../../shared/models/memory";
import type { TaskPlan } from "../../shared/models/task-plan";
import type { UserQuestion } from "../../shared/models/user-question";
import type {
  AnswerQuestionInput,
  UpsertMemoryEntryInput,
  UpsertMemoryPolicyInput,
} from "../../shared/dto";

export type * from "../../shared/models/memory";
export type * from "../../shared/models/task-plan";
export type * from "../../shared/models/user-question";

export interface AssistantApi {
  memory: {
    getSnapshot(): Promise<MemorySnapshot>;
    upsertEntry(input: UpsertMemoryEntryInput): Promise<MemorySnapshot>;
    upsertPolicy(input: UpsertMemoryPolicyInput): Promise<MemorySnapshot>;
    setPinned(id: number, pinned: boolean): Promise<MemorySnapshot>;
    remove(id: number): Promise<MemorySnapshot>;
    clear(): Promise<MemorySnapshot>;
    subscribe(listener: (event: MemoryChangeEvent) => void): () => void;
  };
  tasks: {
    forConversation(conversationId: number): Promise<TaskPlan | null>;
    setStatus(
      conversationId: number,
      position: number,
      status: string,
    ): Promise<TaskPlan>;
    clear(conversationId: number): Promise<void>;
  };
  questions: {
    pendingForConversation(conversationId: number): Promise<UserQuestion[]>;
    forExecution(executionId: number): Promise<UserQuestion[]>;
    answer(input: AnswerQuestionInput): Promise<UserQuestion>;
    subscribe(listener: (question: UserQuestion) => void): () => void;
  };
}

export const ASSISTANT_IPC_CHANNELS = {
  memoryGetSnapshot: "assistant:memory-get-snapshot",
  memoryUpsertEntry: "assistant:memory-upsert-entry",
  memoryUpsertPolicy: "assistant:memory-upsert-policy",
  memorySetPinned: "assistant:memory-set-pinned",
  memoryRemove: "assistant:memory-remove",
  memoryClear: "assistant:memory-clear",
  memoryChanged: "assistant:memory-changed",
  tasksForConversation: "assistant:tasks-for-conversation",
  tasksSetStatus: "assistant:tasks-set-status",
  tasksClear: "assistant:tasks-clear",
  questionsPending: "assistant:questions-pending",
  questionsForExecution: "assistant:questions-for-execution",
  questionsAnswer: "assistant:questions-answer",
  questionsChanged: "assistant:questions-changed",
} as const;
