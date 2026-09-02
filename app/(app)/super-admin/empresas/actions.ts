"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/service";

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
  await supabase
    .from("audit_log")
    .insert({ actor_id: actor.id, action: "empresa.create", target_type: "empresa", meta: parsed.data });
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
  await supabase
    .from("audit_log")
    .insert({ actor_id: actor.id, action: "empresa.update", target_type: "empresa", target_id: id, meta: parsed.data });
  revalidatePath("/super-admin/empresas");
  return { ok: true };
}
