"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/service";
import { parsePriceList } from "@/lib/excel/parsePriceList";
import { resolveUploadTarget } from "@/lib/pricing/repository";
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

  const supabase = createServiceClient();

  // RF-66/RF-67: "pisar" siempre apunta a la vigencia de la activa actual (y
  // por lo tanto la sobrescribe); "próximo mes" apunta al mes siguiente al de
  // la activa y, si ya existe una versión con esa vigencia, también la
  // sobrescribe (con confirmación aparte del lado del cliente) en vez de
  // fallar por vigencia duplicada. Las dos quedan utilizables de inmediato —
  // ya no hace falta un paso aparte de "Activar".
  let target;
  try {
    target = await resolveUploadTarget(modo);
  } catch (e: any) {
    return { ok: false, error: e.message ?? "No se pudo determinar la vigencia de destino." };
  }

  const rows = parsed.prices.map((p) => ({
    region_code: p.regionCode,
    categoria: p.categoria,
    age_bracket_code: p.ageBracketCode,
    plan_code: p.planCode,
    monto: p.monto,
  }));

  if (target.existingId) {
    const { error: rpcErr } = await supabase.rpc("overwrite_active_price_list", {
      p_version_id: target.existingId,
      p_rows: rows,
      p_source_filename: file.name,
      p_parse_report: parsed.report,
      p_actor_id: actor.id,
    });
    if (rpcErr) {
      return { ok: false, error: "No se pudieron reemplazar los precios: " + rpcErr.message };
    }

    await logAction({
      actorId: actor.id,
      action: modo === "pisar" ? "price_list.overwrite_active" : "price_list.overwrite_proximo",
      targetType: "price_list_version",
      targetId: target.existingId,
      meta: parsed.report,
    });

    revalidatePath("/super-admin/price-lists");
    revalidatePath("/quotes");
    return {
      ok: true,
      versionId: target.existingId,
      vigenciaLabel: formatVigencia(target.vigencia, (target.existingVersionNum ?? 1) + 1),
      vigenteDeInmediato: modo === "pisar",
      report: parsed.report,
    };
  }

  // Sin versión previa para esa vigencia (siempre "próximo mes", la primera
  // vez): se crea nueva, Ver.1.
  const { data: version, error: versionErr } = await supabase
    .from("price_list_versions")
    .insert({
      source_filename: file.name,
      status: "draft",
      uploaded_by: actor.id,
      parse_report: parsed.report,
      vigencia_anio: target.vigencia.anio,
      vigencia_mes: target.vigencia.mes,
    })
    .select("id, version_num")
    .single();

  if (versionErr || !version) {
    return { ok: false, error: "No se pudo crear la versión: " + (versionErr?.message ?? "") };
  }

  const priceRows = rows.map((r) => ({ ...r, price_list_version_id: version.id }));
  const { error: pricesErr } = await supabase.from("prices").insert(priceRows);
  if (pricesErr) {
    // limpiar la versión huérfana si falló la inserción de precios
    await supabase.from("price_list_versions").delete().eq("id", version.id);
    return { ok: false, error: "No se pudieron guardar los precios: " + pricesErr.message };
  }

  await logAction({ actorId: actor.id, action: "price_list.upload", targetType: "price_list_version", targetId: version.id, meta: parsed.report });

  revalidatePath("/super-admin/price-lists");
  revalidatePath("/quotes");
  return {
    ok: true,
    versionId: version.id,
    vigenciaLabel: formatVigencia(target.vigencia, version.version_num),
    vigenteDeInmediato: false,
    report: parsed.report,
  };
}

