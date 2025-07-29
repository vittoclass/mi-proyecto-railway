// app/api/evaluate/status/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
        return NextResponse.json({ error: 'Falta el ID de la tarea (jobId).' }, { status: 400 });
    }

    try {
        const data = await redis.get(jobId);

        if (!data) {
            return NextResponse.json({ error: 'Tarea no encontrada o expirada.' }, { status: 404 });
        }

        return NextResponse.json(JSON.parse(data));

    } catch (error) {
        return NextResponse.json({ error: 'Error al consultar el estado de la tarea.' }, { status: 500 });
    }
}