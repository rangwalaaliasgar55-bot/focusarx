// Type declarations for the exam guide cluster data (../index.mjs).
export interface ExamFactbox {
  name: string;
  authority: string;
  mode: string;
  frequency: string;
  tagline: string;
}

export interface ExamSection {
  h: string;
  p: string | string[];
}

export interface ExamGuide {
  slug: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  keywords: string;
  exam: ExamFactbox | null;
  sections: ExamSection[];
  faq: [string, string][];
  related: string[];
}

export interface ExamHub {
  slug: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  sections: ExamSection[];
  faq: [string, string][];
  related: string[];
}

export const EXAM_CORE_LINKS: string[];
export const EXAM_GUIDES: ExamGuide[];
export const EXAM_HUB: ExamHub;
export function findExamGuide(slug: string): ExamGuide | null;
