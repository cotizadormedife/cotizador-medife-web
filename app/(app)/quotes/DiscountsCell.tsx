import { appliedDiscounts, fmtDiscountPct } from "@/lib/pricing/summary";

// RF-23: nombre y valor de cada descuento comercial elegido, uno debajo del
// otro en letra chica cuando hay más de uno.
export default function DiscountsCell({ input, output }: { input: any; output: any }) {
  const discounts = appliedDiscounts(input, output);
  if (discounts.length === 0) return <>—</>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {discounts.map((d, i) => (
        <span key={i} style={{ fontSize: 11 }}>
          {d.nombre}
          {d.valorPct != null ? `: ${fmtDiscountPct(d.valorPct)}` : ""}
        </span>
      ))}
    </div>
  );
}
