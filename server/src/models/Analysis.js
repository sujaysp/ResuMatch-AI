
import mongoose from "mongoose";

// --------------------------------------------------
// RESUME AND SKILL EVIDENCE
// --------------------------------------------------

const evidenceSchema = new mongoose.Schema(
  {
    snippet: {
      type: String,
      required: true,
      maxlength: 240,
    },

    section: {
      type: String,
      default: "other",
    },

    evidenceType: {
      type: String,
      default: "other",
    },

    confidence: {
      type: String,
      enum: ["strong", "moderate", "limited"],
      default: "limited",
    },

    lineNumber: {
      type: Number,
      min: 1,
    },
  },
  { _id: false }
);

// Evidence showing how the job description mentioned a skill.
const requirementEvidenceSchema = new mongoose.Schema(
  {
    snippet: {
      type: String,
      required: true,
    },

    lineNumber: {
      type: Number,
      min: 1,
    },

    requirementLevel: {
      type: String,
      enum: ["required", "preferred", "optional"],
    },

    classificationSource: {
      type: String,
      enum: ["explicit", "default"],
    },
  },
  { _id: false }
);

// --------------------------------------------------
// SKILL STRUCTURE
// --------------------------------------------------

const skillSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    requirementLevel: {
      type: String,
      enum: ["required", "preferred", "optional"],
    },

    weight: {
      type: Number,
      min: 1,
      max: 3,
    },

    classificationSource: {
      type: String,
      enum: ["explicit", "default"],
    },

    matchedAlias: {
      type: String,
    },

    evidenceConfidence: {
      type: String,
      enum: ["strong", "moderate", "limited"],
    },

    evidence: {
      type: [evidenceSchema],
      default: [],
    },

    requirementEvidence: {
      type: [requirementEvidenceSchema],
      default: [],
    },
  },
  { _id: false }
);

// --------------------------------------------------
// SCORE BREAKDOWN
// --------------------------------------------------

const scoreBreakdownSchema = new mongoose.Schema(
  {
    matchedRequiredSkills: {
      type: Number,
      required: true,
      min: 0,
    },

    totalRequiredSkills: {
      type: Number,
      required: true,
      min: 1,
    },

    missingRequiredSkills: {
      type: Number,
      required: true,
      min: 0,
    },

    formula: {
      type: String,
      required: true,
    },

    matchedWeight: {
      type: Number,
      min: 0,
    },

    totalWeight: {
      type: Number,
      min: 0,
    },
  },
  { _id: false }
);

// --------------------------------------------------
// REQUIREMENT BREAKDOWN
// --------------------------------------------------

const requirementCategorySchema = new mongoose.Schema(
  {
    total: {
      type: Number,
      default: 0,
      min: 0,
    },

    matched: {
      type: Number,
      default: 0,
      min: 0,
    },

    missing: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const requirementBreakdownSchema = new mongoose.Schema(
  {
    required: {
      type: requirementCategorySchema,
      default: () => ({}),
    },

    preferred: {
      type: requirementCategorySchema,
      default: () => ({}),
    },

    optional: {
      type: requirementCategorySchema,
      default: () => ({}),
    },
  },
  { _id: false }
);

// --------------------------------------------------
// GEMINI RECOMMENDATION STRUCTURES
// --------------------------------------------------

const recommendationSkillSchema = new mongoose.Schema(
  {
    skill: {
      type: String,
      required: true,
    },

    priority: {
      type: String,
      enum: ["high", "medium", "low"],
      required: true,
    },

    reason: {
      type: String,
      required: true,
    },

    actions: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const learningPlanSchema = new mongoose.Schema(
  {
    phase: {
      type: String,
      required: true,
    },

    goal: {
      type: String,
      required: true,
    },

    tasks: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const aiRecommendationsSchema = new mongoose.Schema(
  {
    summary: {
      type: String,
      required: true,
    },

    prioritySkills: {
      type: [recommendationSkillSchema],
      default: [],
    },

    learningPlan: {
      type: [learningPlanSchema],
      default: [],
    },

    resumeImprovements: {
      type: [String],
      default: [],
    },

    interviewPreparation: {
      type: [String],
      default: [],
    },

    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// --------------------------------------------------
// MAIN ANALYSIS DOCUMENT
// --------------------------------------------------

const analysisSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
      required: true,
    },

    jobDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20000,
    },

    // Original score, retained for compatibility.
    skillMatchScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    // New weighted score.
    weightedSkillMatchScore: {
      type: Number,
      min: 0,
      max: 100,
    },

    // Coverage of mandatory skills only.
    mandatorySkillCoverage: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    scoreBreakdown: {
      type: scoreBreakdownSchema,
      required: true,
    },

    requirementBreakdown: {
      type: requirementBreakdownSchema,
    },

    // Version of the scoring methodology.
    scoreModelVersion: {
      type: String,
      default: "1.0",
    },

    matchedSkills: {
      type: [skillSchema],
      default: [],
    },

    missingSkills: {
      type: [skillSchema],
      default: [],
    },

    additionalSkills: {
      type: [skillSchema],
      default: [],
    },

    candidateSkillCount: {
      type: Number,
      required: true,
      min: 0,
    },

    requiredSkillCount: {
      type: Number,
      required: true,
      min: 1,
    },

    // Optional for older analysis documents.
    aiRecommendations: {
      type: aiRecommendationsSchema,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

// Optimize retrieval of a user's recent analysis records.
analysisSchema.index({
  userId: 1,
  createdAt: -1,
});

const Analysis = mongoose.model(
  "Analysis",
  analysisSchema
);

export default Analysis;