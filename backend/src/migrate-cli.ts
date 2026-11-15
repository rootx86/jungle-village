import { migrate, pool, waitForDb } from './db.js';

await waitForDb();
console.log('applied:', await migrate());
await pool.end();
