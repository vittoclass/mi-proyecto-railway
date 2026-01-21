import { type NextRequest, NextResponse } from "next/server";

// ==================================================================
// INICIO DE LA CORRECCIÓN
// Esta línea le dice a Next.js que esta ruta SIEMPRE debe ejecutarse en el servidor
// y nunca debe ser "congelada" o pre-renderizada estáticamente.
export const dynamic = 'force-dynamic';
// ==================================================================
// FIN DE LA CORRECCIÓN

// Esta es una función GET de ejemplo. Pega tu lógica real si es diferente.
export async function GET(request: NextRequest) {
  try {
    // Tu lógica original que usa request.url probablemente esté aquí
    const url = request.url;
    console.log("URL de la petición de prueba de email:", url);

    // ...aquí iría el resto de tu lógica para enviar un email de prueba...

    return NextResponse.json({ success: true, message: "Email de prueba ejecutado." });

  } catch (error) {
    console.error('Error en la ruta de prueba de email:', error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
