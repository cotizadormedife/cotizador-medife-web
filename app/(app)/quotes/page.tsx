import {
  getRegionsAndFiliales,
  loadAllDiscountPolicies,
  listSelectablePriceListVersions,
  getPriceListVersionInfo,
  getVigenciaSelection,
} from "@/lib/pricing/repository";
import { getCurrentProfile } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/service";
import QuoteForm, { type QuoteFormInitial, type VersionBundle } from "./QuoteForm";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ rehacer?: string }>;
}) {
  const { rehacer } = await searchParams;

  const [profile, selectablePriceListVersions, vigenciaSelection] = await Promise.all([
    getCurrentProfile(),
    listSelectablePriceListVersions(),
    getVigenciaSelection(),
  ]);

  let initial: QuoteFormInitial | null = null;
  if (rehacer && profile) {
    const supabase = createServiceClient();
    const { data: quote } = await supabase
      .from("quotes")
      .select("created_by, vendedor_nombre, asociado_nombre, vigencia, price_list_version_id, input")
      .eq("id", rehacer)
      .single();

    const puedeRehacer =
      quote && (quote.created_by === profile.id || profile.role === "admin" || profile.role === "super_admin");

    if (puedeRehacer) {
      const input = quote.input as any;
      initial = {
        vendedor: quote.vendedor_nombre,
        asociado: quote.asociado_nombre,
        region: input.region,
        categoria: input.categoria,
        procedencia: input.procedencia,
        filial: input.filial,
        vigencia: quote.vigencia ?? "",
        miembros: input.miembros,
        selectedPolicyIds: input.selectedPolicyIds,
        priceListVersionId: quote.price_list_version_id,
      };
    }
  }

  // Si la cotización que se está re-cotizando usó una lista que hoy está
  // deshabilitada (RF-44), igual hay que poder mostrarla en el combo para no
  // perder el dato original — se agrega aparte, marcada como deshabilitada.
  let priceListVersions = selectablePriceListVersions;
  if (initial?.priceListVersionId && !priceListVersions.some((v) => v.id === initial!.priceListVersionId)) {
    const original = await getPriceListVersionInfo(initial.priceListVersionId);
    if (original) {
      priceListVersions = [{ ...original, disabled: true }, ...priceListVersions];
    }
  }

  // RF-65: la lista de "mes siguiente" puede seguir en borrador — no forma
  // parte de selectablePriceListVersions (RF-41), así que se agrega aparte
  // para que el combo "Lista a utilizar" la pueda mostrar seleccionada.
  if (vigenciaSelection.siguiente && !priceListVersions.some((v) => v.id === vigenciaSelection.siguiente!.id)) {
    const siguiente = await getPriceListVersionInfo(vigenciaSelection.siguiente.id);
    if (siguiente) {
      priceListVersions = [siguiente, ...priceListVersions];
    }
  }

  // RF-M9: se precarga el set completo (regiones, filiales, descuentos) de
  // cada lista que el cotizador puede llegar a mostrar — así, al cambiar
  // "Lista a utilizar" en el cliente, todo se conmuta al instante, sin ida
  // y vuelta al servidor.
  const versionIdsToBundle = Array.from(
    new Set(
      [vigenciaSelection.actual?.id, vigenciaSelection.siguiente?.id, initial?.priceListVersionId].filter(
        (id): id is string => Boolean(id)
      )
    )
  );
  const bundleEntries = await Promise.all(
    versionIdsToBundle.map(async (versionId) => {
      const [{ regions, filiales }, policies] = await Promise.all([
        getRegionsAndFiliales(versionId),
        loadAllDiscountPolicies(versionId),
      ]);
      return [versionId, { regions, filiales, policies }] as [string, VersionBundle];
    })
  );
  const bundlesByVersionId: Record<string, VersionBundle> = Object.fromEntries(bundleEntries);

  return (
    <QuoteForm
      bundlesByVersionId={bundlesByVersionId}
      priceListVersions={priceListVersions}
      vigenciaSelection={vigenciaSelection}
      vendedorDefault={`${profile?.nombre ?? ""} ${profile?.apellido ?? ""}`.trim()}
      initial={initial}
    />
  );
}
