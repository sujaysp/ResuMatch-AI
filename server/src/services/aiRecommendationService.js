
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { env } from "../config/env.js";

// --------------------------------------------------
// VALIDATE GEMINI OUTPUT
// --------------------------------------------------

const recommendationOutputSchema = z.object({
  summary: z.string().min(1).max(1000),

  prioritySkills: z.array(
    z.object({
      skill: z.string(),
      priority: z.enum(["high", "medium", "low"]),
      reason: z.string(),
      actions: z.array(z.string()).min(1).max(4),
    })
  ).max(5),

  learningPlan: z.array(
    z.object({
      phase: z.string(),
      goal: z.string(),
      tasks: z.array(z.string()).min(1).max(4),
    })
  ).max(4),

  resumeImprovements: z.array(z.string()).max(5),

  interviewPreparation: z.array(z.string()).max(5),
});

const recommendationJsonSchema = {
  type: "object",

  properties: {
    summary: {
      type: "string",
    },

    prioritySkills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          skill: { type: "string" },

          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
          },

          reason: { type: "string" },

          actions: {
            type: "array",
            items: { type: "string" },
          },
        },

        required: [
          "skill",
          "priority",
          "reason",
          "actions",
        ],
      },
    },

    learningPlan: {
      type: "array",
      items: {
        type: "object",
        properties: {
          phase: { type: "string" },
          goal: { type: "string" },

          tasks: {
            type: "array",
            items: { type: "string" },
          },
        },

        required: ["phase", "goal", "tasks"],
      },
    },

    resumeImprovements: {
      type: "array",
      items: { type: "string" },
    },

    interviewPreparation: {
      type: "array",
      items: { type: "string" },
    },
  },

  required: [
    "summary",
    "prioritySkills",
    "learningPlan",
    "resumeImprovements",
    "interviewPreparation",
  ],
};

// --------------------------------------------------
// RETRY TEMPORARY GEMINI ERRORS
// --------------------------------------------------

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const isTemporaryGeminiError = (error) => {
  const message = error?.message ?? "";

  return (
    Number(error?.status) === 503 ||
    Number(error?.statusCode) === 503 ||
    Number(error?.code) === 503 ||
    /"code"\s*:\s*503/i.test(message) ||
    /UNAVAILABLE|currently experiencing high demand/i.test(message)
  );
};

const generateContentWithRetry = async (ai, request) => {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent(request);
    } catch (error) {
      if (!isTemporaryGeminiError(error)) {
        throw error;
      }

      if (attempt === maxAttempts) {
        const unavailableError = new Error(
          "Gemini is temporarily overloaded. Please try again later.",
          { cause: error }
        );

        unavailableError.code =
          "GEMINI_TEMPORARILY_UNAVAILABLE";

        throw unavailableError;
      }

      const delay = 1000 * (2 ** (attempt - 1));

      console.warn(
        `Gemini temporarily unavailable. Retry ${attempt + 1}/${maxAttempts} in ${delay}ms.`
      );

      await wait(delay);
    }
  }
};

// --------------------------------------------------
// PREPARE SAFE INPUT FOR GEMINI
// --------------------------------------------------

// Only send structured skill information.
// Resume evidence snippets are deliberately excluded.
const prepareSkillForAI = (skill) => ({
  name: skill.name,
  category: skill.category,

  requirementLevel:
    skill.requirementLevel || "required",

  weight: skill.weight || 3,
});

// --------------------------------------------------
// GENERATE CAREER RECOMMENDATIONS
// --------------------------------------------------

export const generateCareerRecommendations = async (analysis) => {
  if (!env.GEMINI_API_KEY?.trim()) {
    const error = new Error(
      "Gemini API key is not configured."
    );

    error.code = "GEMINI_API_KEY_MISSING";
    throw error;
  }

  const ai = new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
  });

  const analysisInput = {
    skillMatchScore: analysis.skillMatchScore,

    weightedSkillMatchScore:
      analysis.weightedSkillMatchScore ?? null,

    mandatorySkillCoverage:
      analysis.mandatorySkillCoverage ?? null,

    candidateSkillCount: analysis.candidateSkillCount,

    requiredSkillCount: analysis.requiredSkillCount,

    matchedSkills: (
      analysis.matchedSkills || []
    ).map(prepareSkillForAI),

    missingSkills: (
      analysis.missingSkills || []
    ).map(prepareSkillForAI),

    additionalSkills: (
      analysis.additionalSkills || []
    ).map(prepareSkillForAI),

    requirementBreakdown:
      analysis.requirementBreakdown ?? null,
  };

  const prompt = `
You are a practical career development assistant.

Analyze the supplied structured resume-to-job comparison.

ANALYSIS DATA:
${JSON.stringify(analysisInput, null, 2)}

INSTRUCTIONS:

1. Explain the existing skill coverage result clearly.

2. Prioritize up to five missing skills.

3. Give higher priority to missing mandatory skills.

4. Consider preferred skills after mandatory skills.

5. Give lower priority to optional skills unless they are
   particularly relevant to the target role.

6. For each priority skill:
   - Explain its relevance to the role.
   - Suggest practical learning resources or topics.
   - Suggest an exercise or project.
   - Choose high, medium, or low priority.

7. Create a realistic learning roadmap with up to four phases.

8. Suggest improvements to the resume.

9. Suggest technical interview preparation topics.

10. Keep recommendations practical and encouraging.

IMPORTANT LIMITATIONS:

- A missing skill means the extraction system did not detect it.
  It does not prove that the candidate lacks the skill.
- Do not invent projects, achievements, work experience,
  certifications or qualifications.
- Do not invent additional skills.
- Do not change or recalculate numerical match scores.
- Do not predict hiring outcomes.
- Do not claim that a candidate is proficient merely because
  a technology appears in the resume.
- Distinguish mandatory, preferred and optional requirements.
- Return only valid JSON matching the required schema.
`;

  const response = await generateContentWithRetry(ai, {
    model: env.GEMINI_MODEL,

    contents: prompt,

    config: {
      temperature: 0.3,

      maxOutputTokens: 1800,

      responseMimeType: "application/json",

      responseJsonSchema: recommendationJsonSchema,
    },
  });

  if (!response.text) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  let parsedResponse;

  try {
    parsedResponse = JSON.parse(response.text);
  } catch {
    throw new Error("Gemini returned invalid JSON.");
  }

  return recommendationOutputSchema.parse(
    parsedResponse
  );
};