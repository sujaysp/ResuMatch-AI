
import { z } from "zod";

import Resume from "../models/Resume.js";
import Analysis from "../models/Analysis.js";

import { compareResumeToJob } from "../services/resumeComparison.js";

import {
  generateCareerRecommendations,
} from "../services/aiRecommendationService.js";

// --------------------------------------------------
// VALIDATION SCHEMAS
// --------------------------------------------------

const analysisRequestSchema = z.object({
  resumeId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "A valid resume ID is required."),

  jobDescription: z
    .string()
    .trim()
    .min(50, "Job description must contain at least 50 characters.")
    .max(20000, "Job description cannot exceed 20,000 characters."),
});

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const analysisParamsSchema = z.object({
  analysisId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "A valid analysis ID is required."),
});

// --------------------------------------------------
// 1. ANALYZE RESUME AGAINST JOB DESCRIPTION
// --------------------------------------------------

export const analyzeResumeAgainstJob = async (req, res) => {
  try {
    const validation = analysisRequestSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid analysis request.",

        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const { resumeId, jobDescription } = validation.data;

    const resume = await Resume.findOne({
      _id: resumeId,
      userId: req.auth.userId,
    }).select("+extractedText");

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found.",
      });
    }

    if (
      typeof resume.extractedText !== "string" ||
      !resume.extractedText.trim()
    ) {
      return res.status(422).json({
        success: false,
        message: "This resume does not contain readable extracted text.",
      });
    }

    let analysis;

    try {
      analysis = compareResumeToJob({
        resumeText: resume.extractedText,
        jobDescription,
      });
    } catch (error) {
      if (
        error.message?.includes(
          "No recognized skills were found in the job description"
        )
      ) {
        return res.status(422).json({
          success: false,
          message: error.message,
        });
      }

      throw error;
    }

    const savedAnalysis = await Analysis.create({
      userId: req.auth.userId,
      resumeId: resume._id,
      jobDescription,
      ...analysis,
    });

    return res.status(201).json({
      success: true,
      message: "Resume analyzed and analysis saved successfully.",

      data: {
        analysisRecord: {
          id: savedAnalysis._id.toString(),
          createdAt: savedAnalysis.createdAt,
        },

        resume: {
          id: resume._id.toString(),
          originalFileName: resume.originalFileName,
        },

        analysis,
      },
    });
  } catch (error) {
    console.error("Resume analysis failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to analyze the resume right now.",
    });
  }
};

// --------------------------------------------------
// 2. RETRIEVE ANALYSIS HISTORY
// --------------------------------------------------

export const getAnalysisHistory = async (req, res) => {
  try {
    const validation = historyQuerySchema.safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters.",

        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const { page, limit } = validation.data;

    const filter = {
      userId: req.auth.userId,
    };

    const [totalCount, records] = await Promise.all([
      Analysis.countDocuments(filter),

      Analysis.find(filter)
        .select([
          "resumeId",
          "skillMatchScore",
          "weightedSkillMatchScore",
          "mandatorySkillCoverage",
          "scoreBreakdown",
          "requirementBreakdown",
          "scoreModelVersion",
          "matchedSkills",
          "missingSkills",
          "additionalSkills",
          "candidateSkillCount",
          "requiredSkillCount",
          "createdAt",
          "aiRecommendations",
        ].join(" "))
        .populate({
          path: "resumeId",
          select: "originalFileName",
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const analyses = records.map((record) => ({
      id: record._id.toString(),

      resume: record.resumeId
        ? {
            id: record.resumeId._id.toString(),
            originalFileName: record.resumeId.originalFileName,
          }
        : null,

      skillMatchScore: record.skillMatchScore,

      weightedSkillMatchScore:
        record.weightedSkillMatchScore ?? null,

      mandatorySkillCoverage:
        record.mandatorySkillCoverage ?? null,

      scoreBreakdown: record.scoreBreakdown,

      requirementBreakdown:
        record.requirementBreakdown ?? null,

      scoreModelVersion:
        record.scoreModelVersion || "1.0",

      matchedSkills: record.matchedSkills,

      missingSkills: record.missingSkills,

      additionalSkills: record.additionalSkills,

      candidateSkillCount: record.candidateSkillCount,

      requiredSkillCount: record.requiredSkillCount,

      aiRecommendations: record.aiRecommendations ?? null,

      createdAt: record.createdAt,
    }));

    return res.status(200).json({
      success: true,
      message: "Analysis history retrieved successfully.",

      data: {
        analyses,

        pagination: {
          currentPage: page,
          pageSize: limit,
          totalRecords: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNextPage: page * limit < totalCount,
        },
      },
    });
  } catch (error) {
    console.error(
      "Analysis history retrieval failed:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve analysis history.",
    });
  }
};

// --------------------------------------------------
// 3. RETRIEVE A COMPLETE INDIVIDUAL ANALYSIS REPORT
// --------------------------------------------------

export const getAnalysisById = async (req, res) => {
  try {
    // Validate the requested report ID.
    const validation = analysisParamsSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid analysis ID.",
      });
    }

    const { analysisId } = validation.data;

    // Retrieve only a report belonging to the current user.
    const record = await Analysis.findOne({
      _id: analysisId,
      userId: req.auth.userId,
    })
      .populate({
        path: "resumeId",
        select: [
          "originalFileName",
          "mimeType",
          "fileSizeBytes",
          "pageCount",
          "createdAt",
        ].join(" "),
      })
      .lean();

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Analysis report not found.",
      });
    }

    // Format the complete report.
    const report = {
      id: record._id.toString(),

      resume: record.resumeId
        ? {
            id: record.resumeId._id.toString(),
            originalFileName: record.resumeId.originalFileName,
            mimeType: record.resumeId.mimeType,
            fileSizeBytes: record.resumeId.fileSizeBytes,
            pageCount: record.resumeId.pageCount,
            uploadedAt: record.resumeId.createdAt,
          }
        : null,

      jobDescription: record.jobDescription,

      skillMatchScore: record.skillMatchScore,

      weightedSkillMatchScore:
        record.weightedSkillMatchScore ?? null,

      mandatorySkillCoverage:
        record.mandatorySkillCoverage ?? null,

      scoreBreakdown: record.scoreBreakdown,

      requirementBreakdown:
        record.requirementBreakdown ?? null,

      scoreModelVersion:
        record.scoreModelVersion || "1.0",

      matchedSkills: record.matchedSkills || [],

      missingSkills: record.missingSkills || [],

      additionalSkills: record.additionalSkills || [],

      candidateSkillCount: record.candidateSkillCount,

      requiredSkillCount: record.requiredSkillCount,

      aiRecommendations:
        record.aiRecommendations ?? null,

      createdAt: record.createdAt,

      updatedAt: record.updatedAt,
    };

    return res.status(200).json({
      success: true,
      message: "Analysis report retrieved successfully.",

      data: {
        analysis: report,
      },
    });
  } catch (error) {
    console.error(
      "Analysis detail retrieval failed:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve the analysis report.",
    });
  }
};

// --------------------------------------------------
// 4. GENERATE GEMINI AI RECOMMENDATIONS
// --------------------------------------------------

export const generateAnalysisRecommendations = async (req, res) => {
  try {
    const validation = analysisParamsSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid analysis ID.",
      });
    }

    const { analysisId } = validation.data;

    const analysis = await Analysis.findOne({
      _id: analysisId,
      userId: req.auth.userId,
    });

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: "Analysis not found.",
      });
    }

    const recommendations = await generateCareerRecommendations({
      skillMatchScore: analysis.skillMatchScore,

      weightedSkillMatchScore:
        analysis.weightedSkillMatchScore,

      mandatorySkillCoverage:
        analysis.mandatorySkillCoverage,

      requirementBreakdown:
        analysis.requirementBreakdown,

      candidateSkillCount: analysis.candidateSkillCount,

      requiredSkillCount: analysis.requiredSkillCount,

      matchedSkills: analysis.matchedSkills,

      missingSkills: analysis.missingSkills,

      additionalSkills: analysis.additionalSkills,
    });

    analysis.aiRecommendations = {
      ...recommendations,
      generatedAt: new Date(),
    };

    await analysis.save();

    return res.status(200).json({
      success: true,
      message: "AI recommendations generated successfully.",

      data: {
        analysisId: analysis._id.toString(),
        aiRecommendations: analysis.aiRecommendations,
      },
    });
  } catch (error) {
    if (error.code === "GEMINI_API_KEY_MISSING") {
      return res.status(503).json({
        success: false,
        message: "Gemini API key is not configured.",
      });
    }

    if (
      error.code === "GEMINI_TEMPORARILY_UNAVAILABLE"
    ) {
      console.error(
        "Gemini capacity error:",
        error.cause?.message ?? error.message
      );

      return res.status(503).json({
        success: false,
        message:
          "Gemini is temporarily overloaded. Your saved analysis is safe. Please try again later.",
      });
    }

    console.error(
      "AI recommendation generation failed:",
      error.message
    );

    return res.status(502).json({
      success: false,
      message: "Unable to generate AI recommendations right now.",
    });
  }
};
