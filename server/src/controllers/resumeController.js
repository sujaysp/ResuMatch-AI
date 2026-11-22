import path from "node:path";

import Resume from "../models/Resume.js";
import { extractPdfText } from "../services/resumeParser.js";

// Upload and process a resume.
export const uploadResume = async (req, res, next) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Please select a PDF file.",
      });
    }

    // Verify the actual PDF signature.
    const header = file.buffer.subarray(0, 1024);

    if (!header.includes(Buffer.from("%PDF-"))) {
      return res.status(400).json({
        success: false,
        message: "The uploaded file is not a valid PDF.",
      });
    }

    // Extract text from the PDF.
    const { text, pageCount } = await extractPdfText(
      file.buffer
    );

    // Sanitize the user-provided filename.
    const originalFileName = path
      .basename(file.originalname)
      .replace(/[\u0000-\u001F\u007F]/g, "_")
      .slice(0, 150) || "resume.pdf";

    // Store the extracted resume against its owner.
    const resume = await Resume.create({
      userId: req.auth.userId,
      originalFileName,
      mimeType: "application/pdf",
      fileSizeBytes: file.size,
      pageCount,
      extractedText: text,
    });

    return res.status(201).json({
      success: true,
      message: "Resume uploaded and processed successfully",

      data: {
        resume: {
          id: resume._id.toString(),
          originalFileName: resume.originalFileName,
          fileSizeBytes: resume.fileSizeBytes,
          pageCount: resume.pageCount,
          characterCount: text.length,
          extractedTextPreview: text.slice(0, 500),
          createdAt: resume.createdAt,
        },
      },
    });

  } catch (error) {
    next(error);
  }
};