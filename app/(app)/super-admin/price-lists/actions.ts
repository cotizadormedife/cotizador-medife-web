"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/service";
import { parsePriceList } from "@/lib/excel/parsePriceList";
import { logAction } from "@/lib/auditLog";

export type UploadState =
  | { ok: true; versionId: string; report: { totalCells: number; warnings: string[]; errors: string[]; regionsParsed: string[] } }
  | { ok: false; error: string };

export async function uploadPriceListAction(formData: FormData): Promise<UploadState> {
  const actor = await requireRole(["super_admin"]);
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { ok: false, error: "Elegí un archivo .xlsx." };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { ok: false, error: "El archivo debe ser .xlsx." };
  }

  const buffer = await file.arrayBuffer();
  let parsed;
  try {
    parsed = await parsePriceList(buffer);
  } catch (e: any) {
    return { ok: false, error: "No se pudo leer el archivo: " + (e.message ?? String(e)) };
  }

  if (!parsed.report.ok || parsed.prices.length === 0) {
    return { ok: false, error: parsed.report.errors.join(" ") || "El archivo no pudo interpretarse." };
  }

  const supabase = createServiceClient();

  const { data: version, error: versionErr } = await supabase
    .from("price_list_versions")
    .insert({
      source_filename: file.name,
      status: "draft",
      uploaded_by: actor.id,
      parse_report: parsed.report,
    })
    .select("id")
    .single();

  if (versionErr || !version) {
    return { ok: false, error: "No se pudo crear la versión: " + (versionErr?.message ?? "") };
  }

  const rows = parsed.prices.map((p) => ({
    price_list_version_id: version.id,
    region_code: p.regionCode,
    categoria: p.categoria,
    age_bracket_code: p.ageBracketCode,
    plan_code: p.planCode,
    monto: p.monto,
  }));

  const { error: pricesErr } = await supabase.from("prices").insert(rows);
  if (pricesErr) {
    // limpiar la versión huérfana si falló la inserción de precios
    await supabase.from("price_list_versions").delete().eq("id", version.id);
    return { ok: false, error: "No se pudieron guardar los precios: " + pricesErr.message };
  }

  await logAction({ actorId: actor.id, action: "price_list.upload", targetType: "price_list_version", targetId: version.id, meta: parsed.report });

  revalidatePath("/super-admin/price-lists");
  return { ok: true, versionId: version.id, report: parsed.report };
}

export type ToggleHabilitadaState = { ok: true } | { ok: false; error: string };

// RF-44 / RF-45: habilitar o deshabilitar una versión para que el cotizador
// pueda (o no) ofrecerla en su combo. Nunca puede quedar el sistema sin
// ninguna lista habilitada disponible para cotizar.
export async function toggleHabilitadaAction(versionId: string, habilitar: boolean): Promise<ToggleHabilitadaState> {
  const actor = await requireRole(["super_admin"]);
  const supabase = createServiceClient();

  if (!habilitar) {
    const { count, error: countErr } = await supabase
      .from("price_list_versions")
      .select("id", { count: "exact", head: true })
      .in("status", ["active", "archived"])
      .eq("habilitada", true)
      .neq("id", versionId);
    if (countErr) return { ok: false, error: countErr.message };
    if (!count) {
      return {
        ok: false,
        error: "No se puede deshabilitar: no podemos quedarnos sin ninguna lista de precios vigente disponible para cotizar.",
      };
    }
  }

  const { error } = await supabase.from("price_list_versions").update({ habilitada: habilitar }).eq("id", versionId);
  if (error) return { ok: false, error: error.message };

  await logAction({
    actorId: actor.id,
    action: habilitar ? "price_list.enable" : "price_list.disable",
    targetType: "price_list_version",
    targetId: versionId,
  });

  revalidatePath("/super-admin/price-lists");
  revalidatePath("/quotes");
  return { ok: true };
}

export async function activatePriceListAction(versionId: string) {
  const actor = await requireRole(["super_admin"]);
  const supabase = createServiceClient();

  // Archivar la versión activa actual (si existe) antes de activar la nueva —
  // el índice único parcial exige que nunca haya dos con status='active'.
  await supabase.from("price_list_versions").update({ status: "archived" }).eq("status", "active");

  const { error } = await supabase
    .from("price_list_versions")
    .update({ status: "active", activated_by: actor.id, activated_at: new Date().toISOString() })
    .eq("id", versionId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAction({ actorId: actor.id, action: "price_list.activate", targetType: "price_list_version", targetId: versionId });

  revalidatePath("/super-admin/price-lists");
  return { ok: true };
}
