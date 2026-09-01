"use server";

import { requireApprovedUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type ChangePasswordState = { ok?: boolean; error?: string };

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const profile = await requireApprovedUser();
  const oldPassword = String(formData.get("oldPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!oldPassword || !newPassword) {
    return { error: "Completá los dos campos de contraseña." };
  }
  if (newPassword.length < 6) {
    return { error: "La nueva contraseña debe tener al menos 6 caracteres." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "La nueva contraseña y su repetición no coinciden." };
  }

  const supabase = await createClient();

  // Confirmamos que conoce la contraseña actual re-autenticando con ella
  // antes de permitir el cambio.
  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: oldPassword,
  });
  if (verifyErr) {
    return { error: "La contraseña actual no es correcta." };
  }

  const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
  if (updateErr) {
    return { error: updateErr.message };
  }

  return { ok: true };
}
