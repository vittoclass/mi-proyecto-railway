'use client'

import { useState } from "react";
import { useForm } from "react-hook-form";
// ... (todos los demás imports que ya tenías)
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const formSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido."),
  curso: z.string().min(1, "El curso es requerido."),
  rubrica: z.string().min(10, "La rúbrica es necesaria."),
});

export default function EvaluatorClient() {
  const [fileToEvaluate, setFileToEvaluate] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{ retro: string; nota: string, puntaje: string } | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { nombre: "", curso: "", rubrica: "" },
  });
  
  const getSupabaseClient = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileToEvaluate(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setEvaluationResult(null);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!fileToEvaluate) {
      alert("Por favor, sube un archivo.");
      return;
    }
    setIsProcessing(true);
    setEvaluationResult(null);
    const supabase = getSupabaseClient();
    try {
      const filePath = `evaluaciones/${Date.now()}_${fileToEvaluate.name}`;
      const { error: uploadError } = await supabase.storage.from("imagenes").upload(filePath, fileToEvaluate);
      if (uploadError) throw new Error(`Error en Supabase: ${uploadError.message}`);
      
      const { data: urlData } = supabase.storage.from("imagenes").getPublicUrl(filePath);
      
      const payload = {
        fileUrl: urlData.publicUrl,
        rubrica: values.rubrica
      };

      // Mantenemos el console.log, que es seguro.
      console.log("Enviando el siguiente payload a la API:", JSON.stringify(payload, null, 2));
      
      // LA LÍNEA DE "alert(...)" HA SIDO ELIMINADA.

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      
      setEvaluationResult({ retro: result.retroalimentacion, nota: result.nota.toFixed(1), puntaje: result.puntaje });
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Desconocido"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="p-4 md:p-8 max-w-2xl mx-auto font-sans">
      {/* Tu JSX completo aquí */}
    </main>
  );
}