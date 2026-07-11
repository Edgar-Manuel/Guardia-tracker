// Cálculo de estadísticas a partir de los registros locales.
// Las métricas de tiempo (efectivo, guardia, nocturno, descanso) se recortan al
// día natural; las métricas por aviso (km, conducción, espera…) se atribuyen a
// la fecha del aviso.
import type { Ajustes, Aviso, Descanso, Guardia } from './types';
import {
  minutosEntre,
  minutosEnDia,
  minutosNocturnos,
  unirIntervalos,
  nowISO,
  fechaADate,
  rangoFechas,
} from './time';

export interface Datos {
  guardias: Guardia[];
  avisos: Aviso[];
  descansos: Descanso[];
}

export function inicioAviso(a: Aviso): string | null {
  return a.horaSalida ?? a.horaAsignacion ?? a.horaLlegada ?? a.horaInicioTrabajo ?? null;
}

export function finAviso(a: Aviso): string | null {
  return a.horaDisponible ?? a.horaFin ?? null;
}

export interface DuracionesAviso {
  /** Desde la salida (o asignación) hasta quedar disponible. */
  total: number | null;
  conduccion: number | null;
  espera: number | null;
  conCliente: number | null;
  parado: number | null;
  km: number | null;
}

export function duracionesAviso(a: Aviso): DuracionesAviso {
  return {
    total: minutosEntre(inicioAviso(a), finAviso(a)),
    conduccion: a.minConduccion ?? minutosEntre(a.horaSalida, a.horaLlegada),
    espera: a.minEspera ?? minutosEntre(a.horaLlegada, a.horaInicioTrabajo),
    conCliente: minutosEntre(a.horaLlegada, a.horaFin),
    parado: a.minParado,
    km: a.kmInicio != null && a.kmFin != null && a.kmFin >= a.kmInicio ? a.kmFin - a.kmInicio : null,
  };
}

export interface EstadisticasDia {
  fecha: string;
  minEfectivos: number;
  minGuardia: number;
  minNocturnos: number;
  minExtra: number;
  minDescanso: number;
  minConduccion: number;
  minConCliente: number;
  minEspera: number;
  minParado: number;
  numAvisos: number;
  km: number;
  /**
   * Amplitud de la jornada: del inicio del primer aviso del día al cierre del
   * último (puede cruzar medianoche). Mide la disponibilidad real, no el
   * trabajo efectivo: 8 h efectivas pueden repartirse en 16 h de amplitud.
   */
  minAmplitud: number;
}

/** Recorta un intervalo abierto usando la hora actual como fin provisional. */
function finODefecto(fin: string | null): string {
  return fin ?? nowISO();
}

function solapaDia(inicio: string | null, fin: string | null, fecha: string): boolean {
  if (!inicio) return false;
  const dia = fechaADate(fecha).getTime();
  const diaFin = dia + 24 * 60 * 60000;
  const s = new Date(inicio).getTime();
  const e = new Date(finODefecto(fin)).getTime();
  return s < diaFin && e > dia;
}

export function estadisticasDia(fecha: string, datos: Datos, ajustes: Ajustes): EstadisticasDia {
  const r: EstadisticasDia = {
    fecha,
    minEfectivos: 0,
    minGuardia: 0,
    minNocturnos: 0,
    minExtra: 0,
    minDescanso: 0,
    minConduccion: 0,
    minConCliente: 0,
    minEspera: 0,
    minParado: 0,
    numAvisos: 0,
    km: 0,
    minAmplitud: 0,
  };

  const dia0 = fechaADate(fecha).getTime();
  const dia24 = dia0 + 24 * 60 * 60000;
  // Tramos de trabajo recortados al día; se fusionan para que los avisos
  // solapados (uno entra antes de cerrar el anterior) no cuenten dos veces.
  const tramos: Array<[number, number]> = [];
  let primerInicio: number | null = null;
  let ultimoFin: number | null = null;

  for (const a of datos.avisos) {
    const ini = inicioAviso(a);
    if (ini && solapaDia(ini, finAviso(a), fecha)) {
      const fin = finODefecto(finAviso(a));
      tramos.push([
        Math.max(new Date(ini).getTime(), dia0),
        Math.min(new Date(fin).getTime(), dia24),
      ]);
    }
    if (a.fecha === fecha) {
      r.numAvisos += 1;
      const d = duracionesAviso(a);
      r.minConduccion += d.conduccion ?? 0;
      r.minConCliente += d.conCliente ?? 0;
      r.minEspera += d.espera ?? 0;
      r.minParado += d.parado ?? 0;
      r.km += d.km ?? 0;
      if (ini) {
        const s = new Date(ini).getTime();
        const e = new Date(finODefecto(finAviso(a))).getTime();
        if (primerInicio === null || s < primerInicio) primerInicio = s;
        if (ultimoFin === null || e > ultimoFin) ultimoFin = e;
      }
    }
  }

  for (const [s, e] of unirIntervalos(tramos)) {
    r.minEfectivos += Math.round((e - s) / 60000);
    r.minNocturnos += minutosNocturnos(
      new Date(s).toISOString(),
      new Date(e).toISOString(),
      ajustes.inicioNocturno,
      ajustes.finNocturno
    );
  }

  if (primerInicio !== null && ultimoFin !== null && ultimoFin > primerInicio) {
    r.minAmplitud = Math.round((ultimoFin - primerInicio) / 60000);
  }

  for (const g of datos.guardias) {
    if (solapaDia(g.inicio, g.fin, fecha)) {
      r.minGuardia += minutosEnDia(g.inicio, finODefecto(g.fin), fecha);
    }
  }

  for (const d of datos.descansos) {
    if (solapaDia(d.inicio, d.fin, fecha)) {
      r.minDescanso += minutosEnDia(d.inicio, finODefecto(d.fin), fecha);
    }
  }

  r.minExtra = Math.max(0, r.minEfectivos - ajustes.maxJornadaDiaria * 60);
  return r;
}

export interface EstadisticasRango {
  desde: string;
  hasta: string;
  dias: EstadisticasDia[];
  minEfectivos: number;
  minGuardia: number;
  minNocturnos: number;
  minExtra: number;
  minDescanso: number;
  minConduccion: number;
  minConCliente: number;
  minEspera: number;
  minParado: number;
  numAvisos: number;
  km: number;
  /** Suma de amplitudes diarias (disponibilidad real de primer a último aviso). */
  minAmplitud: number;
  /** Duración media de un aviso (salida → disponible), en minutos. */
  mediaDuracionAviso: number | null;
  /** Tiempo medio entre el fin de un aviso y el inicio del siguiente, en minutos. */
  mediaEntreAvisos: number | null;
}

export function estadisticasRango(
  desde: string,
  hasta: string,
  datos: Datos,
  ajustes: Ajustes
): EstadisticasRango {
  const dias = rangoFechas(desde, hasta).map((f) => estadisticasDia(f, datos, ajustes));
  const r: EstadisticasRango = {
    desde,
    hasta,
    dias,
    minEfectivos: 0,
    minGuardia: 0,
    minNocturnos: 0,
    minExtra: 0,
    minDescanso: 0,
    minConduccion: 0,
    minConCliente: 0,
    minEspera: 0,
    minParado: 0,
    numAvisos: 0,
    km: 0,
    minAmplitud: 0,
    mediaDuracionAviso: null,
    mediaEntreAvisos: null,
  };
  for (const d of dias) {
    r.minEfectivos += d.minEfectivos;
    r.minGuardia += d.minGuardia;
    r.minNocturnos += d.minNocturnos;
    r.minExtra += d.minExtra;
    r.minDescanso += d.minDescanso;
    r.minConduccion += d.minConduccion;
    r.minConCliente += d.minConCliente;
    r.minEspera += d.minEspera;
    r.minParado += d.minParado;
    r.numAvisos += d.numAvisos;
    r.km += d.km;
    r.minAmplitud += d.minAmplitud;
  }

  const avisosRango = avisosEnRango(desde, hasta, datos.avisos);
  const duraciones = avisosRango
    .map((a) => duracionesAviso(a).total)
    .filter((t): t is number => t != null);
  if (duraciones.length > 0) {
    r.mediaDuracionAviso = Math.round(duraciones.reduce((s, t) => s + t, 0) / duraciones.length);
  }

  // Huecos entre avisos consecutivos del mismo día.
  const ordenados = avisosRango
    .map((a) => ({ ini: inicioAviso(a), fin: finAviso(a), fecha: a.fecha }))
    .filter((x): x is { ini: string; fin: string; fecha: string } => Boolean(x.ini && x.fin))
    .sort((a, b) => a.ini.localeCompare(b.ini));
  const huecos: number[] = [];
  for (let i = 1; i < ordenados.length; i++) {
    if (ordenados[i].fecha !== ordenados[i - 1].fecha) continue;
    const hueco = minutosEntre(ordenados[i - 1].fin, ordenados[i].ini);
    if (hueco != null) huecos.push(hueco);
  }
  if (huecos.length > 0) {
    r.mediaEntreAvisos = Math.round(huecos.reduce((s, h) => s + h, 0) / huecos.length);
  }

  return r;
}

export function avisosEnRango(desde: string, hasta: string, avisos: Aviso[]): Aviso[] {
  return avisos
    .filter((a) => a.fecha >= desde && a.fecha <= hasta)
    .sort((a, b) => (inicioAviso(a) ?? a.fecha).localeCompare(inicioAviso(b) ?? b.fecha));
}

export function guardiasEnRango(desde: string, hasta: string, guardias: Guardia[]): Guardia[] {
  return guardias
    .filter((g) => g.fecha >= desde && g.fecha <= hasta)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export function descansosEnRango(desde: string, hasta: string, descansos: Descanso[]): Descanso[] {
  return descansos
    .filter((d) => {
      const f = d.inicio.slice(0, 10);
      const fLocal = new Date(d.inicio);
      const fecha = `${fLocal.getFullYear()}-${String(fLocal.getMonth() + 1).padStart(2, '0')}-${String(fLocal.getDate()).padStart(2, '0')}`;
      return (fecha >= desde && fecha <= hasta) || (f >= desde && f <= hasta);
    })
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}
