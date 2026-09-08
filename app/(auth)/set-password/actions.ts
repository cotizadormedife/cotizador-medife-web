"use server";

import { createServiceClient } from "@/lib/supabase/service";

// RF-21/RF-56/RF-57: canje del link de primer ingreso propio (sin
// vencimiento) — distinto del flujo token_hash de Supabase Auth que sigue
// usando esta misma pantalla para recuperación de contraseña (RF-26).

export type CheckInviteState = { ok: true; email: string } | { ok: false };

export async function checkInviteTokenAction(token: string): Promise<CheckInviteState> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("invite_tokens").select("user_id, used_at").eq("token", token).maybeSingle();
  if (!data || data.used_at) return { ok: false };
  const { data: userData } = await supabase.auth.admin.getUserById(data.user_id);
  if (!userData?.user?.email) return { ok: false };
  return { ok: true, email: userData.user.email };
}

export type RedeemInviteState = { ok: true; email: string } | { ok: false; error: string };

export async function redeemInviteTokenAction(token: string, password: string): Promise<RedeemInviteState> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("invite_tokens").select("user_id, used_at").eq("token", token).maybeSingle();
  if (!data || data.used_at) {
    return { ok: false, error: "Este link ya no es válido. Pedile a tu administrador que te genere uno nuevo." };
  }
  const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(data.user_id);
  if (userErr || !userData?.user?.email) {
    return { ok: false, error: "No se pudo verificar el usuario." };
  }
  // Usar el link de primer ingreso ya es, en sí mismo, la confirmación de
  // que la persona controla esa casilla — no hace falta un segundo paso de
  // confirmación de email por separado (relevante para usuarios invitados
  // antes de esta versión, cuyo email todavía no estaba confirmado).
  const { error: updErr } = await supabase.auth.admin.updateUserById(data.user_id, { password, email_confirm: true });
  if (updErr) return { ok: false, error: updErr.message };

  await supabase.from("invite_tokens").update({ used_at: new Date().toISOString() }).eq("token", token);
  return { ok: true, email: userData.user.email };
}
