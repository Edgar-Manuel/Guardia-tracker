'use client';

// Estadísticas del periodo seleccionado (hoy / semana / mes): fichas con todas
// las métricas exigidas, gráfico de horas por día y avisos por tipo.
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, obtenerAjustes } from '@/lib/db';
import { AJUSTES_POR_DEFECTO, TIPOS_SERVICIO } from '@/lib/types';
import { avisosEnRango, estadisticasRango } from '@/lib/stats';
import {
  fechaLocal,
  finMes,
  fmtDuracion,
  inicioMes,
  inicioSemana,
  sumarDias,
} from '@/lib/time';
import { analizarCumplimiento } from '@/lib/legal';
import StatTile from '@/components/StatTile';
import { GraficoAvisosPorTipo, GraficoHorasPorDia } from '@/components/Graficos';
import { IconoAlerta } from '@/components/Iconos';

type Periodo = 'hoy' | 'semana' | 'mes';

export default function PaginaEstadisticas() {
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const hoy = fechaLocal();

  const datos = useLiveQuery(async () => {
    const [guardias, avisos, descansos] = await Promise.all([
      db.guardias.filter((g) => !g.deletedAt).toArray(),
      db.avisos.filter((a) => !a.deletedAt).toArray(),
      db.descansos.filter((d) => !d.deletedAt).toArray(),
    ]);
    return { guardias, avisos, descansos };
  }, []);
  const ajustes = useLiveQuery(() => obtenerAjustes(), []) ?? AJUSTES_POR_DEFECTO;

  const [desde, hasta] =
    periodo === 'hoy'
      ? [hoy, hoy]
      : periodo === 'semana'
        ? [inicioSemana(hoy), sumarDias(inicioSemana(hoy), 6)]
        : [inicioMes(hoy), finMes(hoy)];

  const stats = useMemo(
    () => (datos ? estadisticasRango(desde, hasta, datos, ajustes) : null),
    [datos, ajustes, desde, hasta]
  );
  const alertas = useMemo(
    () => (datos ? analizarCumplimiento(desde, hasta, datos, ajustes) : []),
    [datos, ajustes, desde, hasta]
  );

  const porTipo = useMemo(() => {
    if (!datos) return [];
    const cuenta = new Map<string, number>();
    for (const a of avisosEnRango(desde, hasta, datos.avisos)) {
      const etiqueta = TIPOS_SERVICIO[a.tipo];
      cuenta.set(etiqueta, (cuenta.get(etiqueta) ?? 0) + 1);
    }
    return Array.from(cuenta.entries())
      .map(([tipo, total]) => ({ tipo, total }))
      .sort((a, b) => b.total - a.total);
  }, [datos, desde, hasta]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Estadísticas</h1>
        <div className="flex rounded-full border border-line bg-surface p-1">
          {(['hoy', 'semana', 'mes'] as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
                periodo === p ? 'bg-primary text-white' : 'text-ink2'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile
          etiqueta="Horas efectivas"
          valor={fmtDuracion(stats?.minEfectivos ?? 0)}
          acento={
            stats && periodo === 'hoy' && stats.minEfectivos > ajustes.maxJornadaDiaria * 60
              ? 'critical'
              : undefined
          }
        />
        <StatTile etiqueta="Tiempo de guardia" valor={fmtDuracion(stats?.minGuardia ?? 0)} />
        <StatTile etiqueta="Nº de avisos" valor={String(stats?.numAvisos ?? 0)} />
        <StatTile etiqueta="Media por aviso" valor={fmtDuracion(stats?.mediaDuracionAviso ?? null)} />
        <StatTile etiqueta="Media entre avisos" valor={fmtDuracion(stats?.mediaEntreAvisos ?? null)} />
        <StatTile
          etiqueta="Horas nocturnas"
          valor={fmtDuracion(stats?.minNocturnos ?? 0)}
          acento={stats && stats.minNocturnos >= 180 ? 'warn' : undefined}
        />
        <StatTile
          etiqueta="Exceso de jornada"
          valor={fmtDuracion(stats?.minExtra ?? 0)}
          detalle={`sobre ${ajustes.maxJornadaDiaria} h/día`}
          acento={stats && stats.minExtra > 0 ? 'critical' : undefined}
        />
        <StatTile etiqueta="Conduciendo" valor={fmtDuracion(stats?.minConduccion ?? 0)} />
        <StatTile etiqueta="Con clientes" valor={fmtDuracion(stats?.minConCliente ?? 0)} />
        <StatTile etiqueta="Esperando" valor={fmtDuracion(stats?.minEspera ?? 0)} />
        <StatTile etiqueta="Descansos" valor={fmtDuracion(stats?.minDescanso ?? 0)} />
        <StatTile etiqueta="Kilómetros" valor={`${stats?.km ?? 0} km`} />
      </div>

      {stats && stats.dias.length > 1 && (
        <section className="card animar-entrada">
          <h2 className="mb-2 text-sm font-semibold">Horas efectivas por día</h2>
          <GraficoHorasPorDia dias={stats.dias} limiteMin={ajustes.maxJornadaDiaria * 60} />
        </section>
      )}

      {porTipo.length > 0 && (
        <section className="card animar-entrada">
          <h2 className="mb-2 text-sm font-semibold">Avisos por tipo de servicio</h2>
          <GraficoAvisosPorTipo datos={porTipo} />
        </section>
      )}

      <section className="card animar-entrada">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <IconoAlerta className={`text-lg ${alertas.length > 0 ? 'text-warn' : 'text-good'}`} />
          Posibles incidencias del periodo
        </h2>
        {alertas.length === 0 ? (
          <p className="text-xs text-muted">
            No se han detectado incidencias con los umbrales configurados.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {alertas.map((a, i) => (
              <li key={i} className="rounded-xl bg-surface-2 px-3 py-2 text-xs">
                <span
                  className={`font-semibold ${
                    a.severidad === 'grave'
                      ? 'text-critical'
                      : a.severidad === 'aviso'
                        ? 'text-warn'
                        : 'text-ink'
                  }`}
                >
                  {a.titulo}.
                </span>{' '}
                <span className="text-ink2">{a.detalle}</span>{' '}
                <span className="text-muted">({a.referencia})</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[10px] leading-relaxed text-muted">
          Estas alertas se calculan automáticamente con los umbrales configurados en Ajustes y no
          constituyen asesoramiento jurídico.
        </p>
      </section>
    </div>
  );
}
