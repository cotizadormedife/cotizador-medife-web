"use server";

import { createClient } from "@/lib/supabase/server";

export type ForgotPasswordState = { sent?: boolean; error?: string };

export async function forgotPasswordAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") || "").trim();
  if (!email) {
    return { error: "Ingresá tu email." };
  }

  const supabase = await createClient();
  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/set-password`,
  });

  // No confirmamos ni negamos si el email existe (evita filtrar qué cuentas
  // están registradas) — siempre mostramos el mismo mensaje de éxito, salvo
  // error real del servicio de mail (ej. límite de envíos superado).
  if (error && error.status !== 400) {
    return { error: "No se pudo enviar el mail. Probá de nuevo en unos minutos." };
  }

  return { sent: true };
}
