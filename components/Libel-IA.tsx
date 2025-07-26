'use client'

import { useState, useCallback } from "react"
import { useForm } from "react-hook-form"
// ... (todos tus otros imports)
import dynamic from 'next/dynamic'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
// ... etc.

const SmartCameraModal = dynamic(
  () => import('@/components/smart-camera-modal').then(mod => mod.SmartCameraModal),
  { ssr: false, loading: () => <p>Cargando cámara...</p> }
);

// ... (El resto de tu lógica: formSchema, interfaces, etc. se mantiene igual)

export default function LibelIA() {
  // ... (Toda tu lógica de estados y funciones se mantiene igual)

  return (
    <>
      <SmartCameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleFiles} />
      <main className="p-4 md:p-8 max-w-5xl mx-auto font-sans">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">LibelIA Evaluator</h1>
          <p className="text-gray-600">Flujo de trabajo para evaluación multimodal.</p>
        </div>

        {/* PASO 1: SUBIR ARCHIVOS */}
        {workflowStep === "upload" && (
            <Card>
                <CardHeader><CardTitle>Paso 1: Sube los archivos</CardTitle></CardHeader>
                <CardContent className="flex flex-col md:flex-row gap-4">
                    <label htmlFor="file-upload" className="flex-1 cursor-pointer">
                        <div className="border-2 border-dashed rounded-lg p-6 text-center h-full flex flex-col justify-center items-center hover:border-blue-500 transition-colors">
                            <FileUp className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                            <span className="text-blue-600 font-semibold">Sube uno o más archivos</span>
                            <p className="text-xs text-gray-500">O arrástralos aquí</p>
                        </div>
                    </label>
                    <input id="file-upload" type="file" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))} />
                    <Button type="button" variant="outline" className="flex-1 h-auto md:h-full text-lg" onClick={() => setIsCameraOpen(true)}>
                        <CameraIcon className="mr-2 h-6 w-6" /> Usar Cámara Inteligente
                    </Button>
                </CardContent>
            </Card>
        )}

        {/* PASO 2: AGRUPAR ARCHIVOS */}
        {workflowStep === "grouping" && (
            <Card>
                <CardHeader><CardTitle>Paso 2: Organiza los archivos</CardTitle></CardHeader>
                <CardContent>
                    <div className="mb-6">
                        <h3 className="font-semibold mb-2">Archivos subidos ({filePreviews.length}):</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {filePreviews.map(fp => (
                                <div key={fp.id} className="relative group">
                                    {fp.previewUrl ? <img src={fp.previewUrl} alt={fp.file.name} className="aspect-square w-full rounded-md object-cover"/> : <div className="aspect-square w-full rounded-md bg-gray-100 flex items-center justify-center"><FileIcon/></div>}
                                    <p className="text-xs truncate mt-1">{fp.file.name}</p>
                                    <Button size="sm" variant="destructive" className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={() => removeFilePreview(fp.id)}><X className="h-4 w-4"/></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="text-center border-t pt-6">
                        <h3 className="font-semibold mb-4">¿Estos archivos a quién pertenecen?</h3>
                        <div className="flex flex-col md:flex-row gap-4 justify-center">
                            <Button size="lg" onClick={() => handleGroupingModeSelect('multiple')} disabled={isProcessing}>
                                <User className="mr-2"/> A un solo estudiante
                            </Button>
                            <Button size="lg" onClick={() => handleGroupingModeSelect('single')} disabled={isProcessing}>
                                <Users className="mr-2"/> A varios estudiantes (uno por archivo)
                            </Button>
                        </div>
                        {isProcessing && <p className="mt-4 text-blue-600 animate-pulse">Organizando y extrayendo nombres...</p>}
                    </div>
                </CardContent>
            </Card>
        )}

        {/* PASO 3: EVALUAR */}
        {workflowStep === "evaluate" && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEvaluateAll)} className="space-y-6">
              {/* Aquí va el JSX completo para el paso de evaluación, con la configuración y la lista de grupos */}
            </form>
          </Form>
        )}
      </main>
    </>
  )
}