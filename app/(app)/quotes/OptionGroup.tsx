"use client";

// `apilado`: cada opción va en su propia fila, a todo el ancho; si tiene `descripcion`, se muestra arriba de la opción
// (RF-122: "Lista a utilizar"). Sin descripción no se reserva espacio. Sin `apilado` queda como siempre (en fila).
export default function OptionGroup<T extends string>({
  name,
  value,
  onChange,
  options,
  apilado,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; descripcion?: string | null }[];
  apilado?: boolean;
}) {
  const tarjeta = (o: { value: T; label: string }) => (
    <label key={o.value} className="option-card" style={apilado ? { flex: "0 0 auto" } : undefined}>
      <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
      {o.label}
    </label>
  );
  if (!apilado) return <div className="option-group">{options.map(tarjeta)}</div>;
  return (
    <div className="option-group" style={{ flexDirection: "column", flexWrap: "nowrap", gap: 14 }}>
      {options.map((o) => (
        <div key={o.value} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {o.descripcion && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-neutral)" }}>{o.descripcion}</div>}
          {tarjeta(o)}
        </div>
      ))}
    </div>
  );
}
