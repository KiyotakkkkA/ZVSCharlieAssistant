import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

export type ReportBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string; numbered?: boolean }
  | { type: "paragraph"; paragraphs: string[] }
  | { type: "list"; style: "bullet" | "numbered"; items: string[] }
  | {
      type: "table";
      number?: string;
      title: string;
      headers: string[];
      rows: string[][];
    }
  | {
      type: "code";
      number?: string;
      title: string;
      language?: string;
      content: string;
    }
  | { type: "pageBreak" };

export interface CreateReportInput {
  fileName: string;
  template: "mirea-report-gost";
  title?: string;
  blocks: ReportBlock[];
}

const FONT = "Times New Roman";
const cm = (value: number) => Math.round(value * 567);
const REPORT_SESSION_TTL_MS = 30 * 60_000;
const REPORT_SESSION_MAX_BYTES = 2_000_000;
const REPORT_SESSION_MAX_BLOCKS = 2_000;

interface ReportSession {
  id: string;
  ownerId: string;
  fileName: string;
  template: "mirea-report-gost";
  title?: string;
  blocks: ReportBlock[];
  nextSequence: number;
  bytesReceived: number;
  touchedAt: number;
}

export class ReportDocxService {
  private readonly sessions = new Map<string, ReportSession>();

  constructor(private readonly outputRoot: string) {}

  begin(
    input: Omit<CreateReportInput, "blocks">,
    ownerId: string,
  ): {
    sessionId: string;
    fileName: string;
    nextSequence: number;
    recommendedBlocksPerChunk: number;
  } {
    this.cleanupExpiredSessions();
    const id = randomUUID();
    this.sessions.set(id, {
      id,
      ownerId,
      ...input,
      blocks: [],
      nextSequence: 0,
      bytesReceived: 0,
      touchedAt: Date.now(),
    });
    return {
      sessionId: id,
      fileName: input.fileName,
      nextSequence: 0,
      recommendedBlocksPerChunk: 2,
    };
  }

  addBlocks(
    input: { sessionId: string; sequence: number; blocks: ReportBlock[] },
    ownerId: string,
  ): {
    sessionId: string;
    fileName: string;
    acceptedSequence: number;
    nextSequence: number;
    blocksReceived: number;
    bytesReceived: number;
  } {
    const session = this.session(input.sessionId, ownerId);
    if (input.sequence !== session.nextSequence)
      throw new Error(
        `Ожидалась часть отчёта №${session.nextSequence}, получена №${input.sequence}`,
      );
    if (session.blocks.length + input.blocks.length > REPORT_SESSION_MAX_BLOCKS)
      throw new Error(
        `Отчёт не может содержать больше ${REPORT_SESSION_MAX_BLOCKS} блоков`,
      );
    const bytes = Buffer.byteLength(JSON.stringify(input.blocks), "utf8");
    if (session.bytesReceived + bytes > REPORT_SESSION_MAX_BYTES)
      throw new Error(
        `Структура отчёта превышает ${REPORT_SESSION_MAX_BYTES} байт`,
      );
    session.blocks.push(...input.blocks);
    session.bytesReceived += bytes;
    session.nextSequence += 1;
    session.touchedAt = Date.now();
    return {
      sessionId: session.id,
      fileName: session.fileName,
      acceptedSequence: input.sequence,
      nextSequence: session.nextSequence,
      blocksReceived: session.blocks.length,
      bytesReceived: session.bytesReceived,
    };
  }

  async commit(
    input: { sessionId: string },
    ownerId: string,
  ): Promise<{ path: string; fileName: string; blocks: number }> {
    const session = this.session(input.sessionId, ownerId);
    if (!session.blocks.length)
      throw new Error("Нельзя создать DOCX без содержимого");
    const result = await this.create({
      fileName: session.fileName,
      template: session.template,
      title: session.title,
      blocks: session.blocks,
    });
    this.sessions.delete(session.id);
    return result;
  }

  abort(
    input: { sessionId: string },
    ownerId: string,
  ): { sessionId: string; fileName: string; aborted: true } {
    const session = this.session(input.sessionId, ownerId);
    this.sessions.delete(session.id);
    return { sessionId: session.id, fileName: session.fileName, aborted: true };
  }

  /**
   * Sessions are keyed by conversation (see `reportOwnerId` in
   * ToolRegistry.create), so they intentionally survive a single run ending
   * and can be resumed from the next message. Only conversation deletion and
   * the TTL below reclaim them.
   */
  abortConversation(conversationId: string): void {
    for (const session of this.sessions.values())
      if (session.ownerId === conversationId) this.sessions.delete(session.id);
  }

  async create(
    input: CreateReportInput,
  ): Promise<{ path: string; fileName: string; blocks: number }> {
    for (const block of input.blocks) {
      if (
        block.type === "table" &&
        block.rows.some((row) => row.length !== block.headers.length)
      )
        throw new Error(
          `Таблица «${block.title}» содержит строки, не совпадающие с количеством заголовков`,
        );
    }
    const fileName = `${
      input.fileName
        .trim()
        .replace(/[^\p{L}\p{N}._ -]+/gu, "_")
        .replace(/\.docx$/i, "") || "report"
    }.docx`;
    await mkdir(this.outputRoot, { recursive: true });
    const path = join(this.outputRoot, fileName);
    const children: Array<Paragraph | Table> = [];
    if (input.title?.trim()) children.push(this.heading(input.title, 1, false));
    for (const block of input.blocks) children.push(...this.render(block));
    const document = new Document({
      numbering: {
        config: [
          {
            reference: "report-bullets",
            levels: [
              {
                level: 0,
                format: LevelFormat.BULLET,
                text: "–",
                alignment: AlignmentType.LEFT,
                style: {
                  paragraph: { indent: { left: cm(2.25), hanging: cm(1) } },
                },
              },
            ],
          },
          {
            reference: "report-numbers",
            levels: [
              {
                level: 0,
                format: LevelFormat.DECIMAL,
                text: "%1.",
                alignment: AlignmentType.LEFT,
                style: {
                  paragraph: { indent: { left: cm(2.25), hanging: cm(1) } },
                },
              },
            ],
          },
        ],
      },
      styles: {
        default: {
          document: {
            run: { font: FONT, size: 28, color: "000000" },
            paragraph: { spacing: { line: 360, before: 0, after: 0 } },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: cm(21), height: cm(29.7) },
              margin: { top: cm(2), right: cm(1), bottom: cm(2), left: cm(3) },
            },
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      font: FONT,
                      size: 24,
                    }),
                  ],
                }),
              ],
            }),
          },
          children,
        },
      ],
    });
    await writeFile(path, await Packer.toBuffer(document));
    return { path, fileName, blocks: input.blocks.length };
  }

  private render(block: ReportBlock): Array<Paragraph | Table> {
    if (block.type === "pageBreak")
      return [new Paragraph({ children: [new PageBreak()] })];
    if (block.type === "heading")
      return [this.heading(block.text, block.level, block.numbered ?? true)];
    if (block.type === "paragraph")
      return block.paragraphs.map(
        (text) =>
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            indent: { firstLine: cm(1.25) },
            widowControl: true,
            children: [new TextRun(text)],
          }),
      );
    if (block.type === "list")
      return block.items.map(
        (text) =>
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            numbering: {
              reference:
                block.style === "bullet" ? "report-bullets" : "report-numbers",
              level: 0,
            },
            children: [new TextRun(text)],
          }),
      );
    if (block.type === "code")
      return [
        new Paragraph({
          spacing: { before: cm(0.6), after: 0, line: 240 },
          keepNext: true,
          children: [
            new TextRun({
              text: `Листинг${block.number ? ` ${block.number}` : ""} — ${block.title.replace(/[.]$/, "")}`,
              italics: true,
              font: FONT,
              size: 24,
            }),
          ],
        }),
        ...block.content.split(/\r?\n/).map(
          (line) =>
            new Paragraph({
              spacing: { line: 240 },
              border: {
                left: { style: BorderStyle.SINGLE, size: 4, color: "808080" },
                right: {
                  style: BorderStyle.SINGLE,
                  size: 4,
                  color: "808080",
                },
              },
              children: [
                new TextRun({
                  text: line || " ",
                  font: "Courier New",
                  size: 20,
                }),
              ],
            }),
        ),
      ];
    const caption = new Paragraph({
      spacing: { before: cm(0.6), after: 0, line: 240 },
      keepNext: true,
      children: [
        new TextRun({
          text: `Таблица${block.number ? ` ${block.number}` : ""} — ${block.title.replace(/[.]$/, "")}`,
          italics: true,
          font: FONT,
          size: 24,
        }),
      ],
    });
    const widths = block.headers.map(() => 100 / block.headers.length);
    const rows = [block.headers, ...block.rows].map(
      (values, rowIndex) =>
        new TableRow({
          children: block.headers.map(
            (_, columnIndex) =>
              new TableCell({
                width: {
                  size: widths[columnIndex]!,
                  type: WidthType.PERCENTAGE,
                },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { line: 240 },
                    children: [
                      new TextRun({
                        text: values[columnIndex] ?? "",
                        bold: rowIndex === 0,
                        font: FONT,
                        size: 24,
                      }),
                    ],
                  }),
                ],
              }),
          ),
        }),
    );
    return [
      caption,
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
    ];
  }

  private session(sessionId: string, ownerId: string): ReportSession {
    this.cleanupExpiredSessions();
    const session = this.sessions.get(sessionId);
    if (!session)
      throw new Error("Сессия сборки отчёта не найдена или истекла");
    if (session.ownerId !== ownerId)
      throw new Error("Сессия сборки отчёта принадлежит другой задаче");
    return session;
  }

  private cleanupExpiredSessions(): void {
    const expiresBefore = Date.now() - REPORT_SESSION_TTL_MS;
    for (const session of this.sessions.values())
      if (session.touchedAt < expiresBefore) this.sessions.delete(session.id);
  }

  private heading(
    text: string,
    level: 1 | 2 | 3,
    numbered: boolean,
  ): Paragraph {
    const raw = text.trim().replace(/[.]$/, "");
    const value = numbered ? raw : raw.replace(/^\d+(?:\.\d+)*\s+/, "");
    return new Paragraph({
      heading:
        level === 1
          ? HeadingLevel.HEADING_1
          : level === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3,
      pageBreakBefore: level === 1,
      keepNext: true,
      indent: { left: cm(1.25) },
      spacing: { before: level === 1 ? 0 : cm(1.5), after: cm(1), line: 360 },
      children: [
        new TextRun({
          text: level === 1 ? value.toUpperCase() : value,
          bold: true,
          font: FONT,
          size: level === 1 ? 36 : level === 2 ? 32 : 28,
        }),
      ],
    });
  }
}
