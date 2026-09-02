import { describe, expect, it } from "vitest";
import { LoopbackCallbackServer } from "../../src/host/infrastructure/zvs-id/loopback-callback.server";

describe("LoopbackCallbackServer", () => {
  it("binds an ephemeral port on the loopback interface only", async () => {
    const listener = await new LoopbackCallbackServer().listen();

    expect(listener.redirectUri).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/callback$/,
    );
    expect(new URL(listener.redirectUri).port).not.toBe("0");

    listener.close();
  });

  it("resolves with the code and state delivered by the browser", async () => {
    const listener = await new LoopbackCallbackServer().listen();
    const callback = listener.waitForCallback();

    await fetch(`${listener.redirectUri}?code=abc123&state=xyz789`);

    await expect(callback).resolves.toEqual({
      code: "abc123",
      state: "xyz789",
    });
    listener.close();
  });

  it("rejects when ZVS ID reports an authorization error", async () => {
    const listener = await new LoopbackCallbackServer().listen();
    const callback = listener.waitForCallback();

    await fetch(`${listener.redirectUri}?error=access_denied&state=xyz789`);

    await expect(callback).rejects.toThrow("Вы отклонили запрос на доступ");
    listener.close();
  });

  it("serves 404 for any path other than the callback", async () => {
    const listener = await new LoopbackCallbackServer().listen();
    const origin = new URL(listener.redirectUri).origin;

    const response = await fetch(`${origin}/`);

    expect(response.status).toBe(404);
    listener.close();
  });

  it("gives up waiting once the timeout elapses", async () => {
    const listener = await new LoopbackCallbackServer(30).listen();
    const callback = listener.waitForCallback();

    await expect(callback).rejects.toThrow("Истекло время ожидания");
    listener.close();
  });
});
