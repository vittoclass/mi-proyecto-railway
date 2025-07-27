'use client'

import { useState } from "react";
import { useForm } from "react-hook-form";
// ... (imports)

const formSchema = z.object({ /* ... */ });

export default function EvaluatorClient() {
  const [fileToEvaluate, setFileToEvaluate] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const form = useForm<z.infer<typeof formSchema>>({ /* ... */ });
  
  const getSupabaseClient = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!fileToEvaluate) { alert("Sube un archivo."); return; }
    setIsProcessing(true);
    setEvaluationResult(null);
    const supabase = getSupabaseClient();
    let evaluationId = '';

    try {
      // 1. Subir el archivo primero para obtener la URL
      const filePath = `evaluaciones/${Date.now()}_${fileToEvaluate.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from("imagenes").upload(filePath, fileToEvaluate);
      if (uploadError) throw new Error(`Error en Supabase Storage: ${uploadError.message}`);
      const { data: urlData } = supabase.storage.from("imagenes").getPublicUrl(filePath);

      // 2. Insertar los datos en la tabla con estado 'pendiente'
      const { data: insertData, error: insertError } = await supabase
        .from('evaluaciones')
        .insert([{ ...values, imagen: urlData.publicUrl, status: 'pending' }])
        .select('id')
        .single();
      if (insertError) throw new Error(`Error en Base de Datos: ${insertError.message}`);
      evaluationId = insertData.id;

      // 3. Llamar a la nueva API solo con el ID
      const response = await fetch('/api/process-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluationId })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      
      setEvaluationResult(result.result);
    } catch (error) {
      alert(`Error: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main>
        {/* Tu JSX para el formulario, que llama a onSubmit */}
    </main>
  );
}