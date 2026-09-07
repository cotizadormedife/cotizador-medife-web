import { randomBytes } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

// RF-21/RF-56/RF-57: token propio de la aplicación para el link de primer
// ingreso, sin vencimiento (a diferencia del token_hash de Supabase Auth,
// que vence según la configuración de Auth). Generar uno nuevo invalida
// cualquier link anterior sin usar del mismo usuario.
export async function createInviteToken(userId: string, createdBy: string | null): Promise<string> {
  const supabase = createServiceClient();
  await supabase.from("invite_tokens").update({ used_at: new Date().toISOString() }).eq("user_id", userId).is("used_at", null);
  const token = randomBytes(24).toString("base64url");
  const { error } = await supabase.from("invite_tokens").insert({ token, user_id: userId, created_by: createdBy });
  if (error) throw error;
  return token;
}

export function buildInviteLink(token: string): string {
  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${siteUrl}/set-password?invite=${token}`;
}
