
import {
  extractSkillsWithEvidence,
} from "./skillExtractor.js";

import {
  analyzeJobDescription,
} from "./jobDescriptionAnalyzer.js";

const roundPercentage = (numerator, denominator) => {
  if (denominator === 0) return 0;

  return Math.round(
    (numerator / denominator) * 100
  );
};

// Compare candidate resume evidence against job requirements.
export const compareResumeToJob = ({
  resumeText,
  jobDescription,
}) => {
  if (
    typeof resumeText !== "string" ||
    !resumeText.trim()
  ) {
    throw new TypeError("Resume text is required.");
  }

  const candidateSkills =
    extractSkillsWithEvidence(resumeText);

  const jobAnalysis =
    analyzeJobDescription(jobDescription);

  const requiredSkills = jobAnalysis.requiredSkills;

  if (requiredSkills.length === 0) {
    throw new Error(
      "No recognized skills were found in the job description. Add more specific technical requirements."
    );
  }

  const candidateSkillMap = new Map(
    candidateSkills.map((skill) => [
      skill.name,
      skill,
    ])
  );

  const requiredSkillNames = new Set(
    requiredSkills.map((skill) => skill.name)
  );

  // Skills present in both the resume and job description.
  const matchedSkills = [];

  // Required skills not detected in the resume.
  const missingSkills = [];

  for (const requirement of requiredSkills) {
    const candidateSkill = candidateSkillMap.get(
      requirement.name
    );

    const baseSkill = {
      name: requirement.name,
      category: requirement.category,
      requirementLevel: requirement.requirementLevel,
      weight: requirement.weight,
      classificationSource: requirement.classificationSource,
      requirementEvidence: requirement.evidence,
    };

    if (candidateSkill) {
      matchedSkills.push({
        ...baseSkill,

        evidence: candidateSkill.evidence,

        evidenceConfidence:
          candidateSkill.evidenceConfidence,

        matchedAlias: candidateSkill.matchedAlias,
      });
    } else {
      missingSkills.push(baseSkill);
    }
  }

  // Resume skills not detected in the job requirements.
  const additionalSkills = candidateSkills
    .filter((skill) => !requiredSkillNames.has(skill.name))
    .map((skill) => ({
      name: skill.name,
      category: skill.category,
      evidence: skill.evidence,
      evidenceConfidence: skill.evidenceConfidence,
      matchedAlias: skill.matchedAlias,
    }));

  // Maintain the original equal-weight coverage score.
  const totalRequiredSkills = requiredSkills.length;
  const matchedRequiredSkills = matchedSkills.length;

  const skillMatchScore = roundPercentage(
    matchedRequiredSkills,
    totalRequiredSkills
  );

  // Calculate weighted coverage.
  const totalWeight = requiredSkills.reduce(
    (sum, skill) => sum + skill.weight,
    0
  );

  const matchedWeight = matchedSkills.reduce(
    (sum, skill) => sum + skill.weight,
    0
  );

  const weightedSkillMatchScore = roundPercentage(
    matchedWeight,
    totalWeight
  );

  // Calculate mandatory-only coverage.
  const mandatorySkills = requiredSkills.filter(
    (skill) => skill.requirementLevel === "required"
  );

  const matchedMandatorySkills = matchedSkills.filter(
    (skill) => skill.requirementLevel === "required"
  );

  const mandatorySkillCoverage =
    mandatorySkills.length > 0
      ? roundPercentage(
          matchedMandatorySkills.length,
          mandatorySkills.length
        )
      : null;

  // Calculate match/missing counts for each requirement category.
  const requirementBreakdown = {
    required: {
      total: mandatorySkills.length,
      matched: matchedMandatorySkills.length,
      missing:
        mandatorySkills.length -
        matchedMandatorySkills.length,
    },

    preferred: {
      total: requiredSkills.filter(
        (skill) => skill.requirementLevel === "preferred"
      ).length,

      matched: matchedSkills.filter(
        (skill) => skill.requirementLevel === "preferred"
      ).length,

      missing: missingSkills.filter(
        (skill) => skill.requirementLevel === "preferred"
      ).length,
    },

    optional: {
      total: requiredSkills.filter(
        (skill) => skill.requirementLevel === "optional"
      ).length,

      matched: matchedSkills.filter(
        (skill) => skill.requirementLevel === "optional"
      ).length,

      missing: missingSkills.filter(
        (skill) => skill.requirementLevel === "optional"
      ).length,
    },
  };

  return {
    // Original score retained for compatibility.
    skillMatchScore,

    // New scoring metrics.
    weightedSkillMatchScore,

    mandatorySkillCoverage,

    // Detailed numerical explanation.
    scoreBreakdown: {
      matchedRequiredSkills,
      totalRequiredSkills,
      missingRequiredSkills: missingSkills.length,

      formula:
        "Matched recognized requirements / Total recognized requirements × 100",

      matchedWeight,
      totalWeight,
    },

    requirementBreakdown,

    matchedSkills,
    missingSkills,
    additionalSkills,

    candidateSkillCount: candidateSkills.length,
    requiredSkillCount: totalRequiredSkills,

    scoreModelVersion: "2.0",

    note:
      "Scores measure recognized skill overlap. Weighted coverage gives greater importance to explicitly classified mandatory requirements. Missing skills mean they were not detected in the resume, not that the candidate necessarily lacks them. This is not an official ATS score or a prediction of hiring outcomes.",
  };
};