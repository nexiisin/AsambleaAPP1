import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export interface ActaData {
  asamblea: any;
  asistentes: any[];
  apoderados: any[];
  propuestas: any[];
  estadisticas: {
    totalViviendas: number;
    totalAsistentes: number;
    totalRepresentadas: number;
  };
}

export const descargarActaAsamblea = async (asambleaId: string) => {
  try {
    // 1. Obtener datos de la asamblea
    const { data: asamblea, error: errorAsamblea } = await supabase
      .from('asambleas')
      .select('*')
      .eq('id', asambleaId)
      .single();

    if (errorAsamblea) throw new Error('Error cargando asamblea');

    // 2. Obtener asistentes (incluye apoderados)
    const { data: asistencias, error: errorAsistencias } = await supabase
      .from('asistencias')
      .select('*')
      .eq('asamblea_id', asambleaId)
      .order('fecha_registro');

    if (errorAsistencias) throw new Error('Error cargando asistencias');

    // 3. Obtener viviendas para mapear números de casa
    const { data: viviendas, error: errorViviendas } = await supabase
      .from('viviendas')
      .select('id, numero_casa');

    if (errorViviendas) throw new Error('Error cargando viviendas');

    const viviendaMap = new Map<string, string>();
    viviendas?.forEach(v => viviendaMap.set(v.id, v.numero_casa));

    // 4. Obtener propietarios para mostrar apoderados
    const { data: propietarios, error: errorPropietarios } = await supabase
      .from('propietarios')
      .select('vivienda_id, primer_nombre, primer_apellido');

    if (errorPropietarios) throw new Error('Error cargando propietarios');

    const propietarioMap = new Map<string, string>();
    propietarios?.forEach(p => {
      const nombre = [p.primer_nombre, p.primer_apellido].filter(Boolean).join(' ').trim();
      propietarioMap.set(p.vivienda_id, nombre || 'Propietario');
    });

    // 5. Obtener propuestas
    const { data: propuestas, error: errorPropuestas } = await supabase
      .from('propuestas')
      .select('*')
      .eq('asamblea_id', asambleaId)
      .order('orden');

    if (errorPropuestas) throw new Error('Error cargando propuestas');

    // 6. OPTIMIZACIÓN Priority 3.3: Obtener todos los votos en 1 query (NO Promise.all loop)
    // Antes: 10 propuestas = 10 queries paralelas
    // Ahora: 1 query con IN clause
    const propuestaIds = propuestas?.map(p => p.id) || [];
    let votosPorPropuesta = new Map<string, any[]>();

    if (propuestaIds.length > 0) {
      const { data: todosLosVotos, error: errorVotos } = await supabase
        .from('votos')
        .select('*')
        .in('propuesta_id', propuestaIds);

      if (errorVotos) throw new Error('Error cargando votos');

      // Agrupar votos por propuesta localmente (sin queries adicionales)
      todosLosVotos?.forEach(voto => {
        if (!votosPorPropuesta.has(voto.propuesta_id)) {
          votosPorPropuesta.set(voto.propuesta_id, []);
        }
        votosPorPropuesta.get(voto.propuesta_id)!.push(voto);
      });
    }

    // Crear propuestas con votos asignados
    const propuestasConVotos = (propuestas || []).map(prop => ({
      ...prop,
      votos: votosPorPropuesta.get(prop.id) || [],
    }));

    // 7. Calcular estadísticas
    const apoderados = (asistencias || []).filter(a => a.es_apoderado);
    const totalCasas = viviendas?.length || 0;
    let totalAsistentes = 0;
    (asistencias || []).forEach(a => {
      totalAsistentes += 1;
      if (a.es_apoderado && a.estado_apoderado === 'APROBADO') totalAsistentes += 1;
    });

    let totalRepresentadas = new Set<string>();
    asistencias?.forEach(a => totalRepresentadas.add(a.vivienda_id));
    apoderados.forEach(a => {
      totalRepresentadas.add(a.vivienda_id);
      if (a.estado_apoderado === 'APROBADO' && a.casa_representada) {
        totalRepresentadas.add(a.casa_representada);
      }
    });

    // 8. Generar PDF
    const actaData: ActaData = {
      asamblea,
      asistentes: asistencias || [],
      apoderados,
      propuestas: propuestasConVotos,
      estadisticas: {
        totalViviendas: totalCasas,
        totalAsistentes,
        totalRepresentadas: totalRepresentadas.size,
      },
    };

    await generarPDFActa(actaData, viviendaMap, propietarioMap);
  } catch (error) {
    console.error('Error descargando acta:', error);
    throw error;
  }
};

const generarPDFActa = async (
  data: ActaData,
  viviendaMap: Map<string, string>,
  propietarioMap: Map<string, string>
) => {
  const fechaActa = new Date().toLocaleDateString('es-CO');
  const horaActa = new Date().toLocaleTimeString('es-CO');

  // Generar HTML para el PDF
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { text-align: center; color: #33995d; margin-bottom: 5px; }
        h2 { text-align: center; color: #33995d; font-size: 18px; margin-top: 5px; }
        .info { text-align: center; margin: 10px 0; font-size: 12px; }
        .section { margin-top: 20px; }
        .section-title { 
          background-color: #33995d; 
          color: white; 
          padding: 8px; 
          font-weight: bold; 
          font-size: 14px;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 10px;
          font-size: 10px;
        }
        th { 
          background-color: #f0f0f0; 
          padding: 6px; 
          text-align: left; 
          font-weight: bold;
          border-bottom: 1px solid #ddd;
        }
        td { 
          padding: 5px; 
          border-bottom: 1px solid #eee;
        }
        .propuesta { 
          margin-top: 15px; 
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        .propuesta-titulo { 
          font-weight: bold; 
          font-size: 12px;
          color: #336699;
          margin-bottom: 5px;
        }
        .propuesta-desc { 
          font-size: 10px; 
          margin: 5px 0;
          color: #555;
        }
        .grafico-container {
          display: flex;
          justify-content: center;
          margin: 15px 0;
        }
        .barra-container {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 18px;
          height: 130px;
        }
        .barra {
          width: 55px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .barra-visual {
          width: 100%;
          border-radius: 6px 6px 0 0;
          background-color: #e5e7eb;
          min-height: 6px;
        }
        .barra-si { background-color: #22c55e; }
        .barra-no { background-color: #ef4444; }
        .barra-novoto { background-color: #f59e0b; }
        .barra-noasistio { background-color: #9ca3af; }
        .barra-label {
          margin-top: 6px;
          font-size: 11px;
          font-weight: bold;
          text-align: center;
        }
        .barra-valor {
          font-size: 9px;
          color: #666;
        }
        .barra-emoji {
          font-size: 12px;
          margin-top: 2px;
        }
        .barra-text {
          font-size: 9px;
          color: #444;
          text-align: center;
        }
        .estadisticas {
          font-size: 10px;
          margin-top: 10px;
          padding: 8px;
          background-color: #f9f9f9;
        }
        .estadisticas div {
          margin: 3px 0;
        }
        .resultado {
          font-weight: bold;
          margin-top: 5px;
          font-size: 11px;
        }
        .aprobada { color: #059669; }
        .rechazada { color: #dc2626; }
      </style>
    </head>
    <body>
      <h1>ACTA DE ASAMBLEA</h1>
      <h2>Altos del Guali</h2>
      
      <div class="info">
        <strong>Fecha:</strong> ${fechaActa} | <strong>Hora:</strong> ${horaActa}<br>
        <strong>Código de Acceso:</strong> ${data.asamblea.codigo_acceso}
      </div>

      <div class="section">
        <div class="section-title">ASISTENTES</div>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Entrada</th>
              <th>Salida</th>
              <th>Casa</th>
              <th>Apoderado</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${data.asistentes
              .map(
                (a) => `
              <tr>
                <td>${a.nombre_asistente}</td>
                <td>${new Date(a.fecha_registro).toLocaleTimeString('es-CO', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}</td>
                <td>${
                  a.hora_salida
                    ? new Date(a.hora_salida).toLocaleTimeString('es-CO', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '-'
                }</td>
                <td>${viviendaMap.get(a.vivienda_id) || 'N/A'}</td>
                <td>${
                  a.es_apoderado && a.casa_representada
                    ? `Apoderado (Casa ${viviendaMap.get(a.casa_representada) || a.casa_representada})`
                    : '-'
                }</td>
                <td>${a.es_apoderado ? a.estado_apoderado || 'PENDIENTE' : '-'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <div class="section-title">PROPUESTAS Y VOTACIONES</div>
        ${data.propuestas
          .map(
            (prop, index) => `
          <div class="propuesta">
            <div class="propuesta-titulo">PROPUESTA ${index + 1}: ${prop.titulo}</div>
            <div class="propuesta-desc"><strong>Descripción:</strong> ${prop.descripcion || 'N/A'}</div>
            
            ${(() => {
              const totalAsistentes = data.estadisticas.totalRepresentadas || 0;
              const totalViviendas = data.estadisticas.totalViviendas || 0;
              const votosSi = prop.votos_si || 0;
              const votosNo = prop.votos_no || 0;
              const totalVotos = votosSi + votosNo;
              const noVotaron = Math.max(0, totalAsistentes - totalVotos);
              const noAsistieron = Math.max(0, totalViviendas - totalAsistentes);

              const pctSi = totalAsistentes > 0 ? (votosSi / totalAsistentes) * 100 : 0;
              const pctNo = totalAsistentes > 0 ? (votosNo / totalAsistentes) * 100 : 0;
              const pctNoVotaron = totalAsistentes > 0 ? (noVotaron / totalAsistentes) * 100 : 0;
              const pctNoAsistieron = totalViviendas > 0 ? (noAsistieron / totalViviendas) * 100 : 0;

              return `
                <div class="grafico-container">
                  <div class="barra-container">
                    <div class="barra">
                      <div class="barra-visual barra-si" style="height: ${Math.min(100, Math.max(pctSi, 0))}%;"></div>
                      <div class="barra-label">${votosSi}</div>
                      <div class="barra-valor">${pctSi.toFixed(1)}%</div>
                      <div class="barra-emoji">👍</div>
                      <div class="barra-text">SÍ</div>
                    </div>
                    <div class="barra">
                      <div class="barra-visual barra-no" style="height: ${Math.min(100, Math.max(pctNo, 0))}%;"></div>
                      <div class="barra-label">${votosNo}</div>
                      <div class="barra-valor">${pctNo.toFixed(1)}%</div>
                      <div class="barra-emoji">👎</div>
                      <div class="barra-text">NO</div>
                    </div>
                    <div class="barra">
                      <div class="barra-visual barra-novoto" style="height: ${Math.min(100, Math.max(pctNoVotaron, 0))}%;"></div>
                      <div class="barra-label">${noVotaron}</div>
                      <div class="barra-valor">${pctNoVotaron.toFixed(1)}%</div>
                      <div class="barra-emoji">❓</div>
                      <div class="barra-text">No votaron</div>
                    </div>
                    <div class="barra">
                      <div class="barra-visual barra-noasistio" style="height: ${Math.min(100, Math.max(pctNoAsistieron, 0))}%;"></div>
                      <div class="barra-label">${noAsistieron}</div>
                      <div class="barra-valor">${pctNoAsistieron.toFixed(1)}%</div>
                      <div class="barra-emoji">✖️</div>
                      <div class="barra-text">No asistieron</div>
                    </div>
                  </div>
                </div>
              `;
            })()}

            <div class="estadisticas">
              <div><strong>Total de Votos:</strong> ${prop.total_votos || 0}</div>
              ${
                prop.resultado_aprobada !== null
                  ? `<div class="resultado ${prop.resultado_aprobada ? 'aprobada' : 'rechazada'}">
                    ${prop.resultado_aprobada ? '✓ APROBADA' : '✗ RECHAZADA'}
                  </div>`
                  : ''
              }
            </div>
          </div>
        `
          )
          .join('')}
      </div>

      <div class="section">
        <div class="section-title">ESTADÍSTICAS FINALES</div>
        <div class="estadisticas">
          <div><strong>Total de Viviendas:</strong> ${data.estadisticas.totalViviendas}</div>
          <div><strong>Total de Asistentes:</strong> ${data.estadisticas.totalAsistentes}</div>
          <div><strong>Viviendas Representadas:</strong> ${data.estadisticas.totalRepresentadas}</div>
          <div><strong>Porcentaje Quórum:</strong> ${(
            (data.estadisticas.totalRepresentadas / data.estadisticas.totalViviendas) *
            100
          ).toFixed(2)}%</div>
        </div>
      </div>
    </body>
    </html>
  `;

  // Generar y compartir PDF
  if (Platform.OS === 'web') {
    await generarPDFActaWeb(data, viviendaMap, propietarioMap);
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  await shareAsync(uri, {
    UTI: '.pdf',
    mimeType: 'application/pdf',
  });
};

const generarPDFActaWeb = async (
  data: ActaData,
  viviendaMap: Map<string, string>,
  propietarioMap: Map<string, string>
) => {
  const jsPDF = await cargarJsPdfWeb();
  const doc = new jsPDF();

  let yPosition = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 12;
  const rightMargin = 12;
  const contentWidth = pageWidth - leftMargin - rightMargin;

  // ============= ENCABEZADO =============
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('ACTA DE ASAMBLEA', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Altos del Guali', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Información básica
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const fechaActa = new Date().toLocaleDateString('es-CO');
  const horaActa = new Date().toLocaleTimeString('es-CO');
  doc.text(`Fecha: ${fechaActa}`, leftMargin, yPosition);
  doc.text(`Hora: ${horaActa}`, pageWidth / 2, yPosition);
  yPosition += 6;

  doc.text(`Código de Acceso: ${data.asamblea.codigo_acceso}`, leftMargin, yPosition);
  yPosition += 12;

  // ============= SECCIÓN ASISTENTES =============
  addSectionTitle(doc, 'ASISTENTES', yPosition);
  yPosition += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Nombre', leftMargin, yPosition);
  doc.text('Entrada', leftMargin + 45, yPosition);
  doc.text('Salida', leftMargin + 70, yPosition);
  doc.text('Casa', leftMargin + 95, yPosition);
  doc.text('Apoderado', leftMargin + 115, yPosition);
  doc.text('Estado', leftMargin + 155, yPosition);
  yPosition += 6;

  doc.setDrawColor(200);
  doc.line(leftMargin, yPosition, pageWidth - rightMargin, yPosition);
  yPosition += 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  data.asistentes.forEach(asistente => {
    const numCasa = viviendaMap.get(asistente.vivienda_id) || 'N/A';
    const fechaEntrada = new Date(asistente.fecha_registro).toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const fechaSalida = asistente.hora_salida
      ? new Date(asistente.hora_salida).toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-';

    if (yPosition > pageHeight - 20) {
      doc.addPage();
      yPosition = 15;
    }

    const apoderadoInfo =
      asistente.es_apoderado && asistente.casa_representada
        ? `Apoderado (Casa ${viviendaMap.get(asistente.casa_representada) || asistente.casa_representada})`
        : '-';
    const estadoApoderado = asistente.es_apoderado ? asistente.estado_apoderado || 'PENDIENTE' : '-';

    doc.text(asistente.nombre_asistente, leftMargin, yPosition);
    doc.text(fechaEntrada, leftMargin + 45, yPosition);
    doc.text(fechaSalida, leftMargin + 70, yPosition);
    doc.text(numCasa, leftMargin + 95, yPosition);
    doc.text(apoderadoInfo, leftMargin + 115, yPosition);
    doc.text(estadoApoderado, leftMargin + 155, yPosition);
    yPosition += 5;
  });

  yPosition += 8;

  // ============= SECCIÓN PROPUESTAS =============
  data.propuestas.forEach((propuesta, index) => {
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = 15;
    }

    addSectionTitle(doc, `PROPUESTA ${index + 1}: ${propuesta.titulo}`, yPosition);
    yPosition += 8;

    // Descripción
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Descripción:', leftMargin, yPosition);
    yPosition += 5;

    const descripcionSplit = doc.splitTextToSize(propuesta.descripcion || 'N/A', contentWidth - 5);
    doc.setFontSize(8);
    doc.text(descripcionSplit, leftMargin + 2, yPosition);
    yPosition += descripcionSplit.length * 4 + 5;

    // Gráfico de barras
    yPosition = agregarGraficoBarras(
      doc,
      propuesta,
      data.estadisticas.totalRepresentadas,
      data.estadisticas.totalViviendas,
      leftMargin,
      yPosition,
      contentWidth
    );
    yPosition += 3;

    // Estadísticas de votos
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Estadísticas:', leftMargin, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Votos SI: ${propuesta.votos_si} (${propuesta.porcentaje_si?.toFixed(2) || 0}%)`, leftMargin + 5, yPosition);
    yPosition += 5;
    doc.text(`Votos NO: ${propuesta.votos_no} (${propuesta.porcentaje_no?.toFixed(2) || 0}%)`, leftMargin + 5, yPosition);
    yPosition += 5;
    doc.text(`Total Votos: ${propuesta.total_votos}`, leftMargin + 5, yPosition);
    yPosition += 5;

    if (propuesta.resultado_aprobada !== null) {
      const resultado = propuesta.resultado_aprobada ? '✓ APROBADA' : '✗ RECHAZADA';
      doc.setFont('helvetica', 'bold');
      doc.text(`Estado: ${resultado}`, leftMargin + 5, yPosition);
      yPosition += 5;
    }

    yPosition += 5;
  });

  // ============= ESTADÍSTICAS FINALES =============
  if (yPosition > pageHeight - 30) {
    doc.addPage();
    yPosition = 15;
  }

  addSectionTitle(doc, 'ESTADÍSTICAS FINALES', yPosition);
  yPosition += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Total de Viviendas: ${data.estadisticas.totalViviendas}`, leftMargin, yPosition);
  yPosition += 6;
  doc.text(`Total de Asistentes: ${data.estadisticas.totalAsistentes}`, leftMargin, yPosition);
  yPosition += 6;
  doc.text(`Viviendas Representadas: ${data.estadisticas.totalRepresentadas}`, leftMargin, yPosition);
  yPosition += 6;
  doc.text(
    `Porcentaje Quórum: ${((data.estadisticas.totalRepresentadas / data.estadisticas.totalViviendas) * 100).toFixed(2)}%`,
    leftMargin,
    yPosition
  );

  const fecha = new Date().toISOString().slice(0, 10);
  const nombreArchivo = `Acta-Asamblea-${data.asamblea.codigo_acceso}-${fecha}.pdf`;
  doc.save(nombreArchivo);
};

const cargarJsPdfWeb = async () => {
  const existing = (window as any)?.jspdf?.jsPDF;
  if (existing) return existing;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar jsPDF desde CDN'));
    document.head.appendChild(script);
  });

  const loaded = (window as any)?.jspdf?.jsPDF;
  if (!loaded) throw new Error('jsPDF no disponible en web');
  return loaded;
};

const addSectionTitle = (doc: any, title: string, yPosition: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 12;
  const rightMargin = 12;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(51, 102, 153); // Azul oscuro
  doc.rect(leftMargin, yPosition - 4, pageWidth - leftMargin - rightMargin, 7, 'F');
  doc.setTextColor(255, 255, 255); // Blanco
  doc.text(title, pageWidth / 2, yPosition + 1, { align: 'center' });
  doc.setTextColor(0, 0, 0); // Volver a negro
};

const agregarGraficoBarras = (
  doc: any,
  propuesta: any,
  totalAsistentes: number,
  totalViviendas: number,
  leftMargin: number,
  yPosition: number,
  contentWidth: number
): number => {
  const votosSi = propuesta.votos_si || 0;
  const votosNo = propuesta.votos_no || 0;
  const totalVotos = votosSi + votosNo;
  const noVotaron = Math.max(0, (totalAsistentes || 0) - totalVotos);
  const noAsistieron = Math.max(0, (totalViviendas || 0) - (totalAsistentes || 0));

  const pctSi = totalAsistentes > 0 ? (votosSi / totalAsistentes) * 100 : 0;
  const pctNo = totalAsistentes > 0 ? (votosNo / totalAsistentes) * 100 : 0;
  const pctNoVotaron = totalAsistentes > 0 ? (noVotaron / totalAsistentes) * 100 : 0;
  const pctNoAsistieron = totalViviendas > 0 ? (noAsistieron / totalViviendas) * 100 : 0;

  const graficoAlto = 34;
  const barWidth = 16;
  const gap = 10;
  const baseY = yPosition + graficoAlto;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Resultados de Votación:', leftMargin, yPosition);
  yPosition += 6;

  const startX = leftMargin + 10;
  const bars = [
    { label: 'SÍ', value: votosSi, pct: pctSi, color: [34, 197, 94] },
    { label: 'NO', value: votosNo, pct: pctNo, color: [239, 68, 68] },
    { label: 'No votaron', value: noVotaron, pct: pctNoVotaron, color: [245, 158, 11] },
    { label: 'No asistieron', value: noAsistieron, pct: pctNoAsistieron, color: [156, 163, 175] },
  ];

  bars.forEach((b, i) => {
    const x = startX + i * (barWidth + gap);
    const height = Math.max(3, (Math.min(100, b.pct) / 100) * graficoAlto);

    doc.setFillColor(b.color[0], b.color[1], b.color[2]);
    doc.rect(x, baseY - height, barWidth, height, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(String(b.value), x + barWidth / 2, baseY + 6, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`${b.pct.toFixed(1)}%`, x + barWidth / 2, baseY + 10, { align: 'center' });
    doc.text(b.label, x + barWidth / 2, baseY + 15, { align: 'center' });
  });

  return baseY + 20;
};
