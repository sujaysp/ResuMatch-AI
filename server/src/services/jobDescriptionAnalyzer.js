
import {
  extractSkillsWithEvidence,
} from "./skillExtractor.js";

const REQUIREMENT_WEIGHTS = {
  required: 3,
  preferred: 2,
  optional: 1,
};

const REQUIREMENT_PATTERNS = [
  {
    level: "optional",
    pattern: /\boptional\b/i,
  },
  {
    level: "preferred",
    pattern:
      /\bpreferred\b|\bnice[- ]to[- ]have\b|\bgood to have\b|\bdesirable\b|\bbonus\b/i,
  },
  {
    level: "required",
    pattern:
      /\brequired\b|\bmust[- ]have\b|\bmandatory\b|\bessential\b|\bminimum qualifications\b|\bbasic qualifications\b|\bwhat you'll need\b/i,
  },
];

const classifyRequirement = (line) => {
  for (const rule of REQUIREMENT_PATTERNS) {
    if (rule.pattern.test(line)) {
      return {
        level: rule.level,
        source: "explicit",
      };
    }
  }

  return null;
};

export const analyzeJobDescription = (jobDescription) => {
  if (
    typeof jobDescription !== "string" ||
    !jobDescription.trim()
  ) {
    throw new TypeError("Job description is required.");
  }

  const lines = jobDescription
    .replace(/\r\n?/g, "\n")
    .split("\n");

  const lineContexts = new Map();

  // Default to required for backward compatibility.
  let currentLevel = "required";
  let currentSource = "default";

  lines.forEach((line, index) => {
    const classification = classifyRequirement(line);

    if (classification) {
      currentLevel = classification.level;
      currentSource = classification.source;
    }

    lineContexts.set(index + 1, {
      level: currentLevel,
      source: currentSource,
    });
  });

  const extractedSkills =
    extractSkillsWithEvidence(jobDescription);

  const requiredSkills = extractedSkills.map((skill) => {
    const classifiedEvidence = skill.evidence.map((item) => {
      const context = lineContexts.get(item.lineNumber) || {
        level: "required",
        source: "default",
      };

      return {
        snippet: item.snippet,
        lineNumber: item.lineNumber,
        requirementLevel: context.level,
        classificationSource: context.source,
      };
    });

    // If a skill appears in multiple categories, retain
    // its highest-priority requirement classification.
    const bestEvidence = [...classifiedEvidence].sort(
      (a, b) =>
        REQUIREMENT_WEIGHTS[b.requirementLevel] -
        REQUIREMENT_WEIGHTS[a.requirementLevel]
    )[0];

    const requirementLevel =
      bestEvidence?.requirementLevel || "required";

    return {
      name: skill.name,
      category: skill.category,

      requirementLevel,

      weight: REQUIREMENT_WEIGHTS[requirementLevel],

      classificationSource:
        bestEvidence?.classificationSource || "default",

      evidence: classifiedEvidence,
    };
  });

  const requirementBreakdown = {
    required: {
      total: 0,
      matched: 0,
      missing: 0,
    },

    preferred: {
      total: 0,
      matched: 0,
      missing: 0,
    },

    optional: {
      total: 0,
      matched: 0,
      missing: 0,
    },
  };

  for (const skill of requiredSkills) {
    requirementBreakdown[skill.requirementLevel].total++;
  }

  return {
    requiredSkills,

    requiredSkillCount: requiredSkills.length,

    mandatorySkillCount:
      requirementBreakdown.required.total,

    requirementBreakdown,
  };
};