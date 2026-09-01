import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

const connectionString = process.env.MIGRATION_DATABASE_URL;
if (!connectionString) {
  console.error('Falta MIGRATION_DATABASE_URL en el entorno.');
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

await client.connect();
try {
  await client.query('create table if not exists _migrations (filename text primary key, applied_at timestamptz not null default now())');
  const { rows } = await client.query('select filename from _migrations');
  const applied = new Set(rows.map((r) => r.filename));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Skipping ${file} (already applied)`);
      continue;
    }
    const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Applying ${file} (${sql.length} bytes)...`);
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into _migrations (filename) values ($1)', [file]);
      await client.query('commit');
      console.log(`  OK`);
    } catch (err) {
      await client.query('rollback');
      throw err;
    }
  }
  console.log('All migrations applied successfully.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
