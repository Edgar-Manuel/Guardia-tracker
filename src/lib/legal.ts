// Motor de detección de posibles incumplimientos de la normativa laboral.
// Compara los registros con los umbrales del Estatuto de los Trabajadores
// (valores por defecto) o del convenio aplicable (ajustables en Ajustes).
//
// IMPORTANTE: estas alertas son orientativas y NO constituyen asesoramiento
// jurídico. El texto del descargo está en DESCARGO_LEGAL.
import type { Ajustes, AlertaLegal, Aviso } from './types';
import { estadisticasDia, finAviso, inicioAviso, type Datos } from './stats';
import {
  fechaADate,
  fmtDuracion,
  fmtFechaCorta,
  inicioSemana,
  minutosEntre,
  nowISO,
  rangoFechas,
  sumarDias,
} from './time';

export const DESCARGO_LEGAL =
  'Las alertas de esta aplicación se calculan automáticamente a partir de los datos ' +
  'registrados y de los umbrales configurados. Tienen carácter meramente informativo y ' +
  'no constituyen asesoramiento jurídico. Para valorar un posible incumplimiento consulte ' +
  'con un profesional o con la representación legal de los trabajadores.';

/**
 * Huecos (en minutos) sin avisos NI guardias dentro de la ventana
 * [desde, hastaExclusiva), incluyendo los bordes. Las guardias cuentan como
 * presencia: estar disponible no es descansar.
 */
function huecosSinPresencia(desde: string, hastaExclusiva: string, datos: Datos): number[] {
  const inicioMs = fechaADate(desde).getTime();
  const finMs = fechaADate(hastaExclusiva).getTime();
  const ahora = nowISO();
  const presencia: Array<[number, number]> = [];
  for (const a of datos.avisos) {
    const ini = inicioAviso(a);
    const fin = finAviso(a);
    if (ini && fin) presencia.push([new Date(ini).getTime(), new Date(fin).getTime()]);
  }
  for (const g of datos.guardias) {
    presencia.push([new Date(g.inicio).getTime(), new Date(g.fin ?? ahora).getTime()]);
  }
  presencia.sort((x, y) => x[0] - y[0]);

  const huecos: number[] = [];
  let cursor = inicioMs;
  for (const [s, e] of presencia) {
    if (e <= inicioMs || s >= finMs) continue;
    if (s - cursor > 0) huecos.push(Math.round((s - cursor) / 60000));
    cursor = Math.max(cursor, e);
  }
  if (finMs - cursor > 0) huecos.push(Math.round((finMs - cursor) / 60000));
  return huecos;
}

function mayorHuecoSinPresencia(desde: string, hastaExclusiva: string, datos: Datos): number {
  return huecosSinPresencia(desde, hastaExclusiva, datos).reduce((m, h) => Math.max(m, h), 0);
}

function ultimoFinTrabajo(fecha: string, avisos: Aviso[]): string | null {
  let ultimo: string | null = null;
  for (const a of avisos) {
    if (a.fecha !== fecha) continue;
    const fin = finAviso(a);
    if (fin && (!ultimo || fin > ultimo)) ultimo = fin;
  }
  return ultimo;
}

function primerInicioTrabajo(fecha: string, avisos: Aviso[]): string | null {
  let primero: string | null = null;
  for (const a of avisos) {
    if (a.fecha !== fecha) continue;
    const ini = inicioAviso(a);
    if (ini && (!primero || ini < primero)) primero = ini;
  }
  return primero;
}

/** Analiza un rango de fechas y devuelve las alertas detectadas, ordenadas por fecha. */
export function analizarCumplimiento(
  desde: string,
  hasta: string,
  datos: Datos,
  ajustes: Ajustes
): AlertaLegal[] {
  const alertas: AlertaLegal[] = [];
  const fechas = rangoFechas(desde, hasta);
  const porDia = new Map(fechas.map((f) => [f, estadisticasDia(f, datos, ajustes)]));

  for (const fecha of fechas) {
    const dia = porDia.get(fecha)!;

    // Jornada diaria excesiva
    if (dia.minEfectivos > ajustes.maxJornadaDiaria * 60) {
      alertas.push({
        fecha,
        severidad: dia.minEfectivos > (ajustes.maxJornadaDiaria + 2) * 60 ? 'grave' : 'aviso',
        titulo: 'Jornada diaria superior a la permitida',
        detalle: `Trabajo efectivo de ${fmtDuracion(dia.minEfectivos)} el ${fmtFechaCorta(fecha)}; el límite configurado es de ${ajustes.maxJornadaDiaria} h.`,
        referencia: 'ET art. 34.3',
      });
    }

    // Amplitud de jornada excesiva: mucho tiempo de disponibilidad real aunque
    // el trabajo efectivo quede dentro del límite (p. ej. 8 h repartidas en 16 h).
    if (dia.minAmplitud > ajustes.maxAmplitudDiaria * 60) {
      alertas.push({
        fecha,
        severidad: 'aviso',
        titulo: 'Amplitud de jornada elevada',
        detalle: `Del primer aviso al cierre del último transcurrieron ${fmtDuracion(dia.minAmplitud)} el ${fmtFechaCorta(fecha)} (trabajo efectivo: ${fmtDuracion(dia.minEfectivos)}; umbral configurado: ${ajustes.maxAmplitudDiaria} h). El tiempo de presencia está regulado en el transporte por carretera.`,
        referencia: 'RD 1561/1995 (tiempos de presencia)',
      });
    }

    // Jornada nocturna (≥ 3 h en periodo nocturno)
    if (dia.minNocturnos >= 180) {
      alertas.push({
        fecha,
        severidad: 'info',
        titulo: 'Jornada nocturna',
        detalle: `${fmtDuracion(dia.minNocturnos)} de trabajo entre las ${ajustes.inicioNocturno} y las ${ajustes.finNocturno} el ${fmtFechaCorta(fecha)}. Puede tener la consideración de trabajo nocturno.`,
        referencia: 'ET art. 36.1',
      });
    }

    // Pausa insuficiente en jornada continuada > 6 h
    if (dia.minEfectivos > 6 * 60 && dia.minDescanso < ajustes.minPausaJornadaContinuada) {
      alertas.push({
        fecha,
        severidad: 'aviso',
        titulo: 'Pausa insuficiente en jornada continuada',
        detalle: `Más de 6 h de trabajo el ${fmtFechaCorta(fecha)} con solo ${fmtDuracion(dia.minDescanso)} de descanso registrado (mínimo ${ajustes.minPausaJornadaContinuada} min).`,
        referencia: 'ET art. 34.4',
      });
    }

    // Descanso entre jornadas < 12 h
    const finHoy = ultimoFinTrabajo(fecha, datos.avisos);
    const inicioManana = primerInicioTrabajo(sumarDias(fecha, 1), datos.avisos);
    const gap = minutosEntre(finHoy, inicioManana);
    if (gap != null && gap < ajustes.minDescansoEntreJornadas * 60) {
      alertas.push({
        fecha,
        severidad: 'grave',
        titulo: 'Descanso entre jornadas insuficiente',
        detalle: `Solo ${fmtDuracion(gap)} entre el fin del trabajo del ${fmtFechaCorta(fecha)} y el inicio del día siguiente (mínimo ${ajustes.minDescansoEntreJornadas} h).`,
        referencia: 'ET art. 34.3',
      });
    }

    // Guardias de presencia muy largas
    if (dia.minGuardia > 24 * 60) {
      alertas.push({
        fecha,
        severidad: 'aviso',
        titulo: 'Tiempo de presencia muy elevado',
        detalle: `${fmtDuracion(dia.minGuardia)} de guardia/presencia el ${fmtFechaCorta(fecha)}.`,
        referencia: 'Convenio aplicable (tiempo de presencia)',
      });
    }
  }

  // Análisis semanal: horas efectivas y descanso semanal
  const semanas = new Set(fechas.map((f) => inicioSemana(f)));
  for (const lunes of Array.from(semanas).sort()) {
    const diasSemana = rangoFechas(lunes, sumarDias(lunes, 6));
    let minSemana = 0;
    for (const f of diasSemana) {
      const d = porDia.get(f) ?? estadisticasDia(f, datos, ajustes);
      minSemana += d.minEfectivos;
    }

    if (minSemana > ajustes.maxSemana * 60) {
      alertas.push({
        fecha: lunes,
        severidad: 'aviso',
        titulo: 'Jornada semanal superior a la permitida',
        detalle: `${fmtDuracion(minSemana)} de trabajo efectivo en la semana del ${fmtFechaCorta(lunes)} (límite semanal de referencia: ${ajustes.maxSemana} h de promedio anual).`,
        referencia: 'ET art. 34.1',
      });
    }

    // Descanso semanal: mayor hueco sin trabajo NI guardia dentro de la semana.
    // Las guardias cuentan como presencia (estar disponible no es descansar):
    // una semana de guardia 24/7 no tiene descanso semanal aunque haya huecos
    // sin avisos. Solo se evalúa en semanas con 5+ días de actividad para no
    // generar falsos positivos con registros incompletos.
    const diasConActividad = diasSemana.filter((f) => {
      const d = porDia.get(f) ?? estadisticasDia(f, datos, ajustes);
      return d.minEfectivos > 0 || d.minGuardia > 0 || d.numAvisos > 0;
    }).length;
    if (diasConActividad >= 5) {
      const mayorHueco = mayorHuecoSinPresencia(lunes, sumarDias(lunes, 7), datos);
      if (mayorHueco < ajustes.minDescansoSemanal * 60) {
        alertas.push({
          fecha: lunes,
          severidad: 'aviso',
          titulo: 'Posible descanso semanal insuficiente',
          detalle: `El mayor periodo sin avisos ni guardia en la semana del ${fmtFechaCorta(lunes)} fue de ${fmtDuracion(mayorHueco)} (mínimo orientativo: ${ajustes.minDescansoSemanal} h ininterrumpidas, acumulable en periodos de hasta 14 días).`,
          referencia: 'ET art. 37.1',
        });
      }
    }
  }

  // Descanso acumulado en 14 días: el ET permite acumular el día y medio
  // semanal en periodos de hasta 14 días, así que dos semanas seguidas deben
  // reunir al menos 2 × el mínimo en bloques ininterrumpidos que lo alcancen.
  // Clave para ciclos como «semana de 12 h (libra sáb-dom) + semana 24/7»,
  // que encadenan 12 días seguidos de presencia.
  const lunesOrdenados = Array.from(semanas).sort();
  for (const lunes of lunesOrdenados) {
    const finVentana = sumarDias(lunes, 13);
    if (finVentana > hasta) break;
    const diasVentana = rangoFechas(lunes, finVentana);
    const diasConActividad = diasVentana.filter((f) => {
      const d = porDia.get(f) ?? estadisticasDia(f, datos, ajustes);
      return d.minEfectivos > 0 || d.minGuardia > 0 || d.numAvisos > 0;
    }).length;
    if (diasConActividad < 8) continue;
    const minimo = ajustes.minDescansoSemanal * 60;
    const bloques = huecosSinPresencia(lunes, sumarDias(lunes, 14), datos).filter((h) => h >= minimo);
    const acumulado = bloques.reduce((s, h) => s + h, 0);
    if (acumulado < minimo * 2) {
      alertas.push({
        fecha: lunes,
        severidad: 'grave',
        titulo: 'Descanso acumulado en 14 días insuficiente',
        detalle: `Entre el ${fmtFechaCorta(lunes)} y el ${fmtFechaCorta(finVentana)} los periodos de descanso de al menos ${ajustes.minDescansoSemanal} h suman ${fmtDuracion(acumulado)} (referencia: ${ajustes.minDescansoSemanal * 2} h en 14 días). Estar de guardia cuenta como presencia, no como descanso.`,
        referencia: 'ET art. 37.1',
      });
    }
  }

  // Tiempo de presencia (RD 1561/1995 art. 8): la guardia sin trabajo efectivo
  // no puede superar las horas semanales configuradas en promedio mensual.
  // Solo se evalúa cuando el rango analizado se acerca al mes (≥ 28 días),
  // que es el periodo de referencia de la norma.
  if (fechas.length >= 28) {
    let minPresencia = 0;
    for (const f of fechas) {
      const d = porDia.get(f)!;
      minPresencia += Math.max(0, d.minGuardia - d.minEfectivos);
    }
    const promedioSemanal = Math.round(minPresencia / (fechas.length / 7));
    if (promedioSemanal > ajustes.maxPresenciaSemanal * 60) {
      alertas.push({
        fecha: desde,
        severidad: 'grave',
        titulo: 'Tiempo de presencia semanal superior al permitido',
        detalle: `Entre el ${fmtFechaCorta(desde)} y el ${fmtFechaCorta(hasta)} el tiempo de presencia (guardia sin trabajo efectivo) promedia ${fmtDuracion(promedioSemanal)} por semana; el límite configurado es de ${ajustes.maxPresenciaSemanal} h semanales de promedio mensual.`,
        referencia: 'RD 1561/1995 art. 8',
      });
    }
  }

  // Horas extraordinarias acumuladas en el año del inicio del rango
  const anio = desde.slice(0, 4);
  let minExtraAnio = 0;
  for (const f of rangoFechas(`${anio}-01-01`, hasta)) {
    minExtraAnio += (porDia.get(f) ?? estadisticasDia(f, datos, ajustes)).minExtra;
  }
  if (minExtraAnio > ajustes.maxHorasExtraAnuales * 60) {
    alertas.push({
      fecha: hasta,
      severidad: 'grave',
      titulo: 'Horas extraordinarias anuales superadas',
      detalle: `${fmtDuracion(minExtraAnio)} de exceso sobre la jornada diaria acumuladas en ${anio} (máximo legal general: ${ajustes.maxHorasExtraAnuales} h/año).`,
      referencia: 'ET art. 35.2',
    });
  }

  return alertas.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
