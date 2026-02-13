import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

/* =========================
   INTERFACE
========================= */

export interface AsistenciaData {
  nombreAsistente: string;
  nombrePropietario: string;
  apellidoPropietario: string;
  numeroCasa: string;
  casaRepresentada?: string;
  esApoderado: boolean;
  fecha: string;
}

/* =========================
   CARGAR FIRMA PNG → BASE64
========================= */

const loadFirmaPngAsBase64 = async (): Promise<string> => {
  const asset = Asset.fromModule(
    require('../../assets/images/firma_electronica.png')
  );

  await asset.downloadAsync();

  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('No se pudo leer la firma')); 
      reader.readAsDataURL(blob);
    });
    return base64;
  }

  const base64 = await FileSystem.readAsStringAsync(asset.localUri!, {
    encoding: 'base64',
  });

  return `data:image/png;base64,${base64}`;
};

/* =========================
   GENERAR PDF
========================= */

export const descargarComprobanteAsistencia = async (
  data: AsistenciaData
) => {
  try {
    const fechaFormato = new Date(data.fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const firmaBase64 = await loadFirmaPngAsBase64();

    const firmaHTML = `
      <div style="text-align:center; margin:30px 0;">
        <img
          src="${firmaBase64}"
          alt="Firma Electrónica"
          style="max-width:350px; height:auto;"
        />
      </div>
    `;

    const htmlContent = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 40px;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 12px;
              max-width: 700px;
              margin: auto;
            }
            .header {
              text-align: center;
              border-bottom: 3px solid #10b981;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              margin: 0;
              color: #065f46;
            }
            .label {
              font-size: 12px;
              color: #6b7280;
              text-transform: uppercase;
              margin-bottom: 4px;
              font-weight: 600;
            }
            .value {
              font-size: 18px;
              font-weight: 600;
              color: #111827;
            }
            .row {
              margin-bottom: 20px;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 10px;
            }
            .message {
              background: #f0fdf4;
              border-left: 4px solid #10b981;
              padding: 20px;
              margin: 30px 0;
              color: #065f46;
              font-size: 14px;
              line-height: 1.6;
            }
            .signature {
              text-align: center;
              margin-top: 40px;
              border-top: 2px solid #10b981;
              padding-top: 20px;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              font-size: 12px;
              color: #9ca3af;
            }
          </style>
        </head>

        <body>
          <div class="container">
            <div class="header">
              <h1>✓ Comprobante de Asistencia</h1>
              <p>Asamblea de Residentes</p>
            </div>

            <div class="row">
              <div class="label">Propietario</div>
              <div class="value">
                ${data.nombrePropietario} ${data.apellidoPropietario}
              </div>
            </div>

            <div class="row">
              <div class="label">Asistente</div>
              <div class="value">${data.nombreAsistente}</div>
            </div>

            <div class="row">
              <div class="label">Casa</div>
              <div class="value">${data.numeroCasa}</div>
            </div>

            ${
              data.esApoderado && data.casaRepresentada
                ? `
              <div class="row">
                <div class="label">Casa Representada</div>
                <div class="value">${data.casaRepresentada}</div>
              </div>
            `
                : ''
            }

            <div class="row">
              <div class="label">Fecha</div>
              <div class="value">${fechaFormato}</div>
            </div>

            <div class="message">
              ${
                data.esApoderado && data.casaRepresentada
                  ? `
                Confirmamos que <strong>${data.nombreAsistente}</strong> asistió en nombre de la casa <strong>${data.numeroCasa}</strong> y adicional como apoderado de la casa <strong>${data.casaRepresentada}</strong> a la asamblea de residentes el ${fechaFormato}. Este comprobante certifica su participación en el proceso.
              `
                  : `
                Confirmamos que <strong>${data.nombreAsistente}</strong> asistió en nombre de la casa <strong>${data.numeroCasa}</strong> a la asamblea de residentes el ${fechaFormato}. Este comprobante certifica su participación en el proceso.
              `
              }
            </div>

            <div class="signature">
              <div style="font-size:12px; color:#6b7280;">
                Firma Electrónica
              </div>
              ${firmaHTML}
            </div>

            <div class="footer">
              Documento generado automáticamente por el sistema de asamblea.
            </div>
          </div>
        </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      await descargarComprobanteAsistenciaWeb(data, fechaFormato, firmaBase64);
      return true;
    }

    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
    });

    if (!uri) {
      throw new Error('No se pudo generar el PDF');
    }

    await shareAsync(uri, {
      mimeType: 'application/pdf',
      filename: `Comprobante_Asistencia_${data.numeroCasa}_${Date.now()}.pdf`,
    });

    return true;
  } catch (error) {
    console.error('Error generando comprobante:', error);
    throw error;
  }
};

const descargarComprobanteAsistenciaWeb = async (
  data: AsistenciaData,
  fechaFormato: string,
  firmaBase64: string
) => {
  const jsPDF = await cargarJsPdfWeb();
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 16;
  const right = 16;
  const usableWidth = pageWidth - left - right;
  let y = 18;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 95, 70);
  doc.setFontSize(20);
  doc.text('✓ Comprobante de Asistencia', pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setTextColor(45, 55, 72);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Asamblea de Residentes', pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.6);
  doc.line(left, y, pageWidth - right, y);
  y += 10;

  const drawField = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(label.toUpperCase(), left, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    const splitValue = doc.splitTextToSize(value, usableWidth);
    doc.text(splitValue, left, y);
    y += splitValue.length * 5 + 2;

    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(left, y, pageWidth - right, y);
    y += 8;
  };

  drawField('Propietario', `${data.nombrePropietario} ${data.apellidoPropietario}`);
  drawField('Asistente', data.nombreAsistente);
  drawField('Casa', data.numeroCasa);

  if (data.esApoderado && data.casaRepresentada) {
    drawField('Casa representada', data.casaRepresentada);
  }

  drawField('Fecha', fechaFormato);

  const mensaje = data.esApoderado && data.casaRepresentada
    ? `Confirmamos que ${data.nombreAsistente} asistió en nombre de la casa ${data.numeroCasa} y adicional como apoderado de la casa ${data.casaRepresentada} a la asamblea de residentes el ${fechaFormato}. Este comprobante certifica su participación en el proceso.`
    : `Confirmamos que ${data.nombreAsistente} asistió en nombre de la casa ${data.numeroCasa} a la asamblea de residentes el ${fechaFormato}. Este comprobante certifica su participación en el proceso.`;

  const messageBoxTop = y;
  const messageBoxHeight = 28;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(16, 185, 129);
  doc.rect(left, messageBoxTop, usableWidth, messageBoxHeight, 'FD');
  doc.line(left + 1, messageBoxTop, left + 1, messageBoxTop + messageBoxHeight);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(6, 95, 70);
  doc.setFontSize(9);
  const splitMensaje = doc.splitTextToSize(mensaje, usableWidth - 8);
  doc.text(splitMensaje, left + 4, messageBoxTop + 6);
  y = messageBoxTop + messageBoxHeight + 12;

  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.4);
  doc.line(left, y, pageWidth - right, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.text('Firma Electrónica', pageWidth / 2, y, { align: 'center' });
  y += 6;

  try {
    doc.addImage(firmaBase64, 'PNG', pageWidth / 2 - 32, y, 64, 30);
    y += 34;
  } catch {
    y += 10;
  }

  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text('Documento generado automáticamente por el sistema de asamblea.', pageWidth / 2, y + 4, {
    align: 'center',
  });

  const filename = `Comprobante_Asistencia_${data.numeroCasa}_${Date.now()}.pdf`;
  doc.save(filename);
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
