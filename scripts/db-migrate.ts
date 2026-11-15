// Applies the idempotent pgvector statements to an existing database without wiping it.
// `npm run db:reset` already includes them; use this on the live shared DB.
import { db } from '../src/lib/db';
import { PGVECTOR_STATEMENTS } from '../src/lib/schema';

async function main() {
  const sql = db();
  for (const statement of PGVECTOR_STATEMENTS) await sql.query(statement);
  console.log(`Applied ${PGVECTOR_STATEMENTS.length} pgvector statements.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
