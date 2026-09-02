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

const [email, password, nombre, apellido, celular, empresa_id] = process.argv.slice(2);
if (!email || !password) {
  console.error("Uso: node create-test-user.mjs <email> <password> [nombre] [apellido] [celular] [empresa_id]");
  process.exit(1);
}

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { nombre, apellido, celular, empresa_id: empresa_id || "00000000-0000-0000-0000-000000000001" },
});
if (error) throw error;
console.log(`Creado y confirmado: ${email} (id ${data.user.id})`);
