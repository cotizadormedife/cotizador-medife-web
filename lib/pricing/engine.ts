import { PLANES } from "./types";
import type { DiscountPolicy, Miembro, PlanBreakdown, PricingData, QuoteInput, QuoteResult, CuotaProyeccion } from "./types";
import { esHijoElegibleAjuste, getMiembroKey, rangoEfectivo } from "./memberKey";
import {
  findAjusteHijosPolicy,
  findDescuentoFilialPolicy,
  findSegmentoJovenPolicies,
  isExclusionOk,
  isPolicyRelevant,
  isRequisitoCumplido,
} from "./policyEligibility";

const CUOTAS_PROYECCION = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 24];

function planFactor(policy: DiscountPolicy | null | undefined, planIdx: number): number {
  if (!policy) return 0;
  const rule = policy.planRules.find((r) => r.planCode === PLANES[planIdx]);
  if (!rule || !rule.aplica) return 0;
  return rule.valorOverride ?? policy.valorPct;
}

function planFactorAtMonth(policy: DiscountPolicy, planIdx: number, month: number): number {
  const base = planFactor(policy, planIdx);
  if (!base) return 0;
  if (policy.permanente) return base;
  if (policy.schedule.length > 1) {
    let acc = 0;
    for (const step of policy.schedule) {
      acc += step.months;
      if (month <= acc) return step.valorPct;
    }
    return 0;
  }
  if (policy.plazoMeses != null) return month <= policy.plazoMeses ? base : 0;
  return base;
}

function priceLookup(data: PricingData, ageBracketCode: string): number[] {
  const row = PLANES.map((planCode) => {
    const cell = data.prices.find((p) => p.ageBracketCode === ageBracketCode && p.planCode === planCode);
    return cell?.monto ?? 0;
  });
  return row;
}

export function computeQuote(input: QuoteInput, data: PricingData): QuoteResult {
  const isAMBA = input.region === "AMBA";
  const ctx = {
    region: input.region,
    categoria: input.categoria,
    procedencia: input.procedencia,
    filial: input.filial,
    miembros: input.miembros,
  };

  // 1. Precio base por integrante
  const memberPrices = input.miembros.map((m) => {
    const key = getMiembroKey(m.tipo, m.rango || "");
    return priceLookup(data, key);
  });
  const subtotales = PLANES.map((_, pi) => memberPrices.reduce((s, mp) => s + mp[pi], 0));

  // 2. Recargo geográfico — informativo, ya incluido en la lista de precios
  const filialesPatagonia = ["Comahue", "Patagonia Norte", "Patagonia Sur"];
  const filialesBahia = ["Bahía Blanca", "Mar del Plata"];
  const isPatagonia = input.region === "Patagonia" || filialesPatagonia.includes(input.filial);
  const isBahia = input.region.includes("MDQ") || input.region.includes("Bah") || filialesBahia.includes(input.filial);
  let recargoInfo: QuoteResult["recargoInfo"] = null;
  if (isPatagonia) {
    const rate = input.categoria === "Vol" ? 0.26 : 0.16;
    recargoInfo = { activo: true, pct: rate, detalle: "Comahue · Patagonia Norte · Patagonia Sur — incorporado en precios de lista" };
  } else if (isBahia && input.categoria === "Vol") {
    recargoInfo = { activo: true, pct: 0.05, detalle: "Bahía Blanca · Mar del Plata — incorporado en precios de lista (+5% Vol)" };
  }

  // 3. Políticas automáticas
  const ajusteHijosPolicy = findAjusteHijosPolicy(data.policies, ctx);
  const { h25: segJoven25Policy, h29: segJoven29Policy } = findSegmentoJovenPolicies(data.policies, ctx);
  const descFilialPolicy = findDescuentoFilialPolicy(data.policies, ctx);

  const hijoPesosAmt = PLANES.map((_, pi) => {
    const factor = planFactor(ajusteHijosPolicy, pi);
    if (!factor) return 0;
    let sum = 0;
    input.miembros.forEach((m, idx) => {
      if (m.tipo === "Hijo/a" && esHijoElegibleAjuste(rangoEfectivo(m))) sum += memberPrices[idx][pi];
    });
    return sum * factor;
  });
  const ajusteHijosAmt = hijoPesosAmt; // reproyección a % de grupo = mismo valor en $

  const segJovenPesosAmt = PLANES.map((_, pi) => {
    let sum = 0;
    const f25 = planFactor(segJoven25Policy, pi);
    if (f25) {
      input.miembros.forEach((m, idx) => {
        const tipoOk = isAMBA ? m.tipo === "Titular" : m.tipo === "Titular" || m.tipo === "Esposo/a";
        if (tipoOk && rangoEfectivo(m) === "0-25") sum += memberPrices[idx][pi] * f25;
      });
    }
    if (isAMBA) {
      const f29 = planFactor(segJoven29Policy, pi);
      if (f29) {
        input.miembros.forEach((m, idx) => {
          if (m.tipo === "Titular" && rangoEfectivo(m) === "26-35") sum += memberPrices[idx][pi] * f29;
        });
      }
    }
    return sum;
  });
  const segmentoJovenAmt = segJovenPesosAmt;

  // 4. Dto Nom = subtotal + ajuste hijos + segmento joven
  const dtoNomSinFilial = PLANES.map((_, pi) => subtotales[pi] + ajusteHijosAmt[pi] + segmentoJovenAmt[pi]);
  const subtotalAjustado = dtoNomSinFilial;

  // 5. Descuento filial (sobre dtoNom)
  const descFilialPct = planFactor(descFilialPolicy, 4); // referencia (PLATA) para mostrar en UI
  const descFilialAmt = PLANES.map((_, pi) => {
    const f = planFactor(descFilialPolicy, pi);
    return f ? dtoNomSinFilial[pi] * f : 0;
  });

  // 6. Descuentos comerciales seleccionados por el usuario
  // RF-61/RF-M8: algunas políticas exigen que otra también esté seleccionada
  // (requiereSlugPrefix, ej. Opción 6 exige Opción 4) o excluyen a otras
  // (excluyeOtros/excluyeGrupo, ej. Opción 7 excluye todo lo demás) — se
  // valida acá además del formulario, para que no dependa solo del cliente.
  const selectedSlugs = data.policies
    .filter((p) => input.selectedPolicyIds.includes(p.id))
    .map((p) => p.slug);
  const requisitoOk = data.policies.filter(
    (p) =>
      input.selectedPolicyIds.includes(p.id) &&
      isPolicyRelevant(p, ctx) &&
      isRequisitoCumplido(p, selectedSlugs)
  );
  const selectedPolicies = requisitoOk.filter((p) => isExclusionOk(p, requisitoOk));
  const gafPolicies = selectedPolicies.filter((p) => p.procedenciaGate === "GAF");
  const allBlanketPolicies = selectedPolicies.filter((p) => p.grupo !== "ajuste" && p.grupo !== "gaf");
  const mainBlanket = allBlanketPolicies.filter((p) => !p.concatenable);
  const concatBlanket = allBlanketPolicies.filter((p) => p.concatenable);
  const mainPlazo = mainBlanket.reduce((mx, p) => Math.max(mx, p.plazoMeses || 0), 0);

  const totalDtoByPlan = PLANES.map((_, pi) => {
    let t = 0;
    mainBlanket.forEach((p) => (t += planFactor(p, pi)));
    return Math.max(t, -0.7);
  });
  const precioConDto = subtotalAjustado.map((sub, pi) => sub * (1 + totalDtoByPlan[pi]) + descFilialAmt[pi]);

  // 7. UCC — monto fijo sobre subtotalAjustado (misma base que el descuento comercial)
  const uccPolicies = gafPolicies.filter((p) => p.tipo === "ucc");
  const nonUccGafPolicies = gafPolicies.filter((p) => p.tipo !== "ucc");
  const uccAmtByPlan = PLANES.map((_, pi) => {
    let t = 0;
    uccPolicies.forEach((p) => (t += planFactor(p, pi)));
    return subtotalAjustado[pi] * t;
  });
  const precioConUCC = precioConDto.map((p, pi) => p + uccAmtByPlan[pi]);

  // 8. IVA (Vol) / Aportes (Obl)
  function calcAporteMember(m: Miembro): number {
    if (m.obraSocial === "MONOTRIBUTO") {
      const monto = data.monotributoBrackets[m.monotributoCat || "A"] || 0;
      return monto * (data.config.monotributo_factor ?? 0.93);
    }
    const sueldo = m.sueldo || 0;
    if (!sueldo) return 0;
    const G = m.obraSocial === "OBRAS SOCIALES" ? data.config.aporte_factor_obras_sociales ?? 0.93 : data.config.aporte_factor_medife ?? 0.97;
    const E = data.config.aporte_pct_capado ?? 0.0255;
    const F = data.config.aporte_pct_no_capado ?? 0.051;
    const tope = data.config.aporte_tope ?? 4509567.41;
    return sueldo <= tope ? (sueldo * E + sueldo * F) * G : (tope * E + sueldo * F) * G;
  }
  const aporteTotal = input.categoria === "Obl" ? input.miembros.reduce((s, m) => s + calcAporteMember(m), 0) : 0;
  const ivaRate = data.config.iva_voluntario_pct ?? 0.105;
  const precioBase =
    input.categoria === "Vol" ? precioConUCC.map((p) => p * (1 + ivaRate)) : precioConUCC.map((p) => p - aporteTotal);

  // 9. GAF interés general — solo si NO hay ningún descuento comercial activo en ningún plan
  const hayBlanketGlobal = mainBlanket.some((p) => PLANES.some((_, qi) => planFactor(p, qi) !== 0));
  const totalNonUccGafByPlan = PLANES.map((_, pi) => {
    if (hayBlanketGlobal) return 0;
    let t = 0;
    nonUccGafPolicies.forEach((p) => (t += planFactor(p, pi)));
    return t;
  });
  const final = precioBase.map((p, pi) => Math.max(0, p * (1 + totalNonUccGafByPlan[pi])));

  // 10. Desglose por plan
  const planes: PlanBreakdown[] = PLANES.map((planCode, pi) => ({
    planCode,
    subtotal: subtotales[pi],
    ajusteHijos: ajusteHijosAmt[pi],
    segmentoJoven: segmentoJovenAmt[pi],
    dtoNom: dtoNomSinFilial[pi],
    descuentoFilialPct: planFactor(descFilialPolicy, pi),
    descuentoFilial: descFilialAmt[pi],
    descuentoComercialPct: totalDtoByPlan[pi],
    descuentoComercial: subtotalAjustado[pi] * totalDtoByPlan[pi],
    ucc: uccAmtByPlan[pi],
    iva: input.categoria === "Vol" ? precioConUCC[pi] * ivaRate : 0,
    aportes: input.categoria === "Obl" ? -aporteTotal : 0,
    gafInteresPct: totalNonUccGafByPlan[pi],
    gafInteres: final[pi] - precioBase[pi],
    total: final[pi],
  }));

  // 11. Proyección de cuotas
  // Bug real: acá se recalculaba con TODAS las políticas GAF relevantes para
  // el contexto (región/categoría/procedencia/filial), no solo las que el
  // vendedor tildó — con una política "Nac" (nacional, siempre relevante en
  // cualquier región) además de la seleccionada, el interés general de la
  // proyección terminaba sumando un descuento GAF extra que el precio de
  // "hoy" (nonUccGafPolicies, sección 9) correctamente no aplicaba.
  const gafInteresRate = PLANES.map((_, pi) => {
    let t = 0;
    nonUccGafPolicies.forEach((p) => (t += planFactor(p, pi)));
    return t;
  });

  const proyeccionCuotas: CuotaProyeccion[] = CUOTAS_PROYECCION.map((month) => {
    const dtoMes = PLANES.map((_, pi) => {
      let t = 0;
      mainBlanket.forEach((p) => (t += planFactorAtMonth(p, pi, month)));
      const offsetMonth = month - mainPlazo;
      if (offsetMonth >= 1) {
        concatBlanket.forEach((p) => {
          if (offsetMonth <= (p.plazoMeses || 0)) t += planFactor(p, pi);
        });
      }
      return Math.max(t, -0.7);
    });
    const precioMes = subtotalAjustado.map((sub, pi) => sub * (1 + dtoMes[pi]) + descFilialAmt[pi]);
    const uccMes = PLANES.map((_, pi) => {
      let t = 0;
      uccPolicies.forEach((p) => (t += planFactor(p, pi)));
      return subtotalAjustado[pi] * t;
    });
    const conUccMes = precioMes.map((p, pi) => p + uccMes[pi]);
    const baseMes = input.categoria === "Vol" ? conUccMes.map((p) => p * (1 + ivaRate)) : conUccMes.map((p) => p - aporteTotal);
    const anyMain = mainBlanket.some((p) => PLANES.some((_, qi) => planFactorAtMonth(p, qi, month) !== 0));
    const adjMonth = month - mainPlazo;
    const anyConcat = adjMonth >= 1 && concatBlanket.some((p) => adjMonth <= (p.plazoMeses || 0));
    const hayBlanketGlobalMes = anyMain || anyConcat;
    const nonUccGafMes = PLANES.map((_, pi) => (hayBlanketGlobalMes ? 0 : gafInteresRate[pi]));
    const finalMes = baseMes.map((p, pi) => Math.max(0, p * (1 + nonUccGafMes[pi])));

    return {
      month,
      gafActivo: !hayBlanketGlobalMes,
      porPlan: Object.fromEntries(PLANES.map((planCode, pi) => [planCode, finalMes[pi]])),
    };
  });

  // Uso interno: % equivalente por plan para Ajuste Hijos / Segmento Joven,
  // para cargar en el sistema de Medife sobre el total del grupo familiar.
  const ajusteHijosAplica = PLANES.map((_, pi) => planFactor(ajusteHijosPolicy, pi) !== 0);
  const segmentoJovenAplica = PLANES.map(
    (_, pi) => planFactor(segJoven25Policy, pi) !== 0 || (isAMBA && planFactor(segJoven29Policy, pi) !== 0)
  );
  const usoInternoPctByPlan = (amtByPlan: number[], aplica: boolean[]): (number | null)[] =>
    PLANES.map((_, pi) => (aplica[pi] && subtotales[pi] ? Math.abs(amtByPlan[pi]) / subtotales[pi] : null));
  const usoInterno = {
    ajusteHijosPct: usoInternoPctByPlan(ajusteHijosAmt, ajusteHijosAplica),
    segmentoJovenPct: usoInternoPctByPlan(segmentoJovenAmt, segmentoJovenAplica),
  };

  const activePolicies = [
    ...(ajusteHijosPolicy ? [ajusteHijosPolicy] : []),
    ...(segJoven25Policy ? [segJoven25Policy] : []),
    ...(segJoven29Policy ? [segJoven29Policy] : []),
    ...(descFilialPolicy ? [descFilialPolicy] : []),
    ...selectedPolicies,
  ].map((p) => ({ id: p.id, nombre: p.nombre, detalle: p.detalle, valorPct: p.valorPct }));

  return {
    priceListVersionId: data.priceListVersionId,
    planes,
    usoInterno,
    activePolicies,
    proyeccionCuotas,
    recargoInfo,
  };
}
