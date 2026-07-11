// Exportación de datos a CSV, JSON y Excel, e importación del formato JSON
// propio. Todo se procesa en el navegador.
import type { Aviso, Descanso, Guardia } from './types';
import { TIPOS_DESCANSO, TIPOS_GUARDIA, TIPOS_SERVICIO } from './types';
import { duracionesAviso, type Datos } from './stats';
import { fmtHora, nowISO } from './time';
import { db } from './db';

function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --- Filas planas para CSV/Excel ---

export function filasAvisos(avisos: Aviso[]): Record<string, string | number | null>[] {
  return avisos.map((a) => {
    const d = duracionesAviso(a);
    return {
      Fecha: a.fecha,
      Tipo: TIPOS_SERVICIO[a.tipo],
      'Asignación': fmtHora(a.horaAsignacion),
      Salida: fmtHora(a.horaSalida),
      Llegada: fmtHora(a.horaLlegada),
      'Inicio trabajo': fmtHora(a.horaInicioTrabajo),
      'Fin': fmtHora(a.horaFin),
      Disponible: fmtHora(a.horaDisponible),
      'Duración (min)': d.total,
      'Conducción (min)': d.conduccion,
      'Espera (min)': d.espera,
      'Con cliente (min)': d.conCliente,
      'Parado (min)': d.parado,
      'Km inicio': a.kmInicio,
      'Km fin': a.kmFin,
      Km: d.km,
      Municipio: a.municipio,
      Destino: a.destino,
      Aseguradora: a.aseguradora,
      Observaciones: a.observaciones,
    };
  });
}

export function filasGuardias(guardias: Guardia[]): Record<string, string | number | null>[] {
  return guardias.map((g) => ({
    Fecha: g.fecha,
    Tipo: TIPOS_GUARDIA[g.tipo],
    Inicio: fmtHora(g.inicio),
    Fin: g.fin ? fmtHora(g.fin) : 'En curso',
    Notas: g.notas,
  }));
}

export function filasDescansos(descansos: Descanso[]): Record<string, string | number | null>[] {
  return descansos.map((d) => ({
    Fecha: d.inicio.slice(0, 10),
    Tipo: TIPOS_DESCANSO[d.tipo],
    Inicio: fmtHora(d.inicio),
    Fin: d.fin ? fmtHora(d.fin) : 'En curso',
    Notas: d.notas,
  }));
}

// --- CSV ---

function aCSV(filas: Record<string, string | number | null>[]): string {
  if (filas.length === 0) return '';
  const cabeceras = Object.keys(filas[0]);
  const esc = (v: string | number | null) => {
    const s = v == null ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [cabeceras.join(';')];
  for (const f of filas) lineas.push(cabeceras.map((c) => esc(f[c])).join(';'));
  return '﻿' + lineas.join('\n');
}

export function exportarCSV(datos: Datos, sufijo: string) {
  const csv = aCSV(filasAvisos(datos.avisos));
  descargarBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `avisos-${sufijo}.csv`);
}

// --- JSON ---

export function exportarJSON(datos: Datos, sufijo: string) {
  const json = JSON.stringify(
    {
      exportadoEl: new Date().toISOString(),
      guardias: datos.guardias,
      avisos: datos.avisos,
      descansos: datos.descansos,
    },
    null,
    2
  );
  descargarBlob(new Blob([json], { type: 'application/json' }), `guardia-tracker-${sufijo}.json`);
}

// --- Importación JSON (mismo formato que la exportación) ---

export interface ResultadoImportacion {
  guardias: number;
  avisos: number;
  descansos: number;
}

function validarFilas(filas: unknown, camposObligatorios: string[]): Record<string, unknown>[] {
  if (!Array.isArray(filas)) return [];
  return filas.filter(
    (f): f is Record<string, unknown> =>
      typeof f === 'object' &&
      f !== null &&
      camposObligatorios.every((c) => (f as Record<string, unknown>)[c] != null)
  );
}

/**
 * Importa un JSON con la forma { guardias, avisos, descansos }. Las filas se
 * insertan o actualizan por id (idempotente) y se marcan como pendientes de
 * sincronizar. Lanza si el texto no es JSON válido.
 */
export async function importarJSON(texto: string): Promise<ResultadoImportacion> {
  const datos = JSON.parse(texto) as Record<string, unknown>;
  const guardias = validarFilas(datos.guardias, ['id', 'fecha', 'inicio', 'tipo']) as unknown as Guardia[];
  const avisos = validarFilas(datos.avisos, ['id', 'fecha', 'tipo']) as unknown as Aviso[];
  const descansos = validarFilas(datos.descansos, ['id', 'inicio', 'tipo']) as unknown as Descanso[];

  const marcar = <T extends { updatedAt?: string; deletedAt?: string | null; dirty?: number }>(f: T) => ({
    ...f,
    updatedAt: f.updatedAt ?? nowISO(),
    deletedAt: f.deletedAt ?? null,
    dirty: 1,
  });

  await db.transaction('rw', db.guardias, db.avisos, db.descansos, async () => {
    await db.guardias.bulkPut(guardias.map(marcar));
    await db.avisos.bulkPut(avisos.map(marcar));
    await db.descansos.bulkPut(descansos.map(marcar));
  });

  return { guardias: guardias.length, avisos: avisos.length, descansos: descansos.length };
}

// --- Excel ---

export async function exportarExcel(datos: Datos, sufijo: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasAvisos(datos.avisos)), 'Avisos');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasGuardias(datos.guardias)), 'Guardias');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasDescansos(datos.descansos)), 'Descansos');
  XLSX.writeFile(wb, `guardia-tracker-${sufijo}.xlsx`);
}
