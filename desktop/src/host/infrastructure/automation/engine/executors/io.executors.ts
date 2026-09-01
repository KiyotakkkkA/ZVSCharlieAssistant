import {
  PermanentError,
  RetryableError,
} from "../../../../../shared/scenario/errors";
import {
  isRecord,
  type ScenarioBinaryRef,
} from "../../../../../shared/scenario/items";
import type { NodeExecutor } from "../../../../../shared/scenario/node-descriptor";
import type { ScenarioEngineServices } from "../services";
import type { ScenarioFileReference } from "../../../../../shared/dto/scenario-trigger-event.dto";

interface HttpConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
  url: string;
  headers: Array<{ key: string; value: string }>;
  query: Array<{ key: string; value: string }>;
  bodyMode: "none" | "json" | "text" | "form";
  body: unknown;
  authSecretId: string | null;
  authScheme: "bearer" | "basic" | "raw" | "header";
  authHeaderName: string;
  timeoutSeconds: number;
  parseJson: boolean;
  failOnErrorStatus: boolean;
  maxResponseMb: number;
  followRedirects: boolean;
}

export function createHttpExecutor(
  services: ScenarioEngineServices,
): NodeExecutor<HttpConfig, unknown> {
  return {
    kind: "http",
    async execute(context) {
      const config = context.config;
      if (!config.url.trim())
        throw new PermanentError(`Узел «${context.node.name}»: не задан URL`, {
          context: { nodeId: context.node.id },
        });

      let url: URL;
      try {
        url = new URL(config.url);
      } catch {
        throw new PermanentError(
          `Узел «${context.node.name}»: некорректный URL «${config.url}»`,
          { context: { nodeId: context.node.id } },
        );
      }
      for (const entry of config.query)
        if (entry.key.trim())
          url.searchParams.set(entry.key.trim(), entry.value);

      const headers = new Headers();
      for (const entry of config.headers)
        if (entry.key.trim()) headers.set(entry.key.trim(), entry.value);

      if (config.authSecretId) {
        const secret = services.secret(config.authSecretId);
        if (!secret)
          throw new PermanentError(
            `Узел «${context.node.name}»: секрет авторизации не найден`,
            { context: { nodeId: context.node.id } },
          );
        if (config.authScheme === "bearer")
          headers.set("Authorization", `Bearer ${secret}`);
        else if (config.authScheme === "basic")
          headers.set(
            "Authorization",
            `Basic ${Buffer.from(secret).toString("base64")}`,
          );
        else if (config.authScheme === "raw")
          headers.set("Authorization", secret);
        else headers.set(config.authHeaderName || "Authorization", secret);
      }

      let body: BodyInit | undefined;
      if (config.bodyMode === "json") {
        headers.set(
          "Content-Type",
          headers.get("Content-Type") ?? "application/json",
        );
        body = JSON.stringify(config.body ?? null);
      } else if (config.bodyMode === "text") {
        body =
          typeof config.body === "string"
            ? config.body
            : JSON.stringify(config.body ?? "");
      } else if (config.bodyMode === "form" && isRecord(config.body)) {
        const form = new URLSearchParams();
        for (const [key, value] of Object.entries(config.body))
          form.set(key, String(value));
        headers.set(
          "Content-Type",
          headers.get("Content-Type") ?? "application/x-www-form-urlencoded",
        );
        body = form.toString();
      }

      const timeoutSignal = AbortSignal.timeout(config.timeoutSeconds * 1_000);
      const signal = AbortSignal.any([context.signal, timeoutSignal]);

      let response: Response;
      try {
        response = await services.httpFetch(url, {
          method: config.method,
          headers,
          body:
            config.method === "GET" || config.method === "HEAD"
              ? undefined
              : body,
          redirect: config.followRedirects ? "follow" : "manual",
          signal,
        });
      } catch (error) {
        if (timeoutSignal.aborted && !context.signal.aborted)
          throw new RetryableError(
            `Узел «${context.node.name}»: запрос не уложился в ${config.timeoutSeconds} с`,
            { context: { nodeId: context.node.id }, cause: error },
          );
        throw error;
      }

      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > config.maxResponseMb * 1024 * 1024)
        throw new PermanentError(
          `Узел «${context.node.name}»: ответ превышает ${config.maxResponseMb} МБ`,
          { context: { nodeId: context.node.id } },
        );

      const text = await response.text();
      let data: unknown = text;
      if (config.parseJson) {
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = text;
        }
      }

      const output = {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        data,
      };

      if (config.failOnErrorStatus && !response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        const ErrorClass = retryable ? RetryableError : PermanentError;
        throw new ErrorClass(
          `Узел «${context.node.name}»: HTTP ${response.status}`,
          {
            context: {
              nodeId: context.node.id,
              status: response.status,
            } as never,
          },
        );
      }

      return { items: [{ json: output }] };
    },
  };
}

interface DownloadFilesConfig {
  source: "binary" | "urls";
  urls: string[];
  maxFileSizeMb: number;
  maxFiles: number;
  cleanupOnFinish: boolean;
}

export function createDownloadFilesExecutor(
  services: ScenarioEngineServices,
): NodeExecutor<DownloadFilesConfig, unknown> {
  return {
    kind: "downloadFiles",
    async execute(context) {
      const config = context.config;
      const filesPortItems = context.inputs.files ?? [];
      const value =
        config.source === "urls"
          ? config.urls
          : [...context.items, ...filesPortItems].map((item) => item.json);

      const files = await services.downloadFiles({
        executionId: context.executionId,
        nodeRunId: context.nodeRunId,
        nodeId: context.node.id,
        value,
        maxFileSizeBytes: config.maxFileSizeMb * 1024 * 1024,
        maxFiles: config.maxFiles,
        cleanupOnFinish: config.cleanupOnFinish,
        signal: context.signal,
      });

      for (const file of files) context.trackBinary(file as ScenarioBinaryRef);

      const binary: Record<string, ScenarioBinaryRef> = {};
      for (const file of files)
        binary[`file_${file.id}`] = file as ScenarioBinaryRef;

      const item = {
        json: { files },
        binary: Object.keys(binary).length ? binary : undefined,
      };

      return {
        outputs: { main: [item], files: [item] },
        diagnostics: { downloaded: files.length },
      };
    },
  };
}

interface ReadFilesConfig {
  maxCharactersPerFile: number;
  output: "inline" | "reference";
  targetField: string;
  itemPerFile: boolean;
}

export const createReadFilesExecutor = (
  services: ScenarioEngineServices,
): NodeExecutor<ReadFilesConfig, unknown> => ({
  kind: "readFiles",
  async execute(context) {
    const config = context.config;
    const values = [...context.items, ...(context.inputs.files ?? [])].map(
      (item) => item.json,
    );
    const files = collectFiles(values);

    if (files.length === 0) {
      const pending = countPendingAttachments(values);
      if (pending > 0)
        throw new PermanentError(
          `Вложения (${pending}) ещё не скачаны: между триггером и узлом «${context.node.name}» нужен узел «Скачать файлы».`,
          { context: { nodeId: context.node.id } },
        );
    }

    const result = await services.readFiles({
      files,
      maxCharactersPerFile: config.maxCharactersPerFile,
    });

    if (config.itemPerFile) {
      const items = result.documents.map((document, index) => ({
        json: {
          [config.targetField || "text"]: document.text,
          fileName: document.fileName,
          mimeType: document.mimeType,
          truncated: document.truncated,
        },
        pairedItem: index,
      }));
      return {
        items,
        diagnostics: {
          read: result.documents.length,
          unsupported: result.unsupportedFiles.length,
        },
      };
    }

    return {
      items: [
        {
          json: {
            [config.targetField || "text"]: result.documents,
            unsupportedFiles: result.unsupportedFiles,
          },
        },
      ],
      diagnostics: {
        read: result.documents.length,
        unsupported: result.unsupportedFiles.length,
      },
    };
  },
});

function countPendingAttachments(values: unknown[]): number {
  const seen = new Set<string>();
  const visit = (candidate: unknown) => {
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (!isRecord(candidate)) return;
    if (
      typeof candidate.id === "string" &&
      typeof candidate.kind === "string" &&
      "uniqueId" in candidate &&
      candidate.storageKey === undefined
    ) {
      seen.add(candidate.id);
      return;
    }
    Object.values(candidate).forEach(visit);
  };
  values.forEach(visit);
  return seen.size;
}

function collectFiles(values: unknown[]): ScenarioFileReference[] {
  const files = new Map<string, ScenarioFileReference>();
  const visit = (candidate: unknown) => {
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (!isRecord(candidate)) return;
    if (
      typeof candidate.id === "string" &&
      typeof candidate.fileName === "string" &&
      typeof candidate.storageKey === "string" &&
      typeof candidate.sha256 === "string" &&
      Number.isInteger(candidate.size)
    ) {
      files.set(candidate.id, {
        id: candidate.id,
        fileName: candidate.fileName,
        mimeType:
          candidate.mimeType === null || typeof candidate.mimeType === "string"
            ? (candidate.mimeType as string | null)
            : null,
        size: Number(candidate.size),
        sha256: candidate.sha256,
        storageKey: candidate.storageKey,
      });
      return;
    }
    Object.values(candidate).forEach(visit);
  };
  values.forEach(visit);
  return [...files.values()];
}

interface KnowledgeStoreConfig {
  vectorStoreId: string;
  limit: number;
  minScore: number;
}

export function createKnowledgeStoreExecutor(
  services: ScenarioEngineServices,
): NodeExecutor<KnowledgeStoreConfig, unknown> {
  return {
    kind: "knowledgeStore",
    async execute(context) {
      const config = context.config;
      const query = context.items.length
        ? String(context.items[0]!.json ?? "")
        : "";
      const chunks = await services.searchKnowledge({
        vectorStoreIds: [config.vectorStoreId],
        query,
        limit: config.limit,
        minScore: config.minScore,
      });
      return {
        outputs: { knowledge: chunks.map((chunk) => ({ json: chunk })) },
      };
    },
  };
}
