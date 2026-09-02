import { useEffect, useRef } from "react";
import { useStdin, useStdout } from "ink";
import {
  MOUSE_DISABLE,
  MOUSE_ENABLE,
  parseMouseEvents,
  type TuiMouseEvent,
} from "./mouse";

export function useMouse(
  handler: (event: TuiMouseEvent) => void,
  options: { isActive?: boolean } = {},
): void {
  const { stdin, isRawModeSupported } = useStdin();
  const { stdout } = useStdout();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const isActive = options.isActive !== false;

  useEffect(() => {
    if (!isActive || !isRawModeSupported || !stdin || !stdout) return;

    let pending = "";
    const onData = (data: unknown) => {
      const chunk = pending + String(data);
      const { events, rest } = parseMouseEvents(chunk);
      pending = rest;
      for (const event of events) handlerRef.current(event);
    };
    const restore = () => {
      try {
        stdout.write(MOUSE_DISABLE);
      } catch {
        // поток уже закрыт — восстанавливать нечего
      }
    };

    stdout.write(MOUSE_ENABLE);
    stdin.on("data", onData);
    process.on("exit", restore);

    return () => {
      process.off("exit", restore);
      stdin.off("data", onData);
      restore();
    };
  }, [isActive, isRawModeSupported, stdin, stdout]);
}
