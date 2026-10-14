// RF-104: la base guarda cada fecha/hora en UTC (correcto y estándar), pero
// el servidor de Vercel también corre en UTC — formatear sin indicar la zona
// mostraba la hora 3 horas adelantada (y la fecha del día siguiente después de
// las 21:00). Todo lo que se muestre o filtre por fecha pasa por acá, con la
// hora de Argentina.

export const ZONA_ARGENTINA = "America/Argentina/Buenos_Aires";

// Formato fijo "d/M/aaaa, HH:mm:ss" en 24 horas: el "es-AR" por defecto de
// las versiones actuales de Node muestra la hora en formato de 12 horas SIN
// "a. m./p. m." (22:30 se vería como "10:30"), lo que se presta a confusión.
const FORMATO_FECHA_HORA = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA_ARGENTINA,
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function fmtFechaHoraAR(valor: string | Date): string {
  return FORMATO_FECHA_HORA.format(new Date(valor));
}

export function fmtFechaAR(valor: string | Date = new Date()): string {
  return new Date(valor).toLocaleDateString("es-AR", { timeZone: ZONA_ARGENTINA });
}

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

// Filtros por día ("AAAA-MM-DD", lo que manda <input type="date">): Argentina
// no tiene horario de verano (UTC-3 fijo), así que el día arranca a las
// 00:00 -03:00. "Hasta" es inclusivo: se compara contra el inicio del día
// siguiente con "<". Devuelven null si el valor no es una fecha válida.
export function inicioDiaAR(dia: string | undefined): string | null {
  return dia && DIA.test(dia) ? `${dia}T00:00:00-03:00` : null;
}

export function inicioDiaSiguienteAR(dia: string | undefined): string | null {
  const m = dia ? DIA.exec(dia) : null;
  if (!m) return null;
  const siguiente = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  return `${siguiente.toISOString().slice(0, 10)}T00:00:00-03:00`;
}

// ── Meses completos en hora de Argentina (RF-106, Dashboard) ──────────────
// Los períodos del Dashboard siempre son meses calendario completos, medidos
// en hora de Argentina (UTC-3 fijo, sin horario de verano).

export type ClaveMes = string; // "AAAA-MM"

const NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const pad2 = (n: number) => String(n).padStart(2, "0");

export function claveMes(anio: number, mes: number): ClaveMes {
  return `${anio}-${pad2(mes)}`;
}

// Mes (en hora de Argentina) al que pertenece un instante guardado en UTC.
export function mesAR(valor: string | Date): ClaveMes {
  const t = new Date(valor).getTime() - 3 * 60 * 60 * 1000;
  return new Date(t).toISOString().slice(0, 7);
}

// Día ("AAAA-MM-DD") en Argentina al que pertenece un instante guardado en UTC.
export function diaAR(valor: string | Date): string {
  return new Date(new Date(valor).getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Año y mes de hoy en Argentina.
export function hoyAR(ahora: Date = new Date()): { anio: number; mes: number } {
  const [a, m] = mesAR(ahora).split("-").map(Number);
  return { anio: a, mes: m };
}

// Primer instante del mes y primer instante del mes siguiente (exclusivo).
export function limitesMesAR(clave: ClaveMes): { desde: string; hasta: string } {
  const [a, m] = clave.split("-").map(Number);
  const sig = m === 12 ? claveMes(a + 1, 1) : claveMes(a, m + 1);
  return { desde: `${clave}-01T00:00:00-03:00`, hasta: `${sig}-01T00:00:00-03:00` };
}

// "Todo el año": los meses que corresponden — los 12 de un año ya terminado,
// hasta el mes actual en el año en curso, ninguno en un año futuro.
export function mesesQueCorresponden(anio: number, hoy: { anio: number; mes: number }): number[] {
  const hasta = anio < hoy.anio ? 12 : anio === hoy.anio ? hoy.mes : 0;
  return Array.from({ length: hasta }, (_, i) => i + 1);
}

export function etiquetaMes(clave: ClaveMes): string {
  const [a, m] = clave.split("-").map(Number);
  return `${NOMBRES_MES[m - 1]} ${a}`;
}

// Primer y último día ("AAAA-MM-DD") de un mes, como los pide el filtro de fechas de
// "Todas las cotizaciones" (RF-118).
export function diasDelMes(clave: ClaveMes): { desde: string; hasta: string } {
  const [a, m] = clave.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { desde: `${clave}-01`, hasta: `${clave}-${pad2(ultimo)}` };
}

// Desde el primer día del primer mes hasta el último día del último mes.
export function diasDeLosMeses(claves: ClaveMes[]): { desde: string; hasta: string } | null {
  if (claves.length === 0) return null;
  const orden = [...claves].sort();
  return { desde: diasDelMes(orden[0]).desde, hasta: diasDelMes(orden[orden.length - 1]).hasta };
}
