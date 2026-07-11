'use client';

// Ficha del aviso en curso: muestra la cronología registrada y un botón grande
// para sellar la siguiente fase con la hora actual (flujo de un solo toque).
import Link from 'next/link';
import { db, tocar } from '@/lib/db';
import { sincronizar } from '@/lib/sync';
import type { Aviso, FaseAviso } from '@/lib/types';
import { ETIQUETAS_FASE, FASES_AVISO, TIPOS_SERVICIO } from '@/lib/types';
import { fmtHora, nowISO } from '@/lib/time';
import { IconoFlecha } from './Iconos';

export function siguienteFase(a: Aviso): FaseAviso | null {
  for (const f of FASES_AVISO) {
    if (!a[f]) return f;
  }
  return null;
}

export default function FichaAvisoEnCurso({ aviso }: { aviso: Aviso }) {
  const fase = siguienteFase(aviso);

  const sellarFase = async () => {
    if (!fase) return;
    const cambios: Partial<Aviso> = { [fase]: nowISO() };
    await db.avisos.update(aviso.id, tocar({ ...aviso, ...cambios }));
    void sincronizar();
  };

  return (
    <div className="card animar-entrada border-primary/40">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Aviso en curso</p>
          <p className="text-lg font-bold">{TIPOS_SERVICIO[aviso.tipo]}</p>
          {(aviso.municipio || aviso.aseguradora) && (
            <p className="text-xs text-ink2">
              {[aviso.municipio, aviso.aseguradora].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <Link
          href={`/avisos/${aviso.id}`}
          className="btn-outline shrink-0 !px-3 !py-1.5 text-xs"
        >
          Detalles
          <IconoFlecha />
        </Link>
      </div>

      <ol className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {FASES_AVISO.map((f) => {
          const hecho = Boolean(aviso[f]);
          const esSiguiente = f === fase;
          return (
            <li
              key={f}
              className={`rounded-lg px-2 py-1.5 text-center text-[10px] leading-tight ${
                hecho
                  ? 'bg-primary-soft text-ink'
                  : esSiguiente
                    ? 'border border-dashed border-primary text-primary'
                    : 'bg-surface-2 text-muted'
              }`}
            >
              <span className="block font-medium">{ETIQUETAS_FASE[f]}</span>
              <span className="block font-bold">{hecho ? fmtHora(aviso[f]) : '·'}</span>
            </li>
          );
        })}
      </ol>

      {fase && (
        <button onClick={sellarFase} className="btn-primary mt-3 w-full py-3 text-base">
          Marcar «{ETIQUETAS_FASE[fase]}» ahora
        </button>
      )}
    </div>
  );
}
