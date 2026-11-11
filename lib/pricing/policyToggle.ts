import { isCompatible, isRequisitoCumplido, tacticosSolapan } from "./policyEligibility";
import type { DiscountPolicy } from "./types";

// Qué descuentos quedan tildados después de tildar/destildar uno en el formulario de cotización.
// Es la lógica de `togglePolicy` de QuoteForm, extraída para poder probarla.
export function aplicarToggle(policies: DiscountPolicy[], prev: string[], id: string, checked: boolean): string[] {
  const policyOf = (x: string) => policies.find((p) => p.id === x);
  const slugOf = (x: string) => policyOf(x)?.slug ?? "";

  let next = checked ? [...prev, id] : prev.filter((x) => x !== id);
  const slug = slugOf(id);
  if (checked && slug.startsWith("opcion-4")) next = next.filter((x) => !slugOf(x).startsWith("opcion-5"));
  if (checked && slug.startsWith("opcion-5")) next = next.filter((x) => !slugOf(x).startsWith("opcion-4"));
  // RF-60: Opción 1, 2 y 3 son mutuamente excluyentes entre sí.
  const isUno23 = (x: string) => {
    const s = slugOf(x);
    return s.startsWith("opcion-1") || s.startsWith("opcion-2") || s.startsWith("opcion-3");
  };
  if (checked && isUno23(id)) next = next.filter((x) => x === id || !isUno23(x));
  // RF-94: como mucho un descuento GAF activo a la vez — tildar uno destilda los demás.
  const isGaf = (x: string) => policyOf(x)?.grupo === "gaf";
  if (checked && isGaf(id)) next = next.filter((x) => x === id || !isGaf(x));
  // RF-M10: reglas de "no acumulable" leídas del Excel (excluyeOtros/excluyeGrupo) — al tildar una, se destilda en
  // el momento cualquier otra ya elegida que sea incompatible con ella, en cualquiera de los dos sentidos.
  if (checked) {
    const thisPolicy = policyOf(id);
    if (thisPolicy) {
      next = next.filter((x) => {
        const other = policyOf(x);
        return !other || isCompatible(thisPolicy, other);
      });
    }
  }
  // RF-124: dos descuentos tácticos que compiten por el mismo plan no se acumulan — al tildar uno se destilda el otro
  // (ya no se esconde el menor: se puede elegir cualquiera de los dos).
  if (checked) {
    const esta = policyOf(id);
    if (esta?.grupo === "tactico") {
      next = next.filter((x) => {
        const otra = policyOf(x);
        return x === id || !otra || otra.grupo !== "tactico" || !tacticosSolapan(esta, otra);
      });
    }
  }
  // RF-61 (generalizado): un descuento que EXIGE otro (requiereSlugPrefix, leído del Excel) se destilda solo si el
  // exigido no está elegido. Antes esto estaba escrito a mano para "opcion-6" → "opcion-4", que era cierto en las
  // listas de septiembre y octubre; en la de noviembre la Opción 6 es otra ("No acumulable con otros descuentos",
  // sin requisito) y esa regla vieja la destildaba apenas se la tildaba.
  const slugsElegidos = next.map(slugOf);
  next = next.filter((x) => {
    const p = policyOf(x);
    return !p || isRequisitoCumplido(p, slugsElegidos);
  });
  return next;
}
