
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const MAX_PDF_PAGES = 30;
const MAX_EXTRACTED_CHARACTERS = 200000;

const createError = (message, status) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizePageText = (text) => {
  return text
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const reconstructLine = (items) => {
  let result = "";
  let previous = null;

  for (const item of items) {
    const currentText = item.str.trim();

    if (!currentText) continue;

    if (!previous) {
      result = currentText;
      previous = item;
      continue;
    }

    const previousText = previous.str.trimEnd();
    const previousWidth = Number.isFinite(previous.width)
      ? previous.width
      : 0;

    const horizontalGap =
      item.x - (previous.x + previousWidth);

    const fontSize = Math.max(
      previous.fontSize || 10,
      item.fontSize || 10
    );

    const normalSpaceThreshold = Math.max(
      1.5,
      fontSize * 0.15
    );

    let separator = "";

    if (horizontalGap > 35) {
      separator = " | ";
    } else if (horizontalGap > normalSpaceThreshold) {
      separator = " ";
    }

    result += separator + currentText;
    previous = item;
  }

  return result;
};

// Reconstruct a readable page from PDF.js text items.
export const reconstructPageText = (items) => {
  const textItems = items.filter(
    (item) =>
      item &&
      typeof item.str === "string" &&
      item.str.trim().length > 0
  );

  if (textItems.length === 0) {
    return "";
  }

  const hasGeometry = textItems.every((item) => {
    const transform = item.transform;

    return (
      transform &&
      transform.length >= 6 &&
      Number.isFinite(transform[4]) &&
      Number.isFinite(transform[5])
    );
  });

  // Fallback for PDFs without usable positioning data.
  if (!hasGeometry) {
    const lines = [];
    let currentLine = "";

    for (const item of textItems) {
      const value = item.str.trim();

      if (!value) continue;

      currentLine = currentLine
        ? `${currentLine} ${value}`
        : value;

      if (item.hasEOL) {
        lines.push(currentLine);
        currentLine = "";
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return normalizePageText(lines.join("\n"));
  }

  const positionedItems = textItems.map((item) => {
    const transform = item.transform;

    const fontSize =
      Math.hypot(transform[2], transform[3]) ||
      item.height ||
      10;

    return {
      str: item.str,
      x: transform[4],
      y: transform[5],
      width: Number.isFinite(item.width)
        ? item.width
        : 0,
      fontSize,
    };
  });

  // Sort from top to bottom and left to right.
  positionedItems.sort((a, b) => {
    if (Math.abs(a.y - b.y) > 2) {
      return b.y - a.y;
    }

    return a.x - b.x;
  });

  const lines = [];

  for (const item of positionedItems) {
    const tolerance = Math.max(
      2,
      Math.min(5, item.fontSize * 0.3)
    );

    const currentLine = lines[lines.length - 1];

    if (
      !currentLine ||
      Math.abs(currentLine.y - item.y) > tolerance
    ) {
      lines.push({
        y: item.y,
        items: [item],
      });

      continue;
    }

    currentLine.items.push(item);
  }

  const reconstructedLines = lines.map((line) => {
    line.items.sort((a, b) => a.x - b.x);

    return reconstructLine(line.items);
  });

  return normalizePageText(
    reconstructedLines.join("\n")
  );
};

// Extract text from a PDF.
export const extractPdfText = async (fileBuffer) => {
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw createError("The uploaded PDF is empty.", 400);
  }

  const loadingTask = getDocument({
    data: new Uint8Array(fileBuffer),
  });

  try {
    const pdfDocument = await loadingTask.promise;

    const pageCount = pdfDocument.numPages;

    if (pageCount > MAX_PDF_PAGES) {
      throw createError(
        `Resume cannot exceed ${MAX_PDF_PAGES} pages.`,
        413
      );
    }

    const extractedPages = [];

    for (
      let pageNumber = 1;
      pageNumber <= pageCount;
      pageNumber++
    ) {
      const page = await pdfDocument.getPage(pageNumber);

      try {
        const content = await page.getTextContent();

        const pageText = reconstructPageText(
          content.items
        );

        extractedPages.push(pageText);
      } finally {
        page.cleanup();
      }
    }

    const text = extractedPages
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if (!text) {
      throw createError(
        "No readable text was found. Scanned PDFs are not supported yet.",
        422
      );
    }

    if (text.length > MAX_EXTRACTED_CHARACTERS) {
      throw createError(
        "The extracted resume text exceeds the allowed limit.",
        413
      );
    }

    return {
      text,
      pageCount,
    };
  } catch (error) {
    if (error.status) {
      throw error;
    }

    const parseError = new Error(
      "Unable to read this PDF. Make sure it is valid and not password-protected."
    );

    parseError.status = 422;
    throw parseError;
  } finally {
    try {
      await loadingTask.destroy();
    } catch {
      // Ignore PDF cleanup errors.
    }
  }
};
