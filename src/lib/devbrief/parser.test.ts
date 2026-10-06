import { describe, expect, it } from 'vitest';
import {
  briefToMarkdown,
  createMarkdownFilename,
  sectionToMarkdown,
} from './markdown';
import { createBriefTitle, parseIssueToSections } from './parser';

function sectionItems(
  sections: ReturnType<typeof parseIssueToSections>,
  id: string,
): string[] {
  const section = sections.find((candidate) => candidate.id === id);
  if (!section) throw new Error(`Missing section: ${id}`);
  return section.items;
}

describe('parseIssueToSections', () => {
  it.each([
    ['A save issue', 'a-save-issue.md'],
    ['Résumé test', 'résumé-test.md'],
    ['遊びの名前', '遊びの名前.md'],
    ['!!!', 'devbrief.md'],
  ])('creates a safe descriptive filename for %s', (title, filename) => {
    expect(createMarkdownFilename(title)).toBe(filename);
  });

  it('returns all eleven sections in a stable order for a concise issue', () => {
    const sections = parseIssueToSections('The save button never finishes loading.');

    expect(sections.map(({ title }) => title)).toEqual([
      'Problem',
      'Reproduction Steps',
      'Context',
      'Expected Behavior',
      'Current Behavior',
      'Requirements',
      'Acceptance Criteria',
      'Technical Considerations',
      'Edge Cases',
      'Implementation Steps',
      'Testing Checklist',
    ]);
    expect(sectionItems(sections, 'problem')).toEqual([
      'The save button never finishes loading.',
    ]);
    expect(sectionItems(sections, 'expected-behavior')).toContain(
      'The desired outcome is not specified; clarify it before implementation.',
    );
  });

  it.each([
    ['Steps to Reproduce', 'Open the account settings.', 'Click Save.'],
    ['Reproduction Steps', 'Open the account settings.', 'Click Save.'],
    ['How to Reproduce', 'Open the account settings.', 'Click Save.'],
  ])('preserves numbered steps under the %s heading', (heading, firstStep, secondStep) => {
    const sections = parseIssueToSections(
      `## Problem
Saving a profile shows an error.

### ${heading}
1. ${firstStep}
2. ${secondStep}`,
    );

    expect(sectionItems(sections, 'reproduction-steps')).toEqual([
      firstStep,
      secondStep,
    ]);
  });

  it('preserves explicitly labeled multiline sections and infers unlabeled details', () => {
    const sections = parseIssueToSections(
      `## Problem
Search results disappear when I navigate back.

## Expected Behavior
The selected filter should remain active.

Context: Chrome on desktop.
Current behavior: the full list is shown instead.`,
    );

    expect(sectionItems(sections, 'problem')).toEqual([
      'Search results disappear when I navigate back.',
    ]);
    expect(sectionItems(sections, 'expected-behavior')).toContain(
      'The selected filter should remain active.',
    );
    expect(sectionItems(sections, 'context')).toContain('Chrome on desktop.');
    expect(sectionItems(sections, 'current-behavior')).toContain(
      'the full list is shown instead.',
    );
  });

  it('maps a Description heading to the problem section', () => {
    const sections = parseIssueToSections(
      `## Description
Saving a profile shows an error.
The error occurs after choosing an avatar.`,
    );

    expect(sectionItems(sections, 'problem')).toEqual([
      'Saving a profile shows an error.',
      'The error occurs after choosing an avatar.',
    ]);
  });

  it('does not duplicate facts that are both explicitly labeled and inferable', () => {
    const sections = parseIssueToSections(
      '## Requirements\nThe API must reject empty names.',
    );

    expect(sectionItems(sections, 'requirements')).toEqual([
      'The API must reject empty names.',
    ]);
  });

  it('recognizes acceptance criteria before other sentence patterns', () => {
    const sections = parseIssueToSections(
      'Given an empty name, when the form is saved, then the API should return a validation error.',
    );

    expect(sectionItems(sections, 'acceptance-criteria')).toContain(
      'Given an empty name, when the form is saved, then the API should return a validation error.',
    );
    expect(sectionItems(sections, 'expected-behavior')).toContain(
      'The desired outcome is not specified; clarify it before implementation.',
    );
  });

  it('caps generated titles without losing a useful prefix', () => {
    const title = createBriefTitle(`${'A'.repeat(80)} issue description.`);

    expect(title).toHaveLength(72);
    expect(title.endsWith('...')).toBe(true);
  });

  it('formats every section as copyable Markdown', () => {
    const brief = {
      id: 'brief-1',
      title: 'A save issue',
      issue: 'The save button is stuck.',
      createdAt: '2026-09-28T00:00:00.000Z',
      sections: parseIssueToSections('The save button is stuck.'),
    };
    const markdown = briefToMarkdown(brief);

    expect(markdown).toContain('# A save issue\n\n## Problem\n\n- The save button is stuck.');
    expect(markdown).toContain('## Technical Considerations');
    expect(markdown).toContain('## Testing Checklist');
    expect(markdown.endsWith('\n')).toBe(true);
  });

  it('keeps reproduction steps ordered in full and section Markdown exports', () => {
    const brief = {
      id: 'brief-2',
      title: 'A save issue',
      issue: `## Problem
Saving a profile shows an error.

## Steps to Reproduce
1. Open the account settings.
2. Click Save.`,
      createdAt: '2026-09-28T00:00:00.000Z',
      sections: parseIssueToSections(`## Problem
Saving a profile shows an error.

## Steps to Reproduce
1. Open the account settings.
2. Click Save.`),
    };
    const reproductionSteps = brief.sections.find(
      (section) => section.id === 'reproduction-steps',
    );
    if (!reproductionSteps) throw new Error('Missing reproduction steps section.');

    expect(sectionToMarkdown(reproductionSteps)).toBe(
      '## Reproduction Steps\n\n1. Open the account settings.\n2. Click Save.',
    );
    expect(briefToMarkdown(brief)).toContain(
      '## Reproduction Steps\n\n1. Open the account settings.\n2. Click Save.',
    );
  });
});
