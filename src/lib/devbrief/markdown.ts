import type { DevBrief, DevBriefSection } from '../../types/devbrief';

export function createMarkdownFilename(title: string): string {
  const slug = title
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'devbrief'}.md`;
}

export function sectionToMarkdown(section: DevBriefSection): string {
  const items = section.items
    .map((item, index) =>
      section.id === 'reproduction-steps' ? `${index + 1}. ${item}` : `- ${item}`,
    )
    .join('\n');
  return `## ${section.title}\n\n${items}`;
}

export function briefToMarkdown(brief: DevBrief): string {
  const sections = brief.sections
    .map(sectionToMarkdown)
    .join('\n\n');

  return `# ${brief.title}\n\n${sections}\n`;
}
