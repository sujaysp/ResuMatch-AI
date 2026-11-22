import multer from "multer";

// Maximum PDF size: 5 MB.
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Configure Multer.
const multerUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 0,
    parts: 1,
  },

  // Preliminary file type validation.
  fileFilter: (req, file, callback) => {
    const isPdfMimeType = file.mimetype === "application/pdf";
    const hasPdfExtension = /\.pdf$/i.test(file.originalname);

    if (!isPdfMimeType || !hasPdfExtension) {
      const error = new Error("Only PDF files are allowed.");
      error.status = 400;

      return callback(error);
    }

    callback(null, true);
  },
});

// Handle Multer errors with useful HTTP responses.
export const uploadResumeFile = (req, res, next) => {
  multerUpload.single("resume")(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          message: "PDF file must not exceed 5 MB.",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Invalid file upload request.",
      });
    }

    if (error) {
      return next(error);
    }

    next();
  });
};