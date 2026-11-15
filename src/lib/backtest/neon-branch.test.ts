import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withReplayBranch } from './neon-branch';

type Call = { method: string; url: string; body?: unknown };
let calls: Call[] = [];

function fakeNeon(opts: { failCreate?: boolean } = {}) {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (method === 'POST' && url.endsWith('/branches')) {
      if (opts.failCreate) return new Response(JSON.stringify({ message: 'timestamp is outside the history window' }), { status: 400 });
      return Response.json({ branch: { id: 'br-test-123', name: 'backtest-x' }, endpoints: [{ id: 'ep-1' }] }, { status: 201 });
    }
    if (method === 'GET' && url.includes('/connection_uri')) return Response.json({ uri: 'postgresql://u:p@ep-1.example/neondb' });
    if (method === 'DELETE') return Response.json({ branch: { id: 'br-test-123' } });
    return new Response('unexpected', { status: 500 });
  }));
}

beforeEach(() => {
  vi.stubEnv('NEON_API_KEY', 'test-key');
  vi.stubEnv('NEON_PROJECT_ID', 'proj-1');
  vi.stubEnv('DATABASE_URL', 'postgresql://neondb_owner:secret@ep-main-pooler.example/neondb?sslmode=require');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('withReplayBranch', () => {
  it('creates a branch with a read-write endpoint, connects with the main DB\'s database and role, then deletes it', async () => {
    fakeNeon();
    const out = await withReplayBranch({}, async (uri) => `ran on ${uri}`);
    expect(out.result).toBe('ran on postgresql://u:p@ep-1.example/neondb');
    expect(out.branch).toMatchObject({ id: 'br-test-123', deleted: true, asOf: null });

    const create = calls.find((c) => c.method === 'POST')!;
    expect(create.url).toBe('https://console.neon.tech/api/v2/projects/proj-1/branches');
    expect(create.body).toMatchObject({ endpoints: [{ type: 'read_write' }] });
    expect((create.body as { branch: { name: string } }).branch.name).toMatch(/^backtest-/);

    const uri = calls.find((c) => c.url.includes('/connection_uri'))!;
    expect(uri.url).toContain('branch_id=br-test-123');
    expect(uri.url).toContain('database_name=neondb');
    expect(uri.url).toContain('role_name=neondb_owner');

    expect(calls.at(-1)).toMatchObject({ method: 'DELETE', url: 'https://console.neon.tech/api/v2/projects/proj-1/branches/br-test-123' });
  });

  it('branches from a past moment when asked', async () => {
    fakeNeon();
    await withReplayBranch({ asOf: '2026-11-14T16:40:00-08:00' }, async () => null);
    const create = calls.find((c) => c.method === 'POST')!;
    expect((create.body as { branch: { parent_timestamp: string } }).branch.parent_timestamp).toBe('2026-11-15T00:40:00.000Z');
  });

  it('deletes the branch even when the replay throws', async () => {
    fakeNeon();
    await expect(withReplayBranch({}, async () => { throw new Error('replay broke'); })).rejects.toThrow('replay broke');
    expect(calls.at(-1)?.method).toBe('DELETE');
  });

  it('reports Neon\'s error message when the branch cannot be created', async () => {
    fakeNeon({ failCreate: true });
    await expect(withReplayBranch({ asOf: '2026-11-01T00:00:00Z' }, async () => null))
      .rejects.toThrow('timestamp is outside the history window');
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('refuses to run without Neon credentials', async () => {
    vi.stubEnv('NEON_API_KEY', '');
    await expect(withReplayBranch({}, async () => null)).rejects.toThrow('NEON_API_KEY');
  });

  it('rejects an invalid as-of time before calling Neon', async () => {
    fakeNeon();
    await expect(withReplayBranch({ asOf: 'yesterday-ish' }, async () => null)).rejects.toThrow('as-of');
    expect(calls).toHaveLength(0);
  });

  it('reports deleted: false when Neon refuses the delete', async () => {
    fakeNeon();
    const base = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) =>
      init?.method === 'DELETE' ? new Response('nope', { status: 500 }) : base(input, init));
    const out = await withReplayBranch({}, async () => 1);
    expect(out.branch.deleted).toBe(false);
  });
});

