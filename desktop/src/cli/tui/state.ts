import type { UserQuestion } from "../../shared/models/user-question";

export type TuiPhase =
  "idle" | "running" | "waiting-user" | "cancelling" | "failed" | "completed";

export interface TranscriptEntry {
  id: string;
  kind: "user" | "reasoning" | "assistant" | "tool" | "system" | "error";
  text: string;
  runId?: string;
  toolCallId?: string;
  toolStatus?: ToolActivity["status"];
  attachments?: Array<{
    fileName: string;
    mimeType: string;
    size: number;
  }>;
}

export interface ToolActivity {
  callId: string;
  toolId: string;
  status: "requested" | "running" | "completed" | "failed";
  summary: string;
}

export interface TuiState {
  phase: TuiPhase;
  draft: string;
  queued: string[];
  transcript: TranscriptEntry[];
  activeRunId?: string;
  runStartedAt?: number;
  segmentSequence: number;
  question?: UserQuestion;
  error?: string;
}

export type TuiAction =
  | { type: "draft.changed"; value: string }
  | { type: "transcript.append"; entry: TranscriptEntry }
  | { type: "message.queued"; value: string }
  | { type: "queue.shifted" }
  | {
      type: "run.started";
      message: string;
      id: string;
      attachments?: TranscriptEntry["attachments"];
    }
  | { type: "reasoning.delta"; delta: string }
  | { type: "answer.delta"; delta: string }
  | { type: "tool.changed"; tool: ToolActivity }
  | { type: "question.requested"; question: UserQuestion }
  | { type: "question.answered" }
  | { type: "run.cancelling" }
  | { type: "run.completed"; id: string }
  | { type: "run.failed"; id: string; error: string }
  | { type: "session.reset" };

export const initialTuiState = (): TuiState => ({
  phase: "idle",
  draft: "",
  queued: [],
  transcript: [],
  segmentSequence: 0,
});

export function reduceTuiState(state: TuiState, action: TuiAction): TuiState {
  switch (action.type) {
    case "draft.changed":
      return { ...state, draft: action.value };
    case "transcript.append":
      return { ...state, transcript: [...state.transcript, action.entry] };
    case "message.queued": {
      const value = action.value.trim();
      if (!value) return state;
      return { ...state, draft: "", queued: [...state.queued, value] };
    }
    case "queue.shifted":
      return { ...state, queued: state.queued.slice(1) };
    case "run.started":
      return {
        ...state,
        phase: "running",
        draft: "",
        activeRunId: action.id,
        runStartedAt: Date.now(),
        segmentSequence: 0,
        question: undefined,
        error: undefined,
        transcript: [
          ...state.transcript,
          {
            id: `${action.id}:user`,
            runId: action.id,
            kind: "user",
            text: action.message,
            attachments: action.attachments,
          },
        ],
      };
    case "reasoning.delta":
      return appendDelta(state, "reasoning", action.delta);
    case "answer.delta":
      return appendDelta(state, "assistant", action.delta);
    case "tool.changed":
      return upsertTool(state, action.tool);
    case "question.requested":
      return { ...state, phase: "waiting-user", question: action.question };
    case "question.answered":
      return { ...state, phase: "running", question: undefined, draft: "" };
    case "run.cancelling":
      return { ...state, phase: "cancelling" };
    case "run.completed":
      return finishRun(state, "completed");
    case "run.failed": {
      const finished = finishRun(state, "failed");
      return {
        ...finished,
        error: action.error,
        transcript: [
          ...finished.transcript,
          { id: `${action.id}:error`, kind: "error", text: action.error },
        ],
      };
    }
    case "session.reset":
      return initialTuiState();
  }
}

function finishRun(state: TuiState, phase: "completed" | "failed"): TuiState {
  return {
    ...state,
    phase,
    activeRunId: undefined,
    runStartedAt: undefined,
    question: undefined,
  };
}

function appendDelta(
  state: TuiState,
  kind: "reasoning" | "assistant",
  delta: string,
): TuiState {
  const last = state.transcript.at(-1);
  if (last?.kind === kind && last.runId === state.activeRunId) {
    return {
      ...state,
      transcript: [
        ...state.transcript.slice(0, -1),
        { ...last, text: last.text + delta },
      ],
    };
  }
  const sequence = state.segmentSequence + 1;
  return {
    ...state,
    segmentSequence: sequence,
    transcript: [
      ...state.transcript,
      {
        id: `${state.activeRunId ?? "run"}:segment:${sequence}`,
        runId: state.activeRunId,
        kind,
        text: delta,
      },
    ],
  };
}

function upsertTool(state: TuiState, tool: ToolActivity): TuiState {
  const index = state.transcript.findIndex(
    (entry) => entry.toolCallId === tool.callId,
  );
  const entry: TranscriptEntry = {
    id: `${state.activeRunId ?? "run"}:tool:${tool.callId}`,
    runId: state.activeRunId,
    kind: "tool",
    text: tool.summary,
    toolCallId: tool.callId,
    toolStatus: tool.status,
  };
  if (index < 0) return { ...state, transcript: [...state.transcript, entry] };
  return {
    ...state,
    transcript: state.transcript.map((current, position) =>
      position === index ? { ...current, ...entry } : current,
    ),
  };
}
