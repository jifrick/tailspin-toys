import { describe, expect, it } from 'vitest';
import { createCleanedUrl, inspectUrl } from './url-cleaner';

describe('inspectUrl', () => {
  it('recognizes common tracking keys and utm-prefixed keys without regard to case', () => {
    const inspection = inspectUrl(
      'https://example.com/?UTM_Source=newsletter&FbClId=click-id&gclid=ad-id&item=42',
    );

    expect(inspection.status).toBe('valid');
    if (inspection.status !== 'valid') return;

    expect(inspection.candidates.map(({ key }) => key)).toEqual([
      'UTM_Source',
      'FbClId',
      'gclid',
    ]);
    expect(
      createCleanedUrl(
        inspection,
        new Set(inspection.candidates.map(({ index }) => index)),
      ),
    ).toBe('https://example.com/?item=42');
  });

  it('preserves unknown functional parameters, repeated values, order, encoding, path, and fragment', () => {
    const inspection = inspectUrl(
      'https://example.com/a/b?item=first&state=active&item=second&utm_source=mail&token=a%2Fb#details',
    );

    expect(inspection.status).toBe('valid');
    if (inspection.status !== 'valid') return;

    expect(
      createCleanedUrl(
        inspection,
        new Set(inspection.candidates.map(({ index }) => index)),
      ),
    ).toBe('https://example.com/a/b?item=first&state=active&item=second&token=a%2Fb#details');
  });

  it('lets a user keep an individual tracking candidate', () => {
    const inspection = inspectUrl(
      'https://example.com/?utm_source=mail&fbclid=click-id&view=map',
    );

    expect(inspection.status).toBe('valid');
    if (inspection.status !== 'valid') return;

    expect(createCleanedUrl(inspection, new Set([inspection.candidates[0].index]))).toBe(
      'https://example.com/?fbclid=click-id&view=map',
    );
  });

  it('recognizes percent-encoded tracking parameter names', () => {
    const inspection = inspectUrl('https://example.com/?%66bclid=click-id&ref=product');

    expect(inspection.status).toBe('valid');
    if (inspection.status !== 'valid') return;

    expect(inspection.candidates.map(({ key }) => key)).toEqual(['fbclid']);
    expect(createCleanedUrl(inspection, new Set([inspection.candidates[0].index]))).toBe(
      'https://example.com/?ref=product',
    );
  });

  it.each([
    '',
    '   ',
    'example.com/path',
    'https://[invalid',
    'javascript:alert(1)',
  ])('rejects invalid or unsupported input: %s', (input) => {
    expect(inspectUrl(input).status).not.toBe('valid');
  });

  it('returns a clear empty state for a valid URL with no recognized tracking parameters', () => {
    const inspection = inspectUrl('https://example.com/search?q=toys&state=active#results');

    expect(inspection.status).toBe('valid');
    if (inspection.status !== 'valid') return;

    expect(inspection.candidates).toEqual([]);
    expect(createCleanedUrl(inspection, new Set())).toBe(
      'https://example.com/search?q=toys&state=active#results',
    );
  });
});
