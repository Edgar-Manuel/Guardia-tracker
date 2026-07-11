// Ficha de estadística: valor grande + etiqueta. El valor usa la tinta del
// texto (no el color de serie); un acento opcional marca estados.
export default function StatTile({
  etiqueta,
  valor,
  detalle,
  acento,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  acento?: 'primary' | 'warn' | 'critical' | 'good';
}) {
  const colorValor =
    acento === 'critical'
      ? 'text-critical'
      : acento === 'warn'
        ? 'text-warn'
        : acento === 'good'
          ? 'text-good'
          : 'text-ink';
  return (
    <div className="card animar-entrada">
      <p className="text-xs font-medium text-ink2">{etiqueta}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${colorValor}`}>{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-muted">{detalle}</p>}
    </div>
  );
}
