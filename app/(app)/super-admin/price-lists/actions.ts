"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/service";
import { parsePriceList } from "@/lib/excel/parsePriceList";
import { computeNextVigencia } from "@/lib/pricing/repository";
import { formatVigencia } from "@/lib/pricing/vigencia";
import { logAction } from "@/lib/auditLog";

export type UploadState =
  | {
      ok: true;
      versionId: string;
      vigenciaLabel: string;
      vigenteDeInmediato: boolean;
      report: { totalCells: number; warnings: string[]; errors: string[]; regionsParsed: string[] };
    }
  | { ok: false; error: string };

// RF-66: al elegir "pisar la del mes actual" no se crea una versión nueva —
// se reemplazan los precios de la que ya está activa, en una única
// transacción (overwrite_active_price_list), y queda vigente de inmediato,
// sin pasar por el paso de Activar.
async function overwriteActivePriceList(
  actorId: string,
  file: File,
  parsed: Awaited<ReturnType<typeof parsePriceList>>
): Promise<UploadState> {
  const supabase = createServiceClient();

  const { data: active, error: activeErr } = await supabase
    .from("price_list_versions")
    .select("id, vigencia_anio, vigencia_mes")
    .eq("status", "active")
    .single();
  if (activeErr || !active) {
    return { ok: false, error: "No hay una lista de precios activa para pisar." };
  }

  const rows = parsed.prices.map((p) => ({
    region_code: p.regionCode,
    categoria: p.categoria,
    age_bracket_code: p.ageBracketCode,
    plan_code: p.planCode,
    monto: p.monto,
  }));

  const { error: rpcErr } = await supabase.rpc("overwrite_active_price_list", {
    p_version_id: active.id,
    p_rows: rows,
    p_source_filename: file.name,
    p_parse_report: parsed.report,
    p_actor_id: actorId,
  });
  if (rpcErr) {
    return { ok: false, error: "No se pudieron reemplazar los precios: " + rpcErr.message };
  }

  await logAction({
    actorId,
    action: "price_list.overwrite_active",
    targetType: "price_list_version",
    targetId: active.id,
    meta: parsed.report,
  });

  revalidatePath("/super-admin/price-lists");
  revalidatePath("/quotes");
  return {
    ok: true,
    versionId: active.id,
    vigenciaLabel: formatVigencia({ anio: active.vigencia_anio, mes: active.vigencia_mes }),
    vigenteDeInmediato: true,
    report: parsed.report,
  };
}

export async function uploadPriceListAction(formData: FormData): Promise<UploadState> {
  const actor = await requireRole(["super_admin"]);
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { ok: false, error: "Elegí un archivo .xlsx." };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { ok: false, error: "El archivo debe ser .xlsx." };
  }
  const modo = formData.get("modo") === "pisar" ? "pisar" : "proximo";

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

  if (modo === "pisar") {
    return overwriteActivePriceList(actor.id, file, parsed);
  }

  const supabase = createServiceClient();

  // RF-64: la vigencia se asigna sola, siempre correlativa a la más nueva ya
  // cargada — nunca se elige a mano.
  const vigencia = await computeNextVigencia();

  const { data: version, error: versionErr } = await supabase
    .from("price_list_versions")
    .insert({
      source_filename: file.name,
      status: "draft",
      uploaded_by: actor.id,
      parse_report: parsed.report,
      vigencia_anio: vigencia.anio,
      vigencia_mes: vigencia.mes,
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
  return { ok: true, versionId: version.id, vigenciaLabel: vigencia.label, vigenteDeInmediato: false, report: parsed.report };
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
