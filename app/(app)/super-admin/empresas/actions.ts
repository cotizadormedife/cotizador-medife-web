"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/service";
import { logAction } from "@/lib/auditLog";
import { MEDIFE_EMPRESA_ID } from "@/lib/empresas";

const empresaSchema = z.object({
  nombre: z.string().min(1, "Ingresá el nombre.").max(200),
  direccion: z.string().min(1, "Ingresá la dirección.").max(200, "Máximo 200 caracteres."),
});

export type EmpresaFormState = { ok: true } | { ok: false; error: string };

export async function createEmpresaAction(raw: unknown): Promise<EmpresaFormState> {
  const actor = await requireRole(["super_admin"]);
  const parsed = empresaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const supabase = createServiceClient();
  const { error } = await supabase.from("empresas").insert(parsed.data);
  if (error) {
    return { ok: false, error: error.code === "23505" ? "Ya existe una empresa con ese nombre." : error.message };
  }
  await logAction({ actorId: actor.id, action: "empresa.create", targetType: "empresa", meta: parsed.data });
  revalidatePath("/super-admin/empresas");
  return { ok: true };
}

export async function updateEmpresaAction(id: string, raw: unknown): Promise<EmpresaFormState> {
  const actor = await requireRole(["super_admin"]);
  const parsed = empresaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const supabase = createServiceClient();
  const { error } = await supabase.from("empresas").update(parsed.data).eq("id", id);
  if (error) {
    return { ok: false, error: error.code === "23505" ? "Ya existe una empresa con ese nombre." : error.message };
  }
  await logAction({ actorId: actor.id, action: "empresa.update", targetType: "empresa", targetId: id, meta: parsed.data });
  revalidatePath("/super-admin/empresas");
  return { ok: true };
}

export type EmpresaUsuarioBloqueante = { nombre: string | null; apellido: string | null; email: string; role: string };
export type DeleteEmpresaState =
  | { ok: true }
  | { ok: false; error: string; usuarios?: EmpresaUsuarioBloqueante[] };

// RF-97: solo se puede eliminar una empresa sin ningún vendedor/admin
// asociado — si tiene, se devuelve la lista completa (no solo el conteo)
// para que el super_admin vea a quién tiene que eliminar primero.
export async function deleteEmpresaAction(id: string): Promise<DeleteEmpresaState> {
  const actor = await requireRole(["super_admin"]);
  if (id === MEDIFE_EMPRESA_ID) {
    return { ok: false, error: "Medife es la empresa propia del sistema — no se puede eliminar." };
  }
  const supabase = createServiceClient();
  const { data: usuarios, error: usuariosError } = await supabase
    .from("profiles")
    .select("nombre, apellido, email, role")
    .eq("empresa_id", id)
    .in("role", ["vendedor", "admin"]);
  if (usuariosError) return { ok: false, error: usuariosError.message };
  if (usuarios && usuarios.length > 0) {
    return {
      ok: false,
      error: `No se puede eliminar: esta empresa todavía tiene ${usuarios.length} usuario(s) (vendedor/admin) asociado(s). Eliminalos primero.`,
      usuarios,
    };
  }
  const { error } = await supabase.from("empresas").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAction({ actorId: actor.id, action: "empresa.delete", targetType: "empresa", targetId: id });
  revalidatePath("/super-admin/empresas");
  return { ok: true };
}
