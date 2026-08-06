import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('clean migration toolchain', () => {
  it('pins Node 24 and pnpm 10.33.2', async () => {
    const manifest = JSON.parse(await readFile('package.json', 'utf8')) as {
      engines?: Record<string, string>;
      packageManager?: string;
      scripts?: Record<string, string>;
    };

    expect(manifest.engines?.node).toBe('>=24 <25');
    expect(manifest.packageManager).toBe('pnpm@10.33.2');
    expect(manifest.scripts?.quality).not.toMatch(/\bnpm\b/);
  });
});
