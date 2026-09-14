"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export type LoginState = { error?: string };

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Ingresá email y contraseña." };
  }

  // T-A4: sin esto, loginAction es fuerza bruta libre de credenciales.
  const ip = await getClientIp();
  const okIp = await checkRateLimit(`login:ip:${ip}`, { max: 20, windowMinutes: 15 });
  const okEmail = await checkRateLimit(`login:email:${email.toLowerCase()}`, { max: 8, windowMinutes: 15 });
  if (!okIp || !okEmail) {
    return { error: "Demasiados intentos. Esperá unos minutos y volvé a intentar." };
  }

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

  // El usuario ya viene en la respuesta del propio signIn — evita un
  // getUser() extra (una llamada de red más que puede fallar por las suyas,
  // como pasó el 14/09: quedó sin manejar y tiraba la página abajo).
  if (error || !signInData.user) {
    if (error?.code === "email_not_confirmed") {
      return { error: "Todavía no confirmaste tu email — revisá tu casilla de entrada." };
    }
    return { error: "Email o contraseña incorrectos." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", signInData.user.id)
    .single();

  if (profile?.status === "approved") {
    redirect("/quotes");
  }
  redirect("/pending");
}
