import { clock } from '@/lib/format';
import type { AuditRow } from '@/lib/types';

export function AuditLog({ rows }: { rows: AuditRow[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 text-gray-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Audit log</h2>
      <ol className="mt-2 space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.id}>
            <details>
              <summary className="cursor-pointer">
                <span className="tabular-nums text-gray-500">{clock(row.created_at)}</span>{' '}
                <span className="rounded bg-gray-100 px-1 text-xs">{row.actor}</span>{' '}
                <span className="font-medium">{row.action.replaceAll('_', ' ')}</span>
                {row.reason && <span className="text-gray-700">: {row.reason}</span>}
              </summary>
              <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-xs">
                {JSON.stringify({ input: row.input, result: row.result }, null, 2)}
              </pre>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
