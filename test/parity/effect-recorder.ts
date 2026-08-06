import type { EffectRecord, RuntimeObservation } from './contracts.js';

const sensitiveKey = /(?:authorization|cookie|email|name|password|secret|token|private|credential)/i;
const nondeterministicKey = /^(?:id|createdAt|updatedAt|timestamp|requestId)$/;

export const redactValue = (value: unknown, key = ''): unknown => {
  if (sensitiveKey.test(key)) return '[REDACTED]';
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [entryKey, redactValue(entryValue, entryKey)])
    );
  }
  return value;
};

export const normalizeObservation = (observation: RuntimeObservation): RuntimeObservation => {
  const normalized = redactValue(observation) as RuntimeObservation;
  const normalizeObject = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalizeObject);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, nondeterministicKey.test(key) ? '<dynamic>' : normalizeObject(entry)])
      );
    }
    return value;
  };
  return normalizeObject(normalized) as RuntimeObservation;
};

export class EffectRecorder {
  readonly effects: EffectRecord[] = [];

  record(effect: EffectRecord): void {
    this.effects.push(redactValue(effect) as EffectRecord);
  }
}
