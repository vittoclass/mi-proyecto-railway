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
  Camera,
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
  const [evaluations, setEvaluations] = useState<StudentEvaluation[]>([]);
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [groupingMode, setGroupingMode] = useState<GroupingMode>(null);
  const [draggedFile, setDraggedFile] = useState<string | null>(null);
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

  const saveEvaluations = useCallback((newEvals: StudentEvaluation[]) => {
    setEvaluations(prevEvals => {
      const updatedEvals = [...prevEvals, ...newEvals];
      localStorage.setItem("evaluations", JSON.stringify(updatedEvals));
      return updatedEvals;
    });
  }, []);

  const createFilePreview = async (file: File): Promise<FilePreview> => {
    const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let preview = undefined;
    let type: "image" | "pdf" | "other" = "other";
    let processedFile = file;
    const originalSize = file.size;
    if (file.type.startsWith("image/")) {
      type = "image";
      if (optimizeImages) {
        processedFile = await compressImage(file);
      }
      preview = URL.createObjectURL(processedFile);
    } else if (file.type === "application/pdf") {
      type = "pdf";
    }
    return { id, file: processedFile, preview, type, originalSize, compressedSize: processedFile.size };
  };

  const addFilesToPreviews = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const newPreviews = await Promise.all(files.map(createFilePreview));
    setFilePreviews(prev => [...prev, ...newPreviews]);
    setGroupingMode(null);
    setStudentGroups([]);
  }, [optimizeImages]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    addFilesToPreviews(files);
  }, [addFilesToPreviews]);

  const handleCameraCapture = useCallback((file: File) => {
    addFilesToPreviews([file]);
    setIsCameraOpen(false);
  }, [addFilesToPreviews]);

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
      const extractionPromises = newGroups.map(async (group) => {
        const formData = new FormData();
        formData.append("files", group.files[0].file);
        const res = await fetch("/api/extract-name", { method: "POST", body: formData });
        const result = await res.json();
        return { groupId: group.id, name: result.success ? result.name : "" };
      });
      const results = await Promise.all(extractionPromises);
      setStudentGroups(prev =>
        prev.map(group => {
          const foundResult = results.find(r => r.groupId === group.id);
          return { ...group, studentName: foundResult ? foundResult.name : '', isExtractingName: false };
        })
      );
    }
    setFilePreviews([]);
  };
  
  const updateStudentName = (groupId: string, name: string) => {
    setStudentGroups(prev => prev.map(g => (g.id === groupId ? { ...g, studentName: name } : g)));
  };

  const addNewStudentGroup = () => {
    setStudentGroups(prev => [...prev, { id: `group_${Date.now()}`, studentName: "", files: [] }]);
  };
  
  const handleDragStart = (e: React.DragEvent, fileId: string) => {
    setDraggedFile(fileId);
  };

  const handleDrop = (e: React.DragEvent, targetGroupId: string | null) => {
    e.preventDefault();
    if (!draggedFile) return;

    let sourceGroupId: string | null = null;
    let draggedFileObj: FilePreview | null = null;

    if (filePreviews.some(f => f.id === draggedFile)) {
      sourceGroupId = 'preview-area';
      draggedFileObj = filePreviews.find(f => f.id === draggedFile) || null;
    } else {
      for (const group of studentGroups) {
        const file = group.files.find(f => f.id === draggedFile);
        if (file) {
          sourceGroupId = group.id;
          draggedFileObj = file;
          break;
        }
      }
    }
    
    if (!draggedFileObj || sourceGroupId === targetGroupId) {
      setDraggedFile(null);
      return;
    }

    if (sourceGroupId === 'preview-area' && targetGroupId) {
      setFilePreviews(prev => prev.filter(f => f.id !== draggedFile));
      setStudentGroups(prev => prev.map(g => g.id === targetGroupId ? { ...g, files: [...g.files, draggedFileObj!] } : g));
    } else if (sourceGroupId && !targetGroupId) {
      let fileToMove: FilePreview | null = null;
      setStudentGroups(prev => prev.map(g => {
          if (g.id === sourceGroupId) {
              fileToMove = g.files.find(f => f.id === draggedFile)!;
              return { ...g, files: g.files.filter(f => f.id !== draggedFile) };
          }
          return g;
      }).filter(g => g.files.length > 0 || g.studentName.trim() !== ''));
      if(fileToMove) setFilePreviews(prev => [...prev, fileToMove!]);
    } else if (sourceGroupId && targetGroupId) {
      let fileToMove: FilePreview | null = null;
      setStudentGroups(prev => {
        const fromGroup = prev.find(g => g.id === sourceGroupId);
        fileToMove = fromGroup!.files.find(f => f.id === draggedFile)!;

        const newGroups = prev.map(g => {
          if (g.id === sourceGroupId) return { ...g, files: g.files.filter(f => f.id !== draggedFile) };
          if (g.id === targetGroupId) return { ...g, files: [...g.files, fileToMove!] };
          return g;
        });
        return newGroups.filter(g => g.files.length > 0 || g.studentName.trim() !== '');
      });
    }
    setDraggedFile(null);
  };
  
  const evaluateDocuments = async () => {
    const groupsToEvaluate = studentGroups.filter(g => g.files.length > 0 && g.studentName.trim());
    if (groupsToEvaluate.length === 0) { alert("Por favor, crea grupos con nombres y archivos para evaluar."); return; }
    if (!currentEvaluation.rubrica.trim()) { alert("Por favor, proporciona una rúbrica de evaluación."); return; }

    setIsLoading(true);
    const progressInitialState = { total: groupsToEvaluate.length, completed: 0, current: "Iniciando...", successes: 0, failures: 0 };
    setEvaluationProgress(progressInitialState);

    const evaluationPromises = groupsToEvaluate.map((group, index) => {
        const formData = new FormData();
        group.files.forEach(fp => formData.append("files", fp.file));
        formData.append("config", JSON.stringify({ ...config, ...currentEvaluation, studentName: group.studentName }));

        setEvaluationProgress(prev => prev ? { ...prev, current: `Enviando ${index + 1}/${groupsToEvaluate.length}: ${group.studentName}...` } : null);
        
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
          .catch(error => ({ status: 'rejected', reason: error.error || error.message || 'Error desconocido', groupName: group.studentName }));
    });

    const results = await Promise.allSettled(evaluationPromises);
    
    const successfulEvals: StudentEvaluation[] = [];
    const failedEvals: string[] = [];

    results.forEach((res, i) => {
        const groupName = groupsToEvaluate[i].studentName;
        if (res.status === 'fulfilled' && res.value.status === 'fulfilled') {
            successfulEvals.push(res.value.value);
        } else {
            const reason = res.status === 'rejected' ? res.reason : (res.value as any).reason;
            failedEvals.push(`${groupName}: ${reason}`);
        }
    });
    
    setEvaluationProgress(prev => prev ? { ...prev, completed: prev.total, current: 'Finalizado' } : null);

    if (successfulEvals.length > 0) {
        saveEvaluations(successfulEvals);
        setActiveTab("results");
    }
    
    let message = `Evaluación finalizada.\n\nÉxitos: ${successfulEvals.length}\nFallos: ${failedEvals.length}`;
    if (failedEvals.length > 0) message += `\n\nErrores:\n${failedEvals.join("\n")}`;
    alert(message);
    
    setStudentGroups([]);
    setFilePreviews([]);
    setGroupingMode(null);
    setIsLoading(false);
    setEvaluationProgress(null);
  };
  
  const clearHistory = () => {
    if (confirm("¿Borrar PERMANENTEMENTE todo el historial?")) {
      saveEvaluations([]);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (bytes === undefined) return "";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };
  
  const FilePreviewCard = ({ filePreview, onRemove, isDraggable = true, inGroup = false }: { filePreview: FilePreview, onRemove?: () => void, isDraggable?: boolean, inGroup?: boolean }) => (
    <div className={`relative border rounded-lg p-2 bg-white ${isDraggable ? "cursor-move" : ""}`} draggable={isDraggable} onDragStart={(e) => isDraggable && handleDragStart(e, filePreview.id)}>
      <div className="flex flex-col items-center space-y-1 text-center">
        {filePreview.type === "image" && filePreview.preview ? <img src={filePreview.preview} alt={filePreview.file.name} className="w-20 h-20 object-cover rounded-md" /> : <FileIcon className="w-20 h-20 text-gray-300" />}
        <p className="text-xs w-full truncate" title={filePreview.file.name}>{filePreview.file.name}</p>
        {optimizeImages && filePreview.originalSize && filePreview.compressedSize && filePreview.originalSize > filePreview.compressedSize && (
          <Badge variant="outline" className="text-xs font-normal text-green-600 border-green-200"><Zap className="w-3 h-3 mr-1" />{formatFileSize(filePreview.compressedSize)}</Badge>
        )}
      </div>
      {onRemove && (<button onClick={onRemove} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600"><X className="w-3 h-3" /></button>)}
    </div>
  );
  
  const StudentFeedbackTab = ({ evaluation }: { evaluation: StudentEvaluation }) => (
    <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-lg"><h3 className="font-semibold text-blue-900 mb-2">📋 Resumen de Evaluación</h3><p className="text-blue-800">{evaluation.feedback_estudiante?.resumen || "Sin resumen disponible."}</p></div>
        <div className="text-center"><div className="inline-flex items-center gap-4 bg-gray-100 px-6 py-4 rounded-lg"><span className="text-lg font-medium">Nota Final:</span><Badge variant="secondary" className="text-2xl px-4 py-2">{typeof evaluation.notaFinal === 'number' ? evaluation.notaFinal.toFixed(1) : "N/A"}</Badge></div></div>
        <div>
            <h3 className="font-semibold text-green-700 mb-3 flex items-center gap-2"><CheckCircle className="w-5 h-5" />Fortalezas</h3>
            <div className="space-y-3">{evaluation.feedback_estudiante?.fortalezas?.map((fortaleza: any, index: number) => <div key={index} className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400"><p className="font-medium text-green-800">{fortaleza.descripcion}</p><p className="text-sm text-green-700 mt-2 italic">"{fortaleza.cita}"</p></div>) || <p className="text-gray-500 italic">No se identificaron fortalezas específicas.</p>}</div>
        </div>
        <div>
            <h3 className="font-semibold text-orange-700 mb-3 flex items-center gap-2"><AlertCircle className="w-5 h-5" />Áreas para Mejorar</h3>
            <div className="space-y-3">{evaluation.feedback_estudiante?.oportunidades?.map((oportunidad: any, index: number) => <div key={index} className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-400"><p className="font-medium text-orange-800">{oportunidad.descripcion}</p><p className="text-sm text-orange-700 mt-2 italic">"{oportunidad.cita}"</p>{oportunidad.sugerencia_tecnica && <div className="mt-3 p-2 bg-blue-100 rounded text-sm"><strong className="text-blue-800">💡 Consejo:</strong><span className="text-blue-700 ml-1">{oportunidad.sugerencia_tecnica}</span></div>}</div>) || <p className="text-gray-500 italic">No se identificaron áreas específicas de mejora.</p>}</div>
        </div>
        {evaluation.feedback_estudiante?.siguiente_paso_sugerido && <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400"><h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2"><Brain className="w-5 h-5" />Próximo Desafío</h3><p className="text-blue-700">{evaluation.feedback_estudiante.siguiente_paso_sugerido}</p></div>}
    </div>
  );

  const TeacherAnalysisTab = ({ evaluation }: { evaluation: StudentEvaluation }) => (
    <div className="space-y-6">
        <div>
            <h3 className="font-semibold text-purple-700 mb-4 flex items-center gap-2"><Brain className="w-5 h-5" />Análisis de Habilidades</h3>
            <div className="grid gap-4">{evaluation.analisis_habilidades && Object.keys(evaluation.analisis_habilidades).length > 0 ? Object.entries(evaluation.analisis_habilidades).map(([habilidad, datos]: [string, any]) => <div key={habilidad} className="border rounded-lg p-4"><div className="flex justify-between items-start mb-2"><h4 className="font-medium">{habilidad}</h4><Badge variant={datos.nivel === "Destacado" ? "default" : datos.nivel === "Competente" ? "secondary" : "outline"}>{datos.nivel}</Badge></div><p className="text-sm text-gray-600 mb-2"><strong>Evidencia:</strong> {datos.evidencia_especifica}</p><p className="text-sm text-gray-500"><strong>Justificación:</strong> {datos.justificacion_pedagogica}</p></div>) : <p className="text-gray-500 italic">No se registraron habilidades específicas.</p>}</div>
        </div>
        <div>
            <h3 className="font-semibold text-blue-700 mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5" />Evaluación por Rúbrica</h3>
            <div className="space-y-3">{evaluation.analisis_detallado?.map((criterio: any, index: number) => <div key={index} className="border rounded-lg p-4 bg-gray-50"><div className="flex justify-between items-start mb-3"><h4 className="font-medium text-gray-900">{criterio.criterio}</h4><Badge variant="outline" className="font-mono">{criterio.puntaje}</Badge></div><div className="space-y-2"><div><span className="text-sm font-medium text-green-700">Evidencia:</span><p className="text-sm text-gray-600 mt-1">{criterio.evidencia}</p></div><div><span className="text-sm font-medium text-blue-700">Justificación:</span><p className="text-sm text-gray-600 mt-1">{criterio.justificacion}</p></div></div></div>) || <p className="text-gray-500 italic">No se registró análisis detallado por criterios.</p>}</div>
        </div>
        {evaluation.analisis_profesor && <div className="bg-gray-50 p-4 rounded-lg"><h3 className="font-semibold text-gray-700 mb-3">📝 Notas del Profesor</h3><div className="space-y-3 text-sm"><div><strong>Desempeño General:</strong><p className="text-gray-600 mt-1">{evaluation.analisis_profesor.desempeno_general}</p></div><div><strong>Patrones Observados:</strong><p className="text-gray-600 mt-1">{evaluation.analisis_profesor.patrones_observados}</p></div><div><strong>Sugerencia Pedagógica:</strong><p className="text-gray-600 mt-1">{evaluation.analisis_profesor.sugerencia_pedagogica}</p></div></div></div>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-2">✨ Genius Evaluator X</h1>
          <p className="text-gray-600">Sistema de Evaluación Inteligente con IA - Optimizado</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="evaluate" className="flex items-center gap-2"><Brain className="w-4 h-4" /> Evaluar</TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Resultados</TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2"><FileText className="w-4 h-4" /> Historial</TabsTrigger>
          </TabsList>
          
          <TabsContent value="evaluate" className="space-y-6 pt-6">
            {isLoading && evaluationProgress && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-blue-900">Evaluación en Progreso</h3>
                      <Badge variant="secondary">{evaluationProgress.completed}/{evaluationProgress.total}</Badge>
                    </div>
                    <Progress value={(evaluationProgress.completed / evaluationProgress.total) * 100} className="w-full" />
                    <p className="text-sm text-blue-700">{evaluationProgress.current}</p>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <Card>
              <CardHeader><CardTitle>1. Información General</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="nombre-prueba">Nombre de la Evaluación</Label><Input id="nombre-prueba" value={currentEvaluation.nombrePrueba} onChange={(e) => setCurrentEvaluation(prev => ({...prev, nombrePrueba: e.target.value}))} placeholder="Ej: Ensayo Final" /></div>
                  <div className="space-y-2"><Label htmlFor="curso">Curso</Label><Input id="curso" value={currentEvaluation.curso} onChange={(e) => setCurrentEvaluation(prev => ({...prev, curso: e.target.value}))} placeholder="Ej: 3ro Medio A" /></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />2. Configuración y Optimización</CardTitle></CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2"><Label>Sistema de Calificación</Label><Select value={config.sistema} onValueChange={(value) => setConfig((prev) => ({ ...prev, sistema: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="chile_2_7">Chile (2.0 - 7.0)</SelectItem><SelectItem value="latam_1_10">Estándar (1 - 10)</SelectItem><SelectItem value="porcentual_0_100">Porcentual (0 - 100)</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label htmlFor="nivel-exigencia">Exigencia (%)</Label><Input id="nivel-exigencia" type="number" min="1" max="100" value={config.nivelExigencia} onChange={(e) => setConfig((prev) => ({ ...prev, nivelExigencia: Number(e.target.value) }))} /></div>
                    <div className="space-y-2"><Label htmlFor="puntaje-maximo">Puntaje Máximo</Label><Input id="puntaje-maximo" type="number" min="1" value={config.puntajeMaximo} onChange={(e) => setConfig((prev) => ({ ...prev, puntajeMaximo: Number(e.target.value) }))} /></div>
                    <div className="space-y-2"><Label htmlFor="nota-aprobacion">Nota Aprobación</Label><Input id="nota-aprobacion" type="number" step="0.1" value={config.notaAprobacion} onChange={(e) => setConfig((prev) => ({ ...prev, notaAprobacion: Number(e.target.value) }))} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2"><Label>Modelo de IA</Label><Select value={config.aiModel} onValueChange={(value) => setConfig((prev) => ({ ...prev, aiModel: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mistral-small-latest"><div className="flex items-center gap-2"><Zap className="w-4 h-4 text-green-500" /><span>Rápido y Eficiente</span></div></SelectItem><SelectItem value="mistral-large-latest"><div className="flex items-center gap-2"><Brain className="w-4 h-4 text-blue-500" /><span>Potente y Detallado</span></div></SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label>Flexibilidad de IA: {config.flexibility}/10</Label><Slider value={[config.flexibility]} onValueChange={(value) => setConfig((prev) => ({ ...prev, flexibility: value[0] }))} max={10} step={1} /><div className="flex justify-between text-xs text-gray-500"><span>Estricto</span><span>Flexible</span></div></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>3. Cargar y Organizar Documentos</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <div className="flex gap-4 justify-center">
                        <Label htmlFor="file-upload" className="cursor-pointer"><Button variant="outline" asChild><span><Upload className="w-4 h-4 mr-2" />Subir Archivos</span></Button></Label>
                        <Input type="file" multiple accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" id="file-upload" />
                        <Button onClick={() => setIsCameraOpen(true)} variant="outline"><Camera className="w-4 h-4 mr-2" />Usar Cámara</Button>
                    </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div className="space-y-0.5"><Label htmlFor="optimize-images">Optimizar Imágenes</Label><p className="text-xs text-gray-500">Acelera el proceso reduciendo el tamaño.</p></div><Switch id="optimize-images" checked={optimizeImages} onCheckedChange={setOptimizeImages} /></div>
                
                {filePreviews.length > 0 && (
                  <div className="space-y-4 pt-4 border-t">
                    <div onDragOver={handleDragOver} onDrop={e => handleDrop(e, null)}>
                      <Label className="text-sm font-medium mb-2 block">Archivos Cargados ({filePreviews.length})</Label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 p-2 border rounded-lg min-h-[120px] bg-white">
                        {filePreviews.map(fp => <FilePreviewCard key={fp.id} filePreview={fp} onRemove={() => removeFilePreview(fp.id)} />)}
                      </div>
                    </div>
                    {!groupingMode && (
                      <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>
                          <strong>Los archivos corresponden a:</strong>
                          <div className="flex gap-4 mt-2">
                              <Button onClick={() => handleGroupingModeSelect("single")} variant="outline" size="sm"><User className="w-4 h-4 mr-2" />Un Solo Estudiante</Button>
                              <Button onClick={() => handleGroupingModeSelect("multiple")} variant="outline" size="sm"><Users className="w-4 h-4 mr-2" />Varios Estudiantes</Button>
                          </div>
                      </AlertDescription></Alert>
                    )}
                  </div>
                )}

                {studentGroups.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                    <CardHeader className="p-0 mb-2"><CardTitle className="flex justify-between items-center"><span>Organización de Estudiantes</span>{groupingMode === "multiple" && (<Button onClick={addNewStudentGroup} variant="outline" size="sm"><Plus className="w-4 h-4 mr-2" />Añadir Grupo</Button>)}</CardTitle></CardHeader>
                    {studentGroups.map(group => (
                        <div key={group.id} className="border rounded-lg p-4 bg-gray-50 min-h-[140px]" onDragOver={handleDragOver} onDrop={e => handleDrop(e, group.id)}>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="flex-1 flex items-center gap-2">
                                <Input value={group.studentName} onChange={e => updateStudentName(group.id, e.target.value)} placeholder="Nombre Estudiante..." />
                                {group.isExtractingName && <Loader2 className="w-4 h-4 animate-spin" />}
                            </div>
                            <Badge variant="secondary">{group.files.length} archivo(s)</Badge>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                            {group.files.map(fp => <FilePreviewCard key={fp.id} filePreview={fp} groupId={group.id} isDraggable={groupingMode === 'multiple'} showRemove={false} />)}
                        </div>
                        </div>
                    ))}
                </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader><CardTitle>4. Rúbrica y Claves</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label htmlFor="rubrica">Rúbrica</Label><Textarea id="rubrica" value={currentEvaluation.rubrica} onChange={e => setCurrentEvaluation(prev => ({...prev, rubrica: e.target.value}))} placeholder="Criterio 1: (6 Pts)..." rows={5} /></div>
                <div className="space-y-2"><Label htmlFor="preguntas-objetivas">Respuestas Correctas (Opcional)</Label><Textarea id="preguntas-objetivas" value={currentEvaluation.preguntasObjetivas} onChange={e => setCurrentEvaluation(prev => ({...prev, preguntasObjetivas: e.target.value}))} placeholder="1. Verdadero (2 Pts)..." rows={3} /></div>
              </CardContent>
            </Card>

            <Button onClick={evaluateDocuments} disabled={isLoading || (filePreviews.length === 0 && studentGroups.length === 0) || !currentEvaluation.rubrica.trim()} className="w-full text-lg py-6" >
              {isLoading ? (<><Clock className="w-5 h-5 mr-2 animate-spin" />{loadingMessage}</>) : (<><Brain className="w-5 h-5 mr-2" /> Iniciar Evaluación</>)}
            </Button>
          </TabsContent>

          <TabsContent value="results" className="space-y-6 pt-6">
            <Card>
                <CardHeader><CardTitle>Resultados Obtenidos</CardTitle></CardHeader>
                <CardContent>
                    {!evaluations || evaluations.length === 0 ? (
                        <div className="text-center py-8"><GraduationCap className="w-16 h-16 mx-auto text-gray-400 mb-4" /><p className="text-gray-600">Aún no hay resultados para mostrar.</p></div>
                    ) : (
                        <div className="space-y-4">
                            {evaluations.map((evaluation) => (
                                <Dialog key={evaluation.id}>
                                    <DialogTrigger asChild>
                                        <Card className="cursor-pointer hover:shadow-md transition-shadow">
                                            <CardContent className="p-4 flex justify-between items-center">
                                                <div>
                                                    <p className="font-semibold">{evaluation.nombreEstudiante}</p>
                                                    <p className="text-sm text-gray-500">{evaluation.nombrePrueba} - {evaluation.curso}</p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <Badge variant="secondary" className="text-lg px-3 py-1">{typeof evaluation.notaFinal === 'number' ? evaluation.notaFinal.toFixed(1) : "N/A"}</Badge>
                                                    <Eye className="w-5 h-5 text-gray-400" />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
                                        <DialogHeader><DialogTitle className="flex items-center gap-2"><GraduationCap className="w-5 h-5" />Reporte de {evaluation.nombreEstudiante}</DialogTitle></DialogHeader>
                                        <div className="overflow-y-auto p-1 pr-4">
                                            <Tabs defaultValue="student" className="w-full">
                                                <TabsList className="grid w-full grid-cols-2">
                                                    <TabsTrigger value="student">Retroalimentación (Estudiante)</TabsTrigger>
                                                    <TabsTrigger value="teacher">Análisis (Profesor)</TabsTrigger>
                                                </TabsList>
                                                <TabsContent value="student" className="mt-4"><StudentFeedbackTab evaluation={evaluation} /></TabsContent>
                                                <TabsContent value="teacher" className="mt-4"><TeacherAnalysisTab evaluation={evaluation} /></TabsContent>
                                            </Tabs>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="history" className="space-y-6 pt-6">
             <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>Historial Completo</span>
                  <div className="flex gap-2">
                    <Button onClick={copyToClipboard} variant="outline" size="sm"><Copy className="w-4 h-4 mr-2" /> Copiar</Button>
                    <Button onClick={exportToCSV} variant="outline" size="sm"><Download className="w-4 h-4 mr-2" /> CSV</Button>
                    <Button onClick={clearHistory} variant="destructive" size="sm"><Trash2 className="w-4 h-4 mr-2" /> Limpiar</Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evaluations.length === 0 ? (
                   <div className="text-center py-8"><FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" /><p className="text-gray-600">No hay historial para mostrar.</p></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b"><th className="p-2 text-left font-medium">Estudiante</th><th className="p-2 text-left font-medium">Curso</th><th className="p-2 text-left font-medium">Evaluación</th><th className="p-2 text-left font-medium">Nota</th><th className="p-2 text-left font-medium">Puntaje</th><th className="p-2 text-left font-medium">Fecha</th></tr></thead>
                      <tbody>
                        {evaluations.map((evaluation) => (
                          <tr key={evaluation.id} className="border-b hover:bg-gray-50">
                            <td className="p-2">{evaluation.nombreEstudiante}</td>
                            <td className="p-2">{evaluation.curso}</td>
                            <td className="p-2">{evaluation.nombrePrueba}</td>
                            <td className="p-2"><Badge variant={evaluation.notaFinal >= 4.0 ? "default" : "destructive"} className="font-semibold">{typeof evaluation.notaFinal === 'number' ? evaluation.notaFinal.toFixed(1) : 'N/A'}</Badge></td>
                            <td className="p-2">{evaluation.puntajeObtenido ?? 'N/A'}/{evaluation.configuracion?.puntajeMaximo || 'N/A'}</td>
                            <td className="p-2">{evaluation.configuracion?.fecha || 'N/A'}</td>
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
        
        <SmartCameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCameraCapture} />
      </div>
    </div>
  )
}