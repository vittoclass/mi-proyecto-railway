// app/api/omr/extract/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { processOMR } from '@/lib/omr/OmniOMRProcessor';

// Función auxiliar para convertir Data URL (Base64) a Buffer
function dataUrlToBuffer(dataUrl: string) {
    // La Data URL tiene el formato: data:[<mime type>][;charset=<charset>][;base64],<data>
    const parts = dataUrl.split(',');
    if (parts.length !== 2) {
        throw new Error('Formato de Data URL inválido');
    }
    const base64Data = parts[1];
    
    // Detectar MIME dinámicamente desde la primera parte de la URL
    const mimeMatch = parts[0].match(/:(.*?);/);
    // Usamos el mimeType detectado, por si no es JPEG
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream'; 

    // Crear el Buffer a partir de la cadena Base64
    const buffer = Buffer.from(base64Data, 'base64');
    
    return { buffer, mimeType };
}

export async function POST(req: NextRequest) {
  try {
    // Leemos todo el cuerpo enviado desde el frontend (que incluye otros parámetros)
    const body = await req.json();
    const { fileUrl } = body; 

    if (!fileUrl) {
      return NextResponse.json({ success: false, error: 'fileUrl requerido' }, { status: 400 });
    }

    const { buffer, mimeType } = dataUrlToBuffer(fileUrl);
    
    // Ejecutar el procesamiento OMR
    // Asumimos que processOMR espera solo el buffer y el mimeType
    const result = await processOMR(buffer, mimeType);
    
    // Si la extracción OMR no devuelve ítems, forzar un error claro.
    if (result.success && (!result.items || result.items.length === 0)) {
        console.error('[OMR API] Fallo silencioso de OMR: Extracción exitosa, pero 0 ítems devueltos. Verifique la plantilla OMR.');
        return NextResponse.json(
            { success: false, error: 'La IA no pudo detectar ninguna respuesta OMR. Verifique la calidad de la imagen, la rotación o que la plantilla sea la correcta.' },
            { status: 200 }
        );
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[OMR API] Error crítico en el servidor:', error);
    return NextResponse.json(
      { success: false, error: 'Fallo en la conexión o procesamiento OMR', details: error instanceof Error ? error.message : 'error' },
      { status: 500 }
    );
  }
}