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
