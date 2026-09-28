import type { DevBrief } from '../../types/devbrief';

export function briefToMarkdown(brief: DevBrief): string {
  const sections = brief.sections
    .map((section) => {
      const items = section.items.map((item) => `- ${item}`).join('\n');
      return `## ${section.title}\n\n${items}`;
    })
    .join('\n\n');

  return `# ${brief.title}\n\n${sections}\n`;
}
