import { describe, expect, it } from 'vitest';
import { compareObservations } from './http-runner.js';
import { runSocketParity } from './socket-runner.js';

describe('dual-runtime parity harness', () => {
  it('reports actionable transport and effect differences while redacting secrets', () => {
    const result = compareObservations(
      { id: 'http:create', intentionalExceptions: ['$.body.error'] },
      {
        status: 500,
        body: { message: 'failed', error: 'password=raw-secret', id: 'legacy-id' },
        headers: { authorization: 'Bearer secret' },
        effects: [{ kind: 'database', name: 'insert', values: { amount: '10000000000000001' } }],
      },
      {
        status: 503,
        body: { message: 'unavailable', id: 'nest-id' },
        headers: { authorization: 'Bearer other' },
        effects: [{ kind: 'database', name: 'insert', values: { amount: '10000000000000002' } }],
      }
    );

    expect(result.matched).toBe(false);
    expect(result.differences.map(({ path }) => path)).toContain('$.status');
    expect(result.differences.map(({ path }) => path)).toContain('$.effects.0.values.amount');
    expect(JSON.stringify(result)).not.toContain('raw-secret');
    expect(result.differences.find(({ path }) => path === '$.body.error')?.intentional).toBe(true);
  });

  it('compares socket events and acknowledgements', async () => {
    const result = await runSocketParity(
      { id: 'socket:join', description: 'join', kind: 'socket', namespace: '/', event: 'join', payload: {} },
      async () => ({ events: [{ event: 'joined', payload: { room: 'a' }, acknowledgement: 'ok' }], effects: [] }),
      async () => ({ events: [{ event: 'joined', payload: { room: 'b' }, acknowledgement: 'no' }], effects: [] })
    );
    expect(result.matched).toBe(false);
    expect(result.differences.some(({ path }) => path.includes('acknowledgement'))).toBe(true);
  });
});
