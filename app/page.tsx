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
import { Switch } from "@/components/ui/switch"
import { SmartCameraModal } from "@/components/ui/smart-camera-modal" // Importación del nuevo componente
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
  Zap,
  Settings,
  Camera, // Icono de cámara añadido
} from "lucide-react"

// --- INTERFACES ---
interface EvaluationConfig {
  sistema: string; nivelExigencia: number; puntajeMaximo: number; notaAprobacion: number; flexibility: number; fecha: string; aiModel: string;
}
interface FilePreview {
  id: string; file: File; preview?: string; type: "image" | "pdf" | "other"; originalSize?: number; compressedSize?: number;
}
interface StudentGroup {
  id: string; studentName: string; files: FilePreview[]; isExtractingName?: boolean;
}
interface StudentEvaluation {
  id: string; nombreEstudiante: string; nombrePrueba: string; curso: string; notaFinal: number; puntajeObtenido: number; configuracion: EvaluationConfig; feedback_estudiante: any; analisis_profesor: any; analisis_habilidades: any; analisis_detallado: any[]; filesPreviews?: FilePreview[];
}
interface EvaluationProgress {
  total: number; completed: number; current: string; successes: number; failures: number;
}
type GroupingMode = "single" | "multiple" | null

const compressImage = async (file: File): Promise<File> => {
  try {
    const imageCompression = (await import("browser-image-compression")).default
    const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true, quality: 0.7 }
    const compressedFile = await imageCompression(file, options)
    return compressedFile
  } catch (error) {
    console.warn("Error comprimiendo imagen, usando archivo original:", error)
    return file
  }
}

export default function GeniusEvaluator() {
  const [activeTab, setActiveTab] = useState("evaluate")
  const [isLoading, setIsLoading] = useState(false)
  const [evaluations, setEvaluations] = useState<StudentEvaluation[]>([])
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([])
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([])
  const [groupingMode, setGroupingMode] = useState<GroupingMode>(null)
  const [draggedFile, setDraggedFile] = useState<string | null>(null)
  const [evaluationProgress, setEvaluationProgress] = useState<EvaluationProgress | null>(null)
  const [optimizeImages, setOptimizeImages] = useState(true)
  const [isCameraOpen, setIsCameraOpen] = useState(false) // Nuevo estado para la cámara

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
    aiModel: "mistral-large-latest",
  })

  useEffect(() => {
    try {
        const savedEvaluations = localStorage.getItem("evaluations")
        if (savedEvaluations) {
            const parsed = JSON.parse(savedEvaluations)
            if (Array.isArray(parsed)) {
                setEvaluations(parsed)
            }
        }
    } catch (error) {
        console.error("Error al cargar evaluaciones de localStorage:", error)
        localStorage.removeItem("evaluations")
    }
  }, [])

  const saveEvaluations = useCallback((newEvaluations: StudentEvaluation[]) => {
    setEvaluations(newEvaluations)
    localStorage.setItem("evaluations", JSON.stringify(newEvaluations))
  }, [evaluations])

  const createFilePreview = async (file: File): Promise<FilePreview> => {
    const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    let preview = undefined
    let type: "image" | "pdf" | "other" = "other"
    let processedFile = file
    const originalSize = file.size

    if (file.type.startsWith("image/")) {
      type = "image"
      if (optimizeImages) {
        processedFile = await compressImage(file)
      }
      preview = URL.createObjectURL(processedFile)
    } else if (file.type === "application/pdf") {
      type = "pdf"
    }

    return { id, file: processedFile, preview, type, originalSize, compressedSize: processedFile.size }
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
    setGroupingMode(null)
  }

  // Nueva función para manejar captura de cámara
  const handleCameraCapture = async (file: File) => {
    const filePreview = await createFilePreview(file)
    setFilePreviews((prev) => [...prev, filePreview])
    setGroupingMode(null)
    setIsCameraOpen(false) // Cierra el modal después de la captura
  }

  const removeFilePreview = (fileId: string) => {
    setFilePreviews((prev) => prev.filter((f) => f.id !== fileId))
    setStudentGroups((prev) =>
      prev.map((group) => ({ ...group, files: group.files.filter((f) => f.id !== fileId) }))
         .filter((group) => group.files.length > 0)
    )
  }

  const handleGroupingModeSelect = async (mode: GroupingMode) => {
    setGroupingMode(mode)
    if (mode === "single") {
      const singleGroupId = `group_${Date.now()}_single`
      const singleGroup: StudentGroup = { id: singleGroupId, studentName: "", files: [...filePreviews], isExtractingName: true }
      setStudentGroups([singleGroup])

      try {
        const formData = new FormData()
        filePreviews.forEach((fp) => formData.append("files", fp.file))
        const response = await fetch("/api/extract-name", { method: "POST", body: formData })
        const result = await response.json()
        setStudentGroups([{ ...singleGroup, studentName: result.success ? result.name : "", isExtractingName: false }])
      } catch (error) {
        console.error("Error extracting name:", error)
        setStudentGroups([{ ...singleGroup, isExtractingName: false }])
      }
    } else if (mode === "multiple") {
      const newGroups: StudentGroup[] = filePreviews.map(fp => ({
        id: `group_${fp.id}`, studentName: "", files: [fp], isExtractingName: true
      }));
      setStudentGroups(newGroups);

      const extractionPromises = newGroups.map(async (group) => {
        try {
          const formData = new FormData();
          formData.append("files", group.files[0].file);
          const response = await fetch("/api/extract-name", { method: "POST", body: formData });
          const result = await response.json();
          return { groupId: group.id, name: result.success ? result.name : "" };
        } catch (error) {
          console.error(`Error extracting name for group ${group.id}:`, error);
          return { groupId: group.id, name: "" };
        }
      });
      const results = await Promise.allSettled(extractionPromises);
      setStudentGroups(prev =>
        prev.map(group => {
          const result = results.find(r => r.status === "fulfilled" && r.value.groupId === group.id);
          return { ...group, studentName: result && result.status === "fulfilled" ? result.value.name : "", isExtractingName: false };
        })
      );
    }
  }

  const updateStudentName = (groupId: string, name: string) => {
    setStudentGroups(prev => prev.map(g => (g.id === groupId ? { ...g, studentName: name } : g)));
  }

  const addNewStudentGroup = () => {
    setStudentGroups(prev => [...prev, { id: `group_${Date.now()}`, studentName: "", files: [] }]);
  }

  const handleDragStart = (fileId: string) => setDraggedFile(fileId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  
  const handleDrop = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    if (!draggedFile) return;
    let sourceGroupId = "";
    let draggedFileObj: FilePreview | null = null;

    studentGroups.forEach(group => {
        const file = group.files.find(f => f.id === draggedFile);
        if (file) {
            sourceGroupId = group.id;
            draggedFileObj = file;
        }
    });

    if (!draggedFileObj || sourceGroupId === targetGroupId) return;
    
    setStudentGroups(prev => prev
        .map(group => {
            if (group.id === sourceGroupId) return { ...group, files: group.files.filter(f => f.id !== draggedFile) };
            if (group.id === targetGroupId) return { ...group, files: [...group.files, draggedFileObj!] };
            return group;
        })
        .filter(group => group.files.length > 0)
    );
    setDraggedFile(null);
  }

  const evaluateDocuments = async () => {
    const groupsToEvaluate = studentGroups.filter(g => g.files.length > 0);
    if (groupsToEvaluate.length === 0 || !currentEvaluation.rubrica.trim()) {
      alert("Por favor, organiza los archivos y proporciona una rúbrica.");
      return;
    }
    if (groupsToEvaluate.some(g => !g.studentName.trim())) {
      alert("Por favor, asegúrate de que todos los grupos tengan un nombre de estudiante.");
      return;
    }

    setIsLoading(true);
    setEvaluationProgress({ total: groupsToEvaluate.length, completed: 0, current: "", successes: 0, failures: 0 });

    const evaluationPromises = groupsToEvaluate.map(group => {
      const formData = new FormData();
      group.files.forEach(fp => formData.append("files", fp.file));
      formData.append("config", JSON.stringify({ ...config, ...currentEvaluation }));

      return fetch("/api/evaluate", { method: "POST", body: formData })
        .then(res => res.ok ? res.json() : res.json().then(err => Promise.reject(err)))
        .then(result => {
          if (result.success && result.evaluations.length > 0) {
            const evaluation = result.evaluations[0];
            evaluation.nombreEstudiante = group.studentName;
            evaluation.filesPreviews = group.files;
            return { status: 'fulfilled', value: evaluation };
          }
          return Promise.reject(result);
        })
        .catch(error => ({ status: 'rejected', reason: `Fallo al evaluar a ${group.studentName}: ${error.error || error.message || 'error desconocido'}` }));
    });

    const results = await Promise.allSettled(evaluationPromises);
    const successfulEvals: StudentEvaluation[] = [];
    const failedEvals: string[] = [];

    results.forEach((res, index) => {
        const groupName = groupsToEvaluate[index].studentName;
        if (res.status === 'fulfilled' && res.value.status === 'fulfilled') {
            successfulEvals.push(res.value.value);
        } else {
            const reason = res.status === 'rejected' ? res.reason : (res.value as any).reason;
            failedEvals.push(`${groupName}: ${reason}`);
        }
    });

    if (successfulEvals.length > 0) {
        saveEvaluations([...evaluations, ...successfulEvals]);
        setActiveTab("results");
    }

    alert(`Evaluación finalizada.\nÉxitos: ${successfulEvals.length}\nFallos: ${failedEvals.length}${failedEvals.length > 0 ? `\n\nErrores:\n${failedEvals.join("\n")}` : ""}`);
    
    setStudentGroups([]);
    setFilePreviews([]);
    setGroupingMode(null);
    setIsLoading(false);
    setEvaluationProgress(null);
  };

  // ... (exportToCSV, copyToClipboard, clearHistory sin cambios)

  const FilePreviewCard = ({ filePreview, groupId, isDraggable = true, showRemove = true }: { filePreview: FilePreview; groupId?: string; isDraggable?: boolean; showRemove?: boolean }) => (
    <div className={`relative p-2 bg-white ${isDraggable ? "cursor-move" : ""}`} draggable={isDraggable} onDragStart={() => isDraggable && handleDragStart(filePreview.id)}>
        {/* ... JSX de la tarjeta de previsualización ... */}
    </div>
  );

  const StudentFeedbackTab = ({ evaluation }: { evaluation: StudentEvaluation }) => (
      <div>{/* ... JSX de la pestaña de feedback del estudiante ... */}</div>
  );
  const TeacherAnalysisTab = ({ evaluation }: { evaluation: StudentEvaluation }) => (
      <div>{/* ... JSX de la pestaña de análisis del profesor ... */}</div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">✨ Genius Evaluator X</h1>
          <p className="text-gray-600">Sistema de Evaluación Inteligente con IA - Optimizado</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="evaluate">Evaluar</TabsTrigger>
            <TabsTrigger value="results">Resultados</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>
          
          <TabsContent value="evaluate" className="space-y-6">
            {evaluationProgress && (
                <Card className="border-blue-200 bg-blue-50"><CardContent className="pt-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-blue-900">Evaluación en Progreso</h3>
                            <Badge variant="secondary">{evaluationProgress.completed}/{evaluationProgress.total}</Badge>
                        </div>
                        <Progress value={(evaluationProgress.completed / evaluationProgress.total) * 100} className="w-full" />
                        <p className="text-sm text-blue-700">{evaluationProgress.current}</p>
                    </div>
                </CardContent></Card>
            )}

            <Card>
              <CardHeader><CardTitle>Información de la Evaluación</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {/* ... Campos de info de evaluación ... */}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />Configuración de Evaluación</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                 {/* ... Campos de Configuración ... */}
                 <div className="space-y-2">
                    <Label>Modelo de IA para Evaluación</Label>
                    <Select value={config.aiModel} onValueChange={(value) => setConfig((prev) => ({ ...prev, aiModel: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mistral-small-latest"><div className="flex items-center gap-2"><Zap className="w-4 h-4 text-green-500" /><span>Rápido y Eficiente</span></div></SelectItem>
                        <SelectItem value="mistral-large-latest"><div className="flex items-center gap-2"><Brain className="w-4 h-4 text-blue-500" /><span>Potente y Detallado</span></div></SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Cargar Documentos</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <div className="flex gap-4 justify-center">
                    <Label htmlFor="file-upload" className="cursor-pointer"><Button variant="outline" asChild><span><Upload className="w-4 h-4 mr-2" />Seleccionar Archivos</span></Button></Label>
                    <Input type="file" multiple accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" id="file-upload" />
                    <Button onClick={() => setIsCameraOpen(true)} variant="outline" className="flex items-center gap-2"><Camera className="w-4 h-4" />Usar Cámara</Button>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-1"><Label htmlFor="optimize-images">Optimizar imágenes</Label><p className="text-xs text-gray-500">Reduce el tamaño para acelerar el proceso.</p></div>
                    <Switch id="optimize-images" checked={optimizeImages} onCheckedChange={setOptimizeImages} />
                </div>

                {filePreviews.length > 0 && (
                    <div className="space-y-4">
                        <div>
                            <Label className="text-sm font-medium mb-2 block">Archivos Cargados:</Label>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {filePreviews.map(fp => <FilePreviewCard key={fp.id} filePreview={fp} showRemove={true} isDraggable={false} />)}
                            </div>
                        </div>
                        {!groupingMode && (
                            <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>
                                <strong>Los archivos corresponden a:</strong>
                                <div className="flex gap-4 mt-3">
                                    <Button onClick={() => handleGroupingModeSelect("single")} variant="outline"><User className="w-4 h-4 mr-2" />Un Solo Estudiante</Button>
                                    <Button onClick={() => handleGroupingModeSelect("multiple")} variant="outline"><Users className="w-4 h-4 mr-2" />Varios Estudiantes</Button>
                                </div>
                            </AlertDescription></Alert>
                        )}
                    </div>
                )}
              </CardContent>
            </Card>

            {studentGroups.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="flex justify-between items-center"><span>Organización por Estudiante</span>{groupingMode === "multiple" && (<Button onClick={addNewStudentGroup} variant="outline" size="sm"><Plus className="w-4 h-4 mr-2" />Nuevo Estudiante</Button>)}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {studentGroups.map(group => (
                        <div key={group.id} className="border rounded-lg p-4 bg-gray-50" onDragOver={handleDragOver} onDrop={e => handleDrop(e, group.id)}>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="flex-1">
                                    <Label htmlFor={`student-${group.id}`}>Nombre del Estudiante</Label>
                                    <div className="flex items-center gap-2">
                                        <Input id={`student-${group.id}`} value={group.studentName} onChange={e => updateStudentName(group.id, e.target.value)} placeholder="Nombre..." />
                                        {group.isExtractingName && <Loader2 className="w-4 h-4 animate-spin" />}
                                    </div>
                                </div>
                                <Badge variant="secondary">{group.files.length} archivo(s)</Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {group.files.map(fp => <FilePreviewCard key={fp.id} filePreview={fp} groupId={group.id} isDraggable={groupingMode === 'multiple'} showRemove={false} />)}
                            </div>
                        </div>
                    ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle>Rúbrica de Evaluación</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {/* ... Rúbrica y preguntas objetivas Textareas ... */}
                <Button onClick={evaluateDocuments} disabled={isLoading || studentGroups.length === 0 || !currentEvaluation.rubrica.trim()} className="w-full" size="lg">
                  {isLoading ? (<><Clock className="w-4 h-4 mr-2 animate-spin" />{loadingMessage}</>) : (<><Brain className="w-4 h-4 mr-2" /> Iniciar Evaluación</>)}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="results" className="space-y-6">
            {/* ... JSX de la pestaña de Resultados ... */}
          </TabsContent>
          <TabsContent value="history" className="space-y-6">
            {/* ... JSX de la pestaña de Historial ... */}
          </TabsContent>
        </Tabs>

        <SmartCameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCameraCapture} />
      </div>
    </div>
  );
}
```