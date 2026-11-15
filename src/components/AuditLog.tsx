import { clock } from '@/lib/format';
import type { AuditRow } from '@/lib/types';

export function AuditLog({ rows }: { rows: AuditRow[] }) {
  return (
    <section className="ig-panel rounded-2xl p-4 text-white">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Audit log</h2>
      <ol className="mt-2 space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.id}>
            <details>
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="tabular-nums text-white/40">{clock(row.created_at)}</span>{' '}
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/70">{row.actor}</span>{' '}
                <span className="font-medium text-white/90">{row.action.replaceAll('_', ' ')}</span>
                {row.reason && <span className="text-white/55">: {row.reason}</span>}
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/70">
                {JSON.stringify({ input: row.input, result: row.result }, null, 2)}
              </pre>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
