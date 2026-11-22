
import test from "node:test";
import assert from "node:assert/strict";

import { extractSkills } from "../src/services/skillExtractor.js";

const getSkillNames = (text) => {
  return extractSkills(text).map((skill) => skill.name);
};

test("extracts standard technology names", () => {
  const skills = getSkillNames(
    "Experienced in Python, React, Node.js and MongoDB."
  );

  assert.ok(skills.includes("Python"));
  assert.ok(skills.includes("React"));
  assert.ok(skills.includes("Node.js"));
  assert.ok(skills.includes("MongoDB"));
});

test("recognizes alternative skill names", () => {
  const skills = getSkillNames(
    "Worked with ReactJS, NodeJS, Mongo DB and PostgreSQL."
  );

  assert.ok(skills.includes("React"));
  assert.ok(skills.includes("Node.js"));
  assert.ok(skills.includes("MongoDB"));
  assert.ok(skills.includes("PostgreSQL"));
});

test("does not confuse Java with JavaScript", () => {
  const skills = getSkillNames(
    "Built applications using JavaScript."
  );

  assert.ok(skills.includes("JavaScript"));
  assert.ok(!skills.includes("Java"));
});

test("does not match SQL inside NoSQL", () => {
  const skills = getSkillNames(
    "Worked with NoSQL databases."
  );

  assert.ok(!skills.includes("SQL"));
});

test("recognizes punctuation-based languages", () => {
  const skills = getSkillNames(
    "Experience with C++ and C#."
  );

  assert.ok(skills.includes("C++"));
  assert.ok(skills.includes("C#"));
});

test("does not return duplicate skills", () => {
  const skills = getSkillNames(
    "Python, PYTHON, and Python programming."
  );

  assert.equal(
    skills.filter((skill) => skill === "Python").length,
    1
  );
});

test("returns an empty array for empty or invalid input", () => {
  assert.deepEqual(extractSkills(""), []);
  assert.deepEqual(extractSkills("   "), []);
  assert.deepEqual(extractSkills(null), []);
  assert.deepEqual(extractSkills(undefined), []);
});


test("does not interpret framework .js suffixes as JavaScript", () => {
  const skills = getSkillNames(
    "Built applications using React.js, Node.js and Next.js."
  );

  assert.ok(skills.includes("React"));
  assert.ok(skills.includes("Node.js"));
  assert.ok(skills.includes("Next.js"));

  assert.ok(!skills.includes("JavaScript"));
});

test("recognizes standalone JS abbreviation", () => {
  const skills = getSkillNames(
    "Frontend development experience with JS and React."
  );

  assert.ok(skills.includes("JavaScript"));
  assert.ok(skills.includes("React"));
});
