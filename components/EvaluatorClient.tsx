const onEvaluate = async (values: z.infer<typeof formSchema>) => {
  if (filesToEvaluate.length === 0) {
    alert("Por favor, sube al menos un archivo.");
    return;
  }
  setIsProcessing(true);
  setEvaluationDone(false);
  const supabase = getSupabaseClient();

  try {
    const uploadPromises = filesToEvaluate.map(fp => {
      const filePath = `evaluaciones/${Date.now()}_${fp.file.name}`;
      return supabase.storage.from("imagenes").upload(filePath, fp.file);
    });
    const uploadResults = await Promise.all(uploadPromises);
    
    const uploadError = uploadResults.find(res => res.error);
    if (uploadError) throw new Error(`Error al subir a Supabase: ${uploadError.error.message}`);

    const imageUrls = uploadResults.map(res => {
      return supabase.storage.from("imagenes").getPublicUrl(res.data!.path).data.publicUrl;
    });

    // Creamos el paquete de datos que enviaremos
    const payload = {
      imageUrls: imageUrls,
      rubrica: values.rubrica,
    };

    // --- AÑADE ESTE CONSOLE.LOG AQUÍ ---
    console.log("Enviando el siguiente payload a la API:", JSON.stringify(payload, null, 2));
    alert("Revisa la consola del navegador (F12) para ver los datos que se están enviando.");
    // ------------------------------------

    const response = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    form.setValue("retroalimentacion", result.retroalimentacion);
    form.setValue("puntaje", result.puntaje);
    form.setValue("nota", result.nota ? result.nota.toFixed(1) : "N/A");
    setEvaluationDone(true);

  } catch (error) {
    alert(`Error durante la evaluación: ${error instanceof Error ? error.message : "Error desconocido"}`);
  } finally {
    setIsProcessing(false);
  }
};