'use client';

// Pantalla principal: hora actual, estado (libre / en guardia / en servicio /
// descansando), temporizador en tiempo real, acciones rápidas y resumen del día.
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { db, nuevoId, obtenerAjustes } from '@/lib/db';
import { sincronizar } from '@/lib/sync';
import type { Aviso, Descanso, EstadoActual, Guardia, TipoDescanso, TipoGuardia } from '@/lib/types';
import { AJUSTES_POR_DEFECTO, TIPOS_DESCANSO, TIPOS_GUARDIA } from '@/lib/types';
import { estadisticasDia, inicioAviso } from '@/lib/stats';
import { fechaLocal, fmtDuracion, nowISO } from '@/lib/time';
import { analizarCumplimiento } from '@/lib/legal';
import FichaAvisoEnCurso from '@/components/FichaAvisoEnCurso';
import StatTile from '@/components/StatTile';
import { IconoAlerta } from '@/components/Iconos';

const INFO_ESTADO: Record<EstadoActual, { etiqueta: string; clase: string }> = {
  libre: { etiqueta: 'Libre', clase: 'bg-surface-2 text-ink2' },
  guardia: { etiqueta: 'En guardia', clase: 'bg-primary-soft text-primary dark:text-white' },
  servicio: { etiqueta: 'En servicio', clase: 'bg-primary text-white' },
  descanso: { etiqueta: 'Descansando', clase: 'bg-good/15 text-good' },
};

function Reloj() {
  const [ahora, setAhora] = useState<Date | null>(null);
  useEffect(() => {
    setAhora(new Date());
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!ahora) return <span className="text-5xl font-bold tabular-nums">--:--</span>;
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="text-5xl font-bold tabular-nums tracking-tight">
      {p(ahora.getHours())}:{p(ahora.getMinutes())}
      <span className="text-2xl text-muted">:{p(ahora.getSeconds())}</span>
    </span>
  );
}

function Temporizador({ desde }: { desde: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const seg = Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(seg / 3600);
  return (
    <span className="tabular-nums">
      {p(h)}:{p(Math.floor((seg % 3600) / 60))}:{p(seg % 60)}
    </span>
  );
}

export default function PaginaInicio() {
  const hoy = fechaLocal();
  const [selector, setSelector] = useState<'guardia' | 'descanso' | null>(null);

  const guardia = useLiveQuery(
    () => db.guardias.filter((g) => !g.deletedAt && g.fin === null).first(),
    []
  );
  const aviso = useLiveQuery(
    () => db.avisos.filter((a) => !a.deletedAt && a.horaDisponible === null && Boolean(inicioAviso(a))).first(),
    []
  );
  const descanso = useLiveQuery(
    () => db.descansos.filter((d) => !d.deletedAt && d.fin === null).first(),
    []
  );
  const datos = useLiveQuery(async () => {
    const [guardias, avisos, descansos] = await Promise.all([
      db.guardias.filter((g) => !g.deletedAt).toArray(),
      db.avisos.filter((a) => !a.deletedAt).toArray(),
      db.descansos.filter((d) => !d.deletedAt).toArray(),
    ]);
    return { guardias, avisos, descansos };
  }, []);
  const ajustes = useLiveQuery(() => obtenerAjustes(), []) ?? AJUSTES_POR_DEFECTO;

  const estado: EstadoActual = descanso ? 'descanso' : aviso ? 'servicio' : guardia ? 'guardia' : 'libre';
  const inicioEstado =
    estado === 'descanso'
      ? descanso!.inicio
      : estado === 'servicio'
        ? (inicioAviso(aviso!) ?? aviso!.horaAsignacion)
        : estado === 'guardia'
          ? guardia!.inicio
          : null;

  const resumenHoy = useMemo(
    () => (datos ? estadisticasDia(hoy, datos, ajustes) : null),
    [datos, ajustes, hoy]
  );
  const alertasHoy = useMemo(
    () => (datos ? analizarCumplimiento(hoy, hoy, datos, ajustes) : []),
    [datos, ajustes, hoy]
  );

  // --- Acciones rápidas ---

  const iniciarGuardia = async (tipo: TipoGuardia) => {
    const g: Guardia = {
      id: nuevoId(),
      fecha: hoy,
      inicio: nowISO(),
      fin: null,
      tipo,
      notas: '',
      updatedAt: nowISO(),
      deletedAt: null,
      dirty: 1,
    };
    await db.guardias.add(g);
    setSelector(null);
    void sincronizar();
  };

  const finalizarGuardia = async () => {
    if (!guardia) return;
    await db.guardias.update(guardia.id, { fin: nowISO(), updatedAt: nowISO(), dirty: 1 });
    void sincronizar();
  };

  const nuevoAviso = async () => {
    const a: Aviso = {
      id: nuevoId(),
      guardiaId: guardia?.id ?? null,
      fecha: hoy,
      tipo: 'otro',
      horaAsignacion: nowISO(),
      horaSalida: null,
      horaLlegada: null,
      horaInicioTrabajo: null,
      horaFin: null,
      horaDisponible: null,
      kmInicio: null,
      kmFin: null,
      minConduccion: null,
      minParado: null,
      minEspera: null,
      municipio: '',
      destino: '',
      aseguradora: '',
      observaciones: '',
      lat: null,
      lng: null,
      updatedAt: nowISO(),
      deletedAt: null,
      dirty: 1,
    };
    // Captura de ubicación opcional, sin bloquear el registro.
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void db.avisos.update(a.id, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            updatedAt: nowISO(),
            dirty: 1,
          });
        },
        () => {},
        { maximumAge: 60000, timeout: 5000 }
      );
    }
    await db.avisos.add(a);
    void sincronizar();
  };

  const iniciarDescanso = async (tipo: TipoDescanso) => {
    const d: Descanso = {
      id: nuevoId(),
      inicio: nowISO(),
      fin: null,
      tipo,
      notas: '',
      updatedAt: nowISO(),
      deletedAt: null,
      dirty: 1,
    };
    await db.descansos.add(d);
    setSelector(null);
    void sincronizar();
  };

  const finalizarDescanso = async () => {
    if (!descanso) return;
    await db.descansos.update(descanso.id, { fin: nowISO(), updatedAt: nowISO(), dirty: 1 });
    void sincronizar();
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      {/* Estado y reloj */}
      <section className="card animar-entrada flex flex-col items-center gap-3 py-6 text-center">
        <Reloj />
        <span className={`chip px-4 py-1.5 text-sm ${INFO_ESTADO[estado].clase}`}>
          {estado !== 'libre' && <span className="pulso h-2 w-2 rounded-full bg-current" />}
          {INFO_ESTADO[estado].etiqueta}
          {estado === 'guardia' && guardia && ` · ${TIPOS_GUARDIA[guardia.tipo]}`}
          {estado === 'descanso' && descanso && ` · ${TIPOS_DESCANSO[descanso.tipo]}`}
        </span>
        {inicioEstado && (
          <p className="text-3xl font-bold text-ink">
            <Temporizador desde={inicioEstado} />
          </p>
        )}
      </section>

      {/* Aviso en curso con flujo de fases */}
      {aviso && <FichaAvisoEnCurso aviso={aviso} />}

      {/* Acciones rápidas */}
      <section className="card animar-entrada">
        <h2 className="mb-3 text-sm font-semibold text-ink2">Acciones rápidas</h2>
        <div className="grid grid-cols-2 gap-2">
          {!aviso && (
            <button onClick={nuevoAviso} className="btn-primary col-span-2 py-3 text-base">
              + Nuevo aviso
            </button>
          )}
          {guardia ? (
            <button onClick={finalizarGuardia} className="btn-tonal">
              Terminar guardia
            </button>
          ) : (
            <button
              onClick={() => setSelector(selector === 'guardia' ? null : 'guardia')}
              className="btn-tonal"
            >
              Iniciar guardia
            </button>
          )}
          {descanso ? (
            <button onClick={finalizarDescanso} className="btn-tonal">
              Terminar descanso
            </button>
          ) : (
            <button
              onClick={() => setSelector(selector === 'descanso' ? null : 'descanso')}
              className="btn-tonal"
            >
              Iniciar descanso
            </button>
          )}
        </div>

        {selector === 'guardia' && (
          <div className="animar-entrada mt-2 grid grid-cols-3 gap-2">
            {(Object.entries(TIPOS_GUARDIA) as [TipoGuardia, string][]).map(([tipo, etiqueta]) => (
              <button key={tipo} onClick={() => iniciarGuardia(tipo)} className="btn-outline text-xs">
                {etiqueta}
              </button>
            ))}
          </div>
        )}
        {selector === 'descanso' && (
          <div className="animar-entrada mt-2 grid grid-cols-4 gap-2">
            {(Object.entries(TIPOS_DESCANSO) as [TipoDescanso, string][]).map(([tipo, etiqueta]) => (
              <button key={tipo} onClick={() => iniciarDescanso(tipo)} className="btn-outline text-xs">
                {etiqueta}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Alertas del día */}
      {alertasHoy.length > 0 && (
        <section className="card animar-entrada border-warn/50">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-warn">
            <IconoAlerta className="text-lg" /> Avisos de jornada
          </h2>
          <ul className="flex flex-col gap-1.5">
            {alertasHoy.map((a, i) => (
              <li key={i} className="text-xs text-ink2">
                <span className="font-semibold text-ink">{a.titulo}.</span> {a.detalle}{' '}
                <span className="text-muted">({a.referencia})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Resumen del día */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink2">Resumen de hoy</h2>
          <Link href="/estadisticas" className="text-xs font-medium text-primary">
            Ver estadísticas →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatTile
            etiqueta="Trabajo efectivo"
            valor={fmtDuracion(resumenHoy?.minEfectivos ?? 0)}
            acento={
              resumenHoy && resumenHoy.minEfectivos > ajustes.maxJornadaDiaria * 60
                ? 'critical'
                : undefined
            }
          />
          <StatTile
            etiqueta="Amplitud de jornada"
            valor={fmtDuracion(resumenHoy?.minAmplitud ?? 0)}
            detalle="del 1.º al último aviso"
            acento={
              resumenHoy && resumenHoy.minAmplitud > ajustes.maxAmplitudDiaria * 60
                ? 'warn'
                : undefined
            }
          />
          <StatTile etiqueta="Tiempo de guardia" valor={fmtDuracion(resumenHoy?.minGuardia ?? 0)} />
          <StatTile etiqueta="Avisos" valor={String(resumenHoy?.numAvisos ?? 0)} />
          <StatTile etiqueta="Conducción" valor={fmtDuracion(resumenHoy?.minConduccion ?? 0)} />
          <StatTile etiqueta="Descanso" valor={fmtDuracion(resumenHoy?.minDescanso ?? 0)} />
          <StatTile
            etiqueta="Nocturnas"
            valor={fmtDuracion(resumenHoy?.minNocturnos ?? 0)}
            acento={resumenHoy && resumenHoy.minNocturnos >= 180 ? 'warn' : undefined}
          />
        </div>
      </section>
    </div>
  );
}
