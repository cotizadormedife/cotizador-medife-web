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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = process.argv[2];
const newPassword = process.argv[3];

const { data: list, error: listErr } = await admin.auth.admin.listUsers();
if (listErr) throw listErr;
const user = list.users.find((u) => u.email === email);
if (!user) {
  console.log("No existe:", email);
  process.exit(1);
}
const { error } = await admin.auth.admin.updateUserById(user.id, { password: newPassword });
if (error) {
  console.error("Error:", error.message);
} else {
  console.log(`Password de ${email} actualizado.`);
}
