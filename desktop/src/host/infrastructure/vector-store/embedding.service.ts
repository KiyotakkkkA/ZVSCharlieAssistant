import type { SecretStorageRepository } from "../../application/ports/secret-storage.repository";
import type { VectorStoreDataSource } from "../database/vector-store.data-source";

export class EmbeddingService {
  constructor(
    private readonly data: VectorStoreDataSource,
    private readonly secrets: SecretStorageRepository,
  ) {}

  async embed(modelId: number, input: string[]) {
    const model = this.data.embeddingModel(modelId);
    if (!model) throw new Error("Embedding-модель недоступна или отключена");
    const key = model.api_key_secret_id
      ? this.secrets.getSecret(model.api_key_secret_id)?.content.trim()
      : undefined;
    let response: Response;
    try {
      response = await fetch(
        model.kind === "openrouter"
          ? `${model.base_url.replace(/\/+$/, "")}/embeddings`
          : `${model.base_url.replace(/\/+$/, "")}/api/embed`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(key ? { Authorization: `Bearer ${key}` } : {}),
          },
          body: JSON.stringify({ model: model.remote_id, input }),
          signal: AbortSignal.timeout(30_000),
        },
      );
    } catch (error) {
      throw new Error(
        `Не удалось подключиться к embedding-провайдеру: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    if (!response.ok)
      throw new Error(
        `Embedding API вернул ${response.status}: ${(await response.text()).slice(0, 300)}`,
      );
    const payload = (await response.json()) as {
      embeddings?: number[][];
      data?: Array<{ embedding?: number[]; index?: number }>;
    };
    const embeddings =
      model.kind === "openrouter"
        ? (payload.data ?? [])
            .slice()
            .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
            .map((item) => item.embedding ?? [])
        : payload.embeddings;
    if (!embeddings?.length || embeddings.length !== input.length)
      throw new Error("Embedding API вернул некорректный ответ");
    const dimension = embeddings[0]?.length ?? 0;
    if (
      !dimension ||
      embeddings.some(
        (vector) =>
          vector.length !== dimension ||
          vector.some((value) => !Number.isFinite(value)),
      )
    )
      throw new Error("Embedding API вернул векторы некорректной размерности");
    return embeddings;
  }
}
