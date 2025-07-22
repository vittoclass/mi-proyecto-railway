"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Upload, FileText, Brain, Download, Copy, Trash2, BarChart3, GraduationCap, Clock } from "lucide-react"

interface EvaluationConfig {
  sistema: string
  nivelExigencia: number
  puntajeMaximo: number
  notaAprobacion: number
  flexibility: number
  fecha: string
}

interface StudentEvaluation {
  id: string
  nombreEstudiante: string
  nombrePrueba: string
  curso: string
  notaFinal: number
  puntajeObtenido: number
  configuracion: EvaluationConfig
  feedback_estudiante: any
  analisis_profesor: any
  analisis_habilidades: any
  analisis_detallado: any[]
  bonificacion: number
  justificacionDecimas: string
}

export default function GeniusEvaluator() {
  const [activeTab, setActiveTab] = useState("evaluate")
  const [isLoading, setIsLoading] = useState(false)
  const [evaluations, setEvaluations] = useState<StudentEvaluation[]>([])
  const [currentEvaluation, setCurrentEvaluation] = useState({
    nombrePrueba: "",
    curso: "",
    rubrica: "",
    preguntasObjetivas: "",
    files: [] as File[],
  })
  const [config, setConfig] = useState<EvaluationConfig>({
    sistema: "chile_2_7",
    nivelExigencia: 60,
    puntajeMaximo: 30,
    notaAprobacion: 4.0,
    flexibility: 5,
    fecha: new Date().toISOString().split("T")[0],
  })

  useEffect(() => {
    // Load saved data from localStorage
    const savedEvaluations = localStorage.getItem("evaluations")
    if (savedEvaluations) {
      setEvaluations(JSON.parse(savedEvaluations))
    }
  }, [])

  const saveEvaluations = (newEvaluations: StudentEvaluation[]) => {
    setEvaluations(newEvaluations)
    localStorage.setItem("evaluations", JSON.stringify(newEvaluations))
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setCurrentEvaluation((prev) => ({
      ...prev,
      files: [...prev.files, ...files],
    }))
  }

  const evaluateDocuments = async () => {
    if (!currentEvaluation.files.length) {
      alert("Por favor, sube al menos un documento.")
      return
    }

    if (!currentEvaluation.rubrica.trim()) {
      alert("Por favor, proporciona una rúbrica de evaluación.")
      return
    }

    setIsLoading(true)
    try {
      const formData = new FormData()
      currentEvaluation.files.forEach((file) => {
        formData.append("files", file)
      })
      formData.append(
        "config",
        JSON.stringify({
          ...config,
          nombrePrueba: currentEvaluation.nombrePrueba,
          curso: currentEvaluation.curso,
          rubrica: currentEvaluation.rubrica,
          preguntasObjetivas: currentEvaluation.preguntasObjetivas,
        }),
      )

      const response = await fetch("/api/evaluate", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()
      if (result.success) {
        const newEvaluations = [...evaluations, ...result.evaluations]
        saveEvaluations(newEvaluations)
        setActiveTab("results")
        alert(`✅ Evaluación completada. ${result.evaluations.length} estudiantes evaluados.`)
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      alert(`❌ Error durante la evaluación: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const exportToCSV = () => {
    if (evaluations.length === 0) {
      alert("No hay datos para exportar.")
      return
    }

    const headers = ["Estudiante", "Curso", "Evaluación", "Nota Final", "Puntaje", "Fecha"]
    const rows = evaluations.map((evaluation) => [
      evaluation.nombreEstudiante,
      evaluation.curso,
      evaluation.nombrePrueba,
      evaluation.notaFinal.toFixed(1),
      `${evaluation.puntajeObtenido}/${evaluation.configuracion.puntajeMaximo}`,
      evaluation.configuracion.fecha,
    ])

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `evaluaciones_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = async () => {
    const headers = ["Estudiante", "Curso", "Evaluación", "Nota Final"]
    const rows = evaluations.map((evaluation) => [
      evaluation.nombreEstudiante,
      evaluation.curso,
      evaluation.nombrePrueba,
      evaluation.notaFinal.toFixed(1),
    ])

    const tsvContent = [headers, ...rows].map((row) => row.join("\t")).join("\n")

    try {
      await navigator.clipboard.writeText(tsvContent)
      alert("✅ Datos copiados al portapapeles")
    } catch (error) {
      alert("❌ Error al copiar los datos")
    }
  }

  const clearHistory = () => {
    if (confirm("¿Borrar PERMANENTEMENTE todo el historial?")) {
      setEvaluations([])
      localStorage.removeItem("evaluations")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">✨ Genius Evaluator X</h1>
          <p className="text-gray-600">Sistema de Evaluación Inteligente con IA</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="evaluate" className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Evaluar
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Resultados
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Historial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="evaluate" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información de la Evaluación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre-prueba">Nombre de la Evaluación</Label>
                    <Input
                      id="nombre-prueba"
                      value={currentEvaluation.nombrePrueba}
                      onChange={(e) => setCurrentEvaluation((prev) => ({ ...prev, nombrePrueba: e.target.value }))}
                      placeholder="Ej: Ensayo Final - La Célula"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="curso">Curso</Label>
                    <Input
                      id="curso"
                      value={currentEvaluation.curso}
                      onChange={(e) => setCurrentEvaluation((prev) => ({ ...prev, curso: e.target.value }))}
                      placeholder="Ej: 3ro Medio A"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configuración de Evaluación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Sistema de Calificación</Label>
                    <Select
                      value={config.sistema}
                      onValueChange={(value) => setConfig((prev) => ({ ...prev, sistema: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="chile_2_7">Chile (2.0 - 7.0)</SelectItem>
                        <SelectItem value="latam_1_10">Estándar (1 - 10)</SelectItem>
                        <SelectItem value="porcentual_0_100">Porcentual (0 - 100)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nivel-exigencia">Nivel de Exigencia (%)</Label>
                    <Input
                      id="nivel-exigencia"
                      type="number"
                      min="1"
                      max="100"
                      value={config.nivelExigencia}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, nivelExigencia: Number.parseInt(e.target.value) }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="puntaje-maximo">Puntaje Máximo</Label>
                    <Input
                      id="puntaje-maximo"
                      type="number"
                      min="1"
                      value={config.puntajeMaximo}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, puntajeMaximo: Number.parseInt(e.target.value) }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nota-aprobacion">Nota de Aprobación</Label>
                    <Input
                      id="nota-aprobacion"
                      type="number"
                      step="0.1"
                      max="7.0"
                      value={config.notaAprobacion}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, notaAprobacion: Number.parseFloat(e.target.value) }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Nivel de Flexibilidad de la IA: {config.flexibility}/10</Label>
                  <Slider
                    value={[config.flexibility]}
                    onValueChange={(value) => setConfig((prev) => ({ ...prev, flexibility: value[0] }))}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Rígido / Literal</span>
                    <span>Equilibrado</span>
                    <span>Flexible / Holístico</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cargar Documentos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-4">Arrastra archivos aquí o haz clic para seleccionar</p>
                  <Input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <Button variant="outline" asChild>
                      <span>Seleccionar Archivos</span>
                    </Button>
                  </Label>
                </div>

                {currentEvaluation.files.length > 0 && (
                  <div className="space-y-2">
                    <Label>Archivos seleccionados:</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {currentEvaluation.files.map((file, index) => (
                        <div key={index} className="p-2 border rounded-lg text-sm">
                          <FileText className="w-4 h-4 inline mr-1" />
                          {file.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rúbrica de Evaluación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rubrica">Rúbrica de Desarrollo</Label>
                  <Textarea
                    id="rubrica"
                    value={currentEvaluation.rubrica}
                    onChange={(e) => setCurrentEvaluation((prev) => ({ ...prev, rubrica: e.target.value }))}
                    placeholder="Ej: Criterio 1: Identifica 3 causas (6 Puntos). Criterio 2: Argumentación clara (4 Puntos)..."
                    rows={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preguntas-objetivas">Preguntas Objetivas (Opcional)</Label>
                  <Textarea
                    id="preguntas-objetivas"
                    value={currentEvaluation.preguntasObjetivas}
                    onChange={(e) => setCurrentEvaluation((prev) => ({ ...prev, preguntasObjetivas: e.target.value }))}
                    placeholder="Ej: Pregunta 1 (V/F): La respuesta correcta es Verdadero. (2 Puntos)"
                    rows={4}
                  />
                </div>

                <Button
                  onClick={evaluateDocuments}
                  disabled={isLoading || !currentEvaluation.files.length || !currentEvaluation.rubrica.trim()}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Evaluando...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4 mr-2" />
                      Iniciar Evaluación
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Resultados de Evaluación</CardTitle>
              </CardHeader>
              <CardContent>
                {evaluations.length === 0 ? (
                  <div className="text-center py-8">
                    <GraduationCap className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No hay evaluaciones disponibles</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {evaluations.slice(-5).map((evaluation) => (
                      <Card key={evaluation.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="font-semibold text-lg">{evaluation.nombreEstudiante}</h3>
                              <p className="text-gray-600">
                                {evaluation.nombrePrueba} - {evaluation.curso}
                              </p>
                            </div>
                            <Badge variant="secondary" className="text-lg px-3 py-1">
                              {evaluation.notaFinal.toFixed(1)}
                            </Badge>
                          </div>

                          {evaluation.feedback_estudiante && (
                            <div className="space-y-3">
                              <div>
                                <h4 className="font-medium text-green-700">🌟 Fortalezas</h4>
                                <ul className="list-disc list-inside text-sm text-gray-600 ml-4">
                                  {evaluation.feedback_estudiante.fortalezas?.map((fortaleza: any, index: number) => (
                                    <li key={index}>{fortaleza.descripcion}</li>
                                  ))}
                                </ul>
                              </div>

                              <div>
                                <h4 className="font-medium text-orange-700">🚀 Oportunidades de Mejora</h4>
                                <ul className="list-disc list-inside text-sm text-gray-600 ml-4">
                                  {evaluation.feedback_estudiante.oportunidades?.map(
                                    (oportunidad: any, index: number) => (
                                      <li key={index}>{oportunidad.descripcion}</li>
                                    ),
                                  )}
                                </ul>
                              </div>

                              {evaluation.feedback_estudiante.siguiente_paso_sugerido && (
                                <div>
                                  <h4 className="font-medium text-blue-700">🎯 Siguiente Paso</h4>
                                  <p className="text-sm text-gray-600">
                                    {evaluation.feedback_estudiante.siguiente_paso_sugerido}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>Historial de Evaluaciones</span>
                  <div className="flex gap-2">
                    <Button onClick={copyToClipboard} variant="outline" size="sm">
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar
                    </Button>
                    <Button onClick={exportToCSV} variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      CSV
                    </Button>
                    <Button onClick={clearHistory} variant="destructive" size="sm">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Limpiar
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evaluations.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No hay historial disponible</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Estudiante</th>
                          <th className="text-left p-2">Curso</th>
                          <th className="text-left p-2">Evaluación</th>
                          <th className="text-left p-2">Nota</th>
                          <th className="text-left p-2">Puntaje</th>
                          <th className="text-left p-2">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evaluations.map((evaluation) => (
                          <tr key={evaluation.id} className="border-b hover:bg-gray-50">
                            <td className="p-2">{evaluation.nombreEstudiante}</td>
                            <td className="p-2">{evaluation.curso}</td>
                            <td className="p-2">{evaluation.nombrePrueba}</td>
                            <td className="p-2">
                              <Badge variant="secondary">{evaluation.notaFinal.toFixed(1)}</Badge>
                            </td>
                            <td className="p-2">
                              {evaluation.puntajeObtenido}/{evaluation.configuracion.puntajeMaximo}
                            </td>
                            <td className="p-2">{evaluation.configuracion.fecha}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
