import { parentPort } from "node:worker_threads";
import mammoth from "mammoth";

export interface TextExtractionRequest {
  id: number;
  fileName: string;
  data: ArrayBuffer;
}

export type TextExtractionResponse =
  { id: number; text: string } | { id: number; error: string };

async function extractText(buffer: Buffer, name: string): Promise<string> {
  if (/\.txt$/i.test(name)) return buffer.toString("utf8");
  if (/\.docx$/i.test(name))
    return (await mammoth.extractRawText({ buffer })).value;
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];
  for (let index = 1; index <= pdf.numPages; index++) {
    const content = await (await pdf.getPage(index)).getTextContent();
    pages.push(
      content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
    );
  }
  return pages.join("\n\n");
}

parentPort?.on("message", (request: TextExtractionRequest) => {
  void extractText(Buffer.from(request.data), request.fileName)
    .then((text) =>
      parentPort?.postMessage({
        id: request.id,
        text,
      } as TextExtractionResponse),
    )
    .catch((error: unknown) =>
      parentPort?.postMessage({
        id: request.id,
        error: error instanceof Error ? error.message : String(error),
      } as TextExtractionResponse),
    );
});
