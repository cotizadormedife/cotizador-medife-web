"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/service";
import { parsePriceList } from "@/lib/excel/parsePriceList";
import { parseDiscountPolicies } from "@/lib/excel/parseDiscountPolicies";
import { parseRegionesFiliales, parsePlanesFromInfo } from "@/lib/excel/parseRegionesFiliales";
import { resolveUploadTarget } from "@/lib/pricing/repository";
import { formatVigencia } from "@/lib/pricing/vigencia";
import { logAction } from "@/lib/auditLog";

export type UploadState =
  | {
      ok: true;
      versionId: string;
      vigenciaLabel: string;
      vigenteDeInmediato: boolean;
      report: {
        totalCells: number;
        warnings: string[];
        errors: string[];
        regionsParsed: string[];
        totalPolicies: number;
        porGrupo: Record<string, number>;
        policyWarnings: string[];
        totalRegiones: number;
        totalFiliales: number;
        geoWarnings: string[];
        totalPlanes: number;
        planWarnings: string[];
      };
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
  const supabase = createServiceClient();

  // M13: los planes/productos vigentes (hoja "Info", columna "Producto") se
  // interpretan primero — tanto "Resumen LP" como "Políticas Comerciales"
  // necesitan esta lista (en orden) para ubicar sus columnas por plan.
  const { data: plansData } = await supabase.from("plans").select("code, nombre, sort_order");
  const existingPlanes = (plansData ?? []).map((p) => ({ code: p.code, nombre: p.nombre, sortOrder: p.sort_order }));
  let parsedPlanes;
  try {
    parsedPlanes = await parsePlanesFromInfo(buffer, existingPlanes);
  } catch (e: any) {
    return { ok: false, error: "No se pudo leer los planes/productos del archivo: " + (e.message ?? String(e)) };
  }
  if (parsedPlanes.report.errors.length > 0) {
    return { ok: false, error: parsedPlanes.report.errors.join(" ") };
  }
  const planes = parsedPlanes.planes;

  let parsed;
  try {
    parsed = await parsePriceList(buffer, planes);
  } catch (e: any) {
    return { ok: false, error: "No se pudo leer el archivo: " + (e.message ?? String(e)) };
  }
  if (!parsed.report.ok || parsed.prices.length === 0) {
    return { ok: false, error: parsed.report.errors.join(" ") || "El archivo no pudo interpretarse." };
  }

  // RF-M8: el mismo archivo trae también, en "Políticas Comerciales", el
  // modelo de descuentos/recargos — se interpreta acá y se carga junto con
  // los precios, versionado a la misma price_list_version.
  const { data: filiales } = await supabase.from("filiales").select("code, region_code, nombre, sort_order");
  const filialCodes = (filiales ?? []).map((f) => f.code);
  let parsedPolicies;
  try {
    parsedPolicies = await parseDiscountPolicies(buffer, filialCodes, planes);
  } catch (e: any) {
    return { ok: false, error: "No se pudo leer las políticas comerciales del archivo: " + (e.message ?? String(e)) };
  }
  if (!parsedPolicies.report.ok) {
    return { ok: false, error: parsedPolicies.report.errors.join(" ") || "No se pudo interpretar la hoja de políticas comerciales." };
  }

  // RF-M9: la hoja "Info" trae también qué regiones/filiales aplican a esta
  // carga — se valida contra el catálogo real (ya correcto y estable) y
  // hereda de ahí la región puntual de cada filial.
  const { data: regionsData } = await supabase.from("regions").select("code, nombre, sort_order");
  const existingRegions = (regionsData ?? []).map((r) => ({ code: r.code, nombre: r.nombre, sortOrder: r.sort_order }));
  const existingFiliales = (filiales ?? []).map((f) => ({ code: f.code, regionCode: f.region_code, nombre: f.nombre, sortOrder: f.sort_order }));
  let parsedGeo;
  try {
    parsedGeo = await parseRegionesFiliales(buffer, existingRegions, existingFiliales);
  } catch (e: any) {
    return { ok: false, error: "No se pudo leer regiones/filiales del archivo: " + (e.message ?? String(e)) };
  }
  if (parsedGeo.report.errors.length > 0) {
    return { ok: false, error: parsedGeo.report.errors.join(" ") };
  }

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

  const priceRows = parsed.prices.map((p) => ({
    region_code: p.regionCode,
    categoria: p.categoria,
    age_bracket_code: p.ageBracketCode,
    plan_code: p.planCode,
    monto: p.monto,
  }));
  const policyRows = parsedPolicies.policies;
  const regionRows = parsedGeo.regions;
  const filialRows = parsedGeo.filiales;
  const planRows = planes.map((p) => ({ code: p.code, nombre: p.nombre, sortOrder: p.sortOrder }));

  const combinedReport = {
    totalCells: parsed.report.totalCells,
    warnings: parsed.report.warnings,
    errors: parsed.report.errors,
    regionsParsed: parsed.report.regionsParsed,
    totalPolicies: parsedPolicies.report.totalPolicies,
    porGrupo: parsedPolicies.report.porGrupo,
    policyWarnings: parsedPolicies.report.warnings,
    totalRegiones: regionRows.length,
    totalFiliales: filialRows.length,
    geoWarnings: parsedGeo.report.warnings,
    totalPlanes: planRows.length,
    planWarnings: parsedPlanes.report.warnings,
  };

  if (target.existingId) {
    const { error: rpcErr } = await supabase.rpc("overwrite_price_list_version", {
      p_version_id: target.existingId,
      p_price_rows: priceRows,
      p_policy_rows: policyRows,
      p_source_filename: file.name,
      p_parse_report: combinedReport,
      p_actor_id: actor.id,
      p_region_rows: regionRows,
      p_filial_rows: filialRows,
      p_plan_rows: planRows,
    });
    if (rpcErr) {
      return { ok: false, error: "No se pudieron reemplazar los precios y descuentos: " + rpcErr.message };
    }

    await logAction({
      actorId: actor.id,
      action: modo === "pisar" ? "price_list.overwrite_active" : "price_list.overwrite_proximo",
      targetType: "price_list_version",
      targetId: target.existingId,
      meta: combinedReport,
    });

    revalidatePath("/super-admin/price-lists");
    revalidatePath("/quotes");
    return {
      ok: true,
      versionId: target.existingId,
      vigenciaLabel: formatVigencia(target.vigencia, (target.existingVersionNum ?? 1) + 1),
      vigenteDeInmediato: modo === "pisar",
      report: combinedReport,
    };
  }

  // Sin versión previa para esa vigencia (siempre "próximo mes", la primera
  // vez): se crea nueva, Ver.1, con precios y políticas juntos.
  const { data: newVersionId, error: rpcErr } = await supabase.rpc("insert_price_list_version", {
    p_source_filename: file.name,
    p_vigencia_anio: target.vigencia.anio,
    p_vigencia_mes: target.vigencia.mes,
    p_price_rows: priceRows,
    p_policy_rows: policyRows,
    p_parse_report: combinedReport,
    p_actor_id: actor.id,
    p_region_rows: regionRows,
    p_filial_rows: filialRows,
    p_plan_rows: planRows,
  });
  if (rpcErr || !newVersionId) {
    return { ok: false, error: "No se pudo crear la versión: " + (rpcErr?.message ?? "") };
  }

  await logAction({ actorId: actor.id, action: "price_list.upload", targetType: "price_list_version", targetId: newVersionId, meta: combinedReport });

  revalidatePath("/super-admin/price-lists");
  revalidatePath("/quotes");
  return {
    ok: true,
    versionId: newVersionId,
    vigenciaLabel: formatVigencia(target.vigencia, 1),
    vigenteDeInmediato: false,
    report: combinedReport,
  };
}
