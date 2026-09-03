import { useCallback, useEffect, useState } from "react";
import type { ZvsIdConnection } from "../../ipc/contracts";

export function useZvsIdConnection() {
  const [connection, setConnection] = useState<ZvsIdConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void window.desktop.zvsId
      .status()
      .then((value) => {
        if (active) setConnection(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(messageOf(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const release = window.desktop.zvsId.subscribe((value) => {
      if (!active) return;
      setConnection(value);
      setLoading(false);
      setError(null);
    });

    return () => {
      active = false;
      release();
    };
  }, []);

  const connect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const value = await window.desktop.zvsId.connect();
      setConnection(value);
      return value;
    } catch (reason) {
      setError(messageOf(reason));
      throw reason;
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const value = await window.desktop.zvsId.disconnect();
      setConnection(value);
      return value;
    } catch (reason) {
      setError(messageOf(reason));
      throw reason;
    } finally {
      setBusy(false);
    }
  }, []);

  return { connection, loading, busy, error, connect, disconnect };
}

function messageOf(value: unknown): string {
  return value instanceof Error ? value.message : "Неизвестная ошибка";
}
