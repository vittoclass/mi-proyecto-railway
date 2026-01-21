import { type NextRequest, NextResponse } from "next/server";
import { getJobStore } from '../jobStore';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const jobStore = getJobStore();
    const jobId = `job_${Date.now()}`;

    // Guarda el payload completo (incluyendo la materia) junto con el estado inicial.
    jobStore.set(jobId, { status: 'pending', payload: payload });

    console.log(`EVALUACIÓN INICIADA. Job ID: ${jobId}`);
    
    return NextResponse.json({ success: true, jobId });

  } catch (error) {
    console.error("Error en /api/evaluate/start:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}