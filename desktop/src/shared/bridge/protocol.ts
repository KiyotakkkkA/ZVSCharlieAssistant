export const BRIDGE_PROTOCOL_VERSION = 1;

export type BridgeMethod =
  | "hello"
  | "status"
  | "projects.list"
  | "projects.ensure-directory"
  | "projects.assign"
  | "models.list"
  | "agents.list"
  | "skills.list"
  | "conversations.list"
  | "conversations.rename"
  | "sessions.recent"
  | "chat.start"
  | "chat.cancel"
  | "chat.compact"
  | "chat.context"
  | "questions.pending"
  | "questions.answer"
  | "files.edits"
  | "files.revert";

export interface BridgeRequest {
  id: number;
  method: BridgeMethod;
  params?: unknown;
}

export interface BridgeAttachment {
  fileName: string;
  mimeType: string;
  dataBase64: string;
}

export interface BridgeResponse {
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface BridgeEvent {
  id: number;
  event: string;
  payload: unknown;
}

export type BridgeFrame = BridgeResponse | BridgeEvent;

export function isBridgeEvent(frame: BridgeFrame): frame is BridgeEvent {
  return "event" in frame;
}

export function encodeFrame(frame: unknown): string {
  return `${JSON.stringify(frame)}\n`;
}

export class FrameDecoder {
  private buffer = "";

  push(chunk: string): unknown[] {
    this.buffer += chunk;
    const frames: unknown[] = [];
    for (;;) {
      const index = this.buffer.indexOf("\n");
      if (index < 0) break;
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (!line) continue;
      try {
        frames.push(JSON.parse(line) as unknown);
      } catch {
        continue;
      }
    }
    return frames;
  }

  reset() {
    this.buffer = "";
  }
}
