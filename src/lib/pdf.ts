// Generación de informes PDF con jsPDF + autotable.
// El informe incluye: resumen del periodo, gráfico de horas por día, calendario,
// resúmenes semanal y diario, tabla completa de avisos, descansos y alertas.
import type { Ajustes } from './types';
import { TIPOS_DESCANSO, TIPOS_SERVICIO } from './types';
import {
  avisosEnRango,
  descansosEnRango,
  duracionesAviso,
  estadisticasRango,
  inicioAviso,
  type Datos,
} from './stats';
import { analizarCumplimiento, DESCARGO_LEGAL } from './legal';
import {
  fechaADate,
  fmtDuracion,
  fmtFechaCorta,
  fmtHora,
  fmtHoras,
  inicioSemana,
  nombreMes,
  sumarDias,
} from './time';

// Colores del informe (paleta validada del sistema de diseño)
const AZUL: [number, number, number] = [42, 120, 214];
const AZUL_OSCURO: [number, number, number] = [24, 79, 149];
const TINTA: [number, number, number] = [11, 11, 11];
const TINTA_2: [number, number, number] = [82, 81, 78];
const LINEA: [number, number, number] = [225, 224, 217];
const ROJO: [number, number, number] = [208, 59, 59];
const AMBAR: [number, number, number] = [201, 133, 0];

export async function generarInformePDF(
  desde: string,
  hasta: string,
  datos: Datos,
  ajustes: Ajustes,
  titulo: string
) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();
  const margen = 14;
  let y = 0;

  const stats = estadisticasRango(desde, hasta, datos, ajustes);
  const avisos = avisosEnRango(desde, hasta, datos.avisos);
  const descansos = descansosEnRango(desde, hasta, datos.descansos);
  const alertas = analizarCumplimiento(desde, hasta, datos, ajustes);

  // --- Cabecera ---
  doc.setFillColor(...AZUL_OSCURO);
  doc.rect(0, 0, ancho, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Guardia Tracker', margen, 13);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(titulo, margen, 21);
  doc.setFontSize(8);
  doc.text(
    `Periodo: ${fmtFechaCorta(desde)} – ${fmtFechaCorta(hasta)} · Generado el ${fmtFechaCorta(new Date().toISOString().slice(0, 10))}`,
    margen,
    26.5
  );
  y = 38;

  // --- Resumen del periodo ---
  doc.setTextColor(...TINTA);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen del periodo', margen, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: margen, right: margen },
    theme: 'grid',
    styles: { fontSize: 9, textColor: TINTA, lineColor: LINEA },
    headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontStyle: 'bold' },
    head: [['Concepto', 'Valor', 'Concepto', 'Valor']],
    body: [
      ['Horas de trabajo efectivo', fmtDuracion(stats.minEfectivos), 'Nº de avisos', String(stats.numAvisos)],
      ['Amplitud de jornada (1.º → último aviso)', fmtDuracion(stats.minAmplitud), 'Duración media por aviso', fmtDuracion(stats.mediaDuracionAviso)],
      ['Tiempo de guardia / presencia', fmtDuracion(stats.minGuardia), 'Media entre avisos', fmtDuracion(stats.mediaEntreAvisos)],
      ['Horas nocturnas', fmtDuracion(stats.minNocturnos), 'Tiempo conduciendo', fmtDuracion(stats.minConduccion)],
      ['Exceso sobre jornada diaria', fmtDuracion(stats.minExtra), 'Tiempo con clientes', fmtDuracion(stats.minConCliente)],
      ['Descansos registrados', fmtDuracion(stats.minDescanso), 'Tiempo esperando', fmtDuracion(stats.minEspera)],
      ['Kilómetros realizados', `${stats.km} km`, '', ''],
    ],
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // --- Gráfico de barras: horas efectivas por día ---
  const diasConDatos = stats.dias;
  if (diasConDatos.length > 0 && diasConDatos.length <= 31) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Horas efectivas por día', margen, y);
    y += 5;

    const altoGrafico = 40;
    const anchoGrafico = ancho - margen * 2;
    const maxMin = Math.max(ajustes.maxJornadaDiaria * 60, ...diasConDatos.map((d) => d.minEfectivos), 60);
    const anchoBarra = Math.min(8, (anchoGrafico / diasConDatos.length) * 0.7);
    const paso = anchoGrafico / diasConDatos.length;

    // Línea del límite de jornada
    const yLimite = y + altoGrafico - (ajustes.maxJornadaDiaria * 60 / maxMin) * altoGrafico;
    doc.setDrawColor(...ROJO);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(margen, yLimite, margen + anchoGrafico, yLimite);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(6.5);
    doc.setTextColor(...ROJO);
    doc.text(`Límite ${ajustes.maxJornadaDiaria} h`, margen + anchoGrafico, yLimite - 1, { align: 'right' });

    // Base
    doc.setDrawColor(...LINEA);
    doc.line(margen, y + altoGrafico, margen + anchoGrafico, y + altoGrafico);

    diasConDatos.forEach((d, i) => {
      const h = (d.minEfectivos / maxMin) * altoGrafico;
      const x = margen + i * paso + (paso - anchoBarra) / 2;
      if (h > 0) {
        const excede = d.minEfectivos > ajustes.maxJornadaDiaria * 60;
        doc.setFillColor(...(excede ? ROJO : AZUL));
        doc.roundedRect(x, y + altoGrafico - h, anchoBarra, h, 0.8, 0.8, 'F');
      }
      doc.setFontSize(5.5);
      doc.setTextColor(...TINTA_2);
      doc.text(String(fechaADate(d.fecha).getDate()), x + anchoBarra / 2, y + altoGrafico + 3, { align: 'center' });
    });
    y += altoGrafico + 10;
  }

  // --- Calendario del periodo (si es un mes) ---
  if (desde.slice(0, 7) === hasta.slice(0, 7)) {
    if (y > 200) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TINTA);
    const [anio, mes] = desde.split('-').map(Number);
    doc.text(`Calendario · ${nombreMes(mes - 1)} ${anio}`, margen, y);
    y += 5;

    const anchoCelda = (ancho - margen * 2) / 7;
    const altoCelda = 13;
    const diasSemana = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    doc.setFontSize(7);
    doc.setTextColor(...TINTA_2);
    diasSemana.forEach((d, i) => {
      doc.text(d, margen + i * anchoCelda + anchoCelda / 2, y + 3, { align: 'center' });
    });
    y += 5;

    const porFecha = new Map(stats.dias.map((d) => [d.fecha, d]));
    let cursor = desde;
    let fila = 0;
    while (cursor <= hasta) {
      const dow = (fechaADate(cursor).getDay() + 6) % 7;
      const x = margen + dow * anchoCelda;
      const yc = y + fila * altoCelda;
      const d = porFecha.get(cursor);
      const conTrabajo = d && d.minEfectivos > 0;
      const excede = d && d.minEfectivos > ajustes.maxJornadaDiaria * 60;

      doc.setDrawColor(...LINEA);
      if (excede) doc.setFillColor(250, 226, 226);
      else if (conTrabajo) doc.setFillColor(226, 238, 251);
      else doc.setFillColor(252, 252, 251);
      doc.rect(x, yc, anchoCelda, altoCelda, 'FD');

      doc.setFontSize(6.5);
      doc.setTextColor(...TINTA);
      doc.text(String(fechaADate(cursor).getDate()), x + 1.5, yc + 3.5);
      if (conTrabajo && d) {
        doc.setFontSize(6);
        doc.setTextColor(...(excede ? ROJO : AZUL_OSCURO));
        doc.text(fmtHoras(d.minEfectivos), x + 1.5, yc + 7.5);
        doc.setTextColor(...TINTA_2);
        doc.text(`${d.numAvisos} av.`, x + 1.5, yc + 11);
      }
      if (dow === 6) fila += 1;
      cursor = sumarDias(cursor, 1);
    }
    y += (fila + 1) * altoCelda + 10;
  }

  // --- Resumen semanal ---
  doc.addPage();
  y = 20;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TINTA);
  doc.text('Resumen semanal', margen, y);
  y += 3;

  const semanas = new Map<string, typeof stats.dias>();
  for (const d of stats.dias) {
    const lunes = inicioSemana(d.fecha);
    if (!semanas.has(lunes)) semanas.set(lunes, []);
    semanas.get(lunes)!.push(d);
  }
  autoTable(doc, {
    startY: y,
    margin: { left: margen, right: margen },
    theme: 'striped',
    styles: { fontSize: 8.5, textColor: TINTA },
    headStyles: { fillColor: AZUL, textColor: [255, 255, 255] },
    head: [['Semana (lunes)', 'Efectivas', 'Amplitud', 'Guardia', 'Nocturnas', 'Exceso', 'Avisos', 'Km']],
    body: Array.from(semanas.entries()).map(([lunes, ds]) => [
      fmtFechaCorta(lunes),
      fmtDuracion(ds.reduce((s, d) => s + d.minEfectivos, 0)),
      fmtDuracion(ds.reduce((s, d) => s + d.minAmplitud, 0)),
      fmtDuracion(ds.reduce((s, d) => s + d.minGuardia, 0)),
      fmtDuracion(ds.reduce((s, d) => s + d.minNocturnos, 0)),
      fmtDuracion(ds.reduce((s, d) => s + d.minExtra, 0)),
      String(ds.reduce((s, d) => s + d.numAvisos, 0)),
      String(ds.reduce((s, d) => s + d.km, 0)),
    ]),
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // --- Resumen diario (solo días con actividad) ---
  const diasActivos = stats.dias.filter((d) => d.minEfectivos > 0 || d.minGuardia > 0 || d.numAvisos > 0);
  if (diasActivos.length > 0) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen diario', margen, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      margin: { left: margen, right: margen },
      theme: 'striped',
      styles: { fontSize: 8, textColor: TINTA },
      headStyles: { fillColor: AZUL, textColor: [255, 255, 255] },
      head: [['Fecha', 'Efectivas', 'Amplitud', 'Guardia', 'Nocturnas', 'Exceso', 'Descanso', 'Avisos', 'Conducción', 'Km']],
      body: diasActivos.map((d) => [
        fmtFechaCorta(d.fecha),
        fmtDuracion(d.minEfectivos),
        d.minAmplitud > 0 ? fmtDuracion(d.minAmplitud) : '—',
        fmtDuracion(d.minGuardia),
        d.minNocturnos > 0 ? fmtDuracion(d.minNocturnos) : '—',
        d.minExtra > 0 ? fmtDuracion(d.minExtra) : '—',
        d.minDescanso > 0 ? fmtDuracion(d.minDescanso) : '—',
        String(d.numAvisos),
        fmtDuracion(d.minConduccion),
        String(d.km),
      ]),
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5 && data.cell.text[0] !== '—') {
          data.cell.styles.textColor = ROJO;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
  }

  // --- Tabla completa de avisos ---
  if (avisos.length > 0) {
    doc.addPage();
    y = 20;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TINTA);
    doc.text(`Detalle de avisos (${avisos.length})`, margen, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      margin: { left: margen, right: margen },
      theme: 'striped',
      styles: { fontSize: 6.8, textColor: TINTA, cellPadding: 1.2 },
      headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontSize: 6.8 },
      head: [['Fecha', 'Tipo', 'Asig.', 'Salida', 'Lleg.', 'Inicio', 'Fin', 'Disp.', 'Dur.', 'Km', 'Municipio', 'Aseguradora', 'Observaciones']],
      body: avisos.map((a) => {
        const d = duracionesAviso(a);
        return [
          fmtFechaCorta(a.fecha).slice(0, 5),
          TIPOS_SERVICIO[a.tipo],
          fmtHora(a.horaAsignacion),
          fmtHora(a.horaSalida),
          fmtHora(a.horaLlegada),
          fmtHora(a.horaInicioTrabajo),
          fmtHora(a.horaFin),
          fmtHora(a.horaDisponible),
          d.total != null ? fmtDuracion(d.total) : '—',
          d.km != null ? String(d.km) : '—',
          a.municipio || '—',
          a.aseguradora || '—',
          a.observaciones || '',
        ];
      }),
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // --- Descansos ---
  if (descansos.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TINTA);
    doc.text('Descansos', margen, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      margin: { left: margen, right: margen },
      theme: 'striped',
      styles: { fontSize: 8.5, textColor: TINTA },
      headStyles: { fillColor: AZUL, textColor: [255, 255, 255] },
      head: [['Fecha', 'Tipo', 'Inicio', 'Fin', 'Duración']],
      body: descansos.map((d) => [
        fmtFechaCorta(d.inicio.slice(0, 10)),
        TIPOS_DESCANSO[d.tipo],
        fmtHora(d.inicio),
        d.fin ? fmtHora(d.fin) : 'En curso',
        d.fin ? fmtDuracion(Math.round((new Date(d.fin).getTime() - new Date(d.inicio).getTime()) / 60000)) : '—',
      ]),
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // --- Alertas legales ---
  if (y > 220) { doc.addPage(); y = 20; }
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TINTA);
  doc.text('Posibles incidencias detectadas', margen, y);
  y += 3;
  if (alertas.length === 0) {
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TINTA_2);
    doc.text('No se han detectado incidencias con los umbrales configurados.', margen, y);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margen, right: margen },
      theme: 'grid',
      styles: { fontSize: 8, textColor: TINTA, lineColor: LINEA },
      headStyles: { fillColor: [56, 56, 53], textColor: [255, 255, 255] },
      head: [['Fecha', 'Incidencia', 'Detalle', 'Referencia']],
      body: alertas.map((al) => [fmtFechaCorta(al.fecha), al.titulo, al.detalle, al.referencia]),
      columnStyles: { 2: { cellWidth: 80 } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const sev = alertas[data.row.index]?.severidad;
          data.cell.styles.textColor = sev === 'grave' ? ROJO : sev === 'aviso' ? AMBAR : TINTA;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // --- Descargo legal ---
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...TINTA_2);
  const lineas = doc.splitTextToSize(DESCARGO_LEGAL, ancho - margen * 2);
  doc.text(lineas, margen, y);

  // Pie de página en todas las páginas
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TINTA_2);
    doc.text(`Guardia Tracker · ${titulo}`, margen, 290);
    doc.text(`Página ${i} de ${paginas}`, ancho - margen, 290, { align: 'right' });
  }

  doc.save(`informe-${desde}-a-${hasta}.pdf`);
}
