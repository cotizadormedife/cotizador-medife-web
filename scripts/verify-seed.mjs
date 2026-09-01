import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.MIGRATION_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const checks = [
  ["select count(*) from regions", "regions"],
  ["select count(*) from filiales", "filiales"],
  ["select count(*) from plans", "plans"],
  ["select count(*) from age_brackets", "age_brackets"],
  ["select count(*) from monotributo_brackets", "monotributo_brackets"],
  ["select count(*) from prices", "prices"],
  ["select count(*) from discount_policies", "discount_policies"],
  ["select count(*) from discount_policy_plan_rules", "discount_policy_plan_rules"],
  ["select count(*) from discount_policy_schedule", "discount_policy_schedule"],
  ["select status, count(*) from price_list_versions group by status", "price_list_versions by status"],
];

for (const [sql, label] of checks) {
  const res = await client.query(sql);
  console.log(label, '=>', JSON.stringify(res.rows));
}

// sanity: spot-check one known price
const spot = await client.query(
  "select monto from prices where region_code='AMBA' and categoria='Obl' and age_bracket_code='0-25' and plan_code='INDIE'"
);
console.log('AMBA-Obl 0-25 INDIE (esperado 136893) =>', spot.rows);

await client.end();
