
import test from "node:test";
import assert from "node:assert/strict";

import { analyzeJobDescription } from "../src/services/jobDescriptionAnalyzer.js";
import { compareResumeToJob } from "../src/services/resumeComparison.js";

test("extracts required skills from a job description", () => {
  const result = analyzeJobDescription(
    "We need Python, React.js, NodeJS and MongoDB experience."
  );

  const names = result.requiredSkills.map((skill) => skill.name);

  assert.deepEqual(names, [
    "Python",
    "React",
    "Node.js",
    "MongoDB",
  ]);

  assert.equal(result.requiredSkillCount, 4);
});

test("calculates a 75 percent skill match correctly", () => {
  const result = compareResumeToJob({
    resumeText: "Python, React, Node.js and PostgreSQL.",
    jobDescription: "Required: Python, React, Node.js and MongoDB.",
  });

  assert.equal(result.skillMatchScore, 75);
  assert.equal(result.scoreBreakdown.matchedRequiredSkills, 3);
  assert.equal(result.scoreBreakdown.totalRequiredSkills, 4);
  assert.equal(result.scoreBreakdown.missingRequiredSkills, 1);
});

test("identifies matched, missing and additional skills", () => {
  const result = compareResumeToJob({
    resumeText: "Python, React and PostgreSQL.",
    jobDescription: "Required: Python, React and MongoDB.",
  });

  assert.deepEqual(
    result.matchedSkills.map((skill) => skill.name),
    ["Python", "React"]
  );

  assert.deepEqual(
    result.missingSkills.map((skill) => skill.name),
    ["MongoDB"]
  );

  assert.deepEqual(
    result.additionalSkills.map((skill) => skill.name),
    ["PostgreSQL"]
  );
});

test("calculates a 100 percent match when all required skills are present", () => {
  const result = compareResumeToJob({
    resumeText: "Experienced in Python and React.",
    jobDescription: "Looking for Python and React developers.",
  });

  assert.equal(result.skillMatchScore, 100);
  assert.equal(result.missingSkills.length, 0);
});

test("calculates a zero percent match when no required skills are present", () => {
  const result = compareResumeToJob({
    resumeText: "Experienced in Java.",
    jobDescription: "Looking for Python developers.",
  });

  assert.equal(result.skillMatchScore, 0);
  assert.equal(result.matchedSkills.length, 0);
  assert.equal(result.missingSkills.length, 1);
});

test("rejects an empty resume", () => {
  assert.throws(
    () =>
      compareResumeToJob({
        resumeText: "   ",
        jobDescription: "Python developer required.",
      }),
    /Resume text is required/
  );
});

test("rejects a job description without recognized skills", () => {
  assert.throws(
    () =>
      compareResumeToJob({
        resumeText: "Python developer.",
        jobDescription: "We need a motivated and hardworking person.",
      }),
    /No recognized skills/
  );
});

test("rejects an empty job description", () => {
  assert.throws(
    () =>
      analyzeJobDescription(""),
    /Job description is required/
  );
});
