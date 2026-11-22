
import test from "node:test";
import assert from "node:assert/strict";

import {
  extractSkillsWithEvidence,
} from "../src/services/skillExtractor.js";

import {
  analyzeJobDescription,
} from "../src/services/jobDescriptionAnalyzer.js";

import {
  compareResumeToJob,
} from "../src/services/resumeComparison.js";

// --------------------------------------------------
// CONTEXT-AWARE SKILL EXTRACTION
// --------------------------------------------------

test("recognizes skills listed in the technical skills section", () => {
  const result = extractSkillsWithEvidence(
    [
      "TECHNICAL SKILLS",
      "Python",
      "React",
      "Artificial Intelligence",
      "Machine Learning",
    ].join("\n")
  );

  const names = result.map((skill) => skill.name);

  assert.ok(names.includes("Python"));
  assert.ok(names.includes("React"));
  assert.ok(names.includes("Artificial Intelligence"));
  assert.ok(names.includes("Machine Learning"));
});

test("does not classify ordinary react verb usage as React.js", () => {
  const result = extractSkillsWithEvidence(
    "I react to customer feedback and communicate clearly."
  );

  assert.ok(
    !result.some((skill) => skill.name === "React")
  );
});

test("does not recognize AI as a technical skill in ordinary prose", () => {
  const result = extractSkillsWithEvidence(
    "AI is changing many industries around the world."
  );

  assert.ok(
    !result.some(
      (skill) => skill.name === "Artificial Intelligence"
    )
  );
});

test("recognizes AI when used in a technical skills section", () => {
  const result = extractSkillsWithEvidence(
    "TECHNICAL SKILLS\nAI"
  );

  assert.ok(
    result.some(
      (skill) => skill.name === "Artificial Intelligence"
    )
  );
});

test("stores evidence and source section for detected skills", () => {
  const result = extractSkillsWithEvidence(
    [
      "PROJECTS",
      "Resume Analyzer",
      "Developed an analyzer using Python and React.",
    ].join("\n")
  );

  const python = result.find(
    (skill) => skill.name === "Python"
  );

  assert.ok(python);
  assert.equal(python.evidence[0].section, "projects");
  assert.equal(python.evidence[0].evidenceType, "project");
  assert.ok(python.evidence[0].snippet.includes("Python"));
  assert.equal(python.evidenceConfidence, "strong");
});

test("redacts email addresses and phone numbers from evidence", () => {
  const result = extractSkillsWithEvidence(
    [
      "TECHNICAL SKILLS",
      "Python developer, contact: candidate@example.com, 9876543210",
    ].join("\n")
  );

  const python = result.find(
    (skill) => skill.name === "Python"
  );

  assert.ok(python);

  const snippet = python.evidence[0].snippet;

  assert.ok(!snippet.includes("candidate@example.com"));
  assert.ok(!snippet.includes("9876543210"));
});

// --------------------------------------------------
// JOB REQUIREMENT CLASSIFICATION
// --------------------------------------------------

test("classifies mandatory, preferred and optional skills", () => {
  const result = analyzeJobDescription(
    [
      "Required Skills:",
      "Python, React and Node.js",
      "Preferred Skills:",
      "Docker",
      "Optional:",
      "AWS",
    ].join("\n")
  );

  const requirements = Object.fromEntries(
    result.requiredSkills.map((skill) => [
      skill.name,
      skill,
    ])
  );

  assert.equal(requirements.Python.requirementLevel, "required");
  assert.equal(requirements.React.requirementLevel, "required");
  assert.equal(requirements["Node.js"].requirementLevel, "required");
  assert.equal(requirements.Docker.requirementLevel, "preferred");
  assert.equal(requirements.AWS.requirementLevel, "optional");

  assert.equal(requirements.Python.weight, 3);
  assert.equal(requirements.Docker.weight, 2);
  assert.equal(requirements.AWS.weight, 1);
});

test("marks unclassified requirements as default classifications", () => {
  const result = analyzeJobDescription(
    "We need Python, React and Node.js experience."
  );

  assert.ok(
    result.requiredSkills.every(
      (skill) => skill.requirementLevel === "required"
    )
  );

  assert.ok(
    result.requiredSkills.every(
      (skill) => skill.classificationSource === "default"
    )
  );
});

// --------------------------------------------------
// WEIGHTED COMPARISON
// --------------------------------------------------

test("preserves basic score and calculates weighted coverage", () => {
  const result = compareResumeToJob({
    resumeText: "Python, React and Docker.",

    jobDescription: [
      "Required Skills:",
      "Python, React and Node.js",
      "Preferred Skills:",
      "Docker",
      "Optional:",
      "AWS",
    ].join("\n"),
  });

  assert.equal(result.skillMatchScore, 60);

  assert.equal(result.weightedSkillMatchScore, 67);

  assert.equal(result.mandatorySkillCoverage, 67);

  assert.equal(result.scoreModelVersion, "2.0");
});

test("returns correct mandatory requirement breakdown", () => {
  const result = compareResumeToJob({
    resumeText: "Python, React and Docker.",

    jobDescription: [
      "Required Skills:",
      "Python, React and Node.js",
      "Preferred Skills:",
      "Docker",
      "Optional:",
      "AWS",
    ].join("\n"),
  });

  assert.deepEqual(
    result.requirementBreakdown.required,
    {
      total: 3,
      matched: 2,
      missing: 1,
    }
  );

  assert.deepEqual(
    result.requirementBreakdown.preferred,
    {
      total: 1,
      matched: 1,
      missing: 0,
    }
  );

  assert.deepEqual(
    result.requirementBreakdown.optional,
    {
      total: 1,
      matched: 0,
      missing: 1,
    }
  );
});

test("keeps evidence attached to matched skills", () => {
  const result = compareResumeToJob({
    resumeText: [
      "PROJECTS",
      "Built an application using Python and React.",
    ].join("\n"),

    jobDescription: "Required: Python and React developers.",
  });

  assert.equal(result.matchedSkills.length, 2);

  const python = result.matchedSkills.find(
    (skill) => skill.name === "Python"
  );

  assert.ok(python.evidence.length > 0);
  assert.ok(
    python.evidence[0].snippet.includes("Python")
  );
});

test("preserves existing additional skill identification", () => {
  const result = compareResumeToJob({
    resumeText: "Python, React and PostgreSQL.",

    jobDescription: "Required: Python and React.",
  });

  assert.deepEqual(
    result.additionalSkills.map((skill) => skill.name),
    ["PostgreSQL"]
  );
});

test("does not confuse Java with JavaScript", () => {
  const result = extractSkillsWithEvidence(
    "TECHNICAL SKILLS\nJavaScript"
  );

  const names = result.map((skill) => skill.name);

  assert.ok(names.includes("JavaScript"));
  assert.ok(!names.includes("Java"));
});

test("rejects comparison when no job description skills are recognized", () => {
  assert.throws(
    () =>
      compareResumeToJob({
        resumeText: "Python developer.",
        jobDescription:
          "We need a motivated and hardworking professional.",
      }),
    /No recognized skills/
  );
});