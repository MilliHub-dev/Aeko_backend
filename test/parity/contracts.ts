export type SafeNumeric = string | bigint;

export interface EffectRecord {
  kind: 'database' | 'provider' | 'blockchain';
  name: string;
  values: Record<string, unknown>;
}

export interface RuntimeObservation {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
  cookies?: string[];
  events?: Array<{ event: string; payload: unknown; acknowledgement?: unknown }>;
  effects: EffectRecord[];
}

interface BaseParityCase {
  id: string;
  description: string;
  intentionalExceptions?: string[];
}

export interface HttpParityCase extends BaseParityCase {
  kind: 'http' | 'webhook';
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface SocketParityCase extends BaseParityCase {
  kind: 'socket';
  namespace: string;
  event: string;
  payload: unknown;
}

export interface EffectParityCase extends BaseParityCase {
  kind: 'job' | 'provider' | 'database' | 'blockchain';
  operation: string;
  inputs: Record<string, unknown>;
}

export type ParityCase = HttpParityCase | SocketParityCase | EffectParityCase;

export interface ParityDifference {
  path: string;
  legacy: unknown;
  nest: unknown;
  intentional: boolean;
}

export interface ParityResult {
  caseId: string;
  matched: boolean;
  legacy: RuntimeObservation;
  nest: RuntimeObservation;
  differences: ParityDifference[];
}
