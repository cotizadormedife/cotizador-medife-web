"use server";

import { z } from "zod";
import { requireApprovedUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/service";
import { loadPricingData } from "@/lib/pricing/repository";
import { computeQuote } from "@/lib/pricing/engine";
import type { QuoteInput, QuoteResult } from "@/lib/pricing/types";

const miembroSchema = z.object({
  tipo: z.enum(["Titular", "Esposo/a", "Hijo/a", "Familiar a cargo"]),
  rango: z.string(),
  sueldo: z.number().optional(),
  obraSocial: z.enum(["OBRAS SOCIALES", "Medife", "MONOTRIBUTO"]).optional(),
  monotributoCat: z.string().optional(),
});

const inputSchema = z.object({
  vendedor: z.string(),
  asociado: z.string().min(1, "Ingresá el nombre del asociado."),
  region: z.string().min(1),
  categoria: z.enum(["Vol", "Obl"]),
  procedencia: z.enum(["Otros", "comprobable"]),
  filial: z.string().min(1),
  vigencia: z.string(),
  miembros: z.array(miembroSchema).min(1, "Agregá al menos un integrante."),
  selectedPolicyIds: z.array(z.string()),
  priceListVersionId: z.string().uuid().optional(),
});

export type RunQuoteState =
  | { ok: true; result: QuoteResult; quoteId: string; quoteNumber: number }
  | { ok: false; error: string };

export async function runQuoteAction(raw: unknown): Promise<RunQuoteState> {
  const profile = await requireApprovedUser();
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const form = parsed.data;

  const quoteInput: QuoteInput = {
    region: form.region,
    categoria: form.categoria,
    procedencia: form.procedencia,
    filial: form.filial,
    miembros: form.miembros,
    selectedPolicyIds: form.selectedPolicyIds,
  };

  let data;
  try {
    data = await loadPricingData(form.region, form.categoria, form.priceListVersionId);
  } catch (e: any) {
    return { ok: false, error: e.message ?? "No se pudo cargar la lista de precios." };
  }

  const result = computeQuote(quoteInput, data);

  const supabase = createServiceClient();
  const { data: inserted, error } = await supabase
    .from("quotes")
    .insert({
      created_by: profile.id,
      price_list_version_id: data.priceListVersionId,
      vendedor_nombre: form.vendedor || `${profile.nombre ?? ""} ${profile.apellido ?? ""}`.trim(),
      asociado_nombre: form.asociado,
      region_code: form.region,
      categoria: form.categoria,
      procedencia: form.procedencia,
      filial_code: form.filial,
      vigencia: form.vigencia,
      input: quoteInput,
      output: result,
    })
    .select("id, quote_number")
    .single();

  if (error) {
    return { ok: false, error: "La cotización se calculó pero no se pudo guardar: " + error.message };
  }

  return { ok: true, result, quoteId: inserted.id, quoteNumber: inserted.quote_number };
}
