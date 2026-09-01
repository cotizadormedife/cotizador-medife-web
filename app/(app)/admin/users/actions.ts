"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/service";

async function logAction(actorId: string, action: string, targetId: string) {
  const supabase = createServiceClient();
  await supabase
    .from("audit_log")
    .insert({ actor_id: actorId, action, target_type: "profile", target_id: targetId });
}

export async function approveUserAction(userId: string) {
  const actor = await requireRole(["admin", "super_admin"]);
  const supabase = createServiceClient();
  await supabase
    .from("profiles")
    .update({ status: "approved", approved_by: actor.id, approved_at: new Date().toISOString() })
    .eq("id", userId);
  await logAction(actor.id, "user.approve", userId);
  revalidatePath("/admin/users");
}

export async function rejectUserAction(userId: string) {
  const actor = await requireRole(["admin", "super_admin"]);
  const supabase = createServiceClient();
  await supabase.from("profiles").update({ status: "rejected" }).eq("id", userId);
  await logAction(actor.id, "user.reject", userId);
  revalidatePath("/admin/users");
}

// Soft-delete: se preserva la fila (y la trazabilidad de sus cotizaciones)
// pero se bloquea el acceso y se revoca cualquier sesión activa.
export async function deleteUserAction(userId: string) {
  const actor = await requireRole(["admin", "super_admin"]);
  const supabase = createServiceClient();
  await supabase.from("profiles").update({ disabled_at: new Date().toISOString() }).eq("id", userId);
  // Revoca el acceso de inmediato (no solo en el próximo chequeo de perfil):
  // un ban largo invalida su capacidad de generar nuevas sesiones.
  await supabase.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
  await logAction(actor.id, "user.delete", userId);
  revalidatePath("/admin/users");
}

const inviteSchema = z.object({
  email: z.string().email("Ingresá un email válido."),
  nombre: z.string().min(1, "Ingresá el nombre."),
  apellido: z.string().min(1, "Ingresá el apellido."),
  celular: z.string().min(1, "Ingresá el celular."),
  empresa: z.string().min(1, "Ingresá la empresa o broker."),
});

export type InviteUserState = { ok: true; link: string; email: string } | { ok: false; error: string };

// Crea el usuario directamente (sin pasar por autorregistro) y ya lo deja
// aprobado — lo creó un admin, no hace falta una segunda aprobación. Se
// genera un link de primer ingreso para que el usuario defina su propia
// contraseña; no se envía por email desde acá (el mailer gratuito de
// Supabase tiene un límite bajo de envíos por hora) — el admin lo comparte
// por el canal que prefiera.
export async function inviteUserAction(raw: unknown): Promise<InviteUserState> {
  const actor = await requireRole(["admin", "super_admin"]);
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { email, nombre, apellido, celular, empresa } = parsed.data;
  const supabase = createServiceClient();

  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: { nombre, apellido, celular, empresa },
      redirectTo: `${siteUrl}/set-password`,
    },
  });
  if (error || !data?.user) {
    return { ok: false, error: error?.message ?? "No se pudo crear el usuario." };
  }

  await supabase
    .from("profiles")
    .update({ role: "vendedor", status: "approved", approved_by: actor.id, approved_at: new Date().toISOString() })
    .eq("id", data.user.id);
  await logAction(actor.id, "user.invite", data.user.id);
  revalidatePath("/admin/users");

  return { ok: true, link: data.properties.action_link, email };
}
