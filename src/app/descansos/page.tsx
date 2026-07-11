'use client';

// Registro de descansos: comer, cena, descanso o café, con inicio y fin.
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { borrarSuave, db, nuevoId, tocar } from '@/lib/db';
import { sincronizar } from '@/lib/sync';
import type { Descanso, TipoDescanso } from '@/lib/types';
import { TIPOS_DESCANSO } from '@/lib/types';
import {
  fmtDuracion,
  fmtFechaLarga,
  fmtHora,
  isoALocalInput,
  localInputAISO,
  minutosEntre,
  nowISO,
  fechaDeISO,
} from '@/lib/time';

function FormularioDescanso({ descanso, onCerrar }: { descanso?: Descanso; onCerrar: () => void }) {
  const [inicio, setInicio] = useState(isoALocalInput(descanso?.inicio ?? nowISO()));
  const [fin, setFin] = useState(isoALocalInput(descanso?.fin ?? null));
  const [tipo, setTipo] = useState<TipoDescanso>(descanso?.tipo ?? 'descanso');

  const guardar = async () => {
    const inicioISO = localInputAISO(inicio);
    if (!inicioISO) return;
    const d: Descanso = {
      id: descanso?.id ?? nuevoId(),
      inicio: inicioISO,
      fin: localInputAISO(fin),
      tipo,
      notas: descanso?.notas ?? '',
      updatedAt: nowISO(),
      deletedAt: null,
      dirty: 1,
    };
    await db.descansos.put(d);
    void sincronizar();
    onCerrar();
  };

  return (
    <div className="card animar-entrada flex flex-col gap-2 border-primary/40">
      <div>
        <label className="label">Tipo</label>
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.entries(TIPOS_DESCANSO) as [TipoDescanso, string][]).map(([t, etiqueta]) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`rounded-xl border px-2 py-2 text-xs font-medium ${
                tipo === t ? 'border-primary bg-primary-soft text-ink' : 'border-line text-ink2'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="label">Inicio</label>
          <input type="datetime-local" className="input" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div>
          <label className="label">Fin (vacío = en curso)</label>
          <input type="datetime-local" className="input" value={fin} onChange={(e) => setFin(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={guardar} className="btn-primary flex-1">
          Guardar
        </button>
        <button onClick={onCerrar} className="btn-outline">
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default function PaginaDescansos() {
  const [editando, setEditando] = useState<string | 'nuevo' | null>(null);
  const descansos = useLiveQuery(
    () =>
      db.descansos
        .filter((d) => !d.deletedAt)
        .toArray()
        .then((xs) => xs.sort((a, b) => b.inicio.localeCompare(a.inicio))),
    []
  );

  const terminar = async (d: Descanso) => {
    await db.descansos.put(tocar({ ...d, fin: nowISO() }));
    void sincronizar();
  };

  const borrar = async (d: Descanso) => {
    if (!confirm('¿Eliminar este descanso?')) return;
    await borrarSuave(db.descansos, d.id);
    void sincronizar();
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Descansos</h1>
        <button onClick={() => setEditando('nuevo')} className="btn-primary">
          + Nuevo descanso
        </button>
      </div>

      {editando === 'nuevo' && <FormularioDescanso onCerrar={() => setEditando(null)} />}

      {descansos && descansos.length === 0 && editando === null && (
        <div className="card py-10 text-center text-sm text-muted">
          Todavía no hay descansos registrados.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {(descansos ?? []).map((d) =>
          editando === d.id ? (
            <FormularioDescanso key={d.id} descanso={d} onCerrar={() => setEditando(null)} />
          ) : (
            <div key={d.id} className={`card animar-entrada ${!d.fin ? 'border-primary/40' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {TIPOS_DESCANSO[d.tipo]}
                    {!d.fin && (
                      <span className="chip bg-good/15 text-[10px] text-good">En curso</span>
                    )}
                  </p>
                  <p className="text-xs text-ink2">
                    {fmtFechaLarga(fechaDeISO(d.inicio))} · {fmtHora(d.inicio)} → {d.fin ? fmtHora(d.fin) : '…'}
                  </p>
                </div>
                <p className="text-sm font-bold tabular-nums">
                  {d.fin ? fmtDuracion(minutosEntre(d.inicio, d.fin)) : '—'}
                </p>
              </div>
              <div className="mt-2 flex gap-2">
                {!d.fin && (
                  <button onClick={() => terminar(d)} className="btn-tonal !px-3 !py-1.5 text-xs">
                    Terminar ahora
                  </button>
                )}
                <button onClick={() => setEditando(d.id)} className="btn-outline !px-3 !py-1.5 text-xs">
                  Editar
                </button>
                <button onClick={() => borrar(d)} className="btn-outline !px-3 !py-1.5 text-xs text-critical">
                  Eliminar
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
