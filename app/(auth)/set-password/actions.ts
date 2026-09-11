"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { hashInviteToken } from "@/lib/inviteTokens";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// RF-21/RF-56/RF-57: canje del link de primer ingreso propio (sin
// vencimiento) — distinto del flujo token_hash de Supabase Auth que sigue
// usando esta misma pantalla para recuperación de contraseña (RF-26).

export type CheckInviteState = { ok: true; email: string } | { ok: false };

export async function checkInviteTokenAction(token: string): Promise<CheckInviteState> {
  // T-A2/T-A4: checkInviteTokenAction es un oráculo — confirma tokens
  // filtrados y expone el email de la cuenta. Sin límite, no tiene costo
  // intentarlo a repetición.
  const ip = await getClientIp();
  const okIp = await checkRateLimit(`invite-check:ip:${ip}`, { max: 20, windowMinutes: 15 });
  if (!okIp) return { ok: false };

  const supabase = createServiceClient();
  const { data } = await supabase.from("invite_tokens").select("user_id, used_at").eq("token_hash", hashInviteToken(token)).maybeSingle();
  if (!data || data.used_at) return { ok: false };
  const { data: userData } = await supabase.auth.admin.getUserById(data.user_id);
  if (!userData?.user?.email) return { ok: false };
  return { ok: true, email: userData.user.email };
}

export type RedeemInviteState = { ok: true; email: string } | { ok: false; error: string };

export async function redeemInviteTokenAction(token: string, password: string): Promise<RedeemInviteState> {
  if (!password || password.length < 6) {
    return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const ip = await getClientIp();
  const okIp = await checkRateLimit(`invite-redeem:ip:${ip}`, { max: 20, windowMinutes: 15 });
  if (!okIp) {
    return { ok: false, error: "Demasiados intentos. Esperá unos minutos y volvé a intentar." };
  }

  const supabase = createServiceClient();
  const tokenHash = hashInviteToken(token);

  const { data: invite } = await supabase.from("invite_tokens").select("user_id, used_at").eq("token_hash", tokenHash).maybeSingle();
  if (!invite || invite.used_at) {
    return { ok: false, error: "Este link ya no es válido. Pedile a tu administrador que te genere uno nuevo." };
  }
  // T-A2: un token emitido antes de una baja/rechazo no debe seguir sirviendo
  // para fijar contraseña.
  const { data: targetProfile } = await supabase.from("profiles").select("status, disabled_at").eq("id", invite.user_id).maybeSingle();
  if (!targetProfile || targetProfile.status !== "approved" || targetProfile.disabled_at) {
    return { ok: false, error: "Esta cuenta ya no está habilitada para usar este link." };
  }

  // Canje atómico: solo avanza si nadie lo marcó used_at entre la lectura de
  // arriba y esta actualización (evita el doble canje por carrera).
  const { data: claimed } = await supabase
    .from("invite_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .select("user_id")
    .maybeSingle();
  if (!claimed) {
    return { ok: false, error: "Este link ya no es válido. Pedile a tu administrador que te genere uno nuevo." };
  }

  const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(claimed.user_id);
  if (userErr || !userData?.user?.email) {
    return { ok: false, error: "No se pudo verificar el usuario." };
  }
  // Usar el link de primer ingreso ya es, en sí mismo, la confirmación de
  // que la persona controla esa casilla — no hace falta un segundo paso de
  // confirmación de email por separado (relevante para usuarios invitados
  // antes de esta versión, cuyo email todavía no estaba confirmado).
  const { error: updErr } = await supabase.auth.admin.updateUserById(claimed.user_id, { password, email_confirm: true });
  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true, email: userData.user.email };
}
