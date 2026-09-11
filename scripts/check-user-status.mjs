import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.MIGRATION_DATABASE_URL, ssl: { rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0' } });
await client.connect();
const res = await client.query("select email, role, status, disabled_at, approved_at, approved_by from profiles order by created_at");
console.log(res.rows);
await client.end();
