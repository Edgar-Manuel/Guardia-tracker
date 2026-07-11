'use client';

// Gráficos de estadísticas (Recharts) siguiendo el sistema de diseño:
// una sola serie por gráfico (sin leyenda), marcas finas con extremos
// redondeados, rejilla recesiva y tooltip al pasar el dedo o el ratón.
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { EstadisticasDia } from '@/lib/stats';
import { fechaADate, fmtDuracion } from '@/lib/time';

/** Colores por modo (paleta validada; los gráficos no pueden leer variables CSS). */
function useColores() {
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    const leer = () => setOscuro(html.classList.contains('dark'));
    leer();
    const obs = new MutationObserver(leer);
    obs.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return oscuro
    ? {
        serie: '#3987e5',
        critico: '#e66767',
        rejilla: '#2c2c2a',
        eje: '#898781',
        tooltipFondo: '#242422',
        tooltipTinta: '#ffffff',
      }
    : {
        serie: '#2a78d6',
        critico: '#d03b3b',
        rejilla: '#e1e0d9',
        eje: '#898781',
        tooltipFondo: '#fcfcfb',
        tooltipTinta: '#0b0b0b',
      };
}

function TooltipHoras({
  active,
  payload,
  label,
  colores,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  colores: ReturnType<typeof useColores>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border border-line px-2.5 py-1.5 text-xs shadow-card"
      style={{ background: colores.tooltipFondo, color: colores.tooltipTinta }}
    >
      <p className="font-semibold">{label}</p>
      <p>{fmtDuracion(payload[0].value)}</p>
    </div>
  );
}

export function GraficoHorasPorDia({
  dias,
  limiteMin,
}: {
  dias: EstadisticasDia[];
  limiteMin: number;
}) {
  const colores = useColores();
  const datos = dias.map((d) => ({
    dia: String(fechaADate(d.fecha).getDate()),
    minutos: d.minEfectivos,
  }));
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <BarChart data={datos} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={colores.rejilla} strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="dia"
            tick={{ fill: colores.eje, fontSize: 10 }}
            axisLine={{ stroke: colores.rejilla }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: colores.eje, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            domain={[0, (dataMax: number) => Math.max(dataMax, Math.round(limiteMin * 1.15))]}
            tickFormatter={(v: number) => `${Math.round(v / 60)}h`}
          />
          <Tooltip
            cursor={{ fill: colores.rejilla, opacity: 0.4 }}
            content={<TooltipHoras colores={colores} />}
          />
          <ReferenceLine
            y={limiteMin}
            stroke={colores.critico}
            strokeDasharray="4 4"
            label={{
              value: `Límite ${Math.round(limiteMin / 60)} h`,
              position: 'insideTopRight',
              fill: colores.critico,
              fontSize: 10,
            }}
          />
          <Bar dataKey="minutos" radius={[4, 4, 0, 0]} maxBarSize={22}>
            {datos.map((d, i) => (
              <Cell key={i} fill={d.minutos > limiteMin ? colores.critico : colores.serie} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GraficoAvisosPorTipo({ datos }: { datos: Array<{ tipo: string; total: number }> }) {
  const colores = useColores();
  return (
    <div className="w-full" style={{ height: Math.max(120, datos.length * 34) }}>
      <ResponsiveContainer>
        <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={colores.rejilla} horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fill: colores.eje, fontSize: 10 }}
            axisLine={{ stroke: colores.rejilla }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="tipo"
            width={110}
            tick={{ fill: colores.eje, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: colores.rejilla, opacity: 0.4 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div
                  className="rounded-lg border border-line px-2.5 py-1.5 text-xs shadow-card"
                  style={{ background: colores.tooltipFondo, color: colores.tooltipTinta }}
                >
                  <p className="font-semibold">{label}</p>
                  <p>{payload[0].value} avisos</p>
                </div>
              ) : null
            }
          />
          <Bar
            dataKey="total"
            fill={colores.serie}
            radius={[0, 4, 4, 0]}
            maxBarSize={18}
            label={{ position: 'right', fill: colores.eje, fontSize: 10 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
