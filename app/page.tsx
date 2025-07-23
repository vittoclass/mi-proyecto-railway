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
import { SmartCameraModal } from "@/components/ui/smart-camera-modal" // <-- RUTA CORREGIDA
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
  id: string; nombreEstudiante: string; nombrePrueba: string; curso: string; notaFinal: number; puntajeObtenido: number; configuracion: EvaluationConfig; feedback_estudiante: any; analisis_profesor: any; analisis_detallado: any[]; filesPreviews?: FilePreview[];
}
interface EvaluationProgress {
  total: number; completed: number; current: string; successes: number; failures: number;
}
type GroupingMode = "single" | "multiple" | null

const compressImage = async (file: File): Promise<File> => {
  try {
    const imageCompression = (await import("browser-image-compression")).default
    const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true, quality: 0.7 }
    return await imageCompression(file, options)
  } catch (error) {
    console.warn("Error comprimiendo imagen, usando archivo original:", error)
    return file
  }
}

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
        setStudentGroups(prev => prev.map(group => {
            const found = results.find(r => r.groupId === group.id);
            return { ...group, studentName: found ? found.name : '', isExtractingName: false };
        }));
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
    let sourceGroupId: string | null = null;
    let draggedFileObj: FilePreview | null = null;

    for (const group of [...studentGroups, { id: 'preview-area', files: filePreviews }]) {
        const file = group.files.find(f => f.id === draggedFile);
        if (file) {
            sourceGroupId = group.id;
            draggedFileObj = file;
            break;
        }
    }

    if (!draggedFileObj || sourceGroupId === targetGroupId) return;

    if (sourceGroupId === 'preview-area') {
        setFilePreviews(prev => prev.filter(f => f.id !== draggedFile));
    } else {
        setStudentGroups(prev => prev.map(g => g.id === sourceGroupId ? { ...g, files: g.files.filter(f => f.id !== draggedFile) } : g));
    }

    setStudentGroups(prev => prev.map(g => g.id === targetGroupId ? { ...g, files: [...g.files, draggedFileObj!] } : g).filter(g => g.files.length > 0));
    setDraggedFile(null);
  };

  // ... (El resto de las funciones como evaluateDocuments, exportToCSV, etc. se mantienen)
  const evaluateDocuments = async () => {
      // ...
  };

  const FilePreviewCard = ({ filePreview, isDraggable = true, showRemove = true }: { filePreview: FilePreview; isDraggable?: boolean; showRemove?: boolean }) => (
      // ...
  );
  const StudentFeedbackTab = ({ evaluation }: { evaluation: StudentEvaluation }) => (
      // ...
  );
  const TeacherAnalysisTab = ({ evaluation }: { evaluation: StudentEvaluation }) => (
      // ...
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
            <h1 className="text-4xl font-bold">✨ Genius Evaluator X</h1>
            <p>Sistema de Evaluación Inteligente con IA - Optimizado</p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="evaluate">Evaluar</TabsTrigger>
                <TabsTrigger value="results">Resultados</TabsTrigger>
                <TabsTrigger value="history">Historial</TabsTrigger>
            </TabsList>
            <TabsContent value="evaluate" className="space-y-6">
                {/* ... Contenido de la pestaña Evaluar ... */}
                <Card>
                    <CardHeader><CardTitle>Cargar Documentos</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="border-2 border-dashed rounded-lg p-8 text-center">
                            <div className="flex gap-4 justify-center">
                                <Label htmlFor="file-upload" className="cursor-pointer">
                                    <Button variant="outline" asChild><span><Upload className="w-4 h-4 mr-2" />Seleccionar Archivos</span></Button>
                                </Label>
                                <Input type="file" multiple accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" id="file-upload" />
                                <Button onClick={() => setIsCameraOpen(true)} variant="outline" className="flex items-center gap-2">
                                    <Camera className="w-4 h-4" />Usar Cámara
                                </Button>
                            </div>
                        </div>
                        {/* ... Resto del JSX ... */}
                    </CardContent>
                </Card>
                {/* ... Resto del JSX ... */}
            </TabsContent>
            {/* ... Resto de las pestañas ... */}
        </Tabs>
        <SmartCameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCameraCapture} />
      </div>
    </div>
  );
}