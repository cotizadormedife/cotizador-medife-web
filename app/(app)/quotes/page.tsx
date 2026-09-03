import { getRegionsAndFiliales, loadAllDiscountPolicies, listSelectablePriceListVersions, getPriceListVersionInfo } from "@/lib/pricing/repository";
import { getCurrentProfile } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/service";
import QuoteForm, { type QuoteFormInitial } from "./QuoteForm";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ rehacer?: string }>;
}) {
  const { rehacer } = await searchParams;

  const [{ regions, filiales }, policies, profile, selectablePriceListVersions] = await Promise.all([
    getRegionsAndFiliales(),
    loadAllDiscountPolicies(),
    getCurrentProfile(),
    listSelectablePriceListVersions(),
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
        vigencia: (quote.vigencia as "actual" | "siguiente") ?? "actual",
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

  return (
    <QuoteForm
      regions={regions}
      filiales={filiales}
      policies={policies}
      priceListVersions={priceListVersions}
      vendedorDefault={`${profile?.nombre ?? ""} ${profile?.apellido ?? ""}`.trim()}
      initial={initial}
    />
  );
}
