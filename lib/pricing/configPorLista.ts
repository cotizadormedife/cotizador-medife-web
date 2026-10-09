// RF-103: el tope de remuneración para aportes cambia todos los meses y viene
// en cada Excel — se guarda por lista en pricing_config con la clave
// "aporte_tope@<id de la lista>" (sin cambiar la estructura de la tabla). El
// valor general "aporte_tope" queda solo como respaldo para listas cargadas
// antes de este cambio o cuyo Excel no traía el dato.

const SEPARADOR = "@";

export function claveTopePorLista(versionId: string): string {
  return `aporte_tope${SEPARADOR}${versionId}`;
}

type FilaConfig = { key: string; value: unknown };

export function armarConfig(filas: FilaConfig[], versionId?: string): Record<string, number> {
  // Las claves por lista ("aporte_tope@...") no son parte de la configuración
  // general: se aplican solo para la lista con la que se está cotizando.
  const config: Record<string, number> = {};
  for (const f of filas) {
    if (!f.key.includes(SEPARADOR)) config[f.key] = Number(f.value);
  }
  if (versionId) {
    const propia = filas.find((f) => f.key === claveTopePorLista(versionId));
    const tope = propia ? Number(propia.value) : NaN;
    if (Number.isFinite(tope) && tope > 0) config.aporte_tope = tope;
  }
  return config;
}
