import { type NextRequest, NextResponse } from "next/server";
import { getJobStore } from '../jobStore';

const promptsExpertos = {
  general: `Eres un asistente de evaluación educativa...`,
  matematicas: `Actúa como un profesor experto en Matemáticas...`,
  lenguaje: `Actúa como un crítico literario y profesor de Lenguaje e Historia...`,
  ciencias: `Actúa como un riguroso científico y académico...`,
  artes: `Actúa como un curador de arte y un académico en estética...`,
  humanidades: `Actúa como un filósofo y académico de las humanidades...`,
  ingles: `Actúa como un examinador de idiomas (inglés)...`,
};

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');
    const jobStore = getJobStore();

    if (!jobId) {
        return NextResponse.json({ success: false, error: "jobId no proporcionado" }, { status: 400 });
    }
    const job = jobStore.get(jobId);
    if (!job) {
        return NextResponse.json({ success: false, error: "Trabajo no encontrado" }, { status: 404 });
    }
    
    if (job.status === 'pending') {
        job.status = 'processing';
    } else if (job.status === 'processing') {
        job.status = 'completed';
        
        // Simula un resultado detallado basado en el área de conocimiento guardada
        const area = job.payload?.areaConocimiento || 'general';
        const retroalimentacionExperta = `Este es un ejemplo de retroalimentación profunda para el área de '${area}', que cita evidencia específica del texto y sigue la rúbrica proporcionada.`;
        
        job.result = {
            puntaje: "95/100",
            nota: 6.8,
            retroalimentacion: {
                correccion_detallada: [{ seccion: "Análisis Conceptual", detalle: retroalimentacionExperta }],
                evaluacion_habilidades: [{ habilidad: "Profundidad Analítica", evaluacion: "Muy Logrado", evidencia: `Se demuestra un dominio del tema (${area}) al conectar A con B.` }],
                resumen_general: { fortalezas: `Dominio conceptual del área de ${area}.`, areas_mejora: "Se puede mejorar la estructura de las conclusiones." }
            }
        };
    }

    return NextResponse.json(job);
}