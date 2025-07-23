"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Upload,
  FileText,
  Brain,
  Download,
  Copy,
  Trash2,
  BarChart3,
  GraduationCap,
  Clock,
  X,
  Plus,
  Eye,
  Loader2,
  FileIcon,
  Users,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react"

interface EvaluationConfig {
  sistema: string
  nivelExigencia: number
  puntajeMaximo: number
  notaAprobacion: number
  flexibility: number
  fecha: string
}

interface FilePreview {
  id: string
  file: File
  preview?: string
  type: "image" | "pdf" | "other"
}

interface StudentGroup {
  id: string
  studentName: string
  files: FilePreview[]
  isExtractingName?: boolean
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
  filesPreviews?: FilePreview[]
}

interface EvaluationProgress {
  total: number
  completed: number
  current: string
  successes: number
  failures: number
}

type GroupingMode = "single" | "multiple" | null

export default function GeniusEvaluator() {
  const [activeTab, setActiveTab] = useState("evaluate")
  const [isLoading, setIsLoading] = useState(false)
  const [evaluations, setEvaluations] = useState<StudentEvaluation[]>([])
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([])
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([])
  const [groupingMode, setGroupingMode] = useState<GroupingMode>(null)
  const [draggedFile, setDraggedFile] = useState<string | null>(null)
  const [selectedEvaluation, setSelectedEvaluation] = useState<StudentEvaluation | null>(null)
  const [evaluationProgress, setEvaluationProgress] = useState<EvaluationProgress | null>(null)

  const [currentEvaluation, setCurrentEvaluation] = useState({
    nombrePrueba: "",
    curso: "",
    rubrica: "",
    preguntasObjetivas: "",
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
    const savedEvaluations = localStorage.getItem("evaluations")
    if (savedEvaluations) {
      setEvaluations(JSON.parse(savedEvaluations))
    }
  }, [])

  const saveEvaluations = useCallback((newEvaluations: StudentEvaluation[]) => {
    setEvaluations(newEvaluations)
    localStorage.setItem("evaluations", JSON.stringify(newEvaluations))
  }, [])

  const createFilePreview = async (file: File): Promise<FilePreview> => {
    const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    let preview = undefined
    let type: "image" | "pdf" | "other" = "other"

    if (file.type.startsWith("image/")) {
      type = "image"
      preview = URL.createObjectURL(file)
    } else if (file.type === "application/pdf") {
      type = "pdf"
    }

    return { id, file, preview, type }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    const newPreviews: FilePreview[] = []
    for (const file of files) {
      const filePreview = await createFilePreview(file)
      newPreviews.push(filePreview)
    }

    setFilePreviews((prev) => [...prev, ...newPreviews])
    setGroupingMode(null) // Reset grouping mode when new files are added
  }

  const removeFilePreview = (fileId: string) => {
    setFilePreviews((prev) => prev.filter((f) => f.id !== fileId))
    // Also remove from groups if it exists
    setStudentGroups((prev) =>
      prev
        .map((group) => ({
          ...group,
          files: group.files.filter((f) => f.id !== fileId),
        }))
        .filter((group) => group.files.length > 0),
    )
  }

  const handleGroupingModeSelect = async (mode: GroupingMode) => {
    setGroupingMode(mode)

    if (mode === "single") {
      // Create single group with all files
      const singleGroupId = `group_${Date.now()}_single`
      const singleGroup: StudentGroup = {
        id: singleGroupId,
        studentName: "",
        files: [...filePreviews],
        isExtractingName: true,
      }

      setStudentGroups([singleGroup])

      // Extract name from all files at once for better accuracy
      try {
        const formData = new FormData()
        filePreviews.forEach((filePreview) => {
          formData.append("files", filePreview.file)
        })

        const response = await fetch("/api/extract-name", {
          method: "POST",
          body: formData,
        })

        const result = await response.json()
        const extractedName = result.success ? result.name : ""

        setStudentGroups([
          {
            ...singleGroup,
            studentName: extractedName,
            isExtractingName: false,
          },
        ])
      } catch (error) {
        console.error("Error extracting name:", error)
        setStudentGroups([
          {
            ...singleGroup,
            isExtractingName: false,
          },
        ])
      }
    } else if (mode === "multiple") {
      // Create individual groups for each file
      const newGroups: StudentGroup[] = []

      for (const filePreview of filePreviews) {
        const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        newGroups.push({
          id: groupId,
          studentName: "",
          files: [filePreview],
          isExtractingName: true,
        })
      }

      setStudentGroups(newGroups)

      // Extract names for each group in parallel
      const extractionPromises = newGroups.map(async (group) => {
        try {
          const formData = new FormData()
          formData.append("files", group.files[0].file)

          const response = await fetch("/api/extract-name", {
            method: "POST",
            body: formData,
          })

          const result = await response.json()
          return {
            groupId: group.id,
            name: result.success ? result.name : "",
          }
        } catch (error) {
          console.error(`Error extracting name for group ${group.id}:`, error)
          return {
            groupId: group.id,
            name: "",
          }
        }
      })

      const results = await Promise.allSettled(extractionPromises)

      setStudentGroups((prev) =>
        prev.map((group) => {
          const result = results.find((r) => r.status === "fulfilled" && r.value.groupId === group.id)
          return {
            ...group,
            studentName: result && result.status === "fulfilled" ? result.value.name : "",
            isExtractingName: false,
          }
        }),
      )
    }
  }

  const updateStudentName = (groupId: string, name: string) => {
    setStudentGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, studentName: name } : group)))
  }

  const addNewStudentGroup = () => {
    const newGroup: StudentGroup = {
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      studentName: "",
      files: [],
    }
    setStudentGroups((prev) => [...prev, newGroup])
  }

  const handleDragStart = (fileId: string) => {
    setDraggedFile(fileId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault()
    if (!draggedFile) return

    let sourceGroupId = ""
    let draggedFileObj: FilePreview | null = null

    for (const group of studentGroups) {
      const file = group.files.find((f) => f.id === draggedFile)
      if (file) {
        sourceGroupId = group.id
        draggedFileObj = file
        break
      }
    }

    if (!draggedFileObj || sourceGroupId === targetGroupId) return

    setStudentGroups(
      (prev) =>
        prev
          .map((group) => {
            if (group.id === sourceGroupId) {
              const updatedFiles = group.files.filter((f) => f.id !== draggedFile)
              return updatedFiles.length > 0 ? { ...group, files: updatedFiles } : null
            } else if (group.id === targetGroupId) {
              return { ...group, files: [...group.files, draggedFileObj!] }
            }
            return group
          })
          .filter(Boolean) as StudentGroup[],
    )

    setDraggedFile(null)
  }

  // OPTIMIZED EVALUATION FUNCTION - PARALLEL PROCESSING
  const evaluateDocuments = async () => {
    if (studentGroups.length === 0) {
      alert("Por favor, organiza los archivos por estudiante primero.")
      return
    }

    if (!currentEvaluation.rubrica.trim()) {
      alert("Por favor, proporciona una rúbrica de evaluación.")
      return
    }

    // Validate that all groups have names
    const groupsWithoutNames = studentGroups.filter((group) => !group.studentName.trim() && group.files.length > 0)
    if (groupsWithoutNames.length > 0) {
      alert("Por favor, asegúrate de que todos los grupos tengan un nombre de estudiante.")
      return
    }

    setIsLoading(true)
    setEvaluationProgress({
      total: studentGroups.filter((g) => g.files.length > 0).length,
      completed: 0,
      current: "",
      successes: 0,
      failures: 0,
    })

    try {
      // Create evaluation promises for parallel execution
      const evaluationPromises = studentGroups
        .filter((group) => group.files.length > 0)
        .map(async (group, index) => {
          setEvaluationProgress((prev) =>
            prev
              ? {
                  ...prev,
                  current: `Evaluando a ${group.studentName}...`,
                }
              : null,
          )

          try {
            const formData = new FormData()
            group.files.forEach((filePreview) => {
              formData.append("files", filePreview.file)
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

            // Update progress
            setEvaluationProgress((prev) =>
              prev
                ? {
                    ...prev,
                    completed: prev.completed + 1,
                    successes: result.success ? prev.successes + 1 : prev.successes,
                    failures: result.success ? prev.failures : prev.failures + 1,
                  }
                : null,
            )

            if (result.success && result.evaluations.length > 0) {
              const evaluation = result.evaluations[0]
              evaluation.nombreEstudiante = group.studentName
              evaluation.filesPreviews = group.files
              return { success: true, evaluation, groupName: group.studentName }
            } else {
              throw new Error(result.error || "Evaluation failed")
            }
          } catch (error) {
            setEvaluationProgress((prev) =>
              prev
                ? {
                    ...prev,
                    completed: prev.completed + 1,
                    failures: prev.failures + 1,
                  }
                : null,
            )
            return {
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              groupName: group.studentName,
            }
          }
        })

      // Execute all evaluations in parallel
      const results = await Promise.allSettled(evaluationPromises)

      // Process results
      const successfulEvaluations: StudentEvaluation[] = []
      const failedEvaluations: string[] = []

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          if (result.value.success) {
            // Validar que la evaluación tenga los campos necesarios
            const evaluation = result.value.evaluation
            if (!evaluation.notaFinal && evaluation.notaFinal !== 0) {
              evaluation.notaFinal = 1.0 // Nota mínima por defecto
            }
            if (!evaluation.puntajeObtenido && evaluation.puntajeObtenido !== 0) {
              evaluation.puntajeObtenido = 0
            }
            successfulEvaluations.push(evaluation)
          } else {
            failedEvaluations.push(`${result.value.groupName}: ${result.value.error}`)
          }
        } else {
          failedEvaluations.push(`Error desconocido: ${result.reason}`)
        }
      })

      // Save successful evaluations
      if (successfulEvaluations.length > 0) {
        const allEvaluations = [...evaluations, ...successfulEvaluations]
        saveEvaluations(allEvaluations)
        setActiveTab("results")
      }

      // Show comprehensive summary
      const successCount = successfulEvaluations.length
      const failureCount = failedEvaluations.length
      const total = successCount + failureCount

      let message = `✅ Evaluación finalizada.\n\n`
      message += `📊 Resumen:\n`
      message += `• Total procesado: ${total}\n`
      message += `• Éxitos: ${successCount}\n`
      message += `• Fallos: ${failureCount}\n`

      if (failedEvaluations.length > 0) {
        message += `\n❌ Errores:\n${failedEvaluations.slice(0, 3).join("\n")}`
        if (failedEvaluations.length > 3) {
          message += `\n... y ${failedEvaluations.length - 3} más.`
        }
      }

      alert(message)

      // Clear groups after successful evaluation
      if (successCount > 0) {
        setStudentGroups([])
        setFilePreviews([])
        setGroupingMode(null)
      }
    } catch (error) {
      alert(`❌ Error crítico durante la evaluación: ${error}`)
    } finally {
      setIsLoading(false)
      setEvaluationProgress(null)
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
      evaluation.notaFinal ? evaluation.notaFinal.toFixed(1) : "N/A",
      `${evaluation.puntajeObtenido || 0}/${evaluation.configuracion.puntajeMaximo}`,
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
      evaluation.notaFinal ? evaluation.notaFinal.toFixed(1) : "N/A",
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

  const FilePreviewCard = ({
    filePreview,
    groupId,
    isDraggable = true,
    showRemove = true,
  }: {
    filePreview: FilePreview
    groupId?: string
    isDraggable?: boolean
    showRemove?: boolean
  }) => (
    <div
      className={`relative border-2 border-dashed border-gray-300 rounded-lg p-2 bg-white ${
        isDraggable ? "cursor-move hover:border-blue-400" : ""
      }`}
      draggable={isDraggable}
      onDragStart={() => isDraggable && handleDragStart(filePreview.id)}
    >
      <div className="flex flex-col items-center space-y-2">
        {filePreview.type === "image" && filePreview.preview ? (
          <img
            src={filePreview.preview || "/placeholder.svg"}
            alt={filePreview.file.name}
            className="w-16 h-16 object-cover rounded"
          />
        ) : filePreview.type === "pdf" ? (
          <FileIcon className="w-16 h-16 text-red-500" />
        ) : (
          <FileText className="w-16 h-16 text-gray-500" />
        )}
        <span className="text-xs text-center truncate w-full" title={filePreview.file.name}>
          {filePreview.file.name}
        </span>
      </div>
      {showRemove && (
        <button
          onClick={() => {
            if (groupId) {
              // Remove from group logic would go here
            } else {
              removeFilePreview(filePreview.id)
            }
          }}
          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )

  const StudentFeedbackTab = ({ evaluation }: { evaluation: StudentEvaluation }) => (
    <div className="space-y-6">
      {/* Resumen General */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">📋 Resumen de tu Evaluación</h3>
        <p className="text-blue-800">{evaluation.feedback_estudiante?.resumen || "Sin resumen disponible"}</p>
      </div>

      {/* Nota Final Destacada */}
      <div className="text-center">
        <div className="inline-flex items-center gap-4 bg-gray-100 px-6 py-4 rounded-lg">
          <span className="text-lg font-medium">Tu Nota Final:</span>
          <Badge variant="secondary" className="text-2xl px-4 py-2">
            {evaluation.notaFinal ? evaluation.notaFinal.toFixed(1) : "N/A"}
          </Badge>
        </div>
      </div>

      {/* Fortalezas */}
      <div>
        <h3 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />🌟 Tus Fortalezas
        </h3>
        <div className="space-y-3">
          {evaluation.feedback_estudiante?.fortalezas?.map((fortaleza: any, index: number) => (
            <div key={index} className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
              <p className="font-medium text-green-800">{fortaleza.descripcion}</p>
              <p className="text-sm text-green-700 mt-2">{fortaleza.cita}</p>
            </div>
          )) || <p className="text-gray-500 italic">No se identificaron fortalezas específicas.</p>}
        </div>
      </div>

      {/* Oportunidades de Mejora */}
      <div>
        <h3 className="font-semibold text-orange-700 mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />🚀 Áreas para Mejorar
        </h3>
        <div className="space-y-3">
          {evaluation.feedback_estudiante?.oportunidades?.map((oportunidad: any, index: number) => (
            <div key={index} className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-400">
              <p className="font-medium text-orange-800">{oportunidad.descripcion}</p>
              <p className="text-sm text-orange-700 mt-2">{oportunidad.cita}</p>
              {oportunidad.sugerencia_tecnica && (
                <div className="mt-3 p-2 bg-blue-100 rounded text-sm">
                  <strong className="text-blue-800">💡 Consejo:</strong>
                  <span className="text-blue-700 ml-1">{oportunidad.sugerencia_tecnica}</span>
                </div>
              )}
            </div>
          )) || <p className="text-gray-500 italic">No se identificaron áreas específicas de mejora.</p>}
        </div>
      </div>

      {/* Siguiente Paso */}
      {evaluation.feedback_estudiante?.siguiente_paso_sugerido && (
        <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
          <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <Brain className="w-5 h-5" />🎯 Tu Próximo Desafío
          </h3>
          <p className="text-blue-700">{evaluation.feedback_estudiante.siguiente_paso_sugerido}</p>
        </div>
      )}
    </div>
  )

  const TeacherAnalysisTab = ({ evaluation }: { evaluation: StudentEvaluation }) => (
    <div className="space-y-6">
      {/* Análisis de Habilidades */}
      <div>
        <h3 className="font-semibold text-purple-700 mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5" />
          Análisis de Habilidades
        </h3>
        <div className="grid gap-4">
          {evaluation.analisis_habilidades && Object.keys(evaluation.analisis_habilidades).length > 0 ? (
            Object.entries(evaluation.analisis_habilidades).map(([habilidad, datos]: [string, any]) => (
              <div key={habilidad} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium">{habilidad}</h4>
                  <Badge
                    variant={
                      datos.nivel === "Destacado" ? "default" : datos.nivel === "Competente" ? "secondary" : "outline"
                    }
                  >
                    {datos.nivel}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Evidencia:</strong> {datos.evidencia_especifica}
                </p>
                <p className="text-sm text-gray-500">
                  <strong>Justificación:</strong> {datos.justificacion_pedagogica}
                </p>
              </div>
            ))
          ) : (
            <p className="text-gray-500 italic">No se registraron habilidades específicas.</p>
          )}
        </div>
      </div>

      {/* Evaluación por Rúbrica */}
      <div>
        <h3 className="font-semibold text-blue-700 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Evaluación por Rúbrica
        </h3>
        <div className="space-y-3">
          {evaluation.analisis_detallado?.map((criterio: any, index: number) => (
            <div key={index} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-medium text-gray-900">{criterio.criterio}</h4>
                <Badge variant="outline" className="font-mono">
                  {criterio.puntaje}
                </Badge>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium text-green-700">Evidencia encontrada:</span>
                  <p className="text-sm text-gray-600 mt-1">{criterio.evidencia}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-blue-700">Justificación del puntaje:</span>
                  <p className="text-sm text-gray-600 mt-1">{criterio.justificacion}</p>
                </div>
              </div>
            </div>
          )) || <p className="text-gray-500 italic">No se registró análisis detallado por criterios.</p>}
        </div>
      </div>

      {/* Pros y Contras */}
      <div>
        <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Pros y Contras - Visión Rápida
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-medium text-green-800 mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Puntos Altos
            </h4>
            <ul className="text-sm text-green-700 space-y-1">
              {evaluation.feedback_estudiante?.fortalezas?.slice(0, 3).map((f: any, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">•</span>
                  {f.descripcion}
                </li>
              )) || <li className="italic">No se identificaron puntos altos específicos.</li>}
            </ul>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Puntos Bajos
            </h4>
            <ul className="text-sm text-red-700 space-y-1">
              {evaluation.feedback_estudiante?.oportunidades?.slice(0, 3).map((o: any, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  {o.descripcion}
                </li>
              )) || <li className="italic">No se identificaron puntos bajos específicos.</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* Análisis del Profesor */}
      {evaluation.analisis_profesor && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-700 mb-3">📝 Notas del Profesor</h3>
          <div className="space-y-3 text-sm">
            <div>
              <strong>Desempeño General:</strong>
              <p className="text-gray-600 mt-1">{evaluation.analisis_profesor.desempeno_general}</p>
            </div>
            <div>
              <strong>Patrones Observados:</strong>
              <p className="text-gray-600 mt-1">{evaluation.analisis_profesor.patrones_observados}</p>
            </div>
            <div>
              <strong>Sugerencia Pedagógica:</strong>
              <p className="text-gray-600 mt-1">{evaluation.analisis_profesor.sugerencia_pedagogica}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">✨ Genius Evaluator X</h1>
          <p className="text-gray-600">Sistema de Evaluación Inteligente con IA - Optimizado</p>
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
            {/* Evaluation Progress */}
            {evaluationProgress && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-blue-900">Evaluación en Progreso</h3>
                      <Badge variant="secondary">
                        {evaluationProgress.completed}/{evaluationProgress.total}
                      </Badge>
                    </div>
                    <Progress
                      value={(evaluationProgress.completed / evaluationProgress.total) * 100}
                      className="w-full"
                    />
                    <p className="text-sm text-blue-700">{evaluationProgress.current}</p>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-600">✅ Éxitos: {evaluationProgress.successes}</span>
                      <span className="text-red-600">❌ Fallos: {evaluationProgress.failures}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

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

                {filePreviews.length > 0 && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Archivos Cargados:</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {filePreviews.map((filePreview) => (
                          <FilePreviewCard key={filePreview.id} filePreview={filePreview} isDraggable={false} />
                        ))}
                      </div>
                    </div>

                    {!groupingMode && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Los archivos subidos corresponden a:</strong>
                          <div className="flex gap-4 mt-3">
                            <Button
                              onClick={() => handleGroupingModeSelect("single")}
                              variant="outline"
                              className="flex items-center gap-2"
                            >
                              <User className="w-4 h-4" />
                              Un Solo Estudiante
                            </Button>
                            <Button
                              onClick={() => handleGroupingModeSelect("multiple")}
                              variant="outline"
                              className="flex items-center gap-2"
                            >
                              <Users className="w-4 h-4" />
                              Varios Estudiantes
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {studentGroups.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span>Organización por Estudiante</span>
                    {groupingMode === "multiple" && (
                      <Button onClick={addNewStudentGroup} variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Estudiante
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {studentGroups.map((group) => (
                    <div
                      key={group.id}
                      className="border rounded-lg p-4 bg-gray-50"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, group.id)}
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex-1">
                          <Label htmlFor={`student-${group.id}`}>Nombre del Estudiante</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id={`student-${group.id}`}
                              value={group.studentName}
                              onChange={(e) => updateStudentName(group.id, e.target.value)}
                              placeholder="Nombre del estudiante..."
                              className="flex-1"
                            />
                            {group.isExtractingName && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                          </div>
                        </div>
                        <Badge variant="secondary">
                          {group.files.length} archivo{group.files.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {group.files.map((filePreview) => (
                          <FilePreviewCard
                            key={filePreview.id}
                            filePreview={filePreview}
                            groupId={group.id}
                            isDraggable={groupingMode === "multiple"}
                            showRemove={false}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

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
                  disabled={isLoading || studentGroups.length === 0 || !currentEvaluation.rubrica.trim()}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Evaluando en Paralelo...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4 mr-2" />
                      Iniciar Evaluación Optimizada
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
                      <Dialog key={evaluation.id}>
                        <DialogTrigger asChild>
                          <Card className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-md transition-shadow">
                            <CardContent className="pt-6">
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <h3 className="font-semibold text-lg">{evaluation.nombreEstudiante}</h3>
                                  <p className="text-gray-600">
                                    {evaluation.nombrePrueba} - {evaluation.curso}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-lg px-3 py-1">
                                    {evaluation.notaFinal ? evaluation.notaFinal.toFixed(1) : "N/A"}
                                  </Badge>
                                  <Eye className="w-4 h-4 text-gray-400" />
                                </div>
                              </div>

                              {evaluation.feedback_estudiante && (
                                <div className="space-y-2">
                                  <div>
                                    <h4 className="font-medium text-green-700 text-sm">🌟 Fortalezas</h4>
                                    <p className="text-sm text-gray-600 line-clamp-2">
                                      {evaluation.feedback_estudiante.fortalezas?.[0]?.descripcion ||
                                        "Sin fortalezas registradas"}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </DialogTrigger>

                        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <GraduationCap className="w-5 h-5" />
                              Carpeta de {evaluation.nombreEstudiante}
                            </DialogTitle>
                          </DialogHeader>

                          <Tabs defaultValue="student" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="student">Retroalimentación para el Estudiante</TabsTrigger>
                              <TabsTrigger value="teacher">Análisis para el Profesor</TabsTrigger>
                            </TabsList>

                            <TabsContent value="student" className="mt-6">
                              <StudentFeedbackTab evaluation={evaluation} />
                            </TabsContent>

                            <TabsContent value="teacher" className="mt-6">
                              <TeacherAnalysisTab evaluation={evaluation} />
                            </TabsContent>
                          </Tabs>
                        </DialogContent>
                      </Dialog>
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
                  <div className="space-y-2">
                    {evaluations.map((evaluation) => (
                      <Dialog key={evaluation.id}>
                        <DialogTrigger asChild>
                          <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="font-medium">{evaluation.nombreEstudiante}</p>
                                <p className="text-sm text-gray-600">
                                  {evaluation.nombrePrueba} - {evaluation.curso}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <Badge variant="secondary">
                                {evaluation.notaFinal ? evaluation.notaFinal.toFixed(1) : "N/A"}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {evaluation.puntajeObtenido}/{evaluation.configuracion.puntajeMaximo}
                              </span>
                              <span className="text-sm text-gray-500">{evaluation.configuracion.fecha}</span>
                              <Eye className="w-4 h-4 text-gray-400" />
                            </div>
                          </div>
                        </DialogTrigger>

                        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <GraduationCap className="w-5 h-5" />
                              Carpeta de {evaluation.nombreEstudiante}
                            </DialogTitle>
                          </DialogHeader>

                          <Tabs defaultValue="student" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="student">Retroalimentación para el Estudiante</TabsTrigger>
                              <TabsTrigger value="teacher">Análisis para el Profesor</TabsTrigger>
                            </TabsList>

                            <TabsContent value="student" className="mt-6">
                              <StudentFeedbackTab evaluation={evaluation} />
                            </TabsContent>

                            <TabsContent value="teacher" className="mt-6">
                              <TeacherAnalysisTab evaluation={evaluation} />
                            </TabsContent>
                          </Tabs>
                        </DialogContent>
                      </Dialog>
                    ))}
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
