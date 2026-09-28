import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DEVBRIEF_EXAMPLES } from '../../lib/devbrief/examples';
import { briefToMarkdown } from '../../lib/devbrief/markdown';
import { createBriefTitle, parseIssueToSections } from '../../lib/devbrief/parser';
import {
  DEVBRIEF_SECTION_IDS,
  type DevBrief,
  type DevBriefSection,
  type DevBriefSectionId,
} from '../../types/devbrief';

const STORAGE_KEY = 'devbrief.history.v1';
const MAX_HISTORY = 20;
const MAX_ISSUE_LENGTH = 10_000;

const SECTION_ICONS: Record<DevBriefSectionId, string> = {
  problem: 'bug',
  context: 'layers',
  'expected-behavior': 'spark',
  'current-behavior': 'activity',
  requirements: 'check',
  'acceptance-criteria': 'target',
  'technical-considerations': 'code',
  'edge-cases': 'alert',
  'implementation-steps': 'list',
  'testing-checklist': 'flask',
};

const iconPaths: Record<string, ReactNode> = {
  activity: <><path d="M3 12h4l3-9 4 18 3-9h4" /></>,
  alert: <><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>,
  arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
  bug: <><path d="m8 2 1.9 1.9M14 2l-1.9 1.9M9 7h6m-7 4h8m-7 4h6m-7 4h8M4 10H2m2 6H2m20-6h-2m2 6h-2M7 7a5 5 0 0 0-2 4v4a5 5 0 0 0 5 5h4a5 5 0 0 0 5-5v-4a5 5 0 0 0-2-4" /></>,
  check: <><path d="m5 12 4 4L19 6" /><path d="M21 12a9 9 0 1 1-2.6-6.4" /></>,
  chevron: <><path d="m9 18 6-6-6-6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  close: <><path d="m18 6-12 12M6 6l12 12" /></>,
  code: <><path d="m16 18 6-6-6-6M8 6l-6 6 6 6m6-16-4 20" /></>,
  copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3" /></>,
  flask: <><path d="M9 3h6m-5 0v7l-5.4 8.1A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-2.9L14 10V3m-5 12h6" /></>,
  layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5m-18 5 9 5 9-5" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></>,
  moon: <><path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" /></>,
  plus: <><path d="M12 5v14m-7-7h14" /></>,
  spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" /><path d="m19 14 1 2.5 2.5 1-2.5 1L19 21l-1-2.5-2.5-1 2.5-1L19 14Z" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  trash: <><path d="M3 6h18m-2 0-1 14H6L5 6m4 0V4h6v2m-5 4v6m4-6v6" /></>,
};

function Icon({
  name,
  className = 'size-4',
}: {
  name: string;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
    >
      {iconPaths[name] ?? iconPaths.spark}
    </svg>
  );
}

function getStoredBriefs(): DevBrief[] {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || !parsed.every(isStoredBrief)) {
    throw new Error('Saved history has an unexpected format.');
  }

  return parsed;
}

function isStoredSection(value: unknown): value is DevBriefSection {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    DEVBRIEF_SECTION_IDS.includes(candidate.id as DevBriefSectionId) &&
    typeof candidate.title === 'string' &&
    Array.isArray(candidate.items) &&
    candidate.items.every((item: unknown) => typeof item === 'string')
  );
}

function isStoredBrief(value: unknown): value is DevBrief {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.issue === 'string' &&
    typeof candidate.createdAt === 'string' &&
    Array.isArray(candidate.sections) &&
    candidate.sections.every(isStoredSection)
  );
}

function makeBrief(issue: string): DevBrief {
  const sections = parseIssueToSections(issue);
  const problem = sections.find((section) => section.id === 'problem')?.items[0];
  if (!problem) throw new Error('Add a short problem summary before generating a brief.');

  return {
    id: window.crypto.randomUUID(),
    title: createBriefTitle(problem),
    issue,
    createdAt: new Date().toISOString(),
    sections,
  };
}

function formatDate(date: string): string {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return 'Saved brief';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}

export default function DevBriefApp() {
  const [issue, setIssue] = useState('');
  const [brief, setBrief] = useState<DevBrief | null>(null);
  const [history, setHistory] = useState<DevBrief[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const canPersistHistory = useRef(true);
  const wordCount = useMemo(
    () => issue.trim().split(/\s+/).filter(Boolean).length,
    [issue],
  );

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  }, []);

  useEffect(() => {
    try {
      setHistory(getStoredBriefs());
    } catch (loadError) {
      canPersistHistory.current = false;
      setError(
        loadError instanceof Error
          ? `Could not load saved briefs: ${loadError.message}`
          : 'Could not load saved briefs.',
      );
    } finally {
      setHistoryLoaded(true);
    }
    return () => window.clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    if (!historyLoaded || !canPersistHistory.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (saveError) {
      canPersistHistory.current = false;
      if (saveError instanceof DOMException && saveError.name === 'QuotaExceededError') {
        setError('Browser storage is full. Delete an older brief to save new ones.');
      } else {
        setError('Could not save brief history in this browser.');
      }
    }
  }, [history, historyLoaded]);

  const generateBrief = useCallback(() => {
    const trimmedIssue = issue.trim();
    if (!trimmedIssue) {
      setError('Add a few details about the issue before generating a brief.');
      textareaRef.current?.focus();
      return;
    }
    if (trimmedIssue.length > MAX_ISSUE_LENGTH) {
      setError(`Keep the issue under ${MAX_ISSUE_LENGTH.toLocaleString()} characters.`);
      textareaRef.current?.focus();
      return;
    }

    setError('');
    setIsGenerating(true);
    window.setTimeout(() => {
      try {
        const nextBrief = makeBrief(trimmedIssue);
        setBrief(nextBrief);
        setHistory((existing) =>
          [nextBrief, ...existing.filter((saved) => saved.issue !== nextBrief.issue)].slice(
            0,
            MAX_HISTORY,
          ),
        );
        notify('Your brief is ready.');
      } catch (generationError) {
        setError(
          generationError instanceof Error
            ? generationError.message
            : 'Unable to generate a brief. Please try again.',
        );
      } finally {
        setIsGenerating(false);
      }
    }, 250);
  }, [issue, notify]);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        generateBrief();
      } else if (
        event.key === 'Escape' &&
        (issue || error) &&
        !(event.target instanceof HTMLButtonElement)
      ) {
        setIssue('');
        setError('');
        notify('Issue cleared.');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [error, generateBrief, issue, notify]);

  async function copyText(text: string, successMessage: string): Promise<void> {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard access is not available in this browser.');
      }
      await navigator.clipboard.writeText(text);
      notify(successMessage);
    } catch (copyError) {
      setError(
        copyError instanceof Error
          ? copyError.message
          : 'Could not copy text to your clipboard.',
      );
    }
  }

  function restoreBrief(saved: DevBrief): void {
    setIssue(saved.issue);
    setBrief(saved);
    setError('');
    notify('Brief restored.');
  }

  function deleteBrief(id: string): void {
    setHistory((existing) => existing.filter((saved) => saved.id !== id));
    if (brief?.id === id) setBrief(null);
    notify('Saved brief deleted.');
  }

  function downloadMarkdown(): void {
    if (!brief) return;
    const url = URL.createObjectURL(
      new Blob([briefToMarkdown(brief)], { type: 'text/markdown;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${brief.title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'devbrief'}.md`;
    link.click();
    URL.revokeObjectURL(url);
    notify('Markdown file downloaded.');
  }

  const generatedAt = brief ? formatDate(brief.createdAt) : '';

  return (
    <div className="devbrief-shell min-h-screen text-slate-200">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#0a0d13]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <a
            aria-label="DevBrief home"
            className="group flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            data-testid="devbrief-home"
            href="/devbrief"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-950/40">
              <Icon className="size-[19px]" name="moon" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-white">
              devbrief<span className="text-violet-400">.</span>
            </span>
          </a>

          <div className="flex items-center gap-2 sm:gap-5">
            <span className="hidden items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-[11px] font-medium tracking-wide text-emerald-300 sm:inline-flex">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              100% local · no AI
            </span>
            <a
              className="rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              data-testid="home-link"
              href="/"
            >
              Back to Tailspin Toys
              <Icon className="ml-1 inline size-3" name="arrow" />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 pb-16 pt-9 sm:px-8 sm:pt-12">
        <section aria-labelledby="page-title" className="mb-8 sm:mb-10">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300">
            <span className="h-px w-5 bg-violet-400/60" />
            Issue → implementation-ready
          </div>
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <h1
                className="text-[32px] font-semibold leading-tight tracking-[-0.04em] text-white sm:text-[42px]"
                id="page-title"
              >
                Turn messy issues into
                <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-indigo-300 bg-clip-text text-transparent"> clear briefs.</span>
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                Paste a GitHub issue, bug report, or rough idea. Get a structured brief
                your whole team can build from.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-2.5 text-[11px] text-slate-400 md:self-auto">
              <Icon className="size-4 text-violet-300" name="code" />
              Deterministic · private · instant
            </div>
          </div>
        </section>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(360px,0.84fr)_minmax(500px,1.16fr)]">
          <div className="space-y-5">
            <section
              aria-labelledby="issue-heading"
              className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#10141d] shadow-[0_18px_60px_-34px_rgba(0,0,0,0.8)]"
            >
              <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                    <Icon name="bug" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-white" id="issue-heading">
                      Your issue
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Plain text or Markdown, both work
                    </p>
                  </div>
                </div>
                <button
                  aria-label="Clear issue text"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                  data-testid="clear-issue"
                  onClick={() => {
                    setIssue('');
                    setError('');
                    textareaRef.current?.focus();
                  }}
                  type="button"
                >
                  <Icon className="size-4" name="close" />
                </button>
              </div>

              <div className="p-4 sm:p-5">
                <label className="sr-only" htmlFor="issue-input">
                  Describe the issue to turn into a development brief
                </label>
                <textarea
                  autoComplete="off"
                  className="devbrief-textarea min-h-[244px] w-full resize-y rounded-xl border border-white/[0.07] bg-[#0b0e15] px-4 py-3.5 text-[13px] leading-[1.8] text-slate-200 placeholder:text-slate-400 focus:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-violet-400/20"
                  data-testid="issue-input"
                  id="issue-input"
                  maxLength={MAX_ISSUE_LENGTH}
                  onChange={(event) => {
                    setIssue(event.target.value);
                    if (error) setError('');
                  }}
                  placeholder={`Paste your issue here...\n\nThe settings page crashes when I save a profile with an emoji in the display name. Expected: name saves and appears correctly. Actual: a 500 error. Reproduced on Chrome, macOS.`}
                  ref={textareaRef}
                  value={issue}
                />

                <div className="flex items-center justify-between px-1 pt-2.5 text-[10px] text-slate-400">
                  <span>{wordCount} words</span>
                  <span>{issue.length.toLocaleString()} / {MAX_ISSUE_LENGTH.toLocaleString()}</span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-[10px] font-medium text-slate-400">
                    Try an example
                  </span>
                  {DEVBRIEF_EXAMPLES.map((example) => (
                    <button
                      className="rounded-full border border-white/[0.09] bg-white/[0.025] px-2.5 py-1.5 text-[10px] font-medium text-slate-400 transition hover:border-violet-400/30 hover:bg-violet-400/[0.08] hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                      data-testid={`example-${example.id}`}
                      key={example.id}
                      onClick={() => {
                        setIssue(example.issue);
                        setError('');
                        textareaRef.current?.focus();
                      }}
                      type="button"
                    >
                      {example.label}
                    </button>
                  ))}
                </div>

                <button
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-[13px] font-semibold text-white shadow-lg shadow-violet-950/35 transition hover:from-violet-500 hover:to-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10141d] disabled:cursor-wait disabled:opacity-75"
                  data-testid="generate-brief"
                  disabled={isGenerating}
                  onClick={generateBrief}
                  type="button"
                >
                  {isGenerating ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <Icon name="spark" />
                  )}
                  {isGenerating ? 'Structuring your brief…' : 'Generate brief'}
                  {!isGenerating && (
                    <kbd className="ml-auto hidden rounded border border-white/15 bg-black/10 px-1.5 py-0.5 font-mono text-[9px] text-violet-100/80 sm:inline">
                      ⌘ / Ctrl + Enter
                    </kbd>
                  )}
                </button>
                <p className="mt-2 text-center text-[10px] text-slate-400 sm:hidden">
                  Tip: press Ctrl+Enter to generate
                </p>
              </div>

              <div className="flex items-start gap-2.5 border-t border-white/[0.06] bg-white/[0.015] px-5 py-3.5 sm:px-6">
                <Icon className="mt-0.5 size-3.5 shrink-0 text-slate-400" name="moon" />
                <p className="text-[10px] leading-[1.65] text-slate-400">
                  Runs entirely in your browser. Your issue stays on this device.
                  Results are created with transparent, rule-based parsing — not AI.
                </p>
              </div>
            </section>

            <section
              aria-labelledby="history-heading"
              className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#10141d]"
            >
              <div className="flex items-center justify-between px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2.5">
                  <Icon className="size-4 text-slate-400" name="clock" />
                  <h2 className="text-[13px] font-semibold text-slate-200" id="history-heading">
                    Recent briefs
                  </h2>
                </div>
                {history.length > 0 && (
                  <span className="rounded-md bg-white/[0.05] px-2 py-1 text-[10px] text-slate-400">
                    {history.length}
                  </span>
                )}
              </div>

              {!historyLoaded ? (
                <div className="flex items-center gap-2 border-t border-white/[0.06] px-5 py-5 text-xs text-slate-400" role="status">
                  <span className="size-3 animate-spin rounded-full border border-slate-600 border-t-violet-300" />
                  Loading local history…
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center border-t border-white/[0.06] px-5 py-7 text-center">
                  <span className="mb-2 flex size-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-400">
                    <Icon name="clock" />
                  </span>
                  <p className="text-xs font-medium text-slate-400">Nothing here yet</p>
                  <p className="mt-1 text-[10px] text-slate-400">Your generated briefs will be saved on this device.</p>
                </div>
              ) : (
                <ul className="divide-y divide-white/[0.055] border-t border-white/[0.06]">
                  {history.map((saved) => (
                    <li
                      className="flex items-center gap-2 px-4 py-3 transition hover:bg-white/[0.025] sm:px-5"
                      key={saved.id}
                    >
                      <button
                        className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                        data-testid={`restore-brief-${saved.id}`}
                        onClick={() => restoreBrief(saved)}
                        type="button"
                      >
                        <span className="block truncate text-xs font-medium text-slate-300">
                          {saved.title || 'Untitled brief'}
                        </span>
                        <span className="mt-1 block text-[10px] text-slate-400">
                          {formatDate(saved.createdAt)}
                        </span>
                      </button>
                      <button
                        aria-label={`Delete ${saved.title || 'saved brief'}`}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-400/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                        data-testid={`delete-brief-${saved.id}`}
                        onClick={() => deleteBrief(saved.id)}
                        type="button"
                      >
                        <Icon className="size-3.5" name="trash" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section
            aria-labelledby="brief-heading"
            aria-live="polite"
            className="min-h-[580px] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#10141d] shadow-[0_18px_60px_-34px_rgba(0,0,0,0.8)]"
            data-testid="brief-panel"
          >
            {brief ? (
              <>
                <div className="border-b border-white/[0.07] px-5 py-5 sm:px-7 sm:py-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                      <Icon className="size-3.5" name="check" />
                      Brief generated
                    </div>
                    <span className="text-[10px] text-slate-400">{generatedAt}</span>
                  </div>
                  <h2
                    className="max-w-2xl text-xl font-semibold leading-snug tracking-[-0.025em] text-white sm:text-[23px]"
                    id="brief-heading"
                  >
                    {brief.title}
                  </h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.035] px-3 py-2 text-[11px] font-medium text-slate-300 transition hover:border-violet-400/30 hover:bg-violet-400/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                      data-testid="copy-brief"
                      onClick={() => copyText(briefToMarkdown(brief), 'Full brief copied to clipboard.')}
                      type="button"
                    >
                      <Icon className="size-3.5" name="copy" />
                      Copy full brief
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.035] px-3 py-2 text-[11px] font-medium text-slate-300 transition hover:border-violet-400/30 hover:bg-violet-400/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                      data-testid="download-brief"
                      onClick={downloadMarkdown}
                      type="button"
                    >
                      <Icon className="size-3.5" name="download" />
                      Download .md
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                  {brief.sections.map((section, index) => (
                    <article
                      className={`brief-section rounded-xl border border-white/[0.065] bg-[#0d1119] p-4 ${
                        section.id === 'problem' || section.id === 'acceptance-criteria'
                          ? 'sm:col-span-2'
                          : ''
                      }`}
                      data-testid={`brief-section-${section.id}`}
                      key={section.id}
                      style={{ animationDelay: `${Math.min(index * 35, 280)}ms` }}
                    >
                      <div className="mb-2.5 flex items-center justify-between gap-3">
                        <h3 className="flex items-center gap-2 text-[11px] font-semibold text-slate-200">
                          <span className="text-violet-300/80">
                            <Icon className="size-3.5" name={SECTION_ICONS[section.id]} />
                          </span>
                          {section.title}
                        </h3>
                        <button
                          aria-label={`Copy ${section.title}`}
                          className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                          data-testid={`copy-section-${section.id}`}
                          onClick={() =>
                            copyText(
                              `## ${section.title}\n\n${section.items.map((item) => `- ${item}`).join('\n')}`,
                              `${section.title} copied.`,
                            )
                          }
                          type="button"
                        >
                          <Icon className="size-3" name="copy" />
                        </button>
                      </div>
                      {section.items.length > 0 ? (
                        <ul className="space-y-2">
                          {section.items.map((item, itemIndex) => (
                            <li
                              className="flex gap-2 text-[11px] leading-[1.65] text-slate-400"
                              key={`${itemIndex}-${item}`}
                            >
                              <span aria-hidden="true" className="mt-[7px] size-1 shrink-0 rounded-full bg-slate-600" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] italic leading-[1.65] text-slate-400">
                          No additional details provided.
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </>
            ) : isGenerating ? (
              <div className="flex min-h-[580px] flex-col items-center justify-center px-8 text-center">
                <span className="mb-5 flex size-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/[0.07] text-violet-300">
                  <span className="size-6 animate-spin rounded-full border-2 border-violet-300/25 border-t-violet-300" />
                </span>
                <p className="text-sm font-medium text-white" role="status">
                  Finding the signal in your issue…
                </p>
                <p className="mt-2 max-w-xs text-xs leading-5 text-slate-400">
                  Sorting the details into a clear, actionable brief.
                </p>
              </div>
            ) : (
              <div className="flex min-h-[580px] flex-col items-center justify-center px-8 text-center">
                <span className="brief-empty-orbit mb-6 flex size-[72px] items-center justify-center rounded-[22px] border border-violet-300/15 bg-gradient-to-br from-violet-400/[0.12] to-indigo-400/[0.04] text-violet-300 shadow-[0_0_60px_-26px_rgba(167,139,250,0.45)]">
                  <Icon className="size-7" name="spark" />
                </span>
                <h2
                  className="text-base font-semibold tracking-tight text-white"
                  id="brief-heading"
                >
                  Your brief will appear here
                </h2>
                <p className="mt-2 max-w-[290px] text-xs leading-[1.8] text-slate-400">
                  Add an issue on the left and generate a brief. We&apos;ll organize it
                  into ten practical sections, ready to share.
                </p>
                <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
                  {['Problem', 'Requirements', 'Acceptance criteria'].map((label) => (
                    <span
                      className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-[10px] text-slate-400"
                      key={label}
                    >
                      {label}
                    </span>
                  ))}
                  <Icon className="size-3 text-slate-400" name="chevron" />
                  <span className="rounded-full border border-violet-400/15 bg-violet-400/[0.06] px-2.5 py-1.5 text-[10px] text-violet-300">
                    Build with clarity
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>

        <footer className="mt-7 flex flex-col items-center justify-between gap-3 border-t border-white/[0.055] pt-5 text-[10px] text-slate-400 sm:flex-row">
          <span>DevBrief · Open-source project toolkit</span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-400/70" />
            Local-first by design
          </span>
        </footer>
      </main>

      {error && (
        <div
          className="fixed bottom-5 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-start gap-3 rounded-xl border border-rose-400/25 bg-[#201316] px-4 py-3 text-xs text-rose-200 shadow-2xl"
          data-testid="error-message"
          role="alert"
        >
          <Icon className="mt-0.5 size-4 shrink-0 text-rose-300" name="alert" />
          <span className="flex-1 leading-5">{error}</span>
          <button
            aria-label="Dismiss error"
            className="rounded p-1 text-rose-300/70 hover:text-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
            data-testid="dismiss-error"
            onClick={() => setError('')}
            type="button"
          >
            <Icon className="size-3.5" name="close" />
          </button>
        </div>
      )}

      {toast && (
        <div
          className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-emerald-300/20 bg-[#101a19] px-4 py-3 text-xs font-medium text-emerald-200 shadow-2xl"
          data-testid="toast"
          role="status"
        >
          <Icon className="size-4 text-emerald-300" name="check" />
          {toast}
        </div>
      )}
    </div>
  );
}
