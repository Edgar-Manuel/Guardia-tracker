'use client';

// Informes: selección de periodo (mes, semana o rango libre), vista previa del
// resumen y exportación a PDF, Excel, CSV y JSON.
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, obtenerAjustes } from '@/lib/db';
import { AJUSTES_POR_DEFECTO } from '@/lib/types';
import { estadisticasRango } from '@/lib/stats';
import { analizarCumplimiento, DESCARGO_LEGAL } from '@/lib/legal';
import {
  fechaLocal,
  finMes,
  fmtDuracion,
  inicioMes,
  inicioSemana,
  nombreMes,
  sumarDias,
} from '@/lib/time';
import { exportarCSV, exportarExcel, exportarJSON } from '@/lib/export';
import { generarInformePDF } from '@/lib/pdf';
import StatTile from '@/components/StatTile';

type Modo = 'mes' | 'semana' | 'rango';

export default function PaginaInformes() {
  const hoy = fechaLocal();
  const [modo, setModo] = useState<Modo>('mes');
  const [mesSel, setMesSel] = useState(hoy.slice(0, 7));
  const [desdeSel, setDesdeSel] = useState(inicioMes(hoy));
  const [hastaSel, setHastaSel] = useState(hoy);
  const [generando, setGenerando] = useState<string | null>(null);

  const datos = useLiveQuery(async () => {
    const [guardias, avisos, descansos] = await Promise.all([
      db.guardias.filter((g) => !g.deletedAt).toArray(),
      db.avisos.filter((a) => !a.deletedAt).toArray(),
      db.descansos.filter((d) => !d.deletedAt).toArray(),
    ]);
    return { guardias, avisos, descansos };
  }, []);
  const ajustes = useLiveQuery(() => obtenerAjustes(), []) ?? AJUSTES_POR_DEFECTO;

  const [desde, hasta, titulo] = useMemo((): [string, string, string] => {
    if (modo === 'mes') {
      const primero = `${mesSel}-01`;
      const [a, m] = mesSel.split('-').map(Number);
      return [primero, finMes(primero), `Informe mensual · ${nombreMes(m - 1)} ${a}`];
    }
    if (modo === 'semana') {
      const lunes = inicioSemana(hoy);
      return [lunes, sumarDias(lunes, 6), 'Informe semanal'];
    }
    return [desdeSel, hastaSel, 'Informe del periodo'];
  }, [modo, mesSel, desdeSel, hastaSel, hoy]);

  const stats = useMemo(
    () => (datos && desde <= hasta ? estadisticasRango(desde, hasta, datos, ajustes) : null),
    [datos, ajustes, desde, hasta]
  );
  const alertas = useMemo(
    () => (datos && desde <= hasta ? analizarCumplimiento(desde, hasta, datos, ajustes) : []),
    [datos, ajustes, desde, hasta]
  );

  const datosRango = useMemo(() => {
    if (!datos) return null;
    return {
      guardias: datos.guardias.filter((g) => g.fecha >= desde && g.fecha <= hasta),
      avisos: datos.avisos.filter((a) => a.fecha >= desde && a.fecha <= hasta),
      descansos: datos.descansos.filter((d) => {
        const f = d.inicio.slice(0, 10);
        return f >= desde && f <= hasta;
      }),
    };
  }, [datos, desde, hasta]);

  const ejecutar = async (formato: string, fn: () => Promise<void> | void) => {
    setGenerando(formato);
    try {
      await fn();
    } finally {
      setGenerando(null);
    }
  };

  const sufijo = `${desde}-a-${hasta}`;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-bold">Informes</h1>

      <section className="card animar-entrada flex flex-col gap-3">
        <div className="flex rounded-full border border-line bg-surface p-1">
          {(['mes', 'semana', 'rango'] as Modo[]).map((m) => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                modo === m ? 'bg-primary text-white' : 'text-ink2'
              }`}
            >
              {m === 'rango' ? 'Rango libre' : m === 'mes' ? 'Mes' : 'Semana actual'}
            </button>
          ))}
        </div>

        {modo === 'mes' && (
          <div>
            <label className="label">Mes</label>
            <input
              type="month"
              className="input"
              value={mesSel}
              onChange={(e) => setMesSel(e.target.value)}
            />
          </div>
        )}
        {modo === 'rango' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Desde</label>
              <input type="date" className="input" value={desdeSel} onChange={(e) => setDesdeSel(e.target.value)} />
            </div>
            <div>
              <label className="label">Hasta</label>
              <input type="date" className="input" value={hastaSel} onChange={(e) => setHastaSel(e.target.value)} />
            </div>
          </div>
        )}
      </section>

      {stats && (
        <section className="animar-entrada">
          <h2 className="mb-2 text-sm font-semibold text-ink2">Vista previa del periodo</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile etiqueta="Horas efectivas" valor={fmtDuracion(stats.minEfectivos)} />
            <StatTile etiqueta="Guardia" valor={fmtDuracion(stats.minGuardia)} />
            <StatTile etiqueta="Avisos" valor={String(stats.numAvisos)} />
            <StatTile
              etiqueta="Incidencias"
              valor={String(alertas.length)}
              acento={alertas.length > 0 ? 'warn' : 'good'}
            />
          </div>
        </section>
      )}

      <section className="card animar-entrada">
        <h2 className="mb-1 text-sm font-semibold">Generar informe</h2>
        <p className="mb-3 text-xs text-ink2">
          El PDF incluye calendario, resúmenes diario, semanal y mensual, gráfico de horas, la
          tabla completa de avisos, descansos, horas nocturnas y extraordinarias, observaciones y
          las posibles incidencias detectadas.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            disabled={!datos || generando !== null}
            onClick={() =>
              ejecutar('pdf', () => generarInformePDF(desde, hasta, datos!, ajustes, titulo))
            }
            className="btn-primary"
          >
            {generando === 'pdf' ? 'Generando…' : 'PDF'}
          </button>
          <button
            disabled={!datosRango || generando !== null}
            onClick={() => ejecutar('excel', () => exportarExcel(datosRango!, sufijo))}
            className="btn-tonal"
          >
            {generando === 'excel' ? 'Generando…' : 'Excel'}
          </button>
          <button
            disabled={!datosRango || generando !== null}
            onClick={() => ejecutar('csv', () => exportarCSV(datosRango!, sufijo))}
            className="btn-tonal"
          >
            CSV
          </button>
          <button
            disabled={!datosRango || generando !== null}
            onClick={() => ejecutar('json', () => exportarJSON(datosRango!, sufijo))}
            className="btn-tonal"
          >
            JSON
          </button>
        </div>
      </section>

      <p className="px-2 text-[10px] leading-relaxed text-muted">{DESCARGO_LEGAL}</p>
    </div>
  );
}
