import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = process.argv[2];
const { data, error } = await supabase.auth.admin.listUsers();
if (error) throw error;
const user = data.users.find((u) => u.email === email);
if (!user) {
  console.log("No existe:", email);
  process.exit(0);
}
const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
if (delErr) console.error("Error:", delErr.message);
else console.log("Eliminado:", email);
