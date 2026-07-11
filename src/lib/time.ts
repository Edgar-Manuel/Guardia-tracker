// Utilidades de fecha y hora. Todo el cálculo se hace en hora local del dispositivo.

export function nowISO(): string {
  return new Date().toISOString();
}

export function toDate(iso: string): Date {
  return new Date(iso);
}

/** 'YYYY-MM-DD' en hora local. */
export function fechaLocal(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fechaDeISO(iso: string): string {
  return fechaLocal(new Date(iso));
}

/** Minutos entre dos ISO; null si falta alguno o el orden es inverso. */
export function minutosEntre(inicio: string | null, fin: string | null): number | null {
  if (!inicio || !fin) return null;
  const ms = new Date(fin).getTime() - new Date(inicio).getTime();
  if (ms < 0) return null;
  return Math.round(ms / 60000);
}

/** Formatea minutos como '3 h 25 min' (o '45 min'). */
export function fmtDuracion(min: number | null | undefined): string {
  if (min == null) return '—';
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${r} min`;
}

/** Formatea minutos como horas decimales '7,5 h' para tablas compactas. */
export function fmtHoras(min: number | null | undefined): string {
  if (min == null) return '—';
  return `${(min / 60).toFixed(1).replace('.', ',')} h`;
}

export function fmtHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function fmtFechaCorta(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function fmtFechaLarga(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DIAS[date.getDay()]}, ${d} de ${MESES[m - 1]} de ${y}`;
}

export function nombreMes(mes: number): string {
  return MESES[mes];
}

/** Convierte 'YYYY-MM-DD' a Date local a medianoche. */
export function fechaADate(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function sumarDias(fecha: string, dias: number): string {
  const d = fechaADate(fecha);
  d.setDate(d.getDate() + dias);
  return fechaLocal(d);
}

/** Lunes de la semana a la que pertenece la fecha. */
export function inicioSemana(fecha: string): string {
  const d = fechaADate(fecha);
  const dow = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - dow);
  return fechaLocal(d);
}

export function inicioMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

export function finMes(fecha: string): string {
  const [y, m] = fecha.split('-').map(Number);
  return fechaLocal(new Date(y, m, 0));
}

/** Lista de fechas 'YYYY-MM-DD' entre dos incluidas. */
export function rangoFechas(desde: string, hasta: string): string[] {
  const out: string[] = [];
  let f = desde;
  while (f <= hasta) {
    out.push(f);
    f = sumarDias(f, 1);
  }
  return out;
}

function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Minutos de solape de un intervalo [inicio, fin] con el periodo nocturno
 * (p. ej. 22:00–06:00), que cruza medianoche.
 */
export function minutosNocturnos(
  inicioISO: string,
  finISO: string,
  inicioNocturno = '22:00',
  finNocturno = '06:00'
): number {
  const ini = new Date(inicioISO).getTime();
  const fin = new Date(finISO).getTime();
  if (fin <= ini) return 0;

  const nIni = parseHHMM(inicioNocturno);
  const nFin = parseHHMM(finNocturno);

  let total = 0;
  // Recorremos cada día natural que toca el intervalo y sumamos el solape
  // con las ventanas nocturnas [nIni, 24:00) y [00:00, nFin) de ese día.
  const cursor = new Date(ini);
  cursor.setHours(0, 0, 0, 0);
  while (cursor.getTime() < fin) {
    const dia0 = cursor.getTime();
    const ventanas: Array<[number, number]> = [];
    if (nIni > nFin) {
      // Periodo que cruza medianoche: 22:00–24:00 y 00:00–06:00
      ventanas.push([dia0 + nIni * 60000, dia0 + 24 * 60 * 60000]);
      ventanas.push([dia0, dia0 + nFin * 60000]);
    } else {
      ventanas.push([dia0 + nIni * 60000, dia0 + nFin * 60000]);
    }
    for (const [vIni, vFin] of ventanas) {
      const s = Math.max(ini, vIni);
      const e = Math.min(fin, vFin);
      if (e > s) total += (e - s) / 60000;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.round(total);
}

/**
 * Fusiona intervalos solapados [inicio, fin] en milisegundos.
 * Imprescindible para no contar dos veces el tiempo cuando un aviso entra
 * antes de cerrar el anterior.
 */
export function unirIntervalos(intervalos: Array<[number, number]>): Array<[number, number]> {
  const validos = intervalos.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  const unidos: Array<[number, number]> = [];
  for (const [s, e] of validos) {
    const ultimo = unidos[unidos.length - 1];
    if (ultimo && s <= ultimo[1]) {
      ultimo[1] = Math.max(ultimo[1], e);
    } else {
      unidos.push([s, e]);
    }
  }
  return unidos;
}

/** Recorta un intervalo ISO a un día local; devuelve minutos dentro de ese día. */
export function minutosEnDia(inicioISO: string, finISO: string, fecha: string): number {
  const dia = fechaADate(fecha).getTime();
  const diaFin = dia + 24 * 60 * 60000;
  const s = Math.max(new Date(inicioISO).getTime(), dia);
  const e = Math.min(new Date(finISO).getTime(), diaFin);
  return e > s ? Math.round((e - s) / 60000) : 0;
}

/** Para <input type="datetime-local">: ISO → 'YYYY-MM-DDTHH:MM' local. */
export function isoALocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 'YYYY-MM-DDTHH:MM' local → ISO; '' → null. */
export function localInputAISO(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}
