'use client';

// Registro de guardias: alta con fecha, hora de inicio/fin y tipo (12 h, 24 h u
// otro); edición en línea y cierre rápido de la guardia abierta.
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { borrarSuave, db, nuevoId, tocar } from '@/lib/db';
import { sincronizar } from '@/lib/sync';
import type { Guardia, TipoGuardia } from '@/lib/types';
import { TIPOS_GUARDIA } from '@/lib/types';
import {
  fechaDeISO,
  fechaLocal,
  fmtDuracion,
  fmtFechaLarga,
  fmtHora,
  inicioSemana,
  isoALocalInput,
  localInputAISO,
  minutosEntre,
  nowISO,
  sumarDias,
} from '@/lib/time';

function FormularioGuardia({ guardia, onCerrar }: { guardia?: Guardia; onCerrar: () => void }) {
  const [inicio, setInicio] = useState(isoALocalInput(guardia?.inicio ?? nowISO()));
  const [fin, setFin] = useState(isoALocalInput(guardia?.fin ?? null));
  const [tipo, setTipo] = useState<TipoGuardia>(guardia?.tipo ?? 'guardia_12h');
  const [notas, setNotas] = useState(guardia?.notas ?? '');

  const guardar = async () => {
    const inicioISO = localInputAISO(inicio);
    if (!inicioISO) return;
    const g: Guardia = {
      id: guardia?.id ?? nuevoId(),
      fecha: fechaDeISO(inicioISO),
      inicio: inicioISO,
      fin: localInputAISO(fin),
      tipo,
      notas,
      updatedAt: nowISO(),
      deletedAt: null,
      dirty: 1,
    };
    await db.guardias.put(g);
    void sincronizar();
    onCerrar();
  };

  return (
    <div className="card animar-entrada flex flex-col gap-2 border-primary/40">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="label">Hora de inicio</label>
          <input type="datetime-local" className="input" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div>
          <label className="label">Hora de fin (vacío = en curso)</label>
          <input type="datetime-local" className="input" value={fin} onChange={(e) => setFin(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Tipo de guardia</label>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.entries(TIPOS_GUARDIA) as [TipoGuardia, string][]).map(([t, etiqueta]) => (
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
      <div>
        <label className="label">Notas</label>
        <input className="input" value={notas} onChange={(e) => setNotas(e.target.value)} />
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

// Alta de una semana completa según el ciclo real del usuario: semana de
// guardia de 12 h de lunes a viernes (libra sábado y domingo) o semana 24/7.
function FormularioSemana({ onCerrar }: { onCerrar: () => void }) {
  const hoy = fechaLocal();
  const [lunes, setLunes] = useState(inicioSemana(hoy));
  const [tipoSemana, setTipoSemana] = useState<'12h' | '24_7'>('12h');
  const [horaInicio, setHoraInicio] = useState('08:00');

  const crear = async () => {
    const guardias: Guardia[] = [];
    if (tipoSemana === '24_7') {
      const inicio = new Date(`${lunes}T00:00`);
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + 7);
      guardias.push({
        id: nuevoId(),
        fecha: lunes,
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        tipo: 'guardia_24h',
        notas: 'Semana de guardia 24/7',
        updatedAt: nowISO(),
        deletedAt: null,
        dirty: 1,
      });
    } else {
      // Lunes a viernes, 12 h desde la hora elegida; sábado y domingo libres.
      for (let i = 0; i < 5; i++) {
        const fecha = sumarDias(lunes, i);
        const inicio = new Date(`${fecha}T${horaInicio}`);
        const fin = new Date(inicio.getTime() + 12 * 60 * 60000);
        guardias.push({
          id: nuevoId(),
          fecha,
          inicio: inicio.toISOString(),
          fin: fin.toISOString(),
          tipo: 'guardia_12h',
          notas: 'Semana de guardia 12 h (L–V)',
          updatedAt: nowISO(),
          deletedAt: null,
          dirty: 1,
        });
      }
    }
    await db.guardias.bulkAdd(guardias);
    void sincronizar();
    onCerrar();
  };

  return (
    <div className="card animar-entrada flex flex-col gap-2 border-primary/40">
      <h2 className="text-sm font-semibold">Semana completa de guardia</h2>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => setTipoSemana('12h')}
          className={`rounded-xl border px-2 py-2 text-xs font-medium ${
            tipoSemana === '12h' ? 'border-primary bg-primary-soft text-ink' : 'border-line text-ink2'
          }`}
        >
          12 h de lunes a viernes
        </button>
        <button
          onClick={() => setTipoSemana('24_7')}
          className={`rounded-xl border px-2 py-2 text-xs font-medium ${
            tipoSemana === '24_7' ? 'border-primary bg-primary-soft text-ink' : 'border-line text-ink2'
          }`}
        >
          24/7 toda la semana
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Lunes de la semana</label>
          <input type="date" className="input" value={lunes} onChange={(e) => setLunes(e.target.value)} />
        </div>
        {tipoSemana === '12h' && (
          <div>
            <label className="label">Hora de inicio diaria</label>
            <input type="time" className="input" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted">
        {tipoSemana === '12h'
          ? 'Crea 5 guardias de 12 h (lunes a viernes); el sábado y el domingo quedan libres.'
          : 'Crea una única guardia continua desde el lunes a las 00:00 hasta el lunes siguiente.'}
      </p>
      <div className="flex gap-2">
        <button onClick={crear} className="btn-primary flex-1">
          Crear semana
        </button>
        <button onClick={onCerrar} className="btn-outline">
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default function PaginaGuardias() {
  const [editando, setEditando] = useState<string | 'nueva' | 'semana' | null>(null);
  const guardias = useLiveQuery(
    () =>
      db.guardias
        .filter((g) => !g.deletedAt)
        .toArray()
        .then((xs) => xs.sort((a, b) => b.inicio.localeCompare(a.inicio))),
    []
  );

  const cerrarGuardia = async (g: Guardia) => {
    await db.guardias.put(tocar({ ...g, fin: nowISO() }));
    void sincronizar();
  };

  const borrar = async (g: Guardia) => {
    if (!confirm('¿Eliminar esta guardia?')) return;
    await borrarSuave(db.guardias, g.id);
    void sincronizar();
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Guardias</h1>
        <div className="flex gap-2">
          <button onClick={() => setEditando('semana')} className="btn-tonal">
            + Semana
          </button>
          <button onClick={() => setEditando('nueva')} className="btn-primary">
            + Nueva guardia
          </button>
        </div>
      </div>

      {editando === 'nueva' && <FormularioGuardia onCerrar={() => setEditando(null)} />}
      {editando === 'semana' && <FormularioSemana onCerrar={() => setEditando(null)} />}

      {guardias && guardias.length === 0 && editando === null && (
        <div className="card py-10 text-center text-sm text-muted">
          Todavía no hay guardias registradas.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {(guardias ?? []).map((g) =>
          editando === g.id ? (
            <FormularioGuardia key={g.id} guardia={g} onCerrar={() => setEditando(null)} />
          ) : (
            <div key={g.id} className={`card animar-entrada ${!g.fin ? 'border-primary/40' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {TIPOS_GUARDIA[g.tipo]}
                    {!g.fin && (
                      <span className="chip bg-primary-soft text-[10px] text-primary dark:text-white">
                        En curso
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink2">
                    {fmtFechaLarga(g.fecha)} · {fmtHora(g.inicio)} → {g.fin ? fmtHora(g.fin) : '…'}
                  </p>
                  {g.notas && <p className="text-xs text-muted">{g.notas}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums">
                    {g.fin ? fmtDuracion(minutosEntre(g.inicio, g.fin)) : '—'}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                {!g.fin && (
                  <button onClick={() => cerrarGuardia(g)} className="btn-tonal !px-3 !py-1.5 text-xs">
                    Terminar ahora
                  </button>
                )}
                <button onClick={() => setEditando(g.id)} className="btn-outline !px-3 !py-1.5 text-xs">
                  Editar
                </button>
                <button onClick={() => borrar(g)} className="btn-outline !px-3 !py-1.5 text-xs text-critical">
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
