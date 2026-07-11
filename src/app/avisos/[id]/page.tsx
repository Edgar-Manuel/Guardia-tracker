'use client';

// Detalle y edición de un aviso: cronología completa, kilómetros, tiempos,
// localización y observaciones. Diseñado para editarse con una mano en el móvil.
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams, useRouter } from 'next/navigation';
import { borrarSuave, db, tocar } from '@/lib/db';
import { sincronizar } from '@/lib/sync';
import type { Aviso, FaseAviso, TipoServicio } from '@/lib/types';
import { ETIQUETAS_FASE, FASES_AVISO, TIPOS_SERVICIO } from '@/lib/types';
import { duracionesAviso } from '@/lib/stats';
import { fechaDeISO, fmtDuracion, isoALocalInput, localInputAISO, nowISO } from '@/lib/time';
import { IconoMapa } from '@/components/Iconos';

export default function PaginaDetalleAviso() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const aviso = useLiveQuery(() => db.avisos.get(id), [id]);

  if (aviso === undefined) return <div className="p-8 text-center text-sm text-muted">Cargando…</div>;
  if (!aviso || aviso.deletedAt) {
    return <div className="p-8 text-center text-sm text-muted">Este aviso no existe.</div>;
  }

  const d = duracionesAviso(aviso);

  const actualizar = async (cambios: Partial<Aviso>) => {
    const nuevo = { ...aviso, ...cambios };
    // La fecha de la jornada sigue a la hora de asignación si existe.
    if (cambios.horaAsignacion) nuevo.fecha = fechaDeISO(cambios.horaAsignacion);
    await db.avisos.put(tocar(nuevo));
    void sincronizar();
  };

  const borrar = async () => {
    if (!confirm('¿Eliminar este aviso? Podrás seguir viéndolo en las copias exportadas anteriores.')) return;
    await borrarSuave(db.avisos, aviso.id);
    void sincronizar();
    router.push('/avisos');
  };

  const numero = (v: string): number | null => (v === '' ? null : Number(v));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Detalle del aviso</h1>
        <button onClick={borrar} className="btn-danger !px-3 !py-1.5 text-xs">
          Eliminar
        </button>
      </div>

      {/* Tipo de servicio */}
      <section className="card animar-entrada">
        <h2 className="label">Tipo de servicio</h2>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {(Object.entries(TIPOS_SERVICIO) as [TipoServicio, string][]).map(([tipo, etiqueta]) => (
            <button
              key={tipo}
              onClick={() => actualizar({ tipo })}
              className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                aviso.tipo === tipo
                  ? 'border-primary bg-primary-soft text-ink'
                  : 'border-line text-ink2 hover:bg-surface-2'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </section>

      {/* Cronología */}
      <section className="card animar-entrada">
        <h2 className="mb-2 text-sm font-semibold">Cronología</h2>
        <div className="mb-3">
          <label className="label">Jornada a la que pertenece</label>
          <input
            type="date"
            className="input"
            value={aviso.fecha}
            onChange={(e) => e.target.value && actualizar({ fecha: e.target.value })}
          />
          <p className="mt-1 text-[10px] text-muted">
            Un aviso de madrugada puede asignarse a la jornada del día anterior; la amplitud y el
            recuento de avisos se calculan sobre esta fecha. Si cambias la hora de asignación, la
            jornada se ajusta a esa fecha.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {FASES_AVISO.map((fase: FaseAviso) => (
            <div key={fase} className="flex items-end gap-2">
              <div className="flex-1">
                <label className="label">{ETIQUETAS_FASE[fase]}</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={isoALocalInput(aviso[fase])}
                  onChange={(e) => actualizar({ [fase]: localInputAISO(e.target.value) })}
                />
              </div>
              <button
                onClick={() => actualizar({ [fase]: nowISO() })}
                className="btn-tonal shrink-0 !px-3 text-xs"
                title="Usar la hora actual"
              >
                Ahora
              </button>
            </div>
          ))}
        </div>
        {d.total != null && (
          <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink2">
            Duración total: <b className="text-ink">{fmtDuracion(d.total)}</b>
            {d.conduccion != null && <> · Conducción: <b className="text-ink">{fmtDuracion(d.conduccion)}</b></>}
            {d.espera != null && <> · Espera: <b className="text-ink">{fmtDuracion(d.espera)}</b></>}
            {d.conCliente != null && <> · Con cliente: <b className="text-ink">{fmtDuracion(d.conCliente)}</b></>}
          </p>
        )}
      </section>

      {/* Kilómetros y tiempos */}
      <section className="card animar-entrada">
        <h2 className="mb-2 text-sm font-semibold">Kilómetros y tiempos</h2>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Km inicio</label>
            <input
              type="number"
              inputMode="numeric"
              className="input"
              value={aviso.kmInicio ?? ''}
              onChange={(e) => actualizar({ kmInicio: numero(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Km final</label>
            <input
              type="number"
              inputMode="numeric"
              className="input"
              value={aviso.kmFin ?? ''}
              onChange={(e) => actualizar({ kmFin: numero(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Conduciendo (min)</label>
            <input
              type="number"
              inputMode="numeric"
              className="input"
              placeholder={d.conduccion != null ? `auto: ${d.conduccion}` : ''}
              value={aviso.minConduccion ?? ''}
              onChange={(e) => actualizar({ minConduccion: numero(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Parado (min)</label>
            <input
              type="number"
              inputMode="numeric"
              className="input"
              value={aviso.minParado ?? ''}
              onChange={(e) => actualizar({ minParado: numero(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Esperando (min)</label>
            <input
              type="number"
              inputMode="numeric"
              className="input"
              placeholder={d.espera != null ? `auto: ${d.espera}` : ''}
              value={aviso.minEspera ?? ''}
              onChange={(e) => actualizar({ minEspera: numero(e.target.value) })}
            />
          </div>
          {d.km != null && (
            <div className="flex items-end pb-2 text-sm text-ink2">
              Recorrido: <b className="ml-1 text-ink">{d.km} km</b>
            </div>
          )}
        </div>
      </section>

      {/* Localización y cliente */}
      <section className="card animar-entrada">
        <h2 className="mb-2 text-sm font-semibold">Localización y cliente</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="label">Municipio</label>
            <input
              className="input"
              value={aviso.municipio}
              onChange={(e) => actualizar({ municipio: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Destino</label>
            <input
              className="input"
              value={aviso.destino}
              onChange={(e) => actualizar({ destino: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Empresa aseguradora</label>
            <input
              className="input"
              value={aviso.aseguradora}
              onChange={(e) => actualizar({ aseguradora: e.target.value })}
            />
          </div>
        </div>
        {aviso.lat != null && aviso.lng != null && (
          <a
            href={`https://www.openstreetmap.org/?mlat=${aviso.lat}&mlon=${aviso.lng}#map=15/${aviso.lat}/${aviso.lng}`}
            target="_blank"
            rel="noreferrer"
            className="btn-outline mt-2 text-xs"
          >
            <IconoMapa className="text-base" /> Ver ubicación en el mapa
          </a>
        )}
      </section>

      {/* Observaciones */}
      <section className="card animar-entrada">
        <label className="label">Observaciones</label>
        <textarea
          className="input min-h-24"
          placeholder="Ej.: cliente sin rueda de repuesto"
          value={aviso.observaciones}
          onChange={(e) => actualizar({ observaciones: e.target.value })}
        />
      </section>
    </div>
  );
}
