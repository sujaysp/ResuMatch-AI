
import { SKILL_CATALOG } from "../data/skillCatalog.js";

const MAX_EVIDENCE_PER_SKILL = 3;
const MAX_EVIDENCE_LENGTH = 240;

// Some aliases are ambiguous in ordinary English.
const AMBIGUOUS_ALIASES = {
  React: ["react"],
  "Artificial Intelligence": ["ai"],
  "Machine Learning": ["ml"],
};

const SECTION_PATTERNS = [
  {
    section: "skills",
    pattern:
      /^(?:technical skills|skills|core skills|core competencies|key skills|technical proficiencies|tools and technologies|technologies|required skills|preferred skills|optional skills|requirements|qualifications)$/i,
  },
  {
    section: "experience",
    pattern:
      /^(?:experience|work experience|professional experience|employment history|work history)$/i,
  },
  {
    section: "projects",
    pattern:
      /^(?:projects|personal projects|academic projects|project experience)$/i,
  },
  {
    section: "education",
    pattern:
      /^(?:education|academic background|educational qualifications)$/i,
  },
  {
    section: "certifications",
    pattern:
      /^(?:certifications|certificates|professional certifications|licenses)$/i,
  },
  {
    section: "summary",
    pattern:
      /^(?:summary|professional summary|profile|career objective|about me)$/i,
  },
];

const TECH_CONTEXT_REGEX =
  /\b(?:using|used|built|developed|implemented|created|designed|worked with|experience with|experienced in|proficient in|expertise in|knowledge of|familiar with|tech stack|technology|technologies|framework|library|programming|developer|engineer|application|project|stack|tool|tools|language|skills?)\b/i;

const LIST_CONTEXT_REGEX =
  /[,;|/•]|\b(?:and|or)\b/i;

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Find a resume section from a heading.
const detectSectionHeading = (line) => {
  const cleaned = line
    .trim()
    .replace(/^[•\-*]\s*/, "");

  const candidates = [cleaned];

  if (cleaned.includes(":")) {
    candidates.push(cleaned.split(":")[0]);
  }

  for (const candidate of candidates) {
    const normalized = candidate
      .replace(/[|·•]+/g, "")
      .replace(/:$/, "")
      .trim()
      .replace(/\s+/g, " ");

    const match = SECTION_PATTERNS.find(({ pattern }) =>
      pattern.test(normalized)
    );

    if (match) {
      return match.section;
    }
  }

  return null;
};

// Create a whole-word alias matcher.
const createAliasRegex = (alias) => {
  const normalizedAlias = alias.trim().toLowerCase();

  const escapedAlias = alias
    .trim()
    .split(/\s+/)
    .map(escapeRegex)
    .join("\\s+");

  // Do not interpret the JS in React.js or Node.js as
  // a standalone JavaScript abbreviation.
  const precedingBoundary = ["js", "ts"].includes(normalizedAlias)
    ? "(^|[^a-z0-9.])"
    : "(^|[^a-z0-9])";

  return new RegExp(
    `${precedingBoundary}(${escapedAlias})(?=$|[^a-z0-9])`,
    "i"
  );
};

// Avoid storing obvious personal contact information in evidence.
const sanitizeEvidence = (value) => {
  return value
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[email]"
    )
    .replace(
      /\+?\d[\d\s().-]{8,}\d/g,
      "[phone]"
    )
    .replace(/https?:\/\/\S+/gi, "[link]")
    .replace(/\s+/g, " ")
    .trim();
};

const isAmbiguousAlias = (skillName, alias) => {
  return (
    AMBIGUOUS_ALIASES[skillName]?.includes(
      alias.trim().toLowerCase()
    ) ?? false
  );
};

const getEvidenceConfidence = (section) => {
  if (
    section === "skills" ||
    section === "projects" ||
    section === "experience"
  ) {
    return "strong";
  }

  if (
    section === "certifications" ||
    section === "education" ||
    section === "summary"
  ) {
    return "moderate";
  }

  return "limited";
};

const getEvidenceType = (section) => {
  const mapping = {
    skills: "skills_section",
    projects: "project",
    experience: "experience",
    education: "education",
    certifications: "certification",
    summary: "summary",
  };

  return mapping[section] || "other";
};

const getSkillMatchesForLine = (line) => {
  const matches = [];

  for (const skill of SKILL_CATALOG) {
    let matchFound = null;

    for (const alias of skill.aliases) {
      const regex = createAliasRegex(alias);
      const match = regex.exec(line);

      if (!match) continue;

      const aliasStart =
        match.index + match[1].length;

      const aliasEnd =
        aliasStart + match[2].length;

      const trailingText = line.slice(aliasEnd);

      // Avoid interpreting ordinary verb usage as the React framework.
      if (
        skill.name === "React" &&
        /^\s+(?:to|quickly|positively|immediately|strongly)\b/i.test(
          trailingText
        )
      ) {
        continue;
      }

      matchFound = {
        name: skill.name,
        category: skill.category,
        matchedAlias: alias,
        aliasStart,
        aliasEnd,
      };

      break;
    }

    if (matchFound) {
      matches.push(matchFound);
    }
  }

  return matches;
};

const createEvidenceSnippet = (line, aliasStart, aliasEnd) => {
  let snippet = line;

  if (snippet.length > MAX_EVIDENCE_LENGTH) {
    const start = Math.max(0, aliasStart - 90);
    const end = Math.min(
      line.length,
      aliasEnd + 90
    );

    snippet =
      (start > 0 ? "..." : "") +
      line.slice(start, end) +
      (end < line.length ? "..." : "");
  }

  return sanitizeEvidence(snippet);
};

const getBestConfidence = (evidence) => {
  const levels = {
    strong: 3,
    moderate: 2,
    limited: 1,
  };

  return evidence.reduce(
    (best, item) =>
      levels[item.confidence] > levels[best]
        ? item.confidence
        : best,
    "limited"
  );
};

// Extract standardized skills with supporting evidence.
export const extractSkillsWithEvidence = (text) => {
  if (typeof text !== "string" || !text.trim()) {
    return [];
  }

  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n");

  const detectedSkills = new Map();

  let currentSection = "other";

  lines.forEach((originalLine, index) => {
    const line = originalLine.trim();

    if (!line) return;

    const detectedSection = detectSectionHeading(line);

    if (detectedSection) {
      currentSection = detectedSection;
    }

    const matches = getSkillMatchesForLine(line);

    const hasTechnologyListContext =
      matches.length >= 2 &&
      LIST_CONTEXT_REGEX.test(line);

    for (const match of matches) {
      const ambiguous = isAmbiguousAlias(
        match.name,
        match.matchedAlias
      );

      const nearbyStart = Math.max(
        0,
        match.aliasStart - 45
      );

      const nearbyEnd = Math.min(
        line.length,
        match.aliasEnd + 45
      );

      const nearbyText = line.slice(
        nearbyStart,
        nearbyEnd
      );

      const hasTechnicalContext =
        TECH_CONTEXT_REGEX.test(nearbyText);

      if (
        ambiguous &&
        currentSection !== "skills" &&
        !hasTechnicalContext &&
        !hasTechnologyListContext
      ) {
        continue;
      }

      const evidence = {
        snippet: createEvidenceSnippet(
          line,
          match.aliasStart,
          match.aliasEnd
        ),

        section: currentSection,

        evidenceType: getEvidenceType(currentSection),

        confidence: getEvidenceConfidence(currentSection),

        lineNumber: index + 1,
      };

      const existing = detectedSkills.get(match.name);

      if (!existing) {
        detectedSkills.set(match.name, {
          name: match.name,
          category: match.category,
          matchedAlias: match.matchedAlias,
          evidence: [evidence],
        });

        continue;
      }

      const duplicate = existing.evidence.some(
        (item) => item.snippet === evidence.snippet
      );

      if (
        !duplicate &&
        existing.evidence.length < MAX_EVIDENCE_PER_SKILL
      ) {
        existing.evidence.push(evidence);
      }
    }
  });

  return Array.from(detectedSkills.values()).map((skill) => ({
    ...skill,
    evidenceConfidence: getBestConfidence(skill.evidence),
  }));
};

// Backward-compatible skill extraction.
// Existing services and tests can continue using extractSkills().
export const extractSkills = (text) => {
  return extractSkillsWithEvidence(text).map(
    ({ name, category, matchedAlias }) => ({
      name,
      category,
      matchedAlias,
    })
  );
};
