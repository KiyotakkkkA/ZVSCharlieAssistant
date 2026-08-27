import { describe, expect, it } from "vitest";
import {
  FrameDecoder,
  encodeFrame,
  isBridgeEvent,
  type BridgeFrame,
} from "../../src/shared/bridge/protocol";
import {
  bridgeSocketPath,
  bridgeTokenPath,
} from "../../src/shared/bridge/bridge-paths";

describe("протокол локального моста", () => {
  it("кодирует кадр одной строкой", () => {
    const line = encodeFrame({ id: 1, ok: true });
    expect(line.endsWith("\n")).toBe(true);
    expect(line.includes("\n")).toBe(true);
    expect(line.trim().split("\n")).toHaveLength(1);
  });

  it("собирает кадры из произвольно нарезанных чанков", () => {
    const decoder = new FrameDecoder();
    const payload = encodeFrame({
      id: 7,
      ok: true,
      result: { value: "текст" },
    });
    const half = Math.floor(payload.length / 2);

    expect(decoder.push(payload.slice(0, half))).toEqual([]);
    expect(decoder.push(payload.slice(half))).toEqual([
      { id: 7, ok: true, result: { value: "текст" } },
    ]);
  });

  it("разбирает несколько кадров из одного чанка", () => {
    const decoder = new FrameDecoder();
    const chunk = `${encodeFrame({ id: 1, ok: true })}${encodeFrame({
      id: 2,
      event: "text.delta",
      payload: { delta: "а" },
    })}`;
    expect(decoder.push(chunk)).toHaveLength(2);
  });

  it("пропускает битые строки, не ломая поток", () => {
    const decoder = new FrameDecoder();
    const chunk = `не json\n${encodeFrame({ id: 3, ok: true })}`;
    expect(decoder.push(chunk)).toEqual([{ id: 3, ok: true }]);
  });

  it("отличает событие от ответа", () => {
    const event: BridgeFrame = { id: 1, event: "text.delta", payload: null };
    const response: BridgeFrame = { id: 1, ok: true };
    expect(isBridgeEvent(event)).toBe(true);
    expect(isBridgeEvent(response)).toBe(false);
  });

  it("строит пути сокета и токена от каталога данных", () => {
    const home = process.platform === "win32" ? "C:\\data\\zvs" : "/tmp/zvs";
    const socket = bridgeSocketPath(home);
    expect(socket.length).toBeGreaterThan(0);
    if (process.platform === "win32")
      expect(socket.startsWith("\\\\.\\pipe\\zvs-assistant-")).toBe(true);
    expect(bridgeTokenPath(home)).toContain("bridge.token");
  });
});
