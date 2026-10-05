export const DEVBRIEF_SECTION_IDS = [
  'problem',
  'reproduction-steps',
  'context',
  'expected-behavior',
  'current-behavior',
  'requirements',
  'acceptance-criteria',
  'technical-considerations',
  'edge-cases',
  'implementation-steps',
  'testing-checklist',
] as const;

export type DevBriefSectionId = (typeof DEVBRIEF_SECTION_IDS)[number];

export interface DevBriefSection {
  id: DevBriefSectionId;
  title: string;
  items: string[];
}

export interface DevBrief {
  id: string;
  title: string;
  issue: string;
  createdAt: string;
  sections: DevBriefSection[];
}
