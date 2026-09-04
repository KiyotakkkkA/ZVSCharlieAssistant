import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import {
  reviewReason,
  summariseRecognition,
} from "../../src/host/infrastructure/vector-store/vector-store.service";
import { runMigrations } from "../../src/host/infrastructure/database/migrations";

let database: Database.Database | undefined;

function page(
  route: string,
  recognisedLines: number,
  rejectedLines: number,
  meanConfidence: number,
) {
  return { route, recognisedLines, rejectedLines, meanConfidence };
}

afterEach(() => {
  database?.close();
  database = undefined;
});

describe("сводка по распознаванию сканов", () => {
  it("не учитывает страницы с текстовым слоем", () => {
    const summary = summariseRecognition([
      page("text-layer", 0, 0, 0),
      page("ocr", 10, 2, 0.9),
      page("empty", 0, 0, 0),
    ]);

    expect(summary).toEqual({
      ocrPages: 1,
      acceptedLines: 10,
      rejectedLines: 2,
      meanConfidence: 0.9,
    });
  });

  it("взвешивает уверенность по числу строк, а не по страницам", () => {
    const summary = summariseRecognition([
      page("ocr", 90, 0, 0.9),
      page("ocr", 10, 0, 0.1),
    ]);

    expect(summary.meanConfidence).toBeCloseTo(0.82, 5);
  });
});

describe("признак «требует проверки»", () => {
  it("молчит для документа без OCR-страниц", () => {
    expect(
      reviewReason({
        ocrPages: 0,
        acceptedLines: 0,
        rejectedLines: 0,
        meanConfidence: 0,
      }),
    ).toBeUndefined();
  });

  it("молчит для чистого скана", () => {
    expect(
      reviewReason({
        ocrPages: 3,
        acceptedLines: 100,
        rejectedLines: 5,
        meanConfidence: 0.92,
      }),
    ).toBeUndefined();
  });

  it("срабатывает при низкой уверенности", () => {
    const reason = reviewReason({
      ocrPages: 2,
      acceptedLines: 100,
      rejectedLines: 0,
      meanConfidence: 0.41,
    });

    expect(reason).toContain("41%");
    expect(reason).toContain("Часть текста могла не попасть в поиск");
  });

  it("срабатывает при большой доле отброшенных строк", () => {
    const reason = reviewReason({
      ocrPages: 2,
      acceptedLines: 80,
      rejectedLines: 20,
      meanConfidence: 0.95,
    });

    expect(reason).toContain("20 из 100");
  });

  it("не срабатывает ровно на границе доли отброшенных", () => {
    expect(
      reviewReason({
        ocrPages: 1,
        acceptedLines: 85,
        rejectedLines: 15,
        meanConfidence: 0.9,
      }),
    ).toBeUndefined();
  });
});

describe("миграция статуса needs_review", () => {
  it("разрешает новый статус и сохраняет существующие строки", () => {
    database = new Database(":memory:");
    database.pragma("foreign_keys = ON");
    runMigrations(database);
    database
      .prepare(
        `INSERT INTO vector_stores(id,name,embedding_model_id) VALUES(?,?,?)`,
      )
      .run("store-1", "Хранилище", "model-1");
    database
      .prepare(
        `INSERT INTO vector_store_documents(id,vector_store_id,file_name,mime_type,local_path,content_hash,size,status)
         VALUES(?,?,?,?,?,?,?,?)`,
      )
      .run(
        "doc-1",
        "store-1",
        "скан.pdf",
        "application/pdf",
        "/tmp/скан.pdf",
        "hash-1",
        10,
        "needs_review",
      );

    const row = database
      .prepare(`SELECT status FROM vector_store_documents WHERE id=?`)
      .get("doc-1") as { status: string };
    expect(row.status).toBe("needs_review");

    expect(() =>
      database!
        .prepare(`UPDATE vector_store_documents SET status='нечто' WHERE id=?`)
        .run("doc-1"),
    ).toThrow();
  });
});
