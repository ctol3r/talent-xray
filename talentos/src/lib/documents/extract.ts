import { checkDocxBudget } from "./docx-budget";
import { MAX_DOCUMENT_CHARS, MAX_FILE_BYTES, MAX_PDF_PAGES } from "./contracts";

export function checkedText(text: string): string {
  if (!text.trim())
    throw new Error(
      "No readable text found. Scanned PDFs need OCR; paste text or choose a text document.",
    );
  if (text.length > MAX_DOCUMENT_CHARS)
    throw new Error("Document exceeds 200,000 extracted characters.");
  return text;
}
export async function extractDocument(
  bytes: Uint8Array,
  filename: string,
): Promise<{ text: string; mediaType: string }> {
  if (bytes.byteLength > MAX_FILE_BYTES || bytes.byteLength === 0)
    throw new Error("Choose a nonempty file of at most 20 MiB.");
  if (filename.toLowerCase().endsWith(".pdf")) {
    if (Buffer.from(bytes.slice(0, 5)).toString() !== "%PDF-")
      throw new Error("File does not have a valid PDF signature.");
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: true,
      verbosity: 0,
    });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > MAX_PDF_PAGES)
        throw new Error("PDF exceeds 100 pages.");
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const content = await (await pdf.getPage(i)).getTextContent();
        pages.push(
          content.items
            .map((item) =>
              "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
            )
            .join(""),
        );
        if (pages.join("\n\n").length > MAX_DOCUMENT_CHARS)
          throw new Error("Document exceeds 200,000 extracted characters.");
      }
      return {
        text: checkedText(pages.join("\n\n")),
        mediaType: "application/pdf",
      };
    } catch (error) {
      if (error instanceof Error && error.name === "PasswordException")
        throw new Error(
          "Encrypted PDF: provide an unlocked copy or paste text.",
        );
      throw error;
    } finally {
      await task.destroy();
    }
  }
  if (filename.toLowerCase().endsWith(".docx")) {
    checkDocxBudget(bytes);
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return {
      text: checkedText(result.value),
      mediaType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }
  throw new Error(
    "Supported files are PDF and DOCX. Other text can be pasted.",
  );
}
