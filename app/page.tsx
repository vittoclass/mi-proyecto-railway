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
import { SmartCameraModal } from "@/components/ui/smart-camera-modal"
import {
  Upload, FileText, Brain, Download, Copy, Trash2, BarChart3, GraduationCap, Clock, X, Plus, Eye, Loader2, FileIcon, Users, User, CheckCircle, XCircle, AlertCircle, Zap, Settings, Camera,
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
type GroupingMode = "single" | "multiple" | null;

const compressImage = async (file: File): Promise<File> => {
  try {
    const imageCompression = (await import("browser-image-compression")).default;
    const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true, quality: 0.7 };
    return await imageCompression(file, options);
  } catch (error) {
    console.warn("Error comprimiendo imagen, usando archivo original:", error);
    return file;
  }
};

export default function GeniusEvaluator() {
  const [activeTab, setActiveTab] = useState("evaluate");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Evaluando...");
  const [evaluations, setEvaluations] = useState<StudentEvaluation[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [draggedFile, setDraggedFile] = useState<string | null>(null);
  const [groupingMode, setGroupingMode] = useState<GroupingMode>(null);
  const [evaluationProgress, setEvaluationProgress] = useState<EvaluationProgress | null>(null);
  const [optimizeImages, setOptimizeImages] = useState(true);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const [currentEvaluation, setCurrentEvaluation] = useState({
    nombrePrueba: "",
    curso: "",
    rubrica: "",
    preguntasObjetivas: "",
  });

  const [config, setConfig] = useState<EvaluationConfig>({
    sistema: "chile_2_7",
    nivelExigencia: 60,
    puntajeMaximo: 30,
    notaAprobacion: 4.0,
    flexibility: 5,
    fecha: new Date().toISOString().split("T")[0],
    aiModel: "mistral-large-latest",
  });

  useEffect(() => {
    try {
      const savedEvaluations = localStorage.getItem("evaluations");
      if (savedEvaluations) {
        const parsed = JSON.parse(savedEvaluations);
        if (Array.isArray(parsed)) setEvaluations(parsed);
      }
    } catch (error) {
      console.error("Error al cargar evaluaciones de localStorage:", error);
      localStorage.removeItem("evaluations");
    }
  }, []);

  const saveEvaluations = useCallback((newEvaluations: StudentEvaluation[]) => {
    setEvaluations(newEvaluations);
    localStorage.setItem("evaluations", JSON.stringify(newEvaluations));
  }, []);

  const createFilePreview = async (file: File): Promise<FilePreview> => {
    const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let preview: string | undefined = undefined;
    let type: "image" | "pdf" | "other" = "other";
    let processedFile = file;
    const originalSize = file.size;
    if (file.type.startsWith("image/")) {
      type = "image";
      if (optimizeImages) processedFile = await compressImage(file);
      preview = URL.createObjectURL(processedFile);
    } else if (file.type === "application/pdf") {
      type = "pdf";
    }
    return { id, file: processedFile, preview, type, originalSize, compressedSize: processedFile.size };
  };

  const addFileToPreviews = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const newPreviews = await Promise.all(files.map(createFilePreview));
    setFilePreviews(prev => [...prev, ...newPreviews]);
    setGroupingMode(null);
    setStudentGroups([]);
  }, [optimizeImages]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    addFileToPreviews(files);
  }, [addFileToPreviews]);

  const handleCameraCapture = useCallback((file: File) => {
    addFileToPreviews([file]);
    setIsCameraOpen(false);
  }, [addFileToPreviews]);

  const removeFilePreview = (fileId: string) => {
    setFilePreviews(prev => prev.filter(f => f.id !== fileId));
  };
  
  const handleGroupingModeSelect = async (mode: GroupingMode) => {
    setGroupingMode(mode);
    if (mode === 'single') {
      const singleGroupId = `group_single_${Date.now()}`;
      const singleGroup: StudentGroup = { id: singleGroupId, studentName: '', files: [...filePreviews], isExtractingName: true };
      setStudentGroups([singleGroup]);
      try {
        const formData = new FormData();
        filePreviews.forEach(fp => formData.append("files", fp.file));
        const res = await fetch("/api/extract-name", { method: "POST", body: formData });
        const result = await res.json();
        setStudentGroups(prev => prev.map(g => g.id === singleGroupId ? { ...g, studentName: result.success ? result.name : "", isExtractingName: false } : g));
      } catch (e) {
        console.error(e);
        setStudentGroups(prev => prev.map(g => g.id === singleGroupId ? { ...g, isExtractingName: false } : g));
      }
    } else if (mode === 'multiple') {
      const newGroups: StudentGroup[] = filePreviews.map(fp => ({ id: `group_${fp.id}`, studentName: '', files: [fp], isExtractingName: true }));
      setStudentGroups(newGroups);
      const extractionPromises = newGroups.map(async group => {
        const formData = new FormData();
        formData.append("files", group.files[0].file);
        const res = await fetch("/api/extract-name", { method: "POST", body: formData });
        const result = await res.json();
        return { groupId: group.id, name: result.success ? result.name : "" };
      });
      const results = await Promise.all(extractionPromises);
      setStudentGroups(prev =>
        prev.map(group => {
          const found = results.find(r => r.groupId === group.id);
          return { ...group, studentName: found ? found.name : '', isExtractingName: false };
        })
      );
    }
  };
  
  const updateStudentName = (groupId: string, name: string) => {
    setStudentGroups(prev => prev.map(g => (g.id === groupId ? { ...g, studentName: name } : g)));
  };

  const addNewStudentGroup = () => {
    setStudentGroups(prev => [...prev, { id: `group_${Date.now()}`, studentName: "", files: [] }]);
  };
  
  const handleDragStart = (fileId: string) => setDraggedFile(fileId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    if (!draggedFile) return;
    let sourceGroupId: string | null = 'preview-area';
    let draggedFileObj: FilePreview | null = filePreviews.find(f => f.id === draggedFile) || null;

    if (!draggedFileObj) {
      for (const group of studentGroups) {
          const file = group.files.find(f => f.id === draggedFile);
          if (file) {
              sourceGroupId = group.id;
              draggedFileObj = file;
              break;
          }
      }
    }
    if (!draggedFileObj || sourceGroupId === targetGroupId) return;

    if (sourceGroupId === 'preview-area') {
        setFilePreviews(prev => prev.filter(f => f.id !== draggedFile));
    } else {
        setStudentGroups(prev => prev.map(g => g.id === sourceGroupId ? { ...g, files: g.files.filter(f => f.id !== draggedFile) } : g));
    }

    setStudentGroups(prev => prev.map(g => g.id === targetGroupId ? { ...g, files: [...g.files, draggedFileObj!] } : g));
    setDraggedFile(null);
  };
  
  const evaluateDocuments = async () => {
    const groupsToEvaluate = studentGroups.filter(g => g.files.length > 0);
    if (groupsToEvaluate.length === 0 || !currentEvaluation.rubrica.trim()) {
      alert("Por favor, organiza los archivos y proporciona una rúbrica."); return;
    }
    if (groupsToEvaluate.some(g => !g.studentName.trim())) {
      alert("Por favor, asegúrate de que todos los grupos tengan un nombre de estudiante."); return;
    }

    setIsLoading(true);
    setEvaluationProgress({ total: groupsToEvaluate.length, completed: 0, current: "Iniciando...", successes: 0, failures: 0 });

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
                return { status: 'fulfilled', value: evaluation, groupName: group.studentName };
            }
            return Promise.reject(result);
        })
        .catch(error => ({ status: 'rejected', reason: error.error || error.message || 'error desconocido', groupName: group.studentName }));
    });

    const results = await Promise.allSettled(evaluationPromises);
    const successfulEvals: StudentEvaluation[] = [];
    const failedEvals: string[] = [];

    results.forEach((res, i) => {
        setEvaluationProgress(prev => prev ? { ...prev, completed: prev.completed + 1, current: `Procesado ${i + 1} de ${prev.total}` } : null);
        if (res.status === 'fulfilled' && res.value.status === 'fulfilled') {
            successfulEvals.push(res.value.value);
        } else {
            const reason = res.status === 'rejected' ? res.reason : (res.value as any).reason;
            failedEvals.push(`${(res.status === 'fulfilled' ? res.value.groupName : groupsToEvaluate[i].studentName)}: ${reason}`);
        }
    });

    if (successfulEvals.length > 0) {
        saveEvaluations([...evaluations, ...successfulEvals]);
        setActiveTab("results");
    }
    
    let message = `✅ Evaluación finalizada.\n\nÉxitos: ${successfulEvals.length}\nFallos: ${failedEvals.length}`;
    if (failedEvals.length > 0) message += `\n\nErrores:\n${failedEvals.join("\n")}`;
    alert(message);
    
    setStudentGroups([]);
    setFilePreviews([]);
    setGroupingMode(null);
    setIsLoading(false);
    setEvaluationProgress(null);
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const FilePreviewCard = ({ filePreview, groupId, isDraggable = true, showRemove = true }: { filePreview: FilePreview; groupId?: string; isDraggable?: boolean; showRemove?: boolean; }) => (
    <div className={`relative border rounded-lg p-2 bg-white ${isDraggable ? "cursor-move hover:border-blue-400" : ""}`} draggable={isDraggable} onDragStart={() => isDraggable && handleDragStart(filePreview.id)}>
      <div className="flex flex-col items-center space-y-1">
        {filePreview.type === "image" && filePreview.preview ? <img src={filePreview.preview} alt={filePreview.file.name} className="w-16 h-16 object-cover rounded" /> : <FileIcon className="w-16 h-16 text-gray-400" />}
        <span className="text-xs text-center truncate w-full" title={filePreview.file.name}>{filePreview.file.name}</span>
        {filePreview.originalSize && filePreview.compressedSize && filePreview.originalSize > filePreview.compressedSize && (
          <div className="text-xs text-green-600 text-center"><Zap className="w-3 h-3 inline mr-1" />{formatFileSize(filePreview.originalSize)} → {formatFileSize(filePreview.compressedSize)}</div>
        )}
      </div>
      {showRemove && (<button onClick={() => groupId ? removeFileFromGroup(groupId, filePreview.id) : removeFilePreview(filePreview.id)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"><X className="w-3 h-3" /></button>)}
    </div>
  );

  const StudentFeedbackTab = ({ evaluation }: { evaluation: StudentEvaluation }) => (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg"><h3 className="font-semibold text-blue-900 mb-2">📋 Resumen de tu Evaluación</h3><p className="text-blue-800">{evaluation.feedback_estudiante?.resumen || "N/A"}</p></div>
      <div className="text-center"><div className="inline-flex items-center gap-4 bg-gray-100 px-6 py-4 rounded-lg"><span className="text-lg font-medium">Tu Nota Final:</span><Badge variant="secondary" className="text-2xl px-4 py-2">{typeof evaluation.notaFinal === 'number' ? evaluation.notaFinal.toFixed(1) : "N/A"}</Badge></div></div>
      <div>
        <h3 className="font-semibold text-green-700 mb-3 flex items-center gap-2"><CheckCircle className="w-5 h-5" /> Tus Fortalezas</h3>
        <div className="space-y-3">{evaluation.feedback_estudiante?.fortalezas?.map((f: any, i: number) => <div key={i} className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400"><p className="font-medium text-green-800">{f.descripcion}</p><p className="text-sm text-green-700 mt-2 italic">"{f.cita}"</p></div>) || <p>N/A</p>}</div>
      </div>
      <div>
        <h3 className="font-semibold text-orange-700 mb-3 flex items-center gap-2"><AlertCircle className="w-5 h-5" /> Áreas para Mejorar</h3>
        <div className="space-y-3">{evaluation.feedback_estudiante?.oportunidades?.map((o: any, i: number) => <div key={i} className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-400"><p className="font-medium text-orange-800">{o.descripcion}</p><p className="text-sm text-orange-700 mt-2 italic">"{o.cita}"</p>{o.sugerencia_tecnica && <div className="mt-3 p-2 bg-blue-100 rounded text-sm"><strong className="text-blue-800">💡 Consejo:</strong><span className="text-blue-700 ml-1">{o.sugerencia_tecnica}</span></div>}</div>) || <p>N/A</p>}</div>
      </div>
      {evaluation.feedback_estudiante?.siguiente_paso_sugerido && <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400"><h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2"><Brain className="w-5 h-5" /> Tu Próximo Desafío</h3><p className="text-blue-700">{evaluation.feedback_estudiante.siguiente_paso_sugerido}</p></div>}
    </div>
  );

  const TeacherAnalysisTab = ({ evaluation }: { evaluation: StudentEvaluation }) => (
    <div className="space-y-6">
        <div>
            <h3 className="font-semibold text-purple-700 mb-4 flex items-center gap-2"><Brain className="w-5 h-5" />Análisis de Habilidades</h3>
            <div className="grid gap-4">{evaluation.analisis_habilidades && Object.keys(evaluation.analisis_habilidades).length > 0 ? Object.entries(evaluation.analisis_habilidades).map(([habilidad, datos]: [string, any]) => <div key={habilidad} className="border rounded-lg p-4"><div className="flex justify-between items-start mb-2"><h4 className="font-medium">{habilidad}</h4><Badge variant={datos.nivel === "Destacado" ? "default" : datos.nivel === "Competente" ? "secondary" : "outline"}>{datos.nivel}</Badge></div><p className="text-sm text-gray-600 mb-2"><strong>Evidencia:</strong> {datos.evidencia_especifica}</p><p className="text-sm text-gray-500"><strong>Justificación:</strong> {datos.justificacion_pedagogica}</p></div>) : <p>N/A</p>}</div>
        </div>
        <div>
            <h3 className="font-semibold text-blue-700 mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5" />Evaluación por Rúbrica</h3>
            <div className="space-y-3">{evaluation.analisis_detallado?.map((criterio: any, i: number) => <div key={i} className="border rounded-lg p-4 bg-gray-50"><div className="flex justify-between items-start mb-3"><h4 className="font-medium text-gray-900">{criterio.criterio}</h4><Badge variant="outline" className="font-mono">{criterio.puntaje}</Badge></div><div className="space-y-2"><div><span className="text-sm font-medium text-green-700">Evidencia:</span><p className="text-sm text-gray-600 mt-1">{criterio.evidencia}</p></div><div><span className="text-sm font-medium text-blue-700">Justificación:</span><p className="text-sm text-gray-600 mt-1">{criterio.justificacion}</p></div></div></div>) || <p>N/A</p>}</div>
        </div>
        {evaluation.analisis_profesor && <div className="bg-gray-50 p-4 rounded-lg"><h3 className="font-semibold text-gray-700 mb-3">📝 Notas del Profesor</h3><div className="space-y-3 text-sm"><div><strong>Desempeño:</strong><p className="text-gray-600 mt-1">{evaluation.analisis_profesor.desempeno_general}</p></div><div><strong>Patrones:</strong><p className="text-gray-600 mt-1">{evaluation.analisis_profesor.patrones_observados}</p></div><div><strong>Sugerencia:</strong><p className="text-gray-600 mt-1">{evaluation.analisis_profesor.sugerencia_pedagogica}</p></div></div></div>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">✨ Genius Evaluator X</h1>
          <p className="text-gray-600">Sistema de Evaluación Inteligente con IA</p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="evaluate" className="flex items-center gap-2"><Brain className="w-4 h-4" /> Evaluar</TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Resultados</TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2"><FileText className="w-4 h-4" /> Historial</TabsTrigger>
          </TabsList>
          <TabsContent value="evaluate" className="space-y-6 pt-6">
            {evaluationProgress && <Card className="border-blue-200 bg-blue-50"><CardContent className="pt-6"><div className="space-y-4"><div className="flex items-center justify-between"><h3 className="font-semibold text-blue-900">Evaluación en Progreso</h3><Badge variant="secondary">{evaluationProgress.completed}/{evaluationProgress.total}</Badge></div><Progress value={(evaluationProgress.completed / evaluationProgress.total) * 100} className="w-full" /><p className="text-sm text-blue-700">{evaluationProgress.current}</p></div></CardContent></Card>}
            <Card>
              <CardHeader><CardTitle>Información de la Evaluación</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="nombre-prueba">Nombre de la Evaluación</Label><Input id="nombre-prueba" value={currentEvaluation.nombrePrueba} onChange={(e) => setCurrentEvaluation(prev => ({ ...prev, nombrePrueba: e.target.value }))} placeholder="Ej: Ensayo Final" /></div>
                  <div className="space-y-2"><Label htmlFor="curso">Curso</Label><Input id="curso" value={currentEvaluation.curso} onChange={(e) => setCurrentEvaluation(prev => ({ ...prev, curso: e.target.value }))} placeholder="Ej: 3ro Medio A" /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />Configuración</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* ... Configuración de Calificación ... */}
                </div>
                <div className="space-y-2"><Label>Modelo de IA</Label><Select value={config.aiModel} onValueChange={value => setConfig(prev => ({ ...prev, aiModel: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mistral-small-latest"><div className="flex items-center gap-2"><Zap className="w-4 h-4" />Rápido</div></SelectItem><SelectItem value="mistral-large-latest"><div className="flex items-center gap-2"><Brain className="w-4 h-4" />Detallado</div></SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Flexibilidad de IA: {config.flexibility}/10</Label><Slider value={[config.flexibility]} onValueChange={value => setConfig(prev => ({...prev, flexibility: value[0]}))} max={10} step={1} /></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Cargar Documentos</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center flex flex-col items-center gap-4">
                    <div className="flex gap-4 justify-center">
                        <Label htmlFor="file-upload" className="cursor-pointer"><Button variant="outline" asChild><span><Upload className="w-4 h-4 mr-2" />Subir Archivos</span></Button></Label>
                        <Input type="file" multiple accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" id="file-upload" />
                        <Button onClick={() => setIsCameraOpen(true)} variant="outline"><Camera className="w-4 h-4 mr-2" />Usar Cámara</Button>
                    </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div className="space-y-0.5"><Label htmlFor="optimize-images">Optimizar Imágenes</Label><p className="text-xs text-gray-500">Acelera el proceso reduciendo el tamaño.</p></div><Switch id="optimize-images" checked={optimizeImages} onCheckedChange={setOptimizeImages} /></div>
                {filePreviews.length > 0 && (
                  <div className="space-y-4">
                    <div>
                      <Label className="mb-2 block">Archivos Cargados</Label>
                      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-2">
                        {filePreviews.map(fp => <FilePreviewCard key={fp.id} filePreview={fp} showRemove={true} isDraggable={true} />)}
                      </div>
                    </div>
                    {!groupingMode && (
                      <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>
                          <strong>Archivos corresponden a:</strong>
                          <div className="flex gap-4 mt-2">
                              <Button onClick={() => handleGroupingModeSelect("single")} variant="outline" size="sm"><User className="w-4 h-4 mr-2" />Un Estudiante</Button>
                              <Button onClick={() => handleGroupingModeSelect("multiple")} variant="outline" size="sm"><Users className="w-4 h-4 mr-2" />Varios Estudiantes</Button>
                          </div>
                      </AlertDescription></Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {studentGroups.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="flex justify-between items-center"><span>Organización de Estudiantes</span>{groupingMode === "multiple" && (<Button onClick={addNewStudentGroup} variant="outline" size="sm"><Plus className="w-4 h-4 mr-2" />Añadir Grupo</Button>)}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {studentGroups.map(group => (
                    <div key={group.id} className="border rounded-lg p-4 bg-gray-50 min-h-[120px]" onDragOver={handleDragOver} onDrop={e => handleDrop(e, group.id)}>
                      <div className="flex items-center gap-4 mb-2">
                        <div className="flex-1 flex items-center gap-2">
                            <Input value={group.studentName} onChange={e => updateStudentName(group.id, e.target.value)} placeholder="Nombre Estudiante..." />
                            {group.isExtractingName && <Loader2 className="w-4 h-4 animate-spin" />}
                        </div>
                        <Badge variant="secondary">{group.files.length} archivo(s)</Badge>
                      </div>
                      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-2">
                        {group.files.map(fp => <FilePreviewCard key={fp.id} filePreview={fp} groupId={group.id} showRemove={false} />)}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            
            <Card>
              <CardHeader><CardTitle>Rúbrica y Claves</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label htmlFor="rubrica">Rúbrica</Label><Textarea id="rubrica" value={currentEvaluation.rubrica} onChange={e => setCurrentEvaluation(prev => ({...prev, rubrica: e.target.value}))} placeholder="Criterio 1: (6 Pts)..." rows={5} /></div>
                <div className="space-y-2"><Label htmlFor="preguntas-objetivas">Respuestas Correctas (Opcional)</Label><Textarea id="preguntas-objetivas" value={currentEvaluation.preguntasObjetivas} onChange={e => setCurrentEvaluation(prev => ({...prev, preguntasObjetivas: e.target.value}))} placeholder="1. Verdadero (2 Pts)..." rows={3} /></div>
              </CardContent>
            </Card>

            <Button onClick={evaluateDocuments} disabled={isLoading || studentGroups.length === 0 || !currentEvaluation.rubrica.trim()} className="w-full" size="lg">
              {isLoading ? (<><Clock className="w-4 h-4 mr-2 animate-spin" />{loadingMessage}</>) : (<><Brain className="w-4 h-4 mr-2" /> Iniciar Evaluación</>)}
            </Button>
          </TabsContent>
          <TabsContent value="results" className="space-y-6 pt-6">
              {/* ... Resultados ... */}
          </TabsContent>
          <TabsContent value="history" className="space-y-6 pt-6">
              {/* ... Historial ... */}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
