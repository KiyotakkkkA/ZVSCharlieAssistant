import { BrowserWindow, ipcMain } from "electron";
import { ASSISTANT_IPC_CHANNELS } from "../contracts/assistant.contract";
import {
  answerQuestionDtoSchema,
  entityIdSchema,
  parseIpcDto,
  taskItemStatusSchema,
  upsertMemoryEntryDtoSchema,
  upsertMemoryPolicyDtoSchema,
} from "../../shared/dto";
import type { MemoryService } from "../../host/application/services/memory.service";
import type { TaskPlanRepository } from "../../host/infrastructure/database/task-plan.repository";
import type { UserQuestionService } from "../../host/application/services/user-question.service";

const broadcast = (channel: string, payload: unknown) => {
  for (const window of BrowserWindow.getAllWindows())
    if (!window.webContents.isDestroyed())
      window.webContents.send(channel, payload);
};

export function registerAssistantHandlers(
  memory: MemoryService,
  taskPlans: TaskPlanRepository,
  questions: UserQuestionService,
): void {
  memory.watch((event) =>
    broadcast(ASSISTANT_IPC_CHANNELS.memoryChanged, event),
  );
  questions.watch((question) =>
    broadcast(ASSISTANT_IPC_CHANNELS.questionsChanged, question),
  );

  ipcMain.handle(ASSISTANT_IPC_CHANNELS.memoryGetSnapshot, () =>
    memory.snapshot(),
  );
  ipcMain.handle(ASSISTANT_IPC_CHANNELS.memoryUpsertEntry, (_event, input) =>
    memory.upsertFromUi(parseIpcDto(upsertMemoryEntryDtoSchema, input)),
  );
  ipcMain.handle(ASSISTANT_IPC_CHANNELS.memoryUpsertPolicy, (_event, input) =>
    memory.upsertPolicy(parseIpcDto(upsertMemoryPolicyDtoSchema, input)),
  );
  ipcMain.handle(
    ASSISTANT_IPC_CHANNELS.memorySetPinned,
    (_event, id: number, pinned: boolean) =>
      memory.setPinned(parseIpcDto(entityIdSchema, id), Boolean(pinned)),
  );
  ipcMain.handle(ASSISTANT_IPC_CHANNELS.memoryRemove, (_event, id: number) =>
    memory.remove(parseIpcDto(entityIdSchema, id)),
  );
  ipcMain.handle(ASSISTANT_IPC_CHANNELS.memoryClear, () => memory.clear());

  ipcMain.handle(
    ASSISTANT_IPC_CHANNELS.tasksForConversation,
    (_event, conversationId: number) =>
      taskPlans.find({
        conversationId: parseIpcDto(entityIdSchema, conversationId),
      }) ?? null,
  );
  ipcMain.handle(
    ASSISTANT_IPC_CHANNELS.tasksSetStatus,
    (_event, conversationId: number, position: number, status: string) =>
      taskPlans.updateItemStatus(
        { conversationId: parseIpcDto(entityIdSchema, conversationId) },
        Number(position),
        parseIpcDto(taskItemStatusSchema, status),
      ),
  );
  ipcMain.handle(
    ASSISTANT_IPC_CHANNELS.tasksClear,
    (_event, conversationId: number) =>
      taskPlans.clear({
        conversationId: parseIpcDto(entityIdSchema, conversationId),
      }),
  );

  ipcMain.handle(
    ASSISTANT_IPC_CHANNELS.questionsPending,
    (_event, conversationId: number) =>
      questions.pendingForConversation(
        parseIpcDto(entityIdSchema, conversationId),
      ),
  );
  ipcMain.handle(
    ASSISTANT_IPC_CHANNELS.questionsForExecution,
    (_event, executionId: number) =>
      questions.forExecution(parseIpcDto(entityIdSchema, executionId)),
  );
  ipcMain.handle(ASSISTANT_IPC_CHANNELS.questionsAnswer, (_event, input) => {
    const dto = parseIpcDto(answerQuestionDtoSchema, input);
    return questions.answer(dto.questionId, dto.answer, "ui");
  });
}

export function removeAssistantHandlers(): void {
  for (const channel of Object.values(ASSISTANT_IPC_CHANNELS))
    if (
      channel !== ASSISTANT_IPC_CHANNELS.memoryChanged &&
      channel !== ASSISTANT_IPC_CHANNELS.questionsChanged
    )
      ipcMain.removeHandler(channel);
}
