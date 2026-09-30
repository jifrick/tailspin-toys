const TRACKING_PARAMETER_KEYS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'gclsrc',
  'gbraid',
  'wbraid',
  'msclkid',
  'twclid',
  'ttclid',
  'li_fat_id',
  'mc_cid',
  'mc_eid',
  'mkt_tok',
  '_hsenc',
  '_hsmi',
  'igshid',
  'yclid',
  'gad_source',
  'gad_campaignid',
  'srsltid',
  'epik',
  'sscid',
  'si',
]);

export interface TrackingParameterCandidate {
  index: number;
  key: string;
  value: string;
}

export interface ValidUrlInspection {
  status: 'valid';
  url: string;
  base: string;
  fragment: string;
  queryParameters: readonly string[];
  candidates: readonly TrackingParameterCandidate[];
}

export type UrlInspection =
  | { status: 'empty' }
  | { status: 'invalid'; message: string }
  | ValidUrlInspection;

function decodeFormComponent(value: string): string | null {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return null;
  }
}

function isTrackingParameter(key: string): boolean {
  const normalizedKey = key.toLowerCase();
  return normalizedKey.startsWith('utm_') || TRACKING_PARAMETER_KEYS.has(normalizedKey);
}

export function inspectUrl(input: string): UrlInspection {
  const trimmedInput = input.trim();
  if (!trimmedInput) return { status: 'empty' };

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedInput);
  } catch {
    return {
      status: 'invalid',
      message: 'Enter a complete, valid http:// or https:// URL.',
    };
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return {
      status: 'invalid',
      message: 'Only http:// and https:// URLs can be cleaned.',
    };
  }

  const url = parsedUrl.href;
  const fragmentIndex = url.indexOf('#');
  const fragment = fragmentIndex < 0 ? '' : url.slice(fragmentIndex);
  const beforeFragment = fragmentIndex < 0 ? url : url.slice(0, fragmentIndex);
  const queryIndex = beforeFragment.indexOf('?');
  const base = queryIndex < 0 ? beforeFragment : beforeFragment.slice(0, queryIndex);
  const queryString = queryIndex < 0 ? '' : beforeFragment.slice(queryIndex + 1);
  const queryParameters = queryString ? queryString.split('&') : [];
  const candidates: TrackingParameterCandidate[] = [];

  queryParameters.forEach((parameter, index) => {
    const equalsIndex = parameter.indexOf('=');
    const encodedKey = equalsIndex < 0 ? parameter : parameter.slice(0, equalsIndex);
    const key = decodeFormComponent(encodedKey);
    if (key === null || !isTrackingParameter(key)) return;

    const encodedValue = equalsIndex < 0 ? '' : parameter.slice(equalsIndex + 1);
    candidates.push({
      index,
      key,
      value: decodeFormComponent(encodedValue) ?? encodedValue,
    });
  });

  return {
    status: 'valid',
    url,
    base,
    fragment,
    queryParameters,
    candidates,
  };
}

export function createCleanedUrl(
  inspection: ValidUrlInspection,
  removedParameterIndexes: ReadonlySet<number>,
): string {
  if (removedParameterIndexes.size === 0) return inspection.url;

  const remainingParameters = inspection.queryParameters.filter(
    (_, index) => !removedParameterIndexes.has(index),
  );
  const query = remainingParameters.join('&');
  const hasRemainingParameter = remainingParameters.some((parameter) => parameter.length > 0);

  return `${inspection.base}${hasRemainingParameter ? `?${query}` : ''}${inspection.fragment}`;
}
