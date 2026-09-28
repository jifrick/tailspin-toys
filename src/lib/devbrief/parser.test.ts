import { describe, expect, it } from 'vitest';
import { briefToMarkdown } from './markdown';
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
  it('returns all ten sections in a stable order for a concise issue', () => {
    const sections = parseIssueToSections('The save button never finishes loading.');

    expect(sections.map(({ title }) => title)).toEqual([
      'Problem',
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
});
