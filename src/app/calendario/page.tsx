'use client';

// Calendario mensual: cada día muestra horas efectivas y nº de avisos; al
// pulsar un día se abre el detalle con avisos, estadísticas y mapa si hay
// ubicación registrada.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, obtenerAjustes } from '@/lib/db';
import { AJUSTES_POR_DEFECTO, TIPOS_SERVICIO } from '@/lib/types';
import { duracionesAviso, estadisticasDia, inicioAviso } from '@/lib/stats';
import {
  fechaADate,
  fechaLocal,
  finMes,
  fmtDuracion,
  fmtFechaLarga,
  fmtHora,
  fmtHoras,
  inicioMes,
  nombreMes,
  rangoFechas,
} from '@/lib/time';
import { analizarCumplimiento } from '@/lib/legal';
import { IconoFlecha, IconoMapa } from '@/components/Iconos';

export default function PaginaCalendario() {
  const hoy = fechaLocal();
  const [anio, setAnio] = useState(() => Number(hoy.slice(0, 4)));
  const [mes, setMes] = useState(() => Number(hoy.slice(5, 7)) - 1);
  const [seleccionado, setSeleccionado] = useState<string | null>(hoy);

  const datos = useLiveQuery(async () => {
    const [guardias, avisos, descansos] = await Promise.all([
      db.guardias.filter((g) => !g.deletedAt).toArray(),
      db.avisos.filter((a) => !a.deletedAt).toArray(),
      db.descansos.filter((d) => !d.deletedAt).toArray(),
    ]);
    return { guardias, avisos, descansos };
  }, []);
  const ajustes = useLiveQuery(() => obtenerAjustes(), []) ?? AJUSTES_POR_DEFECTO;

  const primerDia = `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
  const ultimoDia = finMes(primerDia);
  const fechas = rangoFechas(primerDia, ultimoDia);

  const statsMes = useMemo(() => {
    if (!datos) return new Map<string, ReturnType<typeof estadisticasDia>>();
    return new Map(fechas.map((f) => [f, estadisticasDia(f, datos, ajustes)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, ajustes, primerDia]);

  const alertasMes = useMemo(
    () => (datos ? analizarCumplimiento(primerDia, ultimoDia, datos, ajustes) : []),
    [datos, ajustes, primerDia, ultimoDia]
  );

  const cambiarMes = (delta: number) => {
    const d = new Date(anio, mes + delta, 1);
    setAnio(d.getFullYear());
    setMes(d.getMonth());
    setSeleccionado(null);
  };

  const offset = (fechaADate(primerDia).getDay() + 6) % 7; // lunes = 0
  const avisosDia = seleccionado
    ? (datos?.avisos ?? [])
        .filter((a) => a.fecha === seleccionado)
        .sort((a, b) => (inicioAviso(a) ?? '').localeCompare(inicioAviso(b) ?? ''))
    : [];
  const statsDia = seleccionado ? statsMes.get(seleccionado) : undefined;
  const alertasDia = alertasMes.filter((a) => a.fecha === seleccionado);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold capitalize">
          {nombreMes(mes)} {anio}
        </h1>
        <div className="flex gap-1">
          <button onClick={() => cambiarMes(-1)} className="btn-outline !px-3" aria-label="Mes anterior">
            <IconoFlecha className="rotate-180" />
          </button>
          <button
            onClick={() => {
              setAnio(Number(hoy.slice(0, 4)));
              setMes(Number(hoy.slice(5, 7)) - 1);
              setSeleccionado(hoy);
            }}
            className="btn-outline !px-3 text-xs"
          >
            Hoy
          </button>
          <button onClick={() => cambiarMes(1)} className="btn-outline !px-3" aria-label="Mes siguiente">
            <IconoFlecha />
          </button>
        </div>
      </div>

      <div className="card animar-entrada !p-2 sm:!p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted">
          {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`v${i}`} />
          ))}
          {fechas.map((f) => {
            const s = statsMes.get(f);
            const conTrabajo = s && s.minEfectivos > 0;
            const excede = s && s.minEfectivos > ajustes.maxJornadaDiaria * 60;
            const esHoy = f === hoy;
            const activo = f === seleccionado;
            return (
              <button
                key={f}
                onClick={() => setSeleccionado(f)}
                className={`flex min-h-14 flex-col items-center justify-start rounded-xl border p-1 text-xs transition-colors sm:min-h-16 ${
                  activo
                    ? 'border-primary bg-primary-soft'
                    : excede
                      ? 'border-critical/40 bg-critical/10'
                      : conTrabajo
                        ? 'border-line bg-surface-2'
                        : 'border-transparent hover:bg-surface-2'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                    esHoy ? 'bg-primary text-white' : 'text-ink'
                  }`}
                >
                  {Number(f.slice(8, 10))}
                </span>
                {conTrabajo && s && (
                  <>
                    <span className={`text-[9px] font-bold ${excede ? 'text-critical' : 'text-primary dark:text-white'}`}>
                      {fmtHoras(s.minEfectivos)}
                    </span>
                    {s.numAvisos > 0 && (
                      <span className="text-[9px] text-muted">{s.numAvisos} av.</span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {seleccionado && statsDia && (
        <section className="card animar-entrada">
          <h2 className="text-sm font-bold">{fmtFechaLarga(seleccionado)}</h2>

          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink2 sm:grid-cols-3">
            <p>Efectivas: <b className="text-ink">{fmtDuracion(statsDia.minEfectivos)}</b></p>
            <p>Amplitud: <b className="text-ink">{fmtDuracion(statsDia.minAmplitud)}</b></p>
            <p>Guardia: <b className="text-ink">{fmtDuracion(statsDia.minGuardia)}</b></p>
            <p>Avisos: <b className="text-ink">{statsDia.numAvisos}</b></p>
            <p>Nocturnas: <b className="text-ink">{fmtDuracion(statsDia.minNocturnos)}</b></p>
            <p>Descanso: <b className="text-ink">{fmtDuracion(statsDia.minDescanso)}</b></p>
            <p>Km: <b className="text-ink">{statsDia.km}</b></p>
          </div>

          {alertasDia.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1">
              {alertasDia.map((a, i) => (
                <li key={i} className="rounded-lg bg-warn/10 px-2.5 py-1.5 text-[11px] text-ink2">
                  <b className={a.severidad === 'grave' ? 'text-critical' : 'text-warn'}>{a.titulo}.</b>{' '}
                  {a.detalle}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-col gap-2">
            {avisosDia.length === 0 && (
              <p className="text-xs text-muted">Sin avisos este día.</p>
            )}
            {avisosDia.map((a) => {
              const dur = duracionesAviso(a);
              return (
                <Link
                  key={a.id}
                  href={`/avisos/${a.id}`}
                  className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs hover:bg-line"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{TIPOS_SERVICIO[a.tipo]}</p>
                    <p className="text-ink2">
                      {fmtHora(a.horaAsignacion)} → {fmtHora(a.horaDisponible)}
                      {a.municipio && ` · ${a.municipio}`}
                    </p>
                  </div>
                  {a.lat != null && a.lng != null && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lng}#map=15/${a.lat}/${a.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="btn-outline shrink-0 !p-2"
                      aria-label="Ver en el mapa"
                    >
                      <IconoMapa />
                    </a>
                  )}
                  <span className="shrink-0 font-bold tabular-nums">{fmtDuracion(dur.total)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
