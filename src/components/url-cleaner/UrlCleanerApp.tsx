import { useMemo, useState } from 'react';
import {
  createCleanedUrl,
  inspectUrl,
  type ValidUrlInspection,
} from '../../lib/url-cleaner';

function getRemovedIndexes(
  inspection: ValidUrlInspection,
  keptIndexes: ReadonlySet<number>,
): ReadonlySet<number> {
  return new Set(
    inspection.candidates
      .filter((candidate) => !keptIndexes.has(candidate.index))
      .map((candidate) => candidate.index),
  );
}

export default function UrlCleanerApp() {
  const [input, setInput] = useState('');
  const [keptIndexes, setKeptIndexes] = useState<ReadonlySet<number>>(new Set());
  const [copyMessage, setCopyMessage] = useState('');
  const inspection = useMemo(() => inspectUrl(input), [input]);
  const removedIndexes =
    inspection.status === 'valid' ? getRemovedIndexes(inspection, keptIndexes) : new Set<number>();
  const cleanedUrl =
    inspection.status === 'valid' ? createCleanedUrl(inspection, removedIndexes) : '';

  function updateInput(value: string): void {
    setInput(value);
    setKeptIndexes(new Set());
    setCopyMessage('');
  }

  function toggleCandidate(index: number, shouldRemove: boolean): void {
    setKeptIndexes((current) => {
      const next = new Set(current);
      if (shouldRemove) next.delete(index);
      else next.add(index);
      return next;
    });
    setCopyMessage('');
  }

  async function copyCleanedUrl(): Promise<void> {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard access is not available in this browser.');
      }
      await navigator.clipboard.writeText(cleanedUrl);
      setCopyMessage('Cleaned URL copied to the clipboard.');
    } catch (copyError) {
      setCopyMessage(
        copyError instanceof Error
          ? `Could not copy the URL: ${copyError.message}`
          : 'Could not copy the URL to the clipboard.',
      );
    }
  }

  const pageMessage =
    inspection.status === 'empty'
      ? 'Paste a complete link to review its recognized tracking parameters.'
      : inspection.status === 'invalid'
        ? inspection.message
        : inspection.candidates.length === 0
          ? 'No recognized tracking parameters found. The URL is unchanged.'
          : `${inspection.candidates.length} recognized parameter${inspection.candidates.length === 1 ? '' : 's'} found. Review the checked items before copying.`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 text-slate-200 sm:px-6 sm:py-14">
      <section aria-labelledby="url-cleaner-title">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">
          A careful link cleanup tool
        </p>
        <h1
          className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
          id="url-cleaner-title"
        >
          URL tracking cleaner
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
          Review a link before sharing it. Only a small set of recognized tracking parameters is
          selected for removal; unknown parameters are always preserved. Everything runs in this
          browser, and your URL is never sent to a service.
        </p>
      </section>

      <div className="mt-8 rounded-2xl border border-slate-700 bg-slate-800/80 p-5 shadow-lg sm:p-7">
        <label className="block text-sm font-semibold text-slate-100" htmlFor="url-input">
          URL to clean
        </label>
        <textarea
          autoCapitalize="off"
          autoComplete="off"
          className="mt-2 min-h-28 w-full resize-y rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          data-testid="url-input"
          id="url-input"
          onChange={(event) => updateInput(event.currentTarget.value)}
          placeholder="https://example.com/page?utm_source=newsletter&item=42"
          spellCheck={false}
          value={input}
        />

        <p
          aria-live="polite"
          className={`mt-3 text-sm ${inspection.status === 'invalid' ? 'text-amber-300' : 'text-slate-400'}`}
          data-testid="url-status"
          role={inspection.status === 'invalid' ? 'alert' : 'status'}
        >
          {pageMessage}
        </p>

        {inspection.status === 'valid' && inspection.candidates.length > 0 && (
          <fieldset className="mt-6 rounded-xl border border-slate-700 p-4 sm:p-5">
            <legend className="px-2 text-sm font-semibold text-slate-100">
              Tracking parameters to remove
            </legend>
            <p className="mb-4 text-sm text-slate-400">
              Uncheck any item to keep it in the URL. All unrecognized parameters stay untouched.
            </p>
            <ul className="space-y-3">
              {inspection.candidates.map((candidate) => (
                <li key={candidate.index}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-slate-900/70 p-3 hover:bg-slate-900">
                    <input
                      checked={removedIndexes.has(candidate.index)}
                      className="mt-1 size-4 accent-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                      data-testid={`remove-candidate-${candidate.index}`}
                      onChange={(event) =>
                        toggleCandidate(candidate.index, event.currentTarget.checked)
                      }
                      type="checkbox"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block break-all text-sm font-medium text-slate-100">
                        {candidate.key}
                      </span>
                      <span className="mt-1 block break-all text-xs text-slate-400">
                        {candidate.value || '(empty value)'}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-cyan-300">
                      {removedIndexes.has(candidate.index) ? 'Remove' : 'Keep'}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        {inspection.status === 'valid' && (
          <div className="mt-6">
            <label className="block text-sm font-semibold text-slate-100" htmlFor="cleaned-url">
              Result preview
            </label>
            <textarea
              className="mt-2 min-h-24 w-full resize-y rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 font-mono text-sm text-emerald-200 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              data-testid="cleaned-url"
              id="cleaned-url"
              readOnly
              value={cleanedUrl}
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className="rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="copy-cleaned-url"
                disabled={!cleanedUrl}
                onClick={copyCleanedUrl}
                type="button"
              >
                Copy cleaned URL
              </button>
              <button
                className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-800"
                data-testid="clear-url"
                onClick={() => updateInput('')}
                type="button"
              >
                Clear
              </button>
            </div>
            <p aria-live="polite" className="mt-3 min-h-5 text-sm text-emerald-300" role="status">
              {copyMessage}
            </p>
          </div>
        )}
      </div>

      <aside className="mt-6 rounded-xl border border-amber-400/25 bg-amber-400/5 p-4 text-sm leading-6 text-amber-100/90">
        <h2 className="font-semibold text-amber-100">A conservative helper, not full tracking protection</h2>
        <p className="mt-2">
          The tool removes only its documented exact-key list and <code>utm_</code> parameters.
          Site-specific tracking may remain, and some recognized parameters can still matter to a
          particular link—review every change before copying.
        </p>
      </aside>
    </div>
  );
}
