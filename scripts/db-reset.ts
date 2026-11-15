import { resetDatabase } from '../src/lib/seed';

resetDatabase()
  .then(() => {
    console.log('Database reset: 3 vendors, 18 historical invoices, 6 sample blocked scams.');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
