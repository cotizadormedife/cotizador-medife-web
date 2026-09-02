"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email("Ingresá un email válido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
  nombre: z.string().min(1, "Ingresá tu nombre."),
  apellido: z.string().min(1, "Ingresá tu apellido."),
  celular: z.string().min(1, "Ingresá tu celular."),
  empresa: z.string().min(1, "Ingresá tu empresa o broker."),
});

export type RegisterState = { error?: string; needsEmailConfirmation?: boolean };

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    nombre: formData.get("nombre"),
    apellido: formData.get("apellido"),
    celular: formData.get("celular"),
    empresa: formData.get("empresa"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { email, password, nombre, apellido, celular, empresa } = parsed.data;
  const supabase = await createClient();
  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre, apellido, celular, empresa }, emailRedirectTo: `${siteUrl}/confirm` },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.session) {
    // El proyecto tiene confirmación de email activada: no hay sesión hasta
    // que el usuario confirme desde el mail que le llega.
    return { needsEmailConfirmation: true };
  }

  redirect("/pending");
}
