// Motor de sincronización local-primero con Supabase.
// Estrategia: last-write-wins por fila usando updatedAt.
//  - push: sube las filas locales con dirty=1.
//  - pull: baja las filas remotas modificadas desde la última sincronización
//    y las aplica solo si son más recientes que la copia local.
import type { Table } from 'dexie';
import { db } from './db';
import { getSupabase, supabaseConfigurado } from './supabase';
import type { Aviso, BaseEntity, Descanso, Guardia } from './types';

export type EstadoSync =
  | 'local'          // Supabase no configurado: solo almacenamiento local
  | 'sin_sesion'     // configurado pero sin iniciar sesión
  | 'offline'
  | 'sincronizando'
  | 'sincronizado'
  | 'error';

type Listener = (estado: EstadoSync) => void;

let estadoActual: EstadoSync = supabaseConfigurado ? 'sin_sesion' : 'local';
const listeners = new Set<Listener>();

function setEstado(e: EstadoSync) {
  estadoActual = e;
  listeners.forEach((l) => l(e));
}

export function getEstadoSync(): EstadoSync {
  return estadoActual;
}

export function onEstadoSync(l: Listener): () => void {
  listeners.add(l);
  l(estadoActual);
  return () => listeners.delete(l);
}

// Mapeo camelCase (local) ↔ snake_case (PostgreSQL)
const CAMPOS_GUARDIA: Record<string, string> = {
  id: 'id', fecha: 'fecha', inicio: 'inicio', fin: 'fin', tipo: 'tipo', notas: 'notas',
  updatedAt: 'updated_at', deletedAt: 'deleted_at',
};
const CAMPOS_AVISO: Record<string, string> = {
  id: 'id', guardiaId: 'guardia_id', fecha: 'fecha', tipo: 'tipo',
  horaAsignacion: 'hora_asignacion', horaSalida: 'hora_salida', horaLlegada: 'hora_llegada',
  horaInicioTrabajo: 'hora_inicio_trabajo', horaFin: 'hora_fin', horaDisponible: 'hora_disponible',
  kmInicio: 'km_inicio', kmFin: 'km_fin',
  minConduccion: 'min_conduccion', minParado: 'min_parado', minEspera: 'min_espera',
  municipio: 'municipio', destino: 'destino', aseguradora: 'aseguradora',
  observaciones: 'observaciones', lat: 'lat', lng: 'lng',
  updatedAt: 'updated_at', deletedAt: 'deleted_at',
};
const CAMPOS_DESCANSO: Record<string, string> = {
  id: 'id', inicio: 'inicio', fin: 'fin', tipo: 'tipo', notas: 'notas',
  updatedAt: 'updated_at', deletedAt: 'deleted_at',
};

interface TablaSync<T extends BaseEntity> {
  nombre: string;
  tabla: Table<T, string>;
  campos: Record<string, string>;
}

function tablas(): [TablaSync<Guardia>, TablaSync<Aviso>, TablaSync<Descanso>] {
  return [
    { nombre: 'guardias', tabla: db.guardias, campos: CAMPOS_GUARDIA },
    { nombre: 'avisos', tabla: db.avisos, campos: CAMPOS_AVISO },
    { nombre: 'descansos', tabla: db.descansos, campos: CAMPOS_DESCANSO },
  ];
}

function aRemoto<T extends BaseEntity>(local: T, campos: Record<string, string>, userId: string) {
  const fila: Record<string, unknown> = { user_id: userId };
  for (const [l, r] of Object.entries(campos)) {
    fila[r] = (local as Record<string, unknown>)[l] ?? null;
  }
  return fila;
}

function aLocal<T extends BaseEntity>(remoto: Record<string, unknown>, campos: Record<string, string>): T {
  const fila: Record<string, unknown> = { dirty: 0 };
  for (const [l, r] of Object.entries(campos)) {
    fila[l] = remoto[r] ?? null;
  }
  return fila as T;
}

let sincronizando = false;

export async function sincronizar(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setEstado('offline');
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    setEstado('sin_sesion');
    return;
  }
  if (sincronizando) return;
  sincronizando = true;
  setEstado('sincronizando');
  try {
    const userId = session.user.id;
    for (const t of tablas()) {
      // 1) Subir cambios locales pendientes
      const pendientes = await t.tabla.where('dirty').equals(1).toArray();
      if (pendientes.length > 0) {
        const filas = pendientes.map((p) => aRemoto(p, t.campos, userId));
        const { error } = await supabase.from(t.nombre).upsert(filas, { onConflict: 'id' });
        if (error) throw error;
        await t.tabla.bulkUpdate(pendientes.map((p) => ({ key: p.id, changes: { dirty: 0 } as Partial<BaseEntity> })));
      }

      // 2) Bajar cambios remotos desde la última sincronización
      const metaKey = `lastPull:${t.nombre}`;
      const meta = await db.meta.get(metaKey);
      let consulta = supabase.from(t.nombre).select('*').order('updated_at', { ascending: true }).limit(1000);
      if (meta?.value) consulta = consulta.gt('updated_at', meta.value);
      const { data, error } = await consulta;
      if (error) throw error;
      let ultimo = meta?.value ?? '';
      for (const remoto of data ?? []) {
        const local = aLocal<BaseEntity>(remoto as Record<string, unknown>, t.campos);
        const existente = await t.tabla.get(local.id);
        // No pisar cambios locales aún no subidos ni versiones más recientes.
        if (!existente || (existente.dirty !== 1 && existente.updatedAt < local.updatedAt)) {
          await t.tabla.put(local as never);
        }
        const ua = (remoto as Record<string, string>).updated_at;
        if (ua > ultimo) ultimo = ua;
      }
      if (ultimo) await db.meta.put({ key: metaKey, value: ultimo });
    }
    setEstado('sincronizado');
  } catch (e) {
    console.error('Error de sincronización', e);
    setEstado('error');
  } finally {
    sincronizando = false;
  }
}

let iniciado = false;

/** Arranca la sincronización automática: al volver la conexión y cada minuto. */
export function iniciarSyncAutomatico() {
  if (iniciado || typeof window === 'undefined') return;
  iniciado = true;
  window.addEventListener('online', () => void sincronizar());
  window.addEventListener('offline', () => setEstado('offline'));
  setInterval(() => void sincronizar(), 60_000);
  void sincronizar();
}
