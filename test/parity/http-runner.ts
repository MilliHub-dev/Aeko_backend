import type { HttpParityCase, ParityDifference, ParityResult, RuntimeObservation } from './contracts.js';
import { normalizeObservation } from './effect-recorder.js';

const flattenDifferences = (legacy: unknown, nest: unknown, path = '$'): ParityDifference[] => {
  if (Object.is(legacy, nest)) return [];
  if (legacy && nest && typeof legacy === 'object' && typeof nest === 'object') {
    const left = legacy as Record<string, unknown>;
    const right = nest as Record<string, unknown>;
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    return [...keys].sort().flatMap((key) => flattenDifferences(left[key], right[key], `${path}.${key}`));
  }
  return [{ path, legacy, nest, intentional: false }];
};

export const compareObservations = (
  parityCase: { id: string; intentionalExceptions?: string[] },
  legacy: RuntimeObservation,
  nest: RuntimeObservation
): ParityResult => {
  const normalizedLegacy = normalizeObservation(legacy);
  const normalizedNest = normalizeObservation(nest);
  const differences = flattenDifferences(normalizedLegacy, normalizedNest).map((difference) => ({
    ...difference,
    intentional: parityCase.intentionalExceptions?.includes(difference.path) ?? false,
  }));
  return {
    caseId: parityCase.id,
    matched: differences.every((difference) => difference.intentional),
    legacy: normalizedLegacy,
    nest: normalizedNest,
    differences,
  };
};

export async function observeHttp(baseUrl: string, parityCase: HttpParityCase): Promise<RuntimeObservation> {
  const response = await fetch(new URL(parityCase.path, baseUrl), {
    method: parityCase.method,
    headers: { 'content-type': 'application/json', ...parityCase.headers },
    body: parityCase.body === undefined ? undefined : JSON.stringify(parityCase.body),
  });
  const contentType = response.headers.get('content-type') ?? '';
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: contentType.includes('json') ? await response.json() : await response.text(),
    cookies: response.headers.getSetCookie(),
    effects: [],
  };
}

export async function runHttpParity(
  parityCase: HttpParityCase,
  legacyBaseUrl: string,
  nestBaseUrl: string
): Promise<ParityResult> {
  const [legacy, nest] = await Promise.all([
    observeHttp(legacyBaseUrl, parityCase),
    observeHttp(nestBaseUrl, parityCase),
  ]);
  return compareObservations(parityCase, legacy, nest);
}
