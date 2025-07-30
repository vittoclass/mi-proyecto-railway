// app/api/extract-text/route.ts
import { type NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import pdf from "pdf-parse";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ success: false, error: "No se encontró ningún archivo." }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        let text = "";

        if (file.type === "application/pdf") {
            const data = await pdf(buffer);
            text = data.text;
        } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") { // .docx
            const result = await mammoth.extractRawText({ buffer });
            text = result.value;
        } else if (file.type === "text/plain") { // .txt
            text = buffer.toString("utf-8");
        } else {
            return NextResponse.json({ success: false, error: "Formato de archivo no soportado. Por favor, sube un PDF, DOCX o TXT." }, { status: 400 });
        }

        return NextResponse.json({ success: true, text });

    } catch (error) {
        console.error("Error al extraer texto del archivo:", error);
        return NextResponse.json({ success: false, error: "No se pudo procesar el archivo." }, { status: 500 });
    }
}