import {
  DEVBRIEF_SECTION_IDS,
  type DevBriefSection,
  type DevBriefSectionId,
} from '../../types/devbrief';

const SECTION_TITLES: Record<DevBriefSectionId, string> = {
  problem: 'Problem',
  'reproduction-steps': 'Reproduction Steps',
  context: 'Context',
  'expected-behavior': 'Expected Behavior',
  'current-behavior': 'Current Behavior',
  requirements: 'Requirements',
  'acceptance-criteria': 'Acceptance Criteria',
  'technical-considerations': 'Technical Considerations',
  'edge-cases': 'Edge Cases',
  'implementation-steps': 'Implementation Steps',
  'testing-checklist': 'Testing Checklist',
};

const EMPTY_SECTION_MESSAGES: Partial<Record<DevBriefSectionId, string[]>> = {
  'reproduction-steps': ['No reproduction steps were included in the issue.'],
  context: ['No environment or setup details were included in the issue.'],
  'expected-behavior': ['The desired outcome is not specified; clarify it before implementation.'],
  'current-behavior': ['The observed behavior is not specified; add steps or an example.'],
  requirements: ['Confirm the intended scope and constraints with the reporter.'],
  'technical-considerations': ['No implementation or system constraints were specified.'],
  'edge-cases': ['Identify relevant empty, invalid, and boundary inputs for this workflow.'],
  'implementation-steps': [
    'Reproduce the issue using the details provided.',
    'Implement the smallest change that satisfies the stated requirements.',
    'Verify the acceptance criteria and check for regressions.',
  ],
  'testing-checklist': [
    'Add or update a focused test for the reported behavior.',
    'Verify the expected behavior and relevant edge cases.',
    'Run the relevant project checks.',
  ],
};

const SECTION_ALIASES: Record<string, DevBriefSectionId> = {
  problem: 'problem',
  summary: 'problem',
  issue: 'problem',
  'steps to reproduce': 'reproduction-steps',
  'reproduction steps': 'reproduction-steps',
  'repro steps': 'reproduction-steps',
  'how to reproduce': 'reproduction-steps',
  'to reproduce': 'reproduction-steps',
  context: 'context',
  environment: 'context',
  expected: 'expected-behavior',
  'expected behavior': 'expected-behavior',
  current: 'current-behavior',
  'current behavior': 'current-behavior',
  'actual behavior': 'current-behavior',
  requirements: 'requirements',
  'acceptance criteria': 'acceptance-criteria',
  'technical considerations': 'technical-considerations',
  'edge cases': 'edge-cases',
  'implementation steps': 'implementation-steps',
  'testing checklist': 'testing-checklist',
  test: 'testing-checklist',
  tests: 'testing-checklist',
};

const HEADING_PATTERN =
  /^\s{0,3}(?:#{1,6}\s*)?(Problem|Summary|Issue|Steps to Reproduce|Reproduction Steps|Repro Steps|How to Reproduce|To Reproduce|Context|Environment|Expected(?: Behavior)?|Current(?: Behavior)?|Actual Behavior|Requirements|Acceptance Criteria|Technical Considerations|Edge Cases|Implementation Steps|Testing Checklist|Tests?)\s*(?:[:\-–—]\s*(.*))?\s*$/i;

const CATEGORY_PATTERNS: Partial<Record<DevBriefSectionId, RegExp>> = {
  'acceptance-criteria': /\bacceptance criteria\b|\bgiven\b.*\bwhen\b.*\bthen\b/i,
  'reproduction-steps': /\b(?:steps? to reproduce|reproduction steps?|repro steps?|how to reproduce|to reproduce)\b/i,
  context: /\b(browser|operating system|environment|version|on desktop|on mobile|using|reproduced with)\b/i,
  'expected-behavior': /\b(expected|should|want(?:s|ed)?|would like|desired|given .+ when .+ then)\b/i,
  'current-behavior': /\b(currently|actual(?:ly)?|instead|observed|happens|doesn't|does not|fails?|broken|not working|error|wrong)\b/i,
  requirements: /\b(requirements?|must|needs? to|need to|support|ensure|allow|should not)\b/i,
  'technical-considerations': /\b(api|database|schema|endpoint|performance|cache|permission|authentication|authorization|dependency|package|server|client|responsive|keyboard|screen reader)\b/i,
  'edge-cases': /\bedge case\b|\b(empty|null|undefined|missing|invalid|malformed|duplicate|boundary|offline|timeout|not found)\b/i,
  'implementation-steps': /\b(implementation step|next step|first,|then,|finally,)\b/i,
  'testing-checklist': /\b(tests?|assert|verify|regression|coverage|test checklist)\b/i,
};

function cleanLine(line: string): string {
  return line
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '')
    .replace(/^\s*>\s?/, '')
    .trim();
}

function addUnique(items: string[], value: string): void {
  const cleaned = cleanLine(value);
  if (cleaned && !items.some((item) => item.toLocaleLowerCase() === cleaned.toLocaleLowerCase())) {
    items.push(cleaned);
  }
}

function firstSentence(value: string): string {
  const match = value.match(/^(.+?[.!?])(?:\s|$)/);
  return (match?.[1] ?? value).trim();
}

function getExplicitSections(issue: string): Map<DevBriefSectionId, string[]> {
  const sections = new Map<DevBriefSectionId, string[]>();
  let activeSection: DevBriefSectionId | null = null;

  for (const rawLine of issue.split(/\r?\n/)) {
    const heading = rawLine.match(HEADING_PATTERN);
    if (heading) {
      const label = heading[1].toLocaleLowerCase().replace(/\s+/g, ' ');
      activeSection = SECTION_ALIASES[label] ?? null;
      if (activeSection) {
        const values = sections.get(activeSection) ?? [];
        sections.set(activeSection, values);
        if (heading[2]) addUnique(values, heading[2]);
      }
      continue;
    }

    const line = cleanLine(rawLine);
    if (activeSection && line) {
      const values = sections.get(activeSection) ?? [];
      addUnique(values, line);
      sections.set(activeSection, values);
    }
  }

  return sections;
}

function getInferredSections(issue: string): Map<DevBriefSectionId, string[]> {
  const sections = new Map<DevBriefSectionId, string[]>();
  for (const rawLine of issue.split(/\r?\n/)) {
    const line = cleanLine(rawLine);
    if (!line || HEADING_PATTERN.test(rawLine)) continue;

    for (const [sectionId, pattern] of Object.entries(CATEGORY_PATTERNS) as [
      DevBriefSectionId,
      RegExp,
    ][]) {
      if (pattern.test(line)) {
        const values = sections.get(sectionId) ?? [];
        addUnique(values, line);
        sections.set(sectionId, values);
        break;
      }
    }
  }
  return sections;
}

function combineSections(
  explicit: Map<DevBriefSectionId, string[]>,
  inferred: Map<DevBriefSectionId, string[]>,
): Map<DevBriefSectionId, string[]> {
  const combined = new Map<DevBriefSectionId, string[]>();
  for (const sectionId of DEVBRIEF_SECTION_IDS) {
    const values: string[] = [];
    for (const item of explicit.get(sectionId) ?? []) addUnique(values, item);
    for (const item of inferred.get(sectionId) ?? []) addUnique(values, item);
    combined.set(sectionId, values);
  }
  return combined;
}

function getProblem(issue: string, sections: Map<DevBriefSectionId, string[]>): string[] {
  const explicitProblem = sections.get('problem') ?? [];
  if (explicitProblem.length > 0) return explicitProblem;

  const firstLine = issue
    .split(/\r?\n/)
    .filter((line) => !HEADING_PATTERN.test(line))
    .map(cleanLine)
    .find(Boolean);
  return firstLine ? [firstSentence(firstLine)] : [];
}

function getAcceptanceCriteria(
  sections: Map<DevBriefSectionId, string[]>,
): string[] {
  const explicit = sections.get('acceptance-criteria') ?? [];
  if (explicit.length > 0) return explicit;

  const expected = sections.get('expected-behavior') ?? [];
  if (expected.length > 0) {
    return [
      `The expected outcome is observable: ${expected[0]}`,
      'Existing behavior outside the reported issue remains unchanged.',
    ];
  }

  return [
    'The reported issue can be reproduced before the change and no longer occurs afterward.',
    'Relevant existing behavior remains unchanged.',
  ];
}

export function parseIssueToSections(issue: string): DevBriefSection[] {
  const explicit = getExplicitSections(issue);
  const inferred = getInferredSections(issue);
  const sections = combineSections(explicit, inferred);
  sections.set('problem', getProblem(issue, sections));
  sections.set('acceptance-criteria', getAcceptanceCriteria(sections));

  return DEVBRIEF_SECTION_IDS.map((id) => {
    const items = sections.get(id) ?? [];
    return {
      id,
      title: SECTION_TITLES[id],
      items: items.length > 0 ? items : EMPTY_SECTION_MESSAGES[id] ?? [],
    };
  });
}

export function createBriefTitle(problem: string): string {
  const title = firstSentence(problem).replace(/[.!?]+$/, '');
  if (title.length <= 72) return title;
  return `${title.slice(0, 69).trimEnd()}...`;
}
