"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/service";
import { isMedife } from "@/lib/empresas";

async function logAction(actorId: string, action: string, targetId: string) {
  const supabase = createServiceClient();
  await supabase
    .from("audit_log")
    .insert({ actor_id: actorId, action, target_type: "profile", target_id: targetId });
}

// Un Admin de una empresa distinta de Medife solo puede gestionar usuarios
// de su propia empresa (RF-31). Un Admin de Medife y el Super Admin no
// tienen esa restricción.
async function assertSameEmpresaScope(actor: { role: string; empresa_id: string | null }, targetUserId: string) {
  if (actor.role === "super_admin" || isMedife(actor.empresa_id)) return;
  const supabase = createServiceClient();
  const { data: target } = await supabase.from("profiles").select("empresa_id").eq("id", targetUserId).single();
  if (!target || target.empresa_id !== actor.empresa_id) {
    throw new Error("No tenés permiso sobre un usuario de otra empresa.");
  }
}

export async function approveUserAction(userId: string) {
  const actor = await requireRole(["admin", "super_admin"]);
  await assertSameEmpresaScope(actor, userId);
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
  await assertSameEmpresaScope(actor, userId);
  const supabase = createServiceClient();
  await supabase.from("profiles").update({ status: "rejected" }).eq("id", userId);
  await logAction(actor.id, "user.reject", userId);
  revalidatePath("/admin/users");
}

// Soft-delete: se preserva la fila (y la trazabilidad de sus cotizaciones)
// pero se bloquea el acceso y se revoca cualquier sesión activa.
export async function deleteUserAction(userId: string) {
  const actor = await requireRole(["admin", "super_admin"]);
  await assertSameEmpresaScope(actor, userId);
  const supabase = createServiceClient();
  await supabase.from("profiles").update({ disabled_at: new Date().toISOString() }).eq("id", userId);
  // Revoca el acceso de inmediato (no solo en el próximo chequeo de perfil):
  // un ban largo invalida su capacidad de generar nuevas sesiones.
  await supabase.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
  await logAction(actor.id, "user.delete", userId);
  revalidatePath("/admin/users");
}

// RF-40: revierte la baja de un usuario eliminado y le restaura el acceso.
// Mismo alcance por empresa que eliminar/aprobar/rechazar.
export async function reactivateUserAction(userId: string) {
  const actor = await requireRole(["admin", "super_admin"]);
  await assertSameEmpresaScope(actor, userId);
  const supabase = createServiceClient();
  await supabase.from("profiles").update({ disabled_at: null }).eq("id", userId);
  await supabase.auth.admin.updateUserById(userId, { ban_duration: "none" });
  await logAction(actor.id, "user.reactivate", userId);
  revalidatePath("/admin/users");
}

// RF-36: el Super Admin puede ascender a Super Admin, solo si el usuario
// pertenece a Medife (el trigger de base también lo garantiza).
export async function promoteToSuperAdminAction(userId: string) {
  const actor = await requireRole(["super_admin"]);
  const supabase = createServiceClient();
  const { data: target } = await supabase.from("profiles").select("empresa_id").eq("id", userId).single();
  if (!target || !isMedife(target.empresa_id)) {
    throw new Error("Un Super Admin solo puede pertenecer a la empresa Medife.");
  }
  await supabase.from("profiles").update({ role: "super_admin" }).eq("id", userId).eq("status", "approved");
  await logAction(actor.id, "role.promote_super_admin", userId);
  revalidatePath("/admin/users");
}

// RF-38: el Super Admin puede quitarle el rol Admin a un usuario (vuelve a Vendedor).
export async function demoteFromAdminAction(userId: string) {
  const actor = await requireRole(["super_admin"]);
  const supabase = createServiceClient();
  await supabase.from("profiles").update({ role: "vendedor" }).eq("id", userId).eq("role", "admin");
  await logAction(actor.id, "role.demote_admin", userId);
  revalidatePath("/admin/users");
}

export type UpdateEmpresaState = { ok: true } | { ok: false; error: string };

// RF-37: el Super Admin puede reasignar la empresa/broker de un usuario existente.
export async function updateUserEmpresaAction(userId: string, empresaId: string): Promise<UpdateEmpresaState> {
  const actor = await requireRole(["super_admin"]);
  const supabase = createServiceClient();
  const { error } = await supabase.from("profiles").update({ empresa_id: empresaId }).eq("id", userId);
  if (error) {
    return { ok: false, error: error.message };
  }
  await logAction(actor.id, "user.change_empresa", userId);
  revalidatePath("/admin/users");
  return { ok: true };
}

const inviteSchema = z.object({
  email: z.string().email("Ingresá un email válido."),
  nombre: z.string().min(1, "Ingresá el nombre."),
  apellido: z.string().min(1, "Ingresá el apellido."),
  celular: z.string().min(1, "Ingresá el celular."),
  empresa_id: z.string().uuid("Elegí la empresa o broker."),
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
  const { email, nombre, apellido, celular, empresa_id } = parsed.data;

  // RF-31: un Admin de una empresa distinta de Medife solo puede crear
  // usuarios dentro de su propia empresa.
  if (actor.role === "admin" && !isMedife(actor.empresa_id) && empresa_id !== actor.empresa_id) {
    return { ok: false, error: "Solo podés crear usuarios de tu propia empresa." };
  }

  const supabase = createServiceClient();

  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: { nombre, apellido, celular, empresa_id },
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

  // Armamos el link directo a nuestra página con token_hash en vez de usar
  // el action_link crudo de Supabase: ese apunta a su propio endpoint
  // /verify, que entrega la sesión por fragmento de URL (#access_token=...)
  // — un formato que nuestro cliente (configurado para flujo PKCE) no
  // procesa solo. Con token_hash, nuestra propia página hace el intercambio
  // explícitamente vía verifyOtp(), sin depender de eso.
  const link = `${siteUrl}/set-password?token_hash=${data.properties.hashed_token}&type=invite`;

  return { ok: true, link, email };
}
