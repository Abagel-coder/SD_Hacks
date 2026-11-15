const API = 'https://console.neon.tech/api/v2';

export interface BranchInfo {
  id: string;
  name: string;
  /** ISO time the branch was forked from, or null for "now". */
  asOf: string | null;
  createMs: number;
  deleted: boolean;
}

function config() {
  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;
  if (!apiKey || !projectId) throw new Error('NEON_API_KEY and NEON_PROJECT_ID must be set to run a backtest on a branch');
  const main = process.env.DATABASE_URL;
  if (!main) throw new Error('DATABASE_URL is not set');
  const url = new URL(main);
  return { apiKey, projectId, databaseName: url.pathname.replace(/^\//, ''), roleName: decodeURIComponent(url.username) };
}

async function neonApi<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text.slice(0, 200);
    try { message = (JSON.parse(text) as { message?: string }).message ?? message; } catch { /* keep raw text */ }
    throw new Error(`Neon API ${res.status}: ${message}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * Fork a throwaway Neon branch (optionally from a past moment), hand its connection URI to `fn`,
 * and always delete the branch afterwards. The branch is a copy-on-write snapshot, so the replay can
 * never touch the live database.
 */
export async function withReplayBranch<T>(
  opts: { asOf?: string },
  fn: (connectionUri: string, branch: { id: string; name: string }) => Promise<T>,
): Promise<{ result: T; branch: BranchInfo }> {
  let asOf: string | null = null;
  if (opts.asOf) {
    const t = new Date(opts.asOf);
    if (Number.isNaN(t.getTime())) throw new Error(`Invalid as-of time: ${opts.asOf}`);
    asOf = t.toISOString();
  }
  const { apiKey, projectId, databaseName, roleName } = config();

  const started = Date.now();
  const name = `backtest-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const created = await neonApi<{ branch: { id: string; name: string } }>(apiKey, `/projects/${projectId}/branches`, {
    method: 'POST',
    body: JSON.stringify({
      branch: { name, ...(asOf ? { parent_timestamp: asOf } : {}) },
      endpoints: [{ type: 'read_write' }],
    }),
  });
  const branch = created.branch;

  let result: T;
  let createMs = 0;
  let deleted = false;
  try {
    const params = new URLSearchParams({ branch_id: branch.id, database_name: databaseName, role_name: roleName });
    const { uri } = await neonApi<{ uri: string }>(apiKey, `/projects/${projectId}/connection_uri?${params}`);
    createMs = Date.now() - started;
    result = await fn(uri, branch);
  } finally {
    deleted = await neonApi(apiKey, `/projects/${projectId}/branches/${branch.id}`, { method: 'DELETE' }).then(
      () => true,
      (err) => {
        console.error(`Could not delete backtest branch ${branch.id}; delete it in the Neon console`, err);
        return false;
      },
    );
  }
  return { result, branch: { id: branch.id, name: branch.name, asOf, createMs, deleted } };
}
