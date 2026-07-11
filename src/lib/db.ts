// Base de datos local (IndexedDB vía Dexie). Es la fuente de verdad de la app:
// todo se escribe primero aquí y se sincroniza con Supabase cuando hay conexión.
import Dexie, { type Table } from 'dexie';
import type { Ajustes, Aviso, Descanso, Guardia } from './types';
import { AJUSTES_POR_DEFECTO } from './types';
import { nowISO } from './time';

export interface MetaEntry {
  key: string;
  value: string;
}

class GuardiaTrackerDB extends Dexie {
  guardias!: Table<Guardia, string>;
  avisos!: Table<Aviso, string>;
  descansos!: Table<Descanso, string>;
  ajustes!: Table<Ajustes, string>;
  meta!: Table<MetaEntry, string>;

  constructor() {
    super('guardia-tracker');
    this.version(1).stores({
      guardias: 'id, fecha, inicio, dirty',
      avisos: 'id, fecha, guardiaId, horaAsignacion, dirty',
      descansos: 'id, inicio, dirty',
      ajustes: 'id',
      meta: 'key',
    });
  }
}

export const db = new GuardiaTrackerDB();

export function nuevoId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Marca la entidad como modificada para que el motor de sincronización la suba. */
export function tocar<T extends { updatedAt: string; dirty: number }>(e: T): T {
  e.updatedAt = nowISO();
  e.dirty = 1;
  return e;
}

export async function borrarSuave(
  tabla: Table<{ id: string; updatedAt: string; deletedAt: string | null; dirty: number }, string>,
  id: string
) {
  await tabla.update(id, { deletedAt: nowISO(), updatedAt: nowISO(), dirty: 1 });
}

export async function obtenerAjustes(): Promise<Ajustes> {
  const a = await db.ajustes.get('ajustes');
  // Se mezclan con los valores por defecto para que los ajustes guardados con
  // versiones anteriores adquieran los campos nuevos.
  return { ...AJUSTES_POR_DEFECTO, ...a };
}

export async function guardarAjustes(a: Ajustes) {
  await db.ajustes.put({ ...a, id: 'ajustes' });
}

// --- Consultas de estado abierto (sin cerrar) ---

export async function guardiaAbierta(): Promise<Guardia | undefined> {
  const abiertas = await db.guardias
    .filter((g) => !g.deletedAt && g.fin === null)
    .toArray();
  return abiertas.sort((a, b) => b.inicio.localeCompare(a.inicio))[0];
}

export async function avisoAbierto(): Promise<Aviso | undefined> {
  const abiertos = await db.avisos
    .filter((a) => !a.deletedAt && a.horaDisponible === null)
    .toArray();
  return abiertos.sort((a, b) => (b.horaAsignacion ?? '').localeCompare(a.horaAsignacion ?? ''))[0];
}

export async function descansoAbierto(): Promise<Descanso | undefined> {
  const abiertos = await db.descansos
    .filter((d) => !d.deletedAt && d.fin === null)
    .toArray();
  return abiertos.sort((a, b) => b.inicio.localeCompare(a.inicio))[0];
}

/** Datos activos (sin borrados) para estadísticas e informes. */
export async function datosActivos() {
  const [guardias, avisos, descansos] = await Promise.all([
    db.guardias.filter((g) => !g.deletedAt).toArray(),
    db.avisos.filter((a) => !a.deletedAt).toArray(),
    db.descansos.filter((d) => !d.deletedAt).toArray(),
  ]);
  return { guardias, avisos, descansos };
}
