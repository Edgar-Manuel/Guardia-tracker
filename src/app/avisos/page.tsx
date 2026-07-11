'use client';

// Lista de avisos agrupados por fecha, con acceso al detalle y alta rápida.
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db, nuevoId } from '@/lib/db';
import { sincronizar } from '@/lib/sync';
import type { Aviso } from '@/lib/types';
import { TIPOS_SERVICIO } from '@/lib/types';
import { duracionesAviso, inicioAviso } from '@/lib/stats';
import { fechaLocal, fmtDuracion, fmtFechaLarga, fmtHora, nowISO } from '@/lib/time';
import { IconoFlecha, IconoMasCirculo } from '@/components/Iconos';

export default function PaginaAvisos() {
  const router = useRouter();
  const avisos = useLiveQuery(
    () =>
      db.avisos
        .filter((a) => !a.deletedAt)
        .toArray()
        .then((xs) =>
          xs.sort((a, b) =>
            (inicioAviso(b) ?? b.fecha).localeCompare(inicioAviso(a) ?? a.fecha)
          )
        ),
    []
  );

  const crearAviso = async () => {
    const a: Aviso = {
      id: nuevoId(),
      guardiaId: null,
      fecha: fechaLocal(),
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
    await db.avisos.add(a);
    void sincronizar();
    router.push(`/avisos/${a.id}`);
  };

  const grupos = new Map<string, Aviso[]>();
  for (const a of avisos ?? []) {
    if (!grupos.has(a.fecha)) grupos.set(a.fecha, []);
    grupos.get(a.fecha)!.push(a);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Avisos</h1>
        <button onClick={crearAviso} className="btn-primary">
          <IconoMasCirculo className="text-lg" /> Nuevo aviso
        </button>
      </div>

      {avisos && avisos.length === 0 && (
        <div className="card py-10 text-center text-sm text-muted">
          Todavía no hay avisos registrados.
        </div>
      )}

      {Array.from(grupos.entries()).map(([fecha, lista]) => (
        <section key={fecha} className="animar-entrada">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {fmtFechaLarga(fecha)}
          </h2>
          <div className="flex flex-col gap-2">
            {lista.map((a) => {
              const d = duracionesAviso(a);
              const abierto = !a.horaDisponible;
              return (
                <Link
                  key={a.id}
                  href={`/avisos/${a.id}`}
                  className={`card flex items-center gap-3 hover:border-primary/50 ${
                    abierto ? 'border-primary/40' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      {TIPOS_SERVICIO[a.tipo]}
                      {abierto && (
                        <span className="chip bg-primary-soft text-[10px] text-primary dark:text-white">
                          En curso
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-ink2">
                      {fmtHora(a.horaAsignacion)} → {fmtHora(a.horaDisponible)}
                      {a.municipio && ` · ${a.municipio}`}
                      {a.aseguradora && ` · ${a.aseguradora}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums">{fmtDuracion(d.total)}</p>
                    {d.km != null && <p className="text-xs text-muted">{d.km} km</p>}
                  </div>
                  <IconoFlecha className="shrink-0 text-muted" />
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
