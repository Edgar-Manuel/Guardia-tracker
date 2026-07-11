'use client';

// Ajustes: umbrales legales (Estatuto de los Trabajadores / convenio),
// cuenta de Supabase para copia de seguridad y sincronización, y exportación
// completa de los datos locales.
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, guardarAjustes, obtenerAjustes } from '@/lib/db';
import { getSupabase, supabaseConfigurado } from '@/lib/supabase';
import { onEstadoSync, sincronizar, type EstadoSync } from '@/lib/sync';
import { AJUSTES_POR_DEFECTO, type Ajustes } from '@/lib/types';
import { exportarJSON, importarJSON } from '@/lib/export';
import { DESCARGO_LEGAL } from '@/lib/legal';
import { useRef } from 'react';

function CampoNumero({
  etiqueta,
  valor,
  onCambio,
  sufijo,
}: {
  etiqueta: string;
  valor: number;
  onCambio: (v: number) => void;
  sufijo: string;
}) {
  return (
    <div>
      <label className="label">{etiqueta}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          className="input"
          value={valor}
          onChange={(e) => onCambio(Number(e.target.value))}
        />
        <span className="shrink-0 text-xs text-muted">{sufijo}</span>
      </div>
    </div>
  );
}

function SeccionCuenta() {
  const supabase = getSupabase();
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [usuario, setUsuario] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [estadoSync, setEstadoSync] = useState<EstadoSync>('local');

  useEffect(() => onEstadoSync(setEstadoSync), []);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUsuario(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sesion) => {
      setUsuario(sesion?.user?.email ?? null);
      if (sesion) void sincronizar();
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  if (!supabaseConfigurado) {
    return (
      <p className="text-xs text-ink2">
        La sincronización en la nube no está configurada en esta instalación. Los datos se guardan
        únicamente en este dispositivo; puedes hacer copias con la exportación JSON. Para
        activarla, define <code>NEXT_PUBLIC_SUPABASE_URL</code> y{' '}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (ver <code>supabase/schema.sql</code>).
      </p>
    );
  }

  const entrar = async (registro: boolean) => {
    if (!supabase) return;
    setMensaje(null);
    const fn = registro
      ? supabase.auth.signUp({ email, password: clave })
      : supabase.auth.signInWithPassword({ email, password: clave });
    const { error } = await fn;
    if (error) setMensaje(error.message);
    else if (registro) setMensaje('Cuenta creada. Revisa tu correo si se requiere confirmación.');
  };

  if (usuario) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">
          Sesión iniciada como <b>{usuario}</b>
        </p>
        <p className="text-xs text-ink2">Estado: {estadoSync}</p>
        <div className="flex gap-2">
          <button onClick={() => void sincronizar()} className="btn-tonal !px-3 !py-1.5 text-xs">
            Sincronizar ahora
          </button>
          <button
            onClick={() => supabase && supabase.auth.signOut()}
            className="btn-outline !px-3 !py-1.5 text-xs"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-ink2">
        Inicia sesión para guardar una copia de seguridad en la nube y sincronizar entre
        dispositivos. Sin sesión, los datos siguen guardándose en este dispositivo.
      </p>
      <input
        type="email"
        className="input"
        placeholder="Correo electrónico"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        className="input"
        placeholder="Contraseña"
        value={clave}
        onChange={(e) => setClave(e.target.value)}
      />
      {mensaje && <p className="text-xs text-warn">{mensaje}</p>}
      <div className="flex gap-2">
        <button onClick={() => entrar(false)} className="btn-primary flex-1">
          Iniciar sesión
        </button>
        <button onClick={() => entrar(true)} className="btn-outline flex-1">
          Crear cuenta
        </button>
      </div>
    </div>
  );
}

export default function PaginaAjustes() {
  const guardado = useLiveQuery(() => obtenerAjustes(), []);
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [confirmacion, setConfirmacion] = useState(false);
  const [mensajeImportacion, setMensajeImportacion] = useState<string | null>(null);
  const inputImportar = useRef<HTMLInputElement>(null);

  const importarArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    try {
      const r = await importarJSON(await archivo.text());
      setMensajeImportacion(
        `Importado: ${r.guardias} guardias, ${r.avisos} avisos y ${r.descansos} descansos.`
      );
      void sincronizar();
    } catch {
      setMensajeImportacion('No se pudo importar: el archivo no tiene el formato esperado.');
    }
  };

  useEffect(() => {
    if (guardado && !ajustes) setAjustes(guardado);
  }, [guardado, ajustes]);

  const a = ajustes ?? AJUSTES_POR_DEFECTO;

  const cambiar = (cambios: Partial<Ajustes>) => setAjustes({ ...a, ...cambios });

  const guardar = async () => {
    await guardarAjustes(a);
    setConfirmacion(true);
    setTimeout(() => setConfirmacion(false), 2000);
  };

  const exportarTodo = async () => {
    const [guardias, avisos, descansos] = await Promise.all([
      db.guardias.toArray(),
      db.avisos.toArray(),
      db.descansos.toArray(),
    ]);
    exportarJSON({ guardias, avisos, descansos }, 'copia-completa');
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-bold">Ajustes</h1>

      <section className="card animar-entrada">
        <h2 className="mb-1 text-sm font-semibold">Cuenta y sincronización</h2>
        <SeccionCuenta />
      </section>

      <section className="card animar-entrada">
        <h2 className="mb-1 text-sm font-semibold">Umbrales legales</h2>
        <p className="mb-3 text-xs text-ink2">
          Valores por defecto según el Estatuto de los Trabajadores. Ajústalos si tu convenio
          establece otros límites: las alertas y los informes usan estos umbrales.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Convenio aplicable (opcional)</label>
            <input
              className="input"
              placeholder="Ej.: Convenio de transporte de mercancías por carretera de…"
              value={a.convenioNombre}
              onChange={(e) => cambiar({ convenioNombre: e.target.value })}
            />
          </div>
          <CampoNumero
            etiqueta="Jornada diaria máxima (ET art. 34.3)"
            valor={a.maxJornadaDiaria}
            onCambio={(v) => cambiar({ maxJornadaDiaria: v })}
            sufijo="h/día"
          />
          <CampoNumero
            etiqueta="Jornada semanal máxima (ET art. 34.1)"
            valor={a.maxSemana}
            onCambio={(v) => cambiar({ maxSemana: v })}
            sufijo="h/sem"
          />
          <CampoNumero
            etiqueta="Descanso mínimo entre jornadas (ET art. 34.3)"
            valor={a.minDescansoEntreJornadas}
            onCambio={(v) => cambiar({ minDescansoEntreJornadas: v })}
            sufijo="h"
          />
          <CampoNumero
            etiqueta="Descanso semanal mínimo (ET art. 37.1)"
            valor={a.minDescansoSemanal}
            onCambio={(v) => cambiar({ minDescansoSemanal: v })}
            sufijo="h"
          />
          <div>
            <label className="label">Inicio del periodo nocturno (ET art. 36.1)</label>
            <input
              type="time"
              className="input"
              value={a.inicioNocturno}
              onChange={(e) => cambiar({ inicioNocturno: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Fin del periodo nocturno</label>
            <input
              type="time"
              className="input"
              value={a.finNocturno}
              onChange={(e) => cambiar({ finNocturno: e.target.value })}
            />
          </div>
          <CampoNumero
            etiqueta="Horas extra máximas al año (ET art. 35.2)"
            valor={a.maxHorasExtraAnuales}
            onCambio={(v) => cambiar({ maxHorasExtraAnuales: v })}
            sufijo="h/año"
          />
          <CampoNumero
            etiqueta="Pausa mínima en jornada de +6 h (ET art. 34.4)"
            valor={a.minPausaJornadaContinuada}
            onCambio={(v) => cambiar({ minPausaJornadaContinuada: v })}
            sufijo="min"
          />
          <CampoNumero
            etiqueta="Amplitud de jornada máxima orientativa (RD 1561/1995)"
            valor={a.maxAmplitudDiaria}
            onCambio={(v) => cambiar({ maxAmplitudDiaria: v })}
            sufijo="h/día"
          />
        </div>
        <button onClick={guardar} className="btn-primary mt-3 w-full">
          {confirmacion ? 'Guardado ✓' : 'Guardar ajustes'}
        </button>
      </section>

      <section className="card animar-entrada">
        <h2 className="mb-1 text-sm font-semibold">Copia de seguridad y datos</h2>
        <p className="mb-2 text-xs text-ink2">
          Descarga todos los datos de este dispositivo (incluidos los eliminados) en un archivo
          JSON, o importa un archivo con el mismo formato (los registros se añaden o actualizan
          por su identificador, así que importar dos veces no duplica).
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportarTodo} className="btn-tonal">
            Exportar copia completa (JSON)
          </button>
          <button onClick={() => inputImportar.current?.click()} className="btn-outline">
            Importar datos (JSON)
          </button>
          <input
            ref={inputImportar}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={importarArchivo}
          />
        </div>
        {mensajeImportacion && <p className="mt-2 text-xs text-ink2">{mensajeImportacion}</p>}
      </section>

      <p className="px-2 text-[10px] leading-relaxed text-muted">{DESCARGO_LEGAL}</p>
    </div>
  );
}
