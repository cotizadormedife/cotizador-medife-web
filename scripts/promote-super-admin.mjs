import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.MIGRATION_DATABASE_URL, ssl: { rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0' } });
await client.connect();
const email = process.argv[2];
const res = await client.query(
  "update profiles set role='super_admin', status='approved', approved_at=now() where email=$1 returning id, email, role, status",
  [email]
);
console.log(res.rows);
await client.end();
