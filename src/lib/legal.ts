// Motor de detección de posibles incumplimientos de la normativa laboral.
// Compara los registros con los umbrales del Estatuto de los Trabajadores
// (valores por defecto) o del convenio aplicable (ajustables en Ajustes).
//
// IMPORTANTE: estas alertas son orientativas y NO constituyen asesoramiento
// jurídico. El texto del descargo está en DESCARGO_LEGAL.
import type { Ajustes, AlertaLegal, Aviso } from './types';
import { estadisticasDia, finAviso, inicioAviso, type Datos } from './stats';
import { fmtDuracion, fmtFechaCorta, inicioSemana, minutosEntre, rangoFechas, sumarDias } from './time';

export const DESCARGO_LEGAL =
  'Las alertas de esta aplicación se calculan automáticamente a partir de los datos ' +
  'registrados y de los umbrales configurados. Tienen carácter meramente informativo y ' +
  'no constituyen asesoramiento jurídico. Para valorar un posible incumplimiento consulte ' +
  'con un profesional o con la representación legal de los trabajadores.';

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

    // Descanso semanal: buscar el mayor hueco sin trabajo dentro de la semana.
    const intervalos = datos.avisos
      .filter((a) => a.fecha >= lunes && a.fecha <= sumarDias(lunes, 6))
      .map((a) => ({ ini: inicioAviso(a), fin: finAviso(a) }))
      .filter((x): x is { ini: string; fin: string } => Boolean(x.ini && x.fin))
      .sort((a, b) => a.ini.localeCompare(b.ini));
    if (intervalos.length >= 3) {
      let mayorHueco = 0;
      for (let i = 1; i < intervalos.length; i++) {
        const h = minutosEntre(intervalos[i - 1].fin, intervalos[i].ini);
        if (h != null && h > mayorHueco) mayorHueco = h;
      }
      if (mayorHueco > 0 && mayorHueco < ajustes.minDescansoSemanal * 60) {
        alertas.push({
          fecha: lunes,
          severidad: 'aviso',
          titulo: 'Posible descanso semanal insuficiente',
          detalle: `El mayor periodo sin avisos en la semana del ${fmtFechaCorta(lunes)} fue de ${fmtDuracion(mayorHueco)} (mínimo orientativo: ${ajustes.minDescansoSemanal} h ininterrumpidas).`,
          referencia: 'ET art. 37.1',
        });
      }
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
