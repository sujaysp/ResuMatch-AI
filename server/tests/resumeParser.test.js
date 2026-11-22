
import test from "node:test";
import assert from "node:assert/strict";

import {
  reconstructPageText,
} from "../src/services/resumeParser.js";

test("reconstructs words on the same visual line", () => {
  const items = [
    {
      str: "Python",
      transform: [1, 0, 0, 10, 40, 700],
      width: 30,
    },
    {
      str: "JavaScript",
      transform: [1, 0, 0, 10, 78, 700],
      width: 50,
    },
    {
      str: "React",
      transform: [1, 0, 0, 10, 135, 700],
      width: 25,
    },
  ];

  assert.equal(
    reconstructPageText(items),
    "Python JavaScript React"
  );
});

test("preserves separate visual lines", () => {
  const items = [
    {
      str: "TECHNICAL SKILLS",
      transform: [1, 0, 0, 12, 40, 750],
      width: 110,
    },
    {
      str: "Python, React and Node.js",
      transform: [1, 0, 0, 10, 40, 725],
      width: 145,
    },
  ];

  assert.equal(
    reconstructPageText(items),
    "TECHNICAL SKILLS\nPython, React and Node.js"
  );
});

test("preserves large horizontal column gaps", () => {
  const items = [
    {
      str: "Python",
      transform: [1, 0, 0, 10, 40, 700],
      width: 30,
    },
    {
      str: "Education",
      transform: [1, 0, 0, 10, 250, 700],
      width: 60,
    },
  ];

  assert.equal(
    reconstructPageText(items),
    "Python | Education"
  );
});

test("uses fallback reconstruction without coordinates", () => {
  const items = [
    { str: "Python" },
    { str: "Developer", hasEOL: true },
    { str: "React" },
  ];

  assert.equal(
    reconstructPageText(items),
    "Python Developer\nReact"
  );
});

test("ignores non-text PDF content items", () => {
  const items = [
    {
      str: "Python",
      transform: [1, 0, 0, 10, 40, 700],
      width: 30,
    },
    {
      type: "beginMarkedContent",
    },
  ];

  assert.equal(
    reconstructPageText(items),
    "Python"
  );
});

test("returns an empty string for documents without readable text", () => {
  assert.equal(
    reconstructPageText([]),
    ""
  );

  assert.equal(
    reconstructPageText([
      { type: "beginMarkedContent" },
    ]),
    ""
  );
});