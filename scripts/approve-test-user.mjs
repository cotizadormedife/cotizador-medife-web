import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = process.argv[2];
if (!email) {
  console.error("Uso: node approve-test-user.mjs <email>");
  process.exit(1);
}

const { data, error } = await supabase
  .from("profiles")
  .update({ status: "approved" })
  .eq("email", email)
  .select();
if (error) throw error;
console.log(data);
