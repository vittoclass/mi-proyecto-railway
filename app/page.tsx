"use client"

import type React from "react"
import { supabase } from "@/utils/supabase"
import { useState, useEffect, useCallback, useRef } from "react"
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
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import {
  Upload,
  FileText,
  Brain,
  Download,
  BarChart3,
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
  Zap,
  Settings,
  Camera,
  Printer,
  UserCheck,
  TrendingUp,
  TrendingDown,
  Target,
  Move,
  FolderOpen,
  ImageIcon,
  Building2,
  ClipboardList,
  LineChart,
  Archive,
  FileImage,
  Activity,
  Bell,
} from "lucide-react"

interface EvaluationConfig {
  sistema: string
  nivelExigencia: number
  puntajeMaximo: number
  notaAprobacion: number
  flexibility: number
  fecha: string
  aiModel: string
  nombreProfesor: string
  departamento: string
  logoFile?: File
  logoUrl?: string
}

interface FilePreview {
  id: string
  file: File
  preview?: string
  type: "image" | "pdf" | "other"
  originalSize: number
  compressedSize?: number
  isCompressed: boolean
}

interface StudentGroup {
  id: string
  studentName: string
  files: FilePreview[]
  isExtractingName: boolean
  extractionError?: string
}

interface ProcessEvaluation {
  id: string
  nombreEstudiante: string
  fecha: string
  tipoActividad: string
  objetivos: string
  habilidades: string
  oa: string
  evidencias: FilePreview[]
  feedback: string
  puntaje: number
  observaciones: string
}

interface StudentFolder {
  id: string
  nombreEstudiante: string
  evaluaciones: StudentEvaluation[]
  evaluacionesProceso: ProcessEvaluation[]
  documentosAdministrativos: FilePreview[]
  alertas: StudentAlert[]
  promedioGeneral: number
  tendencia: "up" | "down" | "stable"
  ultimaActividad: string
}

interface StudentAlert {
  id: string
  tipo: "warning" | "success" | "info" | "danger"
  mensaje: string
  fecha: string
  prioridad: "alta" | "media" | "baja"
  resuelto: boolean
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
  habilidades_identificadas: any
  analisis_detallado: any[]
  filesPreviews?: FilePreview[]
  fecha: string
}

interface EvaluationProgress {
  total: number
  completed: number
  current: string
  successes: number
  failures: number
  currentStudent: string
}

interface GradesSyncData {
  estudiante: string
  evaluacion: string
  nota: number
  fecha: string
  curso: string
  profesor: string
}

type GroupingMode = "single" | "multiple" | null
type WorkflowStep = "upload" | "grouping" | "organized" | "ready"
type SortOrder = "alfabetico" | "nota_desc" | "nota_asc" | "fecha_desc" | "fecha_asc" | "personalizado"

const compressImage = async (file: File, shouldCompress: boolean): Promise<FilePreview> => {
  const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  let processedFile = file
  let preview: string | undefined
  let type: "image" | "pdf" | "other" = "other"

  if (file.type.startsWith("image/")) {
    type = "image"

    if (shouldCompress) {
      try {
        const imageCompression = (await import("browser-image-compression")).default
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          quality: 0.8,
        }
        processedFile = await imageCompression(file, options)
      } catch (error) {
        console.warn("Error compressing image, using original:", error)
        processedFile = file
      }
    }

    preview = URL.createObjectURL(processedFile)
  } else if (file.type === "application/pdf") {
    type = "pdf"
  }

  return {
    id,
    file: processedFile,
    preview,
    type,
    originalSize: file.size,
    compressedSize: processedFile.size,
    isCompressed: shouldCompress && processedFile.size < file.size,
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

const generateStudentFeedbackReport = (evaluation: StudentEvaluation, logoUrl?: string) => {
  const printWindow = window.open("", "_blank")
  if (!printWindow) return

  const logoSection = logoUrl
    ? `<img src="${logoUrl}" alt="Logo Institucional" style="max-height: 60px; margin-bottom: 10px;" onerror="this.style.display='none'" />`
    : ""

  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Feedback - ${evaluation.nombreEstudiante}</title>
      <meta charset="UTF-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: 'Arial', sans-serif; 
          padding: 15px; 
          line-height: 1.4; 
          color: #333;
          background: white;
          font-size: 12px;
        }
        .header { 
          text-align: center; 
          border-bottom: 2px solid #2563eb; 
          padding-bottom: 15px; 
          margin-bottom: 20px; 
        }
        .header h1 { 
          margin: 10px 0 5px 0; 
          color: #1e40af; 
          font-size: 18px;
        }
        .header p { 
          margin: 2px 0; 
          color: #666; 
          font-size: 11px;
        }
        .grade-box { 
          background: #f0f9ff; 
          padding: 15px; 
          border-radius: 8px; 
          text-align: center; 
          margin: 15px 0; 
          border: 1px solid #0ea5e9;
        }
        .grade-box .grade { 
          font-size: 24px; 
          font-weight: bold; 
          color: #0c4a6e; 
        }
        .section { 
          margin-bottom: 20px; 
        }
        .section h2 { 
          color: #1e40af; 
          border-bottom: 1px solid #e5e7eb; 
          padding-bottom: 5px; 
          font-size: 14px;
          margin-bottom: 10px;
        }
        .strength-item { 
          background: #f0fdf4; 
          border-left: 3px solid #22c55e; 
          padding: 10px; 
          margin: 8px 0; 
          border-radius: 4px;
          font-size: 11px;
        }
        .opportunity-item { 
          background: #fffbeb; 
          border-left: 3px solid #f59e0b; 
          padding: 10px; 
          margin: 8px 0; 
          border-radius: 4px;
          font-size: 11px;
        }
        .suggestion-box { 
          background: #dbeafe; 
          padding: 8px; 
          border-radius: 4px; 
          margin-top: 5px;
          font-size: 10px;
        }
        .footer { 
          margin-top: 20px; 
          padding-top: 10px; 
          border-top: 1px solid #e5e7eb; 
          text-align: center; 
          color: #6b7280; 
          font-size: 9px;
        }
        @media print {
          body { margin: 0; padding: 10px; }
        }
        @page { margin: 1cm; }
      </style>
    </head>
    <body>
      <div class="header">
        ${logoSection}
        <h1>📋 Feedback de Evaluación</h1>
        <p><strong>Estudiante:</strong> ${evaluation.nombreEstudiante}</p>
        <p><strong>Evaluación:</strong> ${evaluation.nombrePrueba}</p>
        <p><strong>Curso:</strong> ${evaluation.curso}</p>
        <p><strong>Fecha:</strong> ${new Date(evaluation.fecha || evaluation.configuracion.fecha).toLocaleDateString("es-CL")}</p>
      </div>

      <div class="grade-box">
        <div class="grade">${evaluation.notaFinal ? evaluation.notaFinal.toFixed(1) : "N/A"}</div>
        <div>Puntaje: ${evaluation.puntajeObtenido || 0}/${evaluation.configuracion.puntajeMaximo}</div>
      </div>

      <div class="section">
        <h2>🌟 Tus Fortalezas</h2>
        ${
          evaluation.feedback_estudiante?.fortalezas
            ?.slice(0, 2)
            .map(
              (f: any) => `
          <div class="strength-item">
            <strong>${f.descripcion}</strong>
            <p style="margin: 5px 0 0 0; font-style: italic;">"${f.cita}"</p>
          </div>
        `,
            )
            .join("") || "<p>Sin fortalezas registradas.</p>"
        }
      </div>

      <div class="section">
        <h2>🎯 Áreas de Mejora</h2>
        ${
          evaluation.feedback_estudiante?.oportunidades
            ?.slice(0, 2)
            .map(
              (o: any) => `
          <div class="opportunity-item">
            <strong>${o.descripcion}</strong>
            <p style="margin: 5px 0; font-style: italic;">"${o.cita}"</p>
            ${o.sugerencia_tecnica ? `<div class="suggestion-box"><strong>💡 Sugerencia:</strong> ${o.sugerencia_tecnica}</div>` : ""}
          </div>
        `,
            )
            .join("") || "<p>Sin áreas de mejora específicas.</p>"
        }
      </div>

      ${
        evaluation.feedback_estudiante?.siguiente_paso_sugerido
          ? `
        <div class="section">
          <h2>🎯 Próximo Desafío</h2>
          <div style="background: #f3f4f6; padding: 10px; border-radius: 4px; font-size: 11px;">
            ${evaluation.feedback_estudiante.siguiente_paso_sugerido}
          </div>
        </div>
      `
          : ""
      }

      <div class="footer">
        <p>Generado por Genius Evaluator X - ${new Date().toLocaleDateString("es-CL")}</p>
      </div>

      <script>
        window.onload = function() {
          setTimeout(() => {
            window.print();
          }, 500);
        }
      </script>
    </body>
    </html>
  `

  printWindow.document.write(printContent)
  printWindow.document.close()
}

const generatePrintableReport = (evaluation: StudentEvaluation, logoUrl?: string) => {
  const printWindow = window.open("", "_blank")
  if (!printWindow) return

  const logoSection = logoUrl
    ? `<img src="${logoUrl}" alt="Logo Institucional" style="max-height: 80px; margin-bottom: 15px;" onerror="this.style.display='none'" />`
    : ""

  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Reporte de Evaluación - ${evaluation.nombreEstudiante}</title>
      <meta charset="UTF-8">
      <style>
        * { box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          margin: 0; 
          padding: 20px; 
          line-height: 1.6; 
          color: #333;
          background: white;
        }
        .header { 
          text-align: center; 
          border-bottom: 3px solid #2563eb; 
          padding-bottom: 20px; 
          margin-bottom: 30px; 
        }
        .header h1 { 
          margin: 15px 0 10px 0; 
          color: #1e40af; 
          font-size: 28px;
          font-weight: bold;
        }
        .header p { 
          margin: 5px 0; 
          color: #666; 
          font-size: 14px;
        }
        .grade-section { 
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); 
          padding: 25px; 
          border-radius: 12px; 
          text-align: center; 
          margin: 25px 0; 
          border: 2px solid #0ea5e9;
        }
        .grade-section .grade { 
          font-size: 48px; 
          font-weight: bold; 
          color: #0c4a6e; 
          margin: 10px 0;
        }
        .grade-section .subtitle { 
          color: #0369a1; 
          font-size: 16px; 
          margin: 5px 0;
        }
        .section { 
          margin-bottom: 30px; 
          page-break-inside: avoid;
        }
        .section h2 { 
          color: #1e40af; 
          border-bottom: 2px solid #e5e7eb; 
          padding-bottom: 8px; 
          font-size: 20px;
          margin-bottom: 15px;
        }
        .section h3 { 
          color: #374151; 
          margin: 20px 0 10px 0; 
          font-size: 16px;
        }
        .summary-box { 
          background: #f8fafc; 
          padding: 20px; 
          border-radius: 8px; 
          border-left: 4px solid #3b82f6;
          margin: 15px 0;
        }
        .strength-item { 
          background: #f0fdf4; 
          border-left: 4px solid #22c55e; 
          padding: 15px; 
          margin: 12px 0; 
          border-radius: 6px;
        }
        .opportunity-item { 
          background: #fffbeb; 
          border-left: 4px solid #f59e0b; 
          padding: 15px; 
          margin: 12px 0; 
          border-radius: 6px;
        }
        .skill-item { 
          background: #fafafa; 
          border: 1px solid #e5e7eb; 
          padding: 15px; 
          margin: 10px 0; 
          border-radius: 8px;
        }
        .skill-level { 
          background: #3b82f6; 
          color: white; 
          padding: 4px 12px; 
          border-radius: 20px; 
          font-size: 12px; 
          font-weight: bold;
          display: inline-block;
          margin-left: 10px;
        }
        .criteria-item { 
          background: white; 
          border: 1px solid #d1d5db; 
          padding: 18px; 
          margin: 12px 0; 
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .score-badge { 
          background: #1d4ed8; 
          color: white; 
          padding: 6px 12px; 
          border-radius: 6px; 
          font-weight: bold;
          font-size: 14px;
        }
        .evidence-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
          margin: 15px 0;
        }
        .evidence-item {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 10px;
          text-align: center;
        }
        .evidence-item img {
          max-width: 100%;
          max-height: 100px;
          object-fit: cover;
          border-radius: 4px;
        }
        .footer-info { 
          margin-top: 40px; 
          padding-top: 20px; 
          border-top: 1px solid #e5e7eb; 
          text-align: center; 
          color: #6b7280; 
          font-size: 12px;
        }
        @media print {
          body { margin: 0; padding: 15px; }
          .section { page-break-inside: avoid; }
          .grade-section { page-break-inside: avoid; }
        }
        @page { margin: 1.5cm; }
      </style>
    </head>
    <body>
      <div class="header">
        ${logoSection}
        <h1>📋 Reporte de Evaluación Académica</h1>
        <p><strong>Estudiante:</strong> ${evaluation.nombreEstudiante}</p>
        <p><strong>Evaluación:</strong> ${evaluation.nombrePrueba}</p>
        <p><strong>Curso:</strong> ${evaluation.curso}</p>
        <p><strong>Profesor:</strong> ${evaluation.configuracion.nombreProfesor || "No especificado"}</p>
        <p><strong>Departamento:</strong> ${evaluation.configuracion.departamento || "No especificado"}</p>
        <p><strong>Fecha de Evaluación:</strong> ${new Date(evaluation.fecha || evaluation.configuracion.fecha).toLocaleDateString("es-CL")}</p>
      </div>

      <div class="grade-section">
        <div class="subtitle">Calificación Final</div>
        <div class="grade">${evaluation.notaFinal ? evaluation.notaFinal.toFixed(1) : "N/A"}</div>
        <div class="subtitle">Puntaje Obtenido: ${evaluation.puntajeObtenido || 0}/${evaluation.configuracion.puntajeMaximo} puntos</div>
      </div>

      ${
        evaluation.filesPreviews && evaluation.filesPreviews.length > 0
          ? `
        <div class="section">
          <h2>📸 Evidencias Evaluadas</h2>
          <div class="evidence-grid">
            ${evaluation.filesPreviews
              .map(
                (file) => `
              <div class="evidence-item">
                ${
                  file.type === "image" && file.preview
                    ? `<img src="${file.preview}" alt="${file.file.name}" />`
                    : `<div style="padding: 20px; background: #f3f4f6; border-radius: 4px;">📄</div>`
                }
                <p style="font-size: 10px; margin-top: 5px; word-break: break-all;">${file.file.name}</p>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      <div class="section">
        <h2>📋 Resumen Ejecutivo</h2>
        <div class="summary-box">
          ${evaluation.feedback_estudiante?.resumen || "Sin resumen disponible"}
        </div>
      </div>

      <div class="section">
        <h2>🌟 Fortalezas Identificadas</h2>
        ${
          evaluation.feedback_estudiante?.fortalezas
            ?.map(
              (f: any) => `
          <div class="strength-item">
            <strong>${f.descripcion}</strong>
            <p style="margin: 8px 0 0 0; font-style: italic;">"${f.cita}"</p>
            ${f.habilidad_demostrada ? `<p style="margin: 5px 0 0 0; color: #059669;"><strong>Habilidad demostrada:</strong> ${f.habilidad_demostrada}</p>` : ""}
          </div>
        `,
            )
            .join("") ||
          "<p style='font-style: italic; color: #6b7280;'>No se identificaron fortalezas específicas.</p>"
        }
      </div>

      <div class="section">
        <h2>🎯 Oportunidades de Mejora</h2>
        ${
          evaluation.feedback_estudiante?.oportunidades
            ?.map(
              (o: any) => `
          <div class="opportunity-item">
            <strong>${o.descripcion}</strong>
            <p style="margin: 8px 0; font-style: italic;">"${o.cita}"</p>
            ${o.sugerencia_tecnica ? `<p style="margin: 8px 0 0 0; padding: 10px; background: #dbeafe; border-radius: 4px;"><strong>💡 Sugerencia:</strong> ${o.sugerencia_tecnica}</p>` : ""}
          </div>
        `,
            )
            .join("") ||
          "<p style='font-style: italic; color: #6b7280;'>No se identificaron oportunidades específicas de mejora.</p>"
        }
      </div>

      <div class="section">
        <h2>🧠 Análisis de Habilidades</h2>
        ${
          evaluation.habilidades_identificadas && Object.keys(evaluation.habilidades_identificadas).length > 0
            ? Object.entries(evaluation.habilidades_identificadas)
                .map(
                  ([habilidad, datos]: [string, any]) => `
            <div class="skill-item">
              <h3>${habilidad}<span class="skill-level">${datos.nivel}</span></h3>
              <p><strong>Evidencia específica:</strong> ${datos.evidencia_especifica}</p>
              <p><strong>Justificación pedagógica:</strong> ${datos.justificacion_pedagogica}</p>
            </div>
          `,
                )
                .join("")
            : "<p style='font-style: italic; color: #6b7280;'>No se registraron habilidades específicas.</p>"
        }
      </div>

      <div class="section">
        <h2>📊 Evaluación por Criterios de Rúbrica</h2>
        ${
          evaluation.analisis_detallado
            ?.map(
              (criterio: any) => `
          <div class="criteria-item">
            <h3>${criterio.criterio} <span class="score-badge">${criterio.puntaje}</span></h3>
            <p><strong>Evidencia encontrada:</strong> ${criterio.evidencia}</p>
            <p><strong>Justificación del puntaje:</strong> ${criterio.justificacion}</p>
          </div>
        `,
            )
            .join("") ||
          "<p style='font-style: italic; color: #6b7280;'>No se registró análisis detallado por criterios.</p>"
        }
      </div>

      ${
        evaluation.analisis_profesor
          ? `
        <div class="section">
          <h2>📝 Observaciones del Profesor</h2>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <h3>Desempeño General</h3>
            <p>${evaluation.analisis_profesor.desempeno_general}</p>
            <h3>Patrones Observados</h3>
            <p>${evaluation.analisis_profesor.patrones_observados}</p>
            <h3>Recomendaciones Pedagógicas</h3>
            <p>${evaluation.analisis_profesor.sugerencia_pedagogica}</p>
            ${evaluation.analisis_profesor.proyeccion_desarrollo ? `<h3>Proyección de Desarrollo</h3><p>${evaluation.analisis_profesor.proyeccion_desarrollo}</p>` : ""}
          </div>
        </div>
      `
          : ""
      }

      <div class="footer-info">
        <p>Reporte generado automáticamente por Genius Evaluator X</p>
        <p>Fecha de generación: ${new Date().toLocaleDateString("es-CL")} a las ${new Date().toLocaleTimeString("es-CL")}</p>
      </div>

      <script>
        window.onload = function() {
          setTimeout(() => {
            window.print();
          }, 500);
        }
      </script>
    </body>
    </html>
  `

  printWindow.document.write(printContent)
  printWindow.document.close()
}

export default function GeniusEvaluatorX() {
  const [activeTab, setActiveTab] = useState("evaluate")
  const [isLoading, setIsLoading] = useState(false)
  const [evaluations, setEvaluations] = useState<StudentEvaluation[]>([])
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([])
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([])
  const [groupingMode, setGroupingMode] = useState<GroupingMode>(null)
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("upload")
  const [draggedFile, setDraggedFile] = useState<string | null>(null)
  const [evaluationProgress, setEvaluationProgress] = useState<EvaluationProgress | null>(null)
  const [optimizeImages, setOptimizeImages] = useState(true)
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false)
  const [studentFolders, setStudentFolders] = useState<StudentFolder[]>([])
  const [processEvaluations, setProcessEvaluations] = useState<ProcessEvaluation[]>([])
  const [administrativeFiles, setAdministrativeFiles] = useState<FilePreview[]>([])
  const [sortOrder, setSortOrder] = useState<SortOrder>("alfabetico")
  const [customOrder, setCustomOrder] = useState<string[]>([])
  const [selectedStudentFolder, setSelectedStudentFolder] = useState<StudentFolder | null>(null)

  const [currentEvaluation, setCurrentEvaluation] = useState({
    nombrePrueba: "",
    curso: "",
    rubrica: "",
    preguntasObjetivas: "",
  })

  const [processEvaluationForm, setProcessEvaluationForm] = useState({
    tipoActividad: "",
    objetivos: "",
    habilidades: "",
    oa: "",
    observaciones: "",
  })

  const [config, setConfig] = useState<EvaluationConfig>({
    sistema: "chile_2_7",
    nivelExigencia: 60,
    puntajeMaximo: 30,
    notaAprobacion: 4.0,
    flexibility: 5,
    fecha: new Date().toISOString().split("T")[0],
    aiModel: "mistral-large-latest",
    nombreProfesor: "",
    departamento: "",
  })

  const dragCounter = useRef(0)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
  const fetchEvaluations = async () => {
    const { data: savedData, error } = await supabase
      .from("evaluaciones")
      .select("data")
      .eq("usuario_id", "usuario_demo")
      .order("fecha", { ascending: false })
      .limit(1)

    if (savedData && savedData[0]?.data) {
      setEvaluations(savedData[0].data)
    }
  }

  fetchEvaluations()
}).limit(1)
    const savedFolders = localStorage.getItem("genius-student-folders")
    const savedProcessEvaluations = localStorage.getItem("genius-process-evaluations")
    const savedAdministrativeFiles = localStorage.getItem("genius-administrative-files")
    const savedConfig = localStorage.getItem("genius-config")

    if (savedEvaluations) {
      try {
        setEvaluations(JSON.parse(savedEvaluations))
      } catch (error) {
        console.error("Error loading saved evaluations:", error)
      }
    }

    if (savedFolders) {
      try {
        setStudentFolders(JSON.parse(savedFolders))
      } catch (error) {
        console.error("Error loading saved folders:", error)
      }
    }

    if (savedProcessEvaluations) {
      try {
        setProcessEvaluations(JSON.parse(savedProcessEvaluations))
      } catch (error) {
        console.error("Error loading saved process evaluations:", error)
      }
    }

    if (savedAdministrativeFiles) {
      try {
        setAdministrativeFiles(JSON.parse(savedAdministrativeFiles))
      } catch (error) {
        console.error("Error loading saved administrative files:", error)
      }
    }

    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig)
        setConfig(parsedConfig)
        if (parsedConfig.logoUrl) {
          // Logo URL is already set from saved config
        }
      } catch (error) {
        console.error("Error loading saved config:", error)
      }
    }
  }, [])

  const saveEvaluations = useCallback((newEvaluations: StudentEvaluation[]) => {
    setEvaluations((prev) => {
      const updated = [...prev, ...newEvaluations]
      localStorage.setItem("genius-evaluations", JSON.stringify(updated))

      // Update student folders
      newEvaluations.forEach((evaluation) => {
        updateStudentFolder(evaluation.nombreEstudiante, evaluation)
      })

      return updated
    })
  }, [])

  const updateStudentFolder = useCallback(
    (studentName: string, evaluation: StudentEvaluation) => {
      setStudentFolders((prev) => {
        const existingFolderIndex = prev.findIndex((folder) => folder.nombreEstudiante === studentName)

        if (existingFolderIndex >= 0) {
          const updatedFolders = [...prev]
          const folder = updatedFolders[existingFolderIndex]
          folder.evaluaciones.push(evaluation)
          folder.ultimaActividad = new Date().toISOString()

          // Calculate average and trend
          const notas = folder.evaluaciones.map((e) => e.notaFinal).filter((n) => n > 0)
          folder.promedioGeneral = notas.length > 0 ? notas.reduce((a, b) => a + b, 0) / notas.length : 0

          // Determine trend
          if (notas.length >= 2) {
            const recent = notas.slice(-2)
            folder.tendencia = recent[1] > recent[0] ? "up" : recent[1] < recent[0] ? "down" : "stable"
          }

          // Generate alerts
          if (evaluation.notaFinal < config.notaAprobacion) {
            folder.alertas.push({
              id: `alert_${Date.now()}`,
              tipo: "warning",
              mensaje: `Nota bajo el promedio en ${evaluation.nombrePrueba}: ${evaluation.notaFinal.toFixed(1)}`,
              fecha: new Date().toISOString(),
              prioridad: "alta",
              resuelto: false,
            })
          }

          localStorage.setItem("genius-student-folders", JSON.stringify(updatedFolders))
          return updatedFolders
        } else {
          const newFolder: StudentFolder = {
            id: `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            nombreEstudiante: studentName,
            evaluaciones: [evaluation],
            evaluacionesProceso: [],
            documentosAdministrativos: [],
            alertas: [],
            promedioGeneral: evaluation.notaFinal,
            tendencia: "stable",
            ultimaActividad: new Date().toISOString(),
          }

          const updatedFolders = [...prev, newFolder]
          localStorage.setItem("genius-student-folders", JSON.stringify(updatedFolders))
          return updatedFolders
        }
      })
    },
    [config.notaAprobacion],
  )

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      alert("Por favor, selecciona un archivo de imagen válido.")
      return
    }

    try {
      const logoPreview = await compressImage(file, true)
      const logoUrl = logoPreview.preview

      setConfig((prev) => {
        const updated = { ...prev, logoFile: file, logoUrl }
        localStorage.setItem("genius-config", JSON.stringify(updated))
        return updated
      })
    } catch (error) {
      console.error("Error processing logo:", error)
      alert("Error al procesar el logo. Por favor, inténtalo de nuevo.")
    }

    event.target.value = ""
  }

  const resetWorkflow = useCallback(() => {
    setFilePreviews([])
    setStudentGroups([])
    setGroupingMode(null)
    setWorkflowStep("upload")
    setDraggedFile(null)
  }, [])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    setIsLoading(true)
    try {
      const newPreviews: FilePreview[] = []

      for (const file of files) {
        const filePreview = await compressImage(file, optimizeImages)
        newPreviews.push(filePreview)
      }

      setFilePreviews((prev) => [...prev, ...newPreviews])
      setWorkflowStep("grouping")
    } catch (error) {
      console.error("Error processing files:", error)
      alert("Error al procesar los archivos. Por favor, inténtalo de nuevo.")
    } finally {
      setIsLoading(false)
    }

    event.target.value = ""
  }

  const handleAdministrativeFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    setIsLoading(true)
    try {
      const newFiles: FilePreview[] = []

      for (const file of files) {
        const filePreview = await compressImage(file, optimizeImages)
        newFiles.push(filePreview)
      }

      setAdministrativeFiles((prev) => {
        const updated = [...prev, ...newFiles]
        localStorage.setItem("genius-administrative-files", JSON.stringify(updated))
        return updated
      })

      alert(`✅ ${newFiles.length} archivo(s) administrativo(s) guardado(s) automáticamente.`)
    } catch (error) {
      console.error("Error processing administrative files:", error)
      alert("Error al procesar los archivos administrativos.")
    } finally {
      setIsLoading(false)
    }

    event.target.value = ""
  }

  const handleCameraCapture = async (file: File) => {
    try {
      const filePreview = await compressImage(file, optimizeImages)
      setFilePreviews((prev) => [...prev, filePreview])
      if (workflowStep === "upload") {
        setWorkflowStep("grouping")
      }
    } catch (error) {
      console.error("Error processing camera capture:", error)
      alert("Error al procesar la foto capturada.")
    }
  }

  const removeFilePreview = (fileId: string) => {
    setFilePreviews((prev) => {
      const newPreviews = prev.filter((f) => f.id !== fileId)
      if (newPreviews.length === 0) {
        resetWorkflow()
      }
      return newPreviews
    })

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
    if (!mode) return

    setGroupingMode(mode)
    setWorkflowStep("organized")
    setIsLoading(true)

    try {
      if (mode === "single") {
        const singleGroup: StudentGroup = {
          id: `group_${Date.now()}_single`,
          studentName: "",
          files: [...filePreviews],
          isExtractingName: true,
        }

        setStudentGroups([singleGroup])

        try {
          const formData = new FormData()
          filePreviews.forEach((filePreview) => {
            formData.append("files", filePreview.file)
          })

          const response = await fetch("/api/extract-name", {
            method: "POST",
            body: formData,
          })

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const result = await response.json()
          const extractedName = result.success ? result.name : ""

          setStudentGroups([
            {
              ...singleGroup,
              studentName: extractedName,
              isExtractingName: false,
              extractionError: result.success ? undefined : "No se pudo extraer el nombre automáticamente",
            },
          ])
        } catch (error) {
          console.error("Error extracting name:", error)
          setStudentGroups([
            {
              ...singleGroup,
              isExtractingName: false,
              extractionError: "Error al extraer el nombre. Por favor, ingrésalo manualmente.",
            },
          ])
        }
      } else if (mode === "multiple") {
        const newGroups: StudentGroup[] = filePreviews.map((filePreview) => ({
          id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          studentName: "",
          files: [filePreview],
          isExtractingName: true,
        }))

        setStudentGroups(newGroups)

        const extractionPromises = newGroups.map(async (group) => {
          try {
            const formData = new FormData()
            formData.append("files", group.files[0].file)

            const response = await fetch("/api/extract-name", {
              method: "POST",
              body: formData,
            })

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`)
            }

            const result = await response.json()
            return {
              groupId: group.id,
              name: result.success ? result.name : "",
              error: result.success ? undefined : "No se pudo extraer automáticamente",
            }
          } catch (error) {
            console.error(`Error extracting name for group ${group.id}:`, error)
            return {
              groupId: group.id,
              name: "",
              error: "Error en la extracción",
            }
          }
        })

        const results = await Promise.allSettled(extractionPromises)

        setStudentGroups((prev) =>
          prev.map((group) => {
            const result = results.find((r) => r.status === "fulfilled" && r.value.groupId === group.id)

            if (result && result.status === "fulfilled") {
              return {
                ...group,
                studentName: result.value.name,
                isExtractingName: false,
                extractionError: result.value.error,
              }
            }

            return {
              ...group,
              isExtractingName: false,
              extractionError: "Error desconocido en la extracción",
            }
          }),
        )
      }
    } catch (error) {
      console.error("Error in grouping mode selection:", error)
      alert("Error al organizar los archivos. Por favor, inténtalo de nuevo.")
    } finally {
      setIsLoading(false)
      setWorkflowStep("ready")
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
      isExtractingName: false,
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

    if (!draggedFileObj || sourceGroupId === targetGroupId) {
      setDraggedFile(null)
      return
    }

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

  const evaluateDocuments = async () => {
    if (studentGroups.length === 0) {
      alert("Por favor, organiza los archivos por estudiante primero.")
      return
    }

    if (!currentEvaluation.rubrica.trim()) {
      alert("Por favor, proporciona una rúbrica de evaluación.")
      return
    }

    const validGroups = studentGroups.filter((group) => group.files.length > 0)
    const groupsWithoutNames = validGroups.filter((group) => !group.studentName.trim())

    if (groupsWithoutNames.length > 0) {
      alert("Por favor, asegúrate de que todos los grupos tengan un nombre de estudiante.")
      return
    }

    setIsLoading(true)
    setEvaluationProgress({
      total: validGroups.length,
      completed: 0,
      current: "Iniciando evaluación...",
      successes: 0,
      failures: 0,
      currentStudent: "",
    })

    try {
      const evaluationPromises = validGroups.map(async (group, index) => {
        const studentName = group.studentName.trim()

        setEvaluationProgress((prev) =>
          prev
            ? {
                ...prev,
                current: `Evaluando a ${studentName}... (${index + 1}/${validGroups.length})`,
                currentStudent: studentName,
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

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const result = await response.json()

          setEvaluationProgress((prev) =>
            prev
              ? {
                  ...prev,
                  completed: prev.completed + 1,
                  successes: result.success ? prev.successes + 1 : prev.successes,
                  failures: result.success ? prev.failures : prev.failures + 1,
                  current: `Completado: ${studentName}`,
                }
              : null,
          )

          if (result.success && result.evaluations?.length > 0) {
            const evaluation = result.evaluations[0]
            evaluation.nombreEstudiante = studentName
            evaluation.filesPreviews = group.files
            evaluation.fecha = new Date().toISOString()

            if (typeof evaluation.notaFinal === "undefined") {
              evaluation.notaFinal = 1.0
            }
            if (typeof evaluation.puntajeObtenido === "undefined") {
              evaluation.puntajeObtenido = 0
            }

            return { success: true, evaluation, groupName: studentName }
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
                  current: `Error en: ${studentName}`,
                }
              : null,
          )

          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            groupName: studentName,
          }
        }
      })

      const results = await Promise.allSettled(evaluationPromises)

      const successfulEvaluations: StudentEvaluation[] = []
      const failedEvaluations: string[] = []

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          if (result.value.success) {
            successfulEvaluations.push(result.value.evaluation)
          } else {
            failedEvaluations.push(`${result.value.groupName}: ${result.value.error}`)
          }
        } else {
          failedEvaluations.push(`Error desconocido en evaluación ${index + 1}: ${result.reason}`)
        }
      })

      if (successfulEvaluations.length > 0) {
        saveEvaluations(successfulEvaluations)
        setActiveTab("results")
      }

      const successCount = successfulEvaluations.length
      const failureCount = failedEvaluations.length
      const total = successCount + failureCount

      let message = `✅ Evaluación completada!\n\n`
      message += `📊 Resumen:\n`
      message += `• Total procesado: ${total}\n`
      message += `• Éxitos: ${successCount}\n`
      message += `• Fallos: ${failureCount}\n`

      if (failedEvaluations.length > 0) {
        message += `\n❌ Errores encontrados:\n`
        message += failedEvaluations.slice(0, 3).join("\n")
        if (failedEvaluations.length > 3) {
          message += `\n... y ${failedEvaluations.length - 3} errores más.`
        }
      }

      alert(message)

      if (successCount > 0) {
        resetWorkflow()
      }
    } catch (error) {
      console.error("Critical error during evaluation:", error)
      alert(`❌ Error crítico durante la evaluación: ${error instanceof Error ? error.message : "Error desconocido"}`)
    } finally {
      setIsLoading(false)
      setEvaluationProgress(null)
    }
  }

  const evaluateProcessTask = async (studentName: string, evidences: FilePreview[]) => {
    if (!studentName.trim() || evidences.length === 0) {
      alert("Por favor, selecciona un estudiante y sube evidencias.")
      return
    }

    if (!processEvaluationForm.tipoActividad.trim() || !processEvaluationForm.objetivos.trim()) {
      alert("Por favor, completa el tipo de actividad y los objetivos.")
      return
    }

    setIsLoading(true)

    try {
      const formData = new FormData()
      evidences.forEach((evidence) => {
        formData.append("files", evidence.file)
      })

      const evaluationConfig = {
        ...config,
        nombrePrueba: processEvaluationForm.tipoActividad,
        curso: currentEvaluation.curso,
        rubrica: `Objetivos: ${processEvaluationForm.objetivos}\nHabilidades: ${processEvaluationForm.habilidades}\nOA: ${processEvaluationForm.oa}`,
        preguntasObjetivas: "",
      }

      formData.append("config", JSON.stringify(evaluationConfig))

      const response = await fetch("/api/evaluate", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success && result.evaluations?.length > 0) {
        const evaluation = result.evaluations[0]

        const processEvaluation: ProcessEvaluation = {
          id: `process_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          nombreEstudiante: studentName,
          fecha: new Date().toISOString(),
          tipoActividad: processEvaluationForm.tipoActividad,
          objetivos: processEvaluationForm.objetivos,
          habilidades: processEvaluationForm.habilidades,
          oa: processEvaluationForm.oa,
          evidencias: evidences,
          feedback: evaluation.feedback_estudiante?.resumen || "",
          puntaje: evaluation.puntajeObtenido || 0,
          observaciones: processEvaluationForm.observaciones,
        }

        setProcessEvaluations((prev) => {
          const updated = [...prev, processEvaluation]
          localStorage.setItem("genius-process-evaluations", JSON.stringify(updated))
          return updated
        })

        // Update student folder
        setStudentFolders((prev) => {
          const updatedFolders = prev.map((folder) => {
            if (folder.nombreEstudiante === studentName) {
              return {
                ...folder,
                evaluacionesProceso: [...folder.evaluacionesProceso, processEvaluation],
                ultimaActividad: new Date().toISOString(),
              }
            }
            return folder
          })
          localStorage.setItem("genius-student-folders", JSON.stringify(updatedFolders))
          return updatedFolders
        })

        alert(`✅ Evaluación de proceso guardada para ${studentName}`)

        // Reset form
        setProcessEvaluationForm({
          tipoActividad: "",
          objetivos: "",
          habilidades: "",
          oa: "",
          observaciones: "",
        })
      } else {
        throw new Error(result.error || "Process evaluation failed")
      }
    } catch (error) {
      console.error("Error in process evaluation:", error)
      alert(`❌ Error en la evaluación de proceso: ${error instanceof Error ? error.message : "Error desconocido"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const getSortedGradesData = (): GradesSyncData[] => {
    const gradesData: GradesSyncData[] = evaluations.map((evaluation) => ({
      estudiante: evaluation.nombreEstudiante,
      evaluacion: evaluation.nombrePrueba,
      nota: evaluation.notaFinal,
      fecha: evaluation.fecha || evaluation.configuracion.fecha,
      curso: evaluation.curso,
      profesor: evaluation.configuracion.nombreProfesor || "No especificado",
    }))

    switch (sortOrder) {
      case "alfabetico":
        return gradesData.sort((a, b) => a.estudiante.localeCompare(b.estudiante))
      case "nota_desc":
        return gradesData.sort((a, b) => b.nota - a.nota)
      case "nota_asc":
        return gradesData.sort((a, b) => a.nota - b.nota)
      case "fecha_desc":
        return gradesData.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      case "fecha_asc":
        return gradesData.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
      case "personalizado":
        if (customOrder.length > 0) {
          return gradesData.sort((a, b) => {
            const indexA = customOrder.indexOf(a.estudiante)
            const indexB = customOrder.indexOf(b.estudiante)
            if (indexA === -1 && indexB === -1) return 0
            if (indexA === -1) return 1
            if (indexB === -1) return -1
            return indexA - indexB
          })
        }
        return gradesData
      default:
        return gradesData
    }
  }

  const exportToCSV = () => {
    if (evaluations.length === 0) {
      alert("No hay datos para exportar.")
      return
    }

    const sortedData = getSortedGradesData()
    const headers = ["Estudiante", "Curso", "Evaluación", "Nota Final", "Puntaje", "Fecha", "Profesor"]
    const rows = sortedData.map((data) => [
      data.estudiante,
      data.curso,
      data.evaluacion,
      data.nota.toFixed(1),
      `${evaluations.find((e) => e.nombreEstudiante === data.estudiante && e.nombrePrueba === data.evaluacion)?.puntajeObtenido || 0}/${evaluations.find((e) => e.nombreEstudiante === data.estudiante && e.nombrePrueba === data.evaluacion)?.configuracion.puntajeMaximo || 0}`,
      new Date(data.fecha).toLocaleDateString("es-CL"),
      data.profesor,
    ])

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `evaluaciones_${sortOrder}_${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = async () => {
    if (evaluations.length === 0) {
      alert("No hay datos para copiar.")
      return
    }

    const sortedData = getSortedGradesData()
    const headers = ["Estudiante", "Curso", "Evaluación", "Nota Final"]
    const rows = sortedData.map((data) => [data.estudiante, data.curso, data.evaluacion, data.nota.toFixed(1)])

    const tsvContent = [headers, ...rows].map((row) => row.join("\t")).join("\n")

    try {
      await navigator.clipboard.writeText(tsvContent)
      alert("✅ Datos copiados al portapapeles (formato compatible con sistemas escolares)")
    } catch (error) {
      console.error("Error copying to clipboard:", error)
      alert("❌ Error al copiar los datos")
    }
  }

  const clearHistory = () => {
    if (confirm("¿Estás seguro de que quieres borrar PERMANENTEMENTE todo el historial de evaluaciones?")) {
      setEvaluations([])
      setStudentFolders([])
      setProcessEvaluations([])
      localStorage.removeItem("genius-evaluations")
      localStorage.removeItem("genius-student-folders")
      localStorage.removeItem("genius-process-evaluations")
      alert("✅ Historial eliminado correctamente")
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
      className={`relative border-2 border-dashed border-gray-300 rounded-lg p-3 bg-white transition-all duration-200 ${
        isDraggable ? "cursor-move hover:border-blue-400 hover:shadow-md" : ""
      } ${draggedFile === filePreview.id ? "opacity-50 scale-95" : ""}`}
      draggable={isDraggable}
      onDragStart={() => isDraggable && handleDragStart(filePreview.id)}
    >
      <div className="flex flex-col items-center space-y-2">
        {filePreview.type === "image" && filePreview.preview ? (
          <img
            src={filePreview.preview || "/placeholder.svg"}
            alt={filePreview.file.name}
            className="w-20 h-20 object-cover rounded border"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = "none"
              target.nextElementSibling?.classList.remove("hidden")
            }}
          />
        ) : filePreview.type === "pdf" ? (
          <FileIcon className="w-20 h-20 text-red-500" />
        ) : (
          <FileText className="w-20 h-20 text-gray-500" />
        )}

        <span className="text-xs text-center truncate w-full font-medium" title={filePreview.file.name}>
          {filePreview.file.name}
        </span>

        <div className="text-xs text-gray-500 text-center">{formatFileSize(filePreview.file.size)}</div>

        {filePreview.isCompressed && (
          <div className="text-xs text-green-600 text-center flex items-center gap-1">
            <Zap className="w-3 h-3" />
            Optimizada
          </div>
        )}
      </div>

      {showRemove && (
        <button
          onClick={() => removeFilePreview(filePreview.id)}
          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
          title="Eliminar archivo"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {isDraggable && (
        <div className="absolute top-1 left-1 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
          <Move className="w-3 h-3" />
        </div>
      )}
    </div>
  )

  const StudentFeedbackTab = ({ evaluation }: { evaluation: StudentEvaluation }) => (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center">
        <div className="inline-flex items-center gap-6 bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 rounded-xl border-2 border-blue-200">
          <div className="text-center">
            <div className="text-sm text-gray-600 mb-2">Tu Calificación Final</div>
            <Badge variant="secondary" className="text-4xl px-8 py-4 bg-blue-600 text-white font-bold">
              {evaluation.notaFinal ? evaluation.notaFinal.toFixed(1) : "N/A"}
            </Badge>
            <div className="text-xs text-gray-500 mt-2">
              {evaluation.puntajeObtenido || 0} de {evaluation.configuracion.puntajeMaximo} puntos
            </div>
          </div>
        </div>
      </div>

      {/* Evidence Gallery */}
      {evaluation.filesPreviews && evaluation.filesPreviews.length > 0 && (
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FileImage className="w-5 h-5" />📸 Evidencias Evaluadas
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {evaluation.filesPreviews.map((file) => (
              <div key={file.id} className="border rounded-lg p-2 bg-white">
                {file.type === "image" && file.preview ? (
                  <img
                    src={file.preview || "/placeholder.svg"}
                    alt={file.file.name}
                    className="w-full h-24 object-cover rounded"
                  />
                ) : (
                  <div className="w-full h-24 bg-gray-200 rounded flex items-center justify-center">
                    <FileIcon className="w-8 h-8 text-gray-500" />
                  </div>
                )}
                <p className="text-xs text-gray-600 mt-1 truncate">{file.file.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-400">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5" />📋 Resumen de tu Evaluación
        </h3>
        <p className="text-blue-800 leading-relaxed">
          {evaluation.feedback_estudiante?.resumen || "Sin resumen disponible"}
        </p>
      </div>

      <div>
        <h3 className="font-semibold text-green-700 mb-4 flex items-center gap-2 text-lg">
          <CheckCircle className="w-6 h-6" />🌟 Tus Principales Fortalezas
        </h3>
        <div className="space-y-4">
          {evaluation.feedback_estudiante?.fortalezas?.slice(0, 3).map((fortaleza: any, index: number) => (
            <div key={index} className="bg-green-50 p-5 rounded-lg border-l-4 border-green-400">
              <p className="font-medium text-green-800 mb-2">{fortaleza.descripcion}</p>
              <p className="text-sm text-green-700 italic">"{fortaleza.cita}"</p>
              {fortaleza.habilidad_demostrada && (
                <p className="text-xs text-green-600 mt-2">
                  <strong>Habilidad demostrada:</strong> {fortaleza.habilidad_demostrada}
                </p>
              )}
            </div>
          )) || (
            <p className="text-gray-500 italic bg-gray-50 p-4 rounded-lg">
              No se identificaron fortalezas específicas en esta evaluación.
            </p>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-orange-700 mb-4 flex items-center gap-2 text-lg">
          <Target className="w-6 h-6" />🎯 Áreas para Crecer
        </h3>
        <div className="space-y-4">
          {evaluation.feedback_estudiante?.oportunidades?.slice(0, 3).map((oportunidad: any, index: number) => (
            <div key={index} className="bg-orange-50 p-5 rounded-lg border-l-4 border-orange-400">
              <p className="font-medium text-orange-800 mb-2">{oportunidad.descripcion}</p>
              <p className="text-sm text-orange-700 italic mb-3">"{oportunidad.cita}"</p>
              {oportunidad.sugerencia_tecnica && (
                <div className="mt-3 p-3 bg-blue-100 rounded-md">
                  <strong className="text-blue-800 text-sm">💡 Consejo para mejorar:</strong>
                  <p className="text-blue-700 text-sm mt-1">{oportunidad.sugerencia_tecnica}</p>
                </div>
              )}
            </div>
          )) || (
            <p className="text-gray-500 italic bg-gray-50 p-4 rounded-lg">
              No se identificaron áreas específicas de mejora.
            </p>
          )}
        </div>
      </div>

      {evaluation.feedback_estudiante?.siguiente_paso_sugerido && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg border-l-4 border-purple-400">
          <h3 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
            <Brain className="w-5 h-5" />🎯 Tu Próximo Desafío
          </h3>
          <p className="text-purple-700 leading-relaxed">{evaluation.feedback_estudiante.siguiente_paso_sugerido}</p>
        </div>
      )}

      {/* Download Feedback Button */}
      <div className="text-center pt-4 border-t">
        <Button
          onClick={() => generateStudentFeedbackReport(evaluation, config.logoUrl)}
          variant="outline"
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Descargar Feedback para Prueba Física
        </Button>
        <p className="text-xs text-gray-500 mt-2">Formato optimizado para pegar en evaluaciones físicas</p>
      </div>
    </div>
  )

  const TeacherAnalysisTab = ({ evaluation }: { evaluation: StudentEvaluation }) => (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Eye className="w-6 h-6" />📊 Panorámica General
        </h2>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-green-50 p-5 rounded-lg border border-green-200">
            <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Puntos Más Altos
            </h4>
            <ul className="text-sm text-green-700 space-y-2">
              {evaluation.feedback_estudiante?.fortalezas?.slice(0, 4).map((f: any, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{f.descripcion}</span>
                </li>
              )) || <li className="italic text-green-600">No se identificaron puntos altos específicos.</li>}
            </ul>
          </div>

          <div className="bg-red-50 p-5 rounded-lg border border-red-200">
            <h4 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              Puntos Más Bajos
            </h4>
            <ul className="text-sm text-red-700 space-y-2">
              {evaluation.feedback_estudiante?.oportunidades?.slice(0, 4).map((o: any, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span>{o.descripcion}</span>
                </li>
              )) || <li className="italic text-red-600">No se identificaron puntos bajos específicos.</li>}
            </ul>
          </div>
        </div>

        {evaluation.analisis_profesor && (
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-700 mb-4">📝 Observaciones Generales</h4>
            <div className="space-y-4 text-sm">
              <div>
                <strong className="text-gray-800">Desempeño General:</strong>
                <p className="text-gray-600 mt-1 leading-relaxed">{evaluation.analisis_profesor.desempeno_general}</p>
              </div>
              <div>
                <strong className="text-gray-800">Patrones Observados:</strong>
                <p className="text-gray-600 mt-1 leading-relaxed">{evaluation.analisis_profesor.patrones_observados}</p>
              </div>
              <div>
                <strong className="text-gray-800">Sugerencia Pedagógica:</strong>
                <p className="text-gray-600 mt-1 leading-relaxed">
                  {evaluation.analisis_profesor.sugerencia_pedagogica}
                </p>
              </div>
              {evaluation.analisis_profesor.proyeccion_desarrollo && (
                <div>
                  <strong className="text-gray-800">Proyección de Desarrollo:</strong>
                  <p className="text-gray-600 mt-1 leading-relaxed">
                    {evaluation.analisis_profesor.proyeccion_desarrollo}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div>
        <h2 className="text-xl font-bold text-purple-700 mb-4 flex items-center gap-2">
          <Brain className="w-6 h-6" />🧠 Análisis de Habilidades
        </h2>
        <div className="grid gap-4">
          {evaluation.habilidades_identificadas && Object.keys(evaluation.habilidades_identificadas).length > 0 ? (
            Object.entries(evaluation.habilidades_identificadas).map(([habilidad, datos]: [string, any]) => (
              <div key={habilidad} className="border border-gray-200 rounded-lg p-5 bg-white">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-semibold text-gray-900 text-lg">{habilidad}</h4>
                  <Badge
                    variant={
                      datos.nivel === "Destacado" ? "default" : datos.nivel === "Competente" ? "secondary" : "outline"
                    }
                    className="text-sm px-3 py-1"
                  >
                    {datos.nivel}
                  </Badge>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-green-700">📍 Evidencia Específica:</span>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">{datos.evidencia_especifica}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-blue-700">🎯 Justificación Pedagógica:</span>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">{datos.justificacion_pedagogica}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 italic bg-gray-50 p-4 rounded-lg">
              No se registraron habilidades específicas en esta evaluación.
            </p>
          )}
        </div>
      </div>

      <Separator />

      <div>
        <h2 className="text-xl font-bold text-blue-700 mb-4 flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />📋 Evaluación por Rúbrica
        </h2>
        <div className="space-y-4">
          {evaluation.analisis_detallado?.map((criterio: any, index: number) => (
            <div key={index} className="border border-gray-200 rounded-lg p-5 bg-white">
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-semibold text-gray-900 text-lg">{criterio.criterio}</h4>
                <Badge variant="outline" className="font-mono text-base px-3 py-1">
                  {criterio.puntaje}
                </Badge>
              </div>
              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-green-700">✅ Evidencia Encontrada:</span>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{criterio.evidencia}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-blue-700">⚖️ Justificación del Puntaje:</span>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{criterio.justificacion}</p>
                </div>
              </div>
            </div>
          )) || (
            <p className="text-gray-500 italic bg-gray-50 p-4 rounded-lg">
              No se registró análisis detallado por criterios de rúbrica.
            </p>
          )}
        </div>
      </div>
    </div>
  )

  const StudentFolderView = ({ folder }: { folder: StudentFolder }) => (
    <div className="space-y-6">
      {/* Student Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
              {folder.nombreEstudiante
                .split(" ")
                .map((n) => n[0])
                .join("")
                .substring(0, 2)}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{folder.nombreEstudiante}</h2>
              <p className="text-gray-600">Promedio General: {folder.promedioGeneral.toFixed(1)}</p>
              <div className="flex items-center gap-2 mt-1">
                {folder.tendencia === "up" && <TrendingUp className="w-4 h-4 text-green-500" />}
                {folder.tendencia === "down" && <TrendingDown className="w-4 h-4 text-red-500" />}
                {folder.tendencia === "stable" && <Activity className="w-4 h-4 text-gray-500" />}
                <span className="text-sm text-gray-600">
                  Última actividad: {new Date(folder.ultimaActividad).toLocaleDateString("es-CL")}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <Badge variant={folder.alertas.filter((a) => !a.resuelto).length > 0 ? "destructive" : "secondary"}>
              {folder.alertas.filter((a) => !a.resuelto).length} Alertas
            </Badge>
          </div>
        </div>

        {/* Alerts */}
        {folder.alertas.filter((a) => !a.resuelto).length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-red-700 flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Alertas Activas
            </h4>
            {folder.alertas
              .filter((a) => !a.resuelto)
              .slice(0, 3)
              .map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border-l-4 ${
                    alert.tipo === "danger"
                      ? "bg-red-50 border-red-400"
                      : alert.tipo === "warning"
                        ? "bg-yellow-50 border-yellow-400"
                        : "bg-blue-50 border-blue-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{alert.mensaje}</p>
                    <Badge variant="outline" className="text-xs">
                      {alert.prioridad}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{new Date(alert.fecha).toLocaleDateString("es-CL")}</p>
                </div>
              ))}
          </div>
        )}
      </div>

      <Tabs defaultValue="evaluaciones" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="evaluaciones">Evaluaciones ({folder.evaluaciones.length})</TabsTrigger>
          <TabsTrigger value="proceso">Proceso ({folder.evaluacionesProceso.length})</TabsTrigger>
          <TabsTrigger value="documentos">Documentos ({folder.documentosAdministrativos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="evaluaciones" className="space-y-4">
          {folder.evaluaciones.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">No hay evaluaciones registradas</p>
            </div>
          ) : (
            folder.evaluaciones.map((evaluation) => (
              <Card key={evaluation.id} className="border-l-4 border-l-blue-500">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{evaluation.nombrePrueba}</h3>
                      <p className="text-gray-600 text-sm">{evaluation.curso}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(evaluation.fecha || evaluation.configuracion.fecha).toLocaleDateString("es-CL")}
                      </p>
                    </div>
                    <div className="text-center">
                      <Badge variant="secondary" className="text-lg px-3 py-1 font-bold">
                        {evaluation.notaFinal.toFixed(1)}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {evaluation.puntajeObtenido}/{evaluation.configuracion.puntajeMaximo}
                      </p>
                    </div>
                  </div>

                  {/* Evidence thumbnails */}
                  {evaluation.filesPreviews && evaluation.filesPreviews.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Evidencias:</p>
                      <div className="flex gap-2 overflow-x-auto">
                        {evaluation.filesPreviews.slice(0, 4).map((file) => (
                          <div key={file.id} className="flex-shrink-0">
                            {file.type === "image" && file.preview ? (
                              <img
                                src={file.preview || "/placeholder.svg"}
                                alt={file.file.name}
                                className="w-16 h-16 object-cover rounded border"
                              />
                            ) : (
                              <div className="w-16 h-16 bg-gray-200 rounded border flex items-center justify-center">
                                <FileIcon className="w-6 h-6 text-gray-500" />
                              </div>
                            )}
                          </div>
                        ))}
                        {evaluation.filesPreviews.length > 4 && (
                          <div className="w-16 h-16 bg-gray-100 rounded border flex items-center justify-center">
                            <span className="text-xs text-gray-600">+{evaluation.filesPreviews.length - 4}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div>
                      <h4 className="font-medium text-green-700 text-sm">Fortaleza Principal:</h4>
                      <p className="text-sm text-gray-600">
                        {evaluation.feedback_estudiante?.fortalezas?.[0]?.descripcion || "Sin fortalezas registradas"}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Completo
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center justify-between">
                            <span>
                              {evaluation.nombrePrueba} - {evaluation.nombreEstudiante}
                            </span>
                            <Button
                              onClick={() => generatePrintableReport(evaluation, config.logoUrl)}
                              variant="outline"
                              size="sm"
                            >
                              <Printer className="w-4 h-4 mr-2" />
                              Imprimir
                            </Button>
                          </DialogTitle>
                        </DialogHeader>
                        <Tabs defaultValue="student">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="student">Para el Estudiante</TabsTrigger>
                            <TabsTrigger value="teacher">Análisis del Profesor</TabsTrigger>
                          </TabsList>
                          <TabsContent value="student">
                            <StudentFeedbackTab evaluation={evaluation} />
                          </TabsContent>
                          <TabsContent value="teacher">
                            <TeacherAnalysisTab evaluation={evaluation} />
                          </TabsContent>
                        </Tabs>
                      </DialogContent>
                    </Dialog>
                    <Button
                      onClick={() => generateStudentFeedbackReport(evaluation, config.logoUrl)}
                      variant="outline"
                      size="sm"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Feedback
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="proceso" className="space-y-4">
          {folder.evaluacionesProceso.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">No hay evaluaciones de proceso registradas</p>
            </div>
          ) : (
            folder.evaluacionesProceso.map((processEval) => (
              <Card key={processEval.id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{processEval.tipoActividad}</h3>
                      <p className="text-xs text-gray-500">{new Date(processEval.fecha).toLocaleDateString("es-CL")}</p>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {processEval.puntaje} pts
                    </Badge>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <strong className="text-gray-700">Objetivos:</strong>
                      <p className="text-gray-600">{processEval.objetivos}</p>
                    </div>
                    <div>
                      <strong className="text-gray-700">Habilidades:</strong>
                      <p className="text-gray-600">{processEval.habilidades}</p>
                    </div>
                    {processEval.oa && (
                      <div>
                        <strong className="text-gray-700">OA:</strong>
                        <p className="text-gray-600">{processEval.oa}</p>
                      </div>
                    )}
                    <div>
                      <strong className="text-gray-700">Feedback:</strong>
                      <p className="text-gray-600">{processEval.feedback}</p>
                    </div>
                  </div>

                  {processEval.evidencias.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Evidencias:</p>
                      <div className="flex gap-2 overflow-x-auto">
                        {processEval.evidencias.map((evidence) => (
                          <div key={evidence.id} className="flex-shrink-0">
                            {evidence.type === "image" && evidence.preview ? (
                              <img
                                src={evidence.preview || "/placeholder.svg"}
                                alt={evidence.file.name}
                                className="w-16 h-16 object-cover rounded border"
                              />
                            ) : (
                              <div className="w-16 h-16 bg-gray-200 rounded border flex items-center justify-center">
                                <FileIcon className="w-6 h-6 text-gray-500" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="documentos" className="space-y-4">
          {folder.documentosAdministrativos.length === 0 ? (
            <div className="text-center py-8">
              <Archive className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">No hay documentos administrativos</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {folder.documentosAdministrativos.map((doc) => (
                <div key={doc.id} className="border rounded-lg p-4 text-center">
                  {doc.type === "image" && doc.preview ? (
                    <img
                      src={doc.preview || "/placeholder.svg"}
                      alt={doc.file.name}
                      className="w-full h-24 object-cover rounded mb-2"
                    />
                  ) : (
                    <div className="w-full h-24 bg-gray-200 rounded mb-2 flex items-center justify-center">
                      <FileIcon className="w-8 h-8 text-gray-500" />
                    </div>
                  )}
                  <p className="text-xs text-gray-600 truncate">{doc.file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(doc.file.size)}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">✨ Genius Evaluator X</h1>
          <p className="text-gray-600">Sistema de Evaluación Inteligente con IA - Versión Profesional</p>
          <Badge variant="secondary" className="mt-2">
            <Zap className="w-3 h-3 mr-1" />
            Evaluación Paralela Optimizada
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="evaluate" className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Evaluar
            </TabsTrigger>
            <TabsTrigger value="process" className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Proceso
            </TabsTrigger>
            <TabsTrigger value="folders" className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Carpetas ({studentFolders.length})
            </TabsTrigger>
            <TabsTrigger value="administrative" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Administrativo
            </TabsTrigger>
            <TabsTrigger value="sync" className="flex items-center gap-2">
              <LineChart className="w-4 h-4" />
              Sincronización
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Resultados ({evaluations.length})
            </TabsTrigger>
          </TabsList>

          {/* EVALUATE TAB */}
          <TabsContent value="evaluate" className="space-y-6">
            {evaluationProgress && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Evaluación en Progreso
                      </h3>
                      <Badge variant="secondary">
                        {evaluationProgress.completed}/{evaluationProgress.total}
                      </Badge>
                    </div>
                    <Progress
                      value={(evaluationProgress.completed / evaluationProgress.total) * 100}
                      className="w-full h-3"
                    />
                    <div className="space-y-2">
                      <p className="text-sm text-blue-700 font-medium">{evaluationProgress.current}</p>
                      {evaluationProgress.currentStudent && (
                        <p className="text-xs text-blue-600">Procesando: {evaluationProgress.currentStudent}</p>
                      )}
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Éxitos: {evaluationProgress.successes}
                      </span>
                      <span className="text-red-600 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        Fallos: {evaluationProgress.failures}
                      </span>
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
                    <Label htmlFor="nombre-prueba">Nombre de la Evaluación *</Label>
                    <Input
                      id="nombre-prueba"
                      value={currentEvaluation.nombrePrueba}
                      onChange={(e) => setCurrentEvaluation((prev) => ({ ...prev, nombrePrueba: e.target.value }))}
                      placeholder="Ej: Ensayo Final - La Célula"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="curso">Curso *</Label>
                    <Input
                      id="curso"
                      value={currentEvaluation.curso}
                      onChange={(e) => setCurrentEvaluation((prev) => ({ ...prev, curso: e.target.value }))}
                      placeholder="Ej: 3ro Medio A"
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Configuración de Evaluación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium text-gray-700 mb-4 flex items-center gap-2">
                    <UserCheck className="w-4 h-4" />
                    Personalización de Reportes
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nombre-profesor">Nombre del Profesor</Label>
                      <Input
                        id="nombre-profesor"
                        value={config.nombreProfesor}
                        onChange={(e) => setConfig((prev) => ({ ...prev, nombreProfesor: e.target.value }))}
                        placeholder="Ej: Prof. María González"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="departamento">Departamento o Asignatura</Label>
                      <Input
                        id="departamento"
                        value={config.departamento}
                        onChange={(e) => setConfig((prev) => ({ ...prev, departamento: e.target.value }))}
                        placeholder="Ej: Ciencias Naturales"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="logo-upload">Logo Institucional</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          id="logo-upload"
                        />
                        <Button
                          variant="outline"
                          onClick={() => logoInputRef.current?.click()}
                          className="flex items-center gap-2"
                        >
                          <ImageIcon className="w-4 h-4" />
                          Subir Logo
                        </Button>
                        {config.logoUrl && (
                          <div className="flex items-center gap-2">
                            <img
                              src={config.logoUrl || "/placeholder.svg"}
                              alt="Logo"
                              className="w-8 h-8 object-cover rounded border"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setConfig((prev) => ({ ...prev, logoUrl: undefined, logoFile: undefined }))
                              }
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Formatos: JPG, PNG, GIF, WebP (se optimizará automáticamente)
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium text-gray-700 mb-4">Configuración Técnica</h4>
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
                          <SelectItem value="latam_1_10">LATAM Estándar (1 - 10)</SelectItem>
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
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Modelo de IA para Evaluación</Label>
                    <Select
                      value={config.aiModel}
                      onValueChange={(value) => setConfig((prev) => ({ ...prev, aiModel: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mistral-small-latest">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-green-500" />
                            <div>
                              <div className="font-medium">Rápido (Mistral Small)</div>
                              <div className="text-xs text-gray-500">Evaluaciones veloces</div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="mistral-large-latest">
                          <div className="flex items-center gap-2">
                            <Brain className="w-4 h-4 text-blue-500" />
                            <div>
                              <div className="font-medium">Detallado (Mistral Large)</div>
                              <div className="text-xs text-gray-500">Análisis profundo</div>
                            </div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-gray-500">
                      {config.aiModel === "mistral-small-latest" && "⚡ Evaluaciones más rápidas con excelente calidad"}
                      {config.aiModel === "mistral-large-latest" && "🧠 Análisis más profundo y detallado (más lento)"}
                    </p>
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
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cargar y Organizar Documentos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {workflowStep === "upload" && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                    <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600 mb-4">Arrastra archivos aquí o haz clic para seleccionar</p>
                    <div className="flex gap-4 justify-center">
                      <Input
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                        disabled={isLoading}
                      />
                      <Label htmlFor="file-upload" className="cursor-pointer">
                        <Button variant="outline" asChild disabled={isLoading}>
                          <span className="flex items-center gap-2">
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            Seleccionar Archivos
                          </span>
                        </Button>
                      </Label>
                      <Button
                        variant="outline"
                        className="flex items-center gap-2 bg-transparent"
                        onClick={() => setIsCameraModalOpen(true)}
                        disabled={isLoading}
                      >
                        <Camera className="w-4 h-4" />
                        Usar Cámara Inteligente
                        <Badge variant="secondary" className="ml-1">
                          <Zap className="w-3 h-3 mr-1" />
                          IA
                        </Badge>
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-4">Formatos soportados: JPG, PNG, PDF, DOC, DOCX, TXT</p>
                  </div>
                )}

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="optimize-images" className="text-sm font-medium">
                      Optimizar Imágenes
                    </Label>
                    <p className="text-xs text-gray-500">
                      Reduce automáticamente el tamaño de las imágenes para acelerar el procesamiento
                    </p>
                  </div>
                  <Switch
                    id="optimize-images"
                    checked={optimizeImages}
                    onCheckedChange={setOptimizeImages}
                    disabled={isLoading}
                  />
                </div>

                {workflowStep === "grouping" && filePreviews.length > 0 && (
                  <div className="space-y-6">
                    <div>
                      <Label className="text-sm font-medium mb-3 block">
                        Archivos Cargados ({filePreviews.length}):
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {filePreviews.map((filePreview) => (
                          <FilePreviewCard key={filePreview.id} filePreview={filePreview} isDraggable={false} />
                        ))}
                      </div>
                    </div>

                    <Alert className="border-blue-200 bg-blue-50">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription>
                        <div className="space-y-4">
                          <p className="font-medium text-blue-900">¿Estos archivos son para...?</p>
                          <RadioGroup
                            value={groupingMode || ""}
                            onValueChange={(value) => handleGroupingModeSelect(value as GroupingMode)}
                            className="space-y-3"
                            disabled={isLoading}
                          >
                            <div className="flex items-center space-x-3 p-3 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                              <RadioGroupItem value="single" id="single" />
                              <Label htmlFor="single" className="flex items-center gap-2 cursor-pointer flex-1">
                                <User className="w-4 h-4" />
                                <div>
                                  <div className="font-medium">Un Solo Estudiante</div>
                                  <div className="text-xs text-gray-600">
                                    Todos los archivos pertenecen al mismo estudiante
                                  </div>
                                </div>
                              </Label>
                            </div>
                            <div className="flex items-center space-x-3 p-3 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                              <RadioGroupItem value="multiple" id="multiple" />
                              <Label htmlFor="multiple" className="flex items-center gap-2 cursor-pointer flex-1">
                                <Users className="w-4 h-4" />
                                <div>
                                  <div className="font-medium">Varios Estudiantes</div>
                                  <div className="text-xs text-gray-600">
                                    Cada archivo pertenece a un estudiante diferente
                                  </div>
                                </div>
                              </Label>
                            </div>
                          </RadioGroup>
                          {isLoading && (
                            <div className="flex items-center gap-2 text-blue-600">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="text-sm">Organizando archivos y extrayendo nombres...</span>
                            </div>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {(workflowStep === "organized" || workflowStep === "ready") && studentGroups.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-medium">
                        Organización por Estudiante ({studentGroups.length}):
                      </Label>
                      {groupingMode === "multiple" && (
                        <Button onClick={addNewStudentGroup} variant="outline" size="sm" disabled={isLoading}>
                          <Plus className="w-4 h-4 mr-2" />
                          Nuevo Estudiante
                        </Button>
                      )}
                    </div>

                    {studentGroups.map((group) => (
                      <div
                        key={group.id}
                        className="border rounded-lg p-4 bg-gray-50 transition-colors hover:bg-gray-100"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, group.id)}
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className="flex-1">
                            <Label htmlFor={`student-${group.id}`}>Nombre del Estudiante *</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                id={`student-${group.id}`}
                                value={group.studentName}
                                onChange={(e) => updateStudentName(group.id, e.target.value)}
                                placeholder="Nombre del estudiante..."
                                className="flex-1"
                                disabled={group.isExtractingName}
                                required
                              />
                              {group.isExtractingName && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                            </div>
                            {group.extractionError && (
                              <p className="text-xs text-orange-600 mt-1">{group.extractionError}</p>
                            )}
                          </div>
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <FileIcon className="w-3 h-3" />
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
                          {group.files.length === 0 && groupingMode === "multiple" && (
                            <div className="col-span-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
                              <Users className="w-8 h-8 mx-auto mb-2" />
                              <p className="text-sm">Arrastra archivos aquí</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
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
                  <Label htmlFor="rubrica">Rúbrica de Desarrollo *</Label>
                  <Textarea
                    id="rubrica"
                    value={currentEvaluation.rubrica}
                    onChange={(e) => setCurrentEvaluation((prev) => ({ ...prev, rubrica: e.target.value }))}
                    placeholder="Ej: Criterio 1: Identifica 3 causas principales (6 puntos). Criterio 2: Argumentación clara y coherente (4 puntos)..."
                    rows={6}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preguntas-objetivas">Preguntas Objetivas (Opcional)</Label>
                  <Textarea
                    id="preguntas-objetivas"
                    value={currentEvaluation.preguntasObjetivas}
                    onChange={(e) => setCurrentEvaluation((prev) => ({ ...prev, preguntasObjetivas: e.target.value }))}
                    placeholder="Ej: Pregunta 1 (V/F): La respuesta correcta es Verdadero (2 puntos). Pregunta 2: La respuesta correcta es 'Mitocondria' (3 puntos)..."
                    rows={4}
                  />
                </div>

                <Button
                  onClick={evaluateDocuments}
                  disabled={
                    isLoading ||
                    studentGroups.length === 0 ||
                    !currentEvaluation.rubrica.trim() ||
                    !currentEvaluation.nombrePrueba.trim() ||
                    !currentEvaluation.curso.trim() ||
                    studentGroups.some((group) => !group.studentName.trim() && group.files.length > 0)
                  }
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
                      Iniciar Evaluación Profesional
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PROCESS EVALUATION TAB */}
          <TabsContent value="process" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  Evaluación de Proceso - Tareas y Actividades
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="border-blue-200 bg-blue-50">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription>
                    <p className="font-medium text-blue-900 mb-2">Evaluación Continua de Proceso</p>
                    <p className="text-blue-800 text-sm">
                      Sube evidencias de tareas, trabajos en proceso y actividades para evaluar el progreso continuo de
                      cada estudiante. Cada evaluación se suma automáticamente a la carpeta del estudiante para
                      seguimiento integral.
                    </p>
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="tipo-actividad">Tipo de Actividad *</Label>
                      <Input
                        id="tipo-actividad"
                        value={processEvaluationForm.tipoActividad}
                        onChange={(e) =>
                          setProcessEvaluationForm((prev) => ({ ...prev, tipoActividad: e.target.value }))
                        }
                        placeholder="Ej: Tarea de Matemáticas - Fracciones"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="objetivos">Objetivos de la Actividad *</Label>
                      <Textarea
                        id="objetivos"
                        value={processEvaluationForm.objetivos}
                        onChange={(e) => setProcessEvaluationForm((prev) => ({ ...prev, objetivos: e.target.value }))}
                        placeholder="Ej: Resolver operaciones con fracciones, aplicar conceptos de equivalencia..."
                        rows={3}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="habilidades">Habilidades a Evaluar</Label>
                      <Textarea
                        id="habilidades"
                        value={processEvaluationForm.habilidades}
                        onChange={(e) => setProcessEvaluationForm((prev) => ({ ...prev, habilidades: e.target.value }))}
                        placeholder="Ej: Resolución de problemas, razonamiento matemático, comunicación..."
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="oa">Objetivos de Aprendizaje (OA)</Label>
                      <Input
                        id="oa"
                        value={processEvaluationForm.oa}
                        onChange={(e) => setProcessEvaluationForm((prev) => ({ ...prev, oa: e.target.value }))}
                        placeholder="Ej: OA 12 - Resolver problemas con fracciones"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="observaciones">Observaciones Adicionales</Label>
                      <Textarea
                        id="observaciones"
                        value={processEvaluationForm.observaciones}
                        onChange={(e) =>
                          setProcessEvaluationForm((prev) => ({ ...prev, observaciones: e.target.value }))
                        }
                        placeholder="Observaciones específicas sobre la actividad..."
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Subir Evidencias</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600 mb-2">Arrastra evidencias aquí</p>
                        <Input
                          type="file"
                          multiple
                          accept="image/*,.pdf"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="process-file-upload"
                          disabled={isLoading}
                        />
                        <Label htmlFor="process-file-upload" className="cursor-pointer">
                          <Button variant="outline" asChild disabled={isLoading} size="sm">
                            <span>Seleccionar Archivos</span>
                          </Button>
                        </Label>
                      </div>
                    </div>

                    {filePreviews.length > 0 && (
                      <div className="space-y-2">
                        <Label>Evidencias Cargadas ({filePreviews.length})</Label>
                        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                          {filePreviews.map((file) => (
                            <div key={file.id} className="relative">
                              <FilePreviewCard filePreview={file} isDraggable={false} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Seleccionar Estudiante</Label>
                      <Select
                        value=""
                        onValueChange={(studentName) => {
                          if (studentName && filePreviews.length > 0) {
                            evaluateProcessTask(studentName, filePreviews)
                          }
                        }}
                        disabled={isLoading || filePreviews.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un estudiante..." />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from(
                            new Set([
                              ...evaluations.map((e) => e.nombreEstudiante),
                              ...studentFolders.map((f) => f.nombreEstudiante),
                            ]),
                          )
                            .sort()
                            .map((studentName) => (
                              <SelectItem key={studentName} value={studentName}>
                                {studentName}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        O escribe un nombre nuevo para crear una nueva carpeta de estudiante
                      </p>
                    </div>

                    <Button
                      onClick={() => {
                        const studentName = prompt("Ingresa el nombre del estudiante:")
                        if (studentName && filePreviews.length > 0) {
                          evaluateProcessTask(studentName, filePreviews)
                        }
                      }}
                      disabled={
                        isLoading ||
                        filePreviews.length === 0 ||
                        !processEvaluationForm.tipoActividad.trim() ||
                        !processEvaluationForm.objetivos.trim()
                      }
                      className="w-full"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Evaluando Proceso...
                        </>
                      ) : (
                        <>
                          <ClipboardList className="w-4 h-4 mr-2" />
                          Evaluar y Guardar en Carpeta
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Process Evaluations */}
            {processEvaluations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Evaluaciones de Proceso Recientes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {processEvaluations
                      .slice(-5)
                      .reverse()
                      .map((processEval) => (
                        <div key={processEval.id} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-medium">{processEval.nombreEstudiante}</h4>
                              <p className="text-sm text-gray-600">{processEval.tipoActividad}</p>
                            </div>
                            <Badge variant="outline">{processEval.puntaje} pts</Badge>
                          </div>
                          <p className="text-xs text-gray-500">
                            {new Date(processEval.fecha).toLocaleDateString("es-CL")}
                          </p>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* STUDENT FOLDERS TAB */}
          <TabsContent value="folders" className="space-y-6">
            {selectedStudentFolder ? (
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedStudentFolder(null)}
                    className="flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Volver a Carpetas
                  </Button>
                  <h2 className="text-xl font-bold">Carpeta de {selectedStudentFolder.nombreEstudiante}</h2>
                </div>
                <StudentFolderView folder={selectedStudentFolder} />
              </div>
            ) : (
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FolderOpen className="w-5 h-5" />
                      Carpetas de Estudiantes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {studentFolders.length === 0 ? (
                      <div className="text-center py-12">
                        <FolderOpen className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-600 mb-2">No hay carpetas de estudiantes</p>
                        <p className="text-sm text-gray-500">
                          Las carpetas se crean automáticamente cuando evalúas estudiantes
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {studentFolders.map((folder) => (
                          <Card
                            key={folder.id}
                            className="cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 border-l-blue-500"
                            onClick={() => setSelectedStudentFolder(folder)}
                          >
                            <CardContent className="pt-6">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                                  {folder.nombreEstudiante
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .substring(0, 2)}
                                </div>
                                <div className="flex-1">
                                  <h3 className="font-semibold text-lg">{folder.nombreEstudiante}</h3>
                                  <p className="text-sm text-gray-600">Promedio: {folder.promedioGeneral.toFixed(1)}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  {folder.tendencia === "up" && <TrendingUp className="w-4 h-4 text-green-500" />}
                                  {folder.tendencia === "down" && <TrendingDown className="w-4 h-4 text-red-500" />}
                                  {folder.tendencia === "stable" && <Activity className="w-4 h-4 text-gray-500" />}
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-4 text-center text-sm">
                                <div>
                                  <div className="font-semibold text-blue-600">{folder.evaluaciones.length}</div>
                                  <div className="text-gray-500">Evaluaciones</div>
                                </div>
                                <div>
                                  <div className="font-semibold text-green-600">
                                    {folder.evaluacionesProceso.length}
                                  </div>
                                  <div className="text-gray-500">Proceso</div>
                                </div>
                                <div>
                                  <div className="font-semibold text-orange-600">
                                    {folder.alertas.filter((a) => !a.resuelto).length}
                                  </div>
                                  <div className="text-gray-500">Alertas</div>
                                </div>
                              </div>

                              <div className="mt-4 pt-4 border-t">
                                <p className="text-xs text-gray-500">
                                  Última actividad: {new Date(folder.ultimaActividad).toLocaleDateString("es-CL")}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ADMINISTRATIVE TAB */}
          <TabsContent value="administrative" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Gestión Administrativa - Digitalización Automática
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    <p className="font-medium text-green-900 mb-2">Sistema de Digitalización Automática</p>
                    <p className="text-green-800 text-sm">
                      Sube informes, documentos administrativos y evidencias. El sistema los digitalizará
                      automáticamente y los organizará por estudiante. Ideal para la gestión administrativa del colegio.
                    </p>
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Subir Documentos Administrativos</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-400 transition-colors">
                        <Archive className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-600 mb-4">Arrastra documentos administrativos aquí</p>
                        <Input
                          type="file"
                          multiple
                          accept="image/*,.pdf,.doc,.docx"
                          onChange={handleAdministrativeFileUpload}
                          className="hidden"
                          id="admin-file-upload"
                          disabled={isLoading}
                        />
                        <Label htmlFor="admin-file-upload" className="cursor-pointer">
                          <Button variant="outline" asChild disabled={isLoading}>
                            <span className="flex items-center gap-2">
                              {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Upload className="w-4 h-4" />
                              )}
                              Seleccionar Documentos
                            </span>
                          </Button>
                        </Label>
                        <p className="text-xs text-gray-500 mt-4">
                          Formatos: JPG, PNG, PDF, DOC, DOCX - Se digitalizan automáticamente
                        </p>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">Funcionalidades Administrativas:</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Digitalización automática de documentos</li>
                        <li>• Organización por estudiante</li>
                        <li>• Extracción de texto con OCR</li>
                        <li>• Almacenamiento seguro y búsqueda</li>
                        <li>• Integración con carpetas de estudiantes</li>
                      </ul>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-3 block">
                        Documentos Administrativos ({administrativeFiles.length})
                      </Label>
                      {administrativeFiles.length === 0 ? (
                        <div className="text-center py-8 border rounded-lg bg-gray-50">
                          <Archive className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                          <p className="text-gray-600 text-sm">No hay documentos administrativos</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                          {administrativeFiles.slice(-20).map((file) => (
                            <div key={file.id} className="border rounded-lg p-3 bg-white">
                              <div className="flex flex-col items-center space-y-2">
                                {file.type === "image" && file.preview ? (
                                  <img
                                    src={file.preview || "/placeholder.svg"}
                                    alt={file.file.name}
                                    className="w-16 h-16 object-cover rounded"
                                  />
                                ) : (
                                  <FileIcon className="w-16 h-16 text-gray-500" />
                                )}
                                <div className="text-center">
                                  <p className="text-xs font-medium truncate w-full" title={file.file.name}>
                                    {file.file.name}
                                  </p>
                                  <p className="text-xs text-gray-500">{formatFileSize(file.file.size)}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-700 mb-2">Estadísticas:</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Total documentos:</span>
                          <span className="font-semibold ml-2">{administrativeFiles.length}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Espacio usado:</span>
                          <span className="font-semibold ml-2">
                            {formatFileSize(administrativeFiles.reduce((total, file) => total + file.file.size, 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SYNCHRONIZATION TAB */}
          <TabsContent value="sync" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="w-5 h-5" />
                  Sincronización de Notas - Sistema Escolar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="border-purple-200 bg-purple-50">
                  <LineChart className="h-4 w-4 text-purple-600" />
                  <AlertDescription>
                    <p className="font-medium text-purple-900 mb-2">Exportación Compatible con Sistemas Escolares</p>
                    <p className="text-purple-800 text-sm">
                      Organiza y exporta las notas en formatos compatibles con sistemas escolares chilenos y LATAM.
                      Incluye ordenamiento personalizable y formato optimizado para copiar/pegar.
                    </p>
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Orden de Exportación</Label>
                      <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alfabetico">Alfabético (A-Z)</SelectItem>
                          <SelectItem value="nota_desc">Nota Mayor a Menor</SelectItem>
                          <SelectItem value="nota_asc">Nota Menor a Mayor</SelectItem>
                          <SelectItem value="fecha_desc">Fecha Más Reciente</SelectItem>
                          <SelectItem value="fecha_asc">Fecha Más Antigua</SelectItem>
                          <SelectItem value="personalizado">Orden Personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {sortOrder === "personalizado" && (
                      <div className="space-y-2">
                        <Label>Orden Personalizado (separar por comas)</Label>
                        <Textarea
                          value={customOrder.join(", ")}
                          onChange={(e) =>
                            setCustomOrder(
                              e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            )
                          }
                          placeholder="Ej: Juan Pérez, María González, Carlos Silva..."
                          rows={3}
                        />
                        <p className="text-xs text-gray-500">
                          Los estudiantes no listados aparecerán al final en orden alfabético
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button onClick={copyToClipboard} disabled={evaluations.length === 0} className="flex-1">
                        <Download className="w-4 h-4 mr-2" />
                        Copiar para Sistema Escolar
                      </Button>
                      <Button onClick={exportToCSV} variant="outline" disabled={evaluations.length === 0}>
                        <FileText className="w-4 h-4 mr-2" />
                        Exportar CSV
                      </Button>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-medium text-green-900 mb-2">Compatibilidad:</h4>
                      <ul className="text-sm text-green-800 space-y-1">
                        <li>✅ Sistemas escolares chilenos</li>
                        <li>✅ Plataformas LATAM estándar</li>
                        <li>✅ Excel y Google Sheets</li>
                        <li>✅ Formato de copia directa</li>
                      </ul>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-3 block">
                        Vista Previa de Exportación ({getSortedGradesData().length} registros)
                      </Label>
                      {evaluations.length === 0 ? (
                        <div className="text-center py-8 border rounded-lg bg-gray-50">
                          <LineChart className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                          <p className="text-gray-600 text-sm">No hay evaluaciones para sincronizar</p>
                        </div>
                      ) : (
                        <div className="border rounded-lg max-h-96 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="text-left p-2 border-b">Estudiante</th>
                                <th className="text-left p-2 border-b">Nota</th>
                                <th className="text-left p-2 border-b">Evaluación</th>
                              </tr>
                            </thead>
                            <tbody>
                              {getSortedGradesData()
                                .slice(0, 20)
                                .map((data, index) => (
                                  <tr key={index} className="hover:bg-gray-50">
                                    <td className="p-2 border-b">{data.estudiante}</td>
                                    <td className="p-2 border-b font-mono">{data.nota.toFixed(1)}</td>
                                    <td className="p-2 border-b text-xs text-gray-600 truncate">{data.evaluacion}</td>
                                  </tr>
                                ))}
                              {getSortedGradesData().length > 20 && (
                                <tr>
                                  <td colSpan={3} className="p-2 text-center text-gray-500 text-xs">
                                    ... y {getSortedGradesData().length - 20} registros más
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">Instrucciones de Uso:</h4>
                      <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                        <li>Selecciona el orden deseado</li>
                        <li>Haz clic en "Copiar para Sistema Escolar"</li>
                        <li>Pega directamente en tu sistema escolar</li>
                        <li>O exporta a CSV para mayor compatibilidad</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RESULTS TAB */}
          <TabsContent value="results" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Resultados Recientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evaluations.length === 0 ? (
                  <div className="text-center py-12">
                    <BarChart3 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600 mb-2">No hay evaluaciones disponibles</p>
                    <p className="text-sm text-gray-500">
                      Las evaluaciones aparecerán aquí después de completar el proceso
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {evaluations
                      .slice(-10)
                      .reverse()
                      .map((evaluation) => (
                        <Dialog key={evaluation.id}>
                          <DialogTrigger asChild>
                            <Card className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-md transition-all duration-200">
                              <CardContent className="pt-6">
                                <div className="flex justify-between items-start mb-4">
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-lg text-gray-900">
                                      {evaluation.nombreEstudiante}
                                    </h3>
                                    <p className="text-gray-600 text-sm">
                                      {evaluation.nombrePrueba} • {evaluation.curso}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {new Date(evaluation.fecha || evaluation.configuracion.fecha).toLocaleDateString(
                                        "es-CL",
                                      )}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="text-center">
                                      <Badge variant="secondary" className="text-lg px-3 py-1 font-bold">
                                        {evaluation.notaFinal ? evaluation.notaFinal.toFixed(1) : "N/A"}
                                      </Badge>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {evaluation.puntajeObtenido || 0}/{evaluation.configuracion.puntajeMaximo}
                                      </p>
                                    </div>
                                    <Eye className="w-4 h-4 text-gray-400" />
                                  </div>
                                </div>

                                {evaluation.feedback_estudiante && (
                                  <div className="space-y-2">
                                    <div>
                                      <h4 className="font-medium text-green-700 text-sm flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" />
                                        Fortaleza Principal
                                      </h4>
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

                          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <BarChart3 className="w-5 h-5" />
                                  Carpeta de {evaluation.nombreEstudiante}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => generateStudentFeedbackReport(evaluation, config.logoUrl)}
                                    variant="outline"
                                    size="sm"
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Feedback
                                  </Button>
                                  <Button
                                    onClick={() => generatePrintableReport(evaluation, config.logoUrl)}
                                    variant="outline"
                                    size="sm"
                                  >
                                    <Printer className="w-4 h-4 mr-2" />
                                    Reporte Completo
                                  </Button>
                                </div>
                              </DialogTitle>
                            </DialogHeader>

                            <Tabs defaultValue="student" className="w-full">
                              <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="student" className="flex items-center gap-2">
                                  <User className="w-4 h-4" />
                                  Para el Estudiante
                                </TabsTrigger>
                                <TabsTrigger value="teacher" className="flex items-center gap-2">
                                  <Brain className="w-4 h-4" />
                                  Análisis del Profesor
                                </TabsTrigger>
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

            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Gestión de Datos
                  </span>
                  <div className="flex gap-2">
                    <Button onClick={copyToClipboard} variant="outline" size="sm" disabled={evaluations.length === 0}>
                      <Download className="w-4 h-4 mr-2" />
                      Copiar
                    </Button>
                    <Button onClick={exportToCSV} variant="outline" size="sm" disabled={evaluations.length === 0}>
                      <FileText className="w-4 h-4 mr-2" />
                      Exportar CSV
                    </Button>
                    <Button onClick={clearHistory} variant="destructive" size="sm" disabled={evaluations.length === 0}>
                      <X className="w-4 h-4 mr-2" />
                      Limpiar Historial
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{evaluations.length}</div>
                    <div className="text-sm text-blue-700">Evaluaciones Totales</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{studentFolders.length}</div>
                    <div className="text-sm text-green-700">Estudiantes Registrados</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{processEvaluations.length}</div>
                    <div className="text-sm text-purple-700">Evaluaciones de Proceso</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
