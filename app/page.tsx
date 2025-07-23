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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
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
} from "lucide-react"

// --- INTERFACES ---
interface EvaluationConfig {
  sistema: string; nivelExigencia: number; puntajeMaximo: number; notaAprobacion: number; flexibility: number; fecha: string;
}
interface FilePreview {
  id: string; file: File; preview?: string; type: "image" | "pdf" | "other";
}
interface StudentGroup {
  id: string; studentName: string; files: FilePreview[]; isExtractingName?: boolean;
}
interface StudentEvaluation {
  id: string; nombreEstudiante: string; nombrePrueba: string; curso: string; notaFinal: number; puntajeObtenido: number; configuracion: EvaluationConfig; feedback_estudiante: any; analisis_profesor: any; analisis_detallado: any[]; filesPreviews?: FilePreview[];
}

// --- COMPONENTE PRINCIPAL ---
export default function GeniusEvaluator() {
  const [activeTab, setActiveTab] = useState("evaluate");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Evaluando...");
  const [evaluations, setEvaluations] = useState<StudentEvaluation[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [draggedFile, setDraggedFile] = useState<string | null>(null);
  
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
  });

  useEffect(() => {
    try {
      const savedEvaluations = localStorage.getItem("evaluations");
      if (savedEvaluations) {
        const parsed = JSON.parse(savedEvaluations);
        if (Array.isArray(parsed)) {
          setEvaluations(parsed);
        }
      }
    } catch (error) {
      console.error("Error al cargar evaluaciones de localStorage:", error);
      localStorage.removeItem("evaluations");
    }
  }, []);

  const saveEvaluations = (newEvaluations: StudentEvaluation[]) => {
    setEvaluations(newEvaluations);
    localStorage.setItem("evaluations", JSON.stringify(newEvaluations));
  };

  const createFilePreview = async (file: File): Promise<FilePreview> => {
    const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let preview = undefined;
    let type: "image" | "pdf" | "other" = "other";
    if (file.type.startsWith("image/")) {
      type = "image";
      preview = URL.createObjectURL(file);
    } else if (file.type === "application/pdf") {
      type = "pdf";
    }
    return { id, file, preview, type };
  };

  const extractNameFromFile = async (filePreview: FilePreview): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append("file", filePreview.file);
      const response = await fetch("/api/extract-name", { method: "POST", body: formData });
      const result = await response.json();
      return result.success ? result.name : "";
    } catch (error) {
      console.error("Error extracting name:", error);
      return "";
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    for (const file of files) {
      const filePreview = await createFilePreview(file);
      const newGroupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newGroup: StudentGroup = {
        id: newGroupId, studentName: "", files: [filePreview], isExtractingName: true,
      };
      setStudentGroups((prev) => [...prev, newGroup]);
      const extractedName = await extractNameFromFile(filePreview);
      setStudentGroups((prev) =>
        prev.map((group) =>
          group.id === newGroupId ? { ...group, studentName: extractedName, isExtractingName: false } : group,
        ),
      );
    }
  };

  const removeFileFromGroup = (groupId: string, fileId: string) => {
    setStudentGroups((prev) =>
      prev.map((group) => {
          if (group.id === groupId) {
            const updatedFiles = group.files.filter((f) => f.id !== fileId);
            return updatedFiles.length > 0 ? { ...group, files: updatedFiles } : null;
          }
          return group;
        }).filter(Boolean) as StudentGroup[],
    );
  };

  const addNewStudentGroup = () => {
    const newGroup: StudentGroup = {
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, studentName: "", files: [],
    };
    setStudentGroups((prev) => [...prev, newGroup]);
  };

  const updateStudentName = (groupId: string, name: string) => {
    setStudentGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, studentName: name } : group)));
  };

  const handleDragStart = (fileId: string) => setDraggedFile(fileId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  
  const handleDrop = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    if (!draggedFile) return;
    let sourceGroupId = "";
    let draggedFileObj: FilePreview | null = null;
    for (const group of studentGroups) {
      const file = group.files.find((f) => f.id === draggedFile);
      if (file) {
        sourceGroupId = group.id;
        draggedFileObj = file;
        break;
      }
    }
    if (!draggedFileObj || sourceGroupId === targetGroupId) return;
    setStudentGroups((prev) =>
      prev.map((group) => {
        if (group.id === sourceGroupId) {
          const updatedFiles = group.files.filter((f) => f.id !== draggedFile);
          return updatedFiles.length > 0 ? { ...group, files: updatedFiles } : null;
        } else if (group.id === targetGroupId) {
          return { ...group, files: [...group.files, draggedFileObj!] };
        }
        return group;
      }).filter(Boolean) as StudentGroup[],
    );
    setDraggedFile(null);
  };
  
  const evaluateDocuments = async () => {
    const groupsToEvaluate = studentGroups.filter(g => g.files.length > 0);
    if (groupsToEvaluate.length === 0) {
      alert("Por favor, sube y agrupa al menos un documento.");
      return;
    }
    if (!currentEvaluation.rubrica.trim()) {
      alert("Por favor, proporciona una rúbrica de evaluación.");
      return;
    }

    setIsLoading(true);
    setLoadingMessage(`Iniciando evaluación para ${groupsToEvaluate.length} estudiante(s)...`);

    const evaluationPromises = groupsToEvaluate.map((group, index) => {
      const formData = new FormData();
      group.files.forEach((filePreview) => formData.append("files", filePreview.file));
      formData.append(
        "config",
        JSON.stringify({
          ...config,
          nombrePrueba: currentEvaluation.nombrePrueba,
          curso: currentEvaluation.curso,
          rubrica: currentEvaluation.rubrica,
          preguntasObjetivas: currentEvaluation.preguntasObjetivas,
        }),
      );

      return fetch("/api/evaluate", {
        method: "POST",
        body: formData,
      })
      .then(response => {
        if (!response.ok) {
            return response.json().then(err => Promise.reject(err));
        }
        return response.json();
      })
      .then(result => {
        if (result.success && result.evaluations.length > 0) {
          const evaluation = result.evaluations[0];
          if (group.studentName.trim()) {
            evaluation.nombreEstudiante = group.studentName;
          }
          evaluation.filesPreviews = group.files;
          return { status: 'fulfilled', value: evaluation };
        } else {
          return Promise.reject(result);
        }
      })
      .catch(error => {
        return { status: 'rejected', reason: `Fallo al evaluar a ${group.studentName || 'desconocido'}: ${error.error || error.message || 'error desconocido'}` };
      });
    });

    const results = await Promise.allSettled(evaluationPromises);
    
    const successfulEvaluations: StudentEvaluation[] = [];
    const failedEvaluations: string[] = [];

    results.forEach((result, index) => {
        const groupName = groupsToEvaluate[index].studentName || `Grupo ${index + 1}`;
        if (result.status === 'fulfilled') {
            successfulEvaluations.push(result.value);
        } else {
            failedEvaluations.push(`${groupName}: ${result.reason}`);
        }
    });

    if (successfulEvaluations.length > 0) {
      const allEvaluations = [...evaluations, ...successfulEvaluations];
      saveEvaluations(allEvaluations);
      setActiveTab("results");
    }

    if(failedEvaluations.length > 0) {
        alert(`❌ Evaluación completada con errores.\n\nÉxitos: ${successfulEvaluations.length}\nFallos: ${failedEvaluations.length}\n\nDetalles:\n${failedEvaluations.join("\n")}`);
    } else if (successfulEvaluations.length > 0) {
        alert(`✅ Evaluación completada. ${successfulEvaluations.length} estudiantes evaluados.`);
    } else {
        alert("No se pudo completar ninguna evaluación.");
    }

    setStudentGroups([]);
    setIsLoading(false);
  };

  const exportToCSV = () => {
    if (evaluations.length === 0) { return; }
    const headers = ["Estudiante", "Curso", "Evaluación", "Nota Final", "Puntaje", "Fecha"];
    const rows = evaluations.map((evaluation) => [
      evaluation.nombreEstudiante,
      evaluation.curso,
      evaluation.nombrePrueba,
      typeof evaluation.notaFinal === 'number' ? evaluation.notaFinal.toFixed(1) : 'N/A',
      `${evaluation.puntajeObtenido}/${evaluation.configuracion?.puntajeMaximo || 'N/A'}`,
      evaluation.configuracion?.fecha || 'N/A',
    ]);
    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evaluaciones_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    if (evaluations.length === 0) { return; }
    const headers = ["Estudiante", "Curso", "Evaluación", "Nota Final"];
    const rows = evaluations.map((evaluation) => [
      evaluation.nombreEstudiante,
      evaluation.curso,
      evaluation.nombrePrueba,
      typeof evaluation.notaFinal === 'number' ? evaluation.notaFinal.toFixed(1) : 'N/A',
    ]);
    const tsvContent = [headers, ...rows].map((row) => row.join("\t")).join("\n");
    try {
      await navigator.clipboard.writeText(tsvContent);
      alert("✅ Datos copiados al portapapeles");
    } catch (error) {
      alert("❌ Error al copiar los datos");
    }
  };
  
  const clearHistory = () => {
    if (confirm("¿Borrar PERMANENTEMENTE todo el historial?")) {
      saveEvaluations([]);
    }
  };

  const FilePreviewCard = ({ filePreview, groupId, isDraggable = true }: { filePreview: FilePreview; groupId: string; isDraggable?: boolean; }) => (
    <div className={`relative border-2 border-dashed border-gray-300 rounded-lg p-2 bg-white ${isDraggable ? "cursor-move hover:border-blue-400" : ""}`} draggable={isDraggable} onDragStart={() => isDraggable && handleDragStart(filePreview.id)}>
      <div className="flex flex-col items-center space-y-2">
        {filePreview.type === "image" && filePreview.preview ? (
          <img src={filePreview.preview} alt={filePreview.file.name} className="w-16 h-16 object-cover rounded" />
        ) : filePreview.type === "pdf" ? (
          <FileIcon className="w-16 h-16 text-red-500" />
        ) : (
          <FileText className="w-16 h-16 text-gray-500" />
        )}
        <span className="text-xs text-center truncate w-full" title={filePreview.file.name}>{filePreview.file.name}</span>
      </div>
      {isDraggable && (<button onClick={() => removeFileFromGroup(groupId, filePreview.id)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"><X className="w-3 h-3" /></button>)}
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
          
          <TabsContent value="evaluate" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Información de la Evaluación</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre-prueba">Nombre de la Evaluación</Label>
                    <Input id="nombre-prueba" value={currentEvaluation.nombrePrueba} onChange={(e) => setCurrentEvaluation((prev) => ({ ...prev, nombrePrueba: e.target.value }))} placeholder="Ej: Ensayo Final - La Célula" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="curso">Curso</Label>
                    <Input id="curso" value={currentEvaluation.curso} onChange={(e) => setCurrentEvaluation((prev) => ({ ...prev, curso: e.target.value }))} placeholder="Ej: 3ro Medio A" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Configuración de Evaluación</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Sistema de Calificación</Label>
                    <Select value={config.sistema} onValueChange={(value) => setConfig((prev) => ({ ...prev, sistema: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="chile_2_7">Chile (2.0 - 7.0)</SelectItem>
                        <SelectItem value="latam_1_10">Estándar (1 - 10)</SelectItem>
                        <SelectItem value="porcentual_0_100">Porcentual (0 - 100)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nivel-exigencia">Nivel de Exigencia (%)</Label>
                    <Input id="nivel-exigencia" type="number" min="1" max="100" value={config.nivelExigencia} onChange={(e) => setConfig((prev) => ({ ...prev, nivelExigencia: Number.parseInt(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="puntaje-maximo">Puntaje Máximo</Label>
                    <Input id="puntaje-maximo" type="number" min="1" value={config.puntajeMaximo} onChange={(e) => setConfig((prev) => ({ ...prev, puntajeMaximo: Number.parseInt(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nota-aprobacion">Nota de Aprobación</Label>
                    <Input id="nota-aprobacion" type="number" step="0.1" max="7.0" value={config.notaAprobacion} onChange={(e) => setConfig((prev) => ({ ...prev, notaAprobacion: Number.parseFloat(e.target.value) }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nivel de Flexibilidad de la IA: {config.flexibility}/10</Label>
                  <Slider value={[config.flexibility]} onValueChange={(value) => setConfig((prev) => ({ ...prev, flexibility: value[0] }))} max={10} step={1} className="w-full" />
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Rígido / Literal</span>
                    <span>Equilibrado</span>
                    <span>Flexible / Holístico</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Cargar Documentos</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-4">Arrastra archivos aquí o haz clic para seleccionar</p>
                  <Input type="file" multiple accept="image/*,.pdf,.doc,.docx" onChange={handleFileUpload} className="hidden" id="file-upload" />
                  <Label htmlFor="file-upload" className="cursor-pointer"><Button variant="outline" asChild><span>Seleccionar Archivos</span></Button></Label>
                </div>
              </CardContent>
            </Card>

            {studentGroups.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span>Agrupar Evaluaciones por Estudiante</span>
                    <Button onClick={addNewStudentGroup} variant="outline" size="sm"><Plus className="w-4 h-4 mr-2" /> Nuevo Estudiante</Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {studentGroups.map((group) => (
                    <div key={group.id} className="border rounded-lg p-4 bg-gray-50" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, group.id)}>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex-1">
                          <Label htmlFor={`student-${group.id}`}>Nombre del Estudiante</Label>
                          <div className="flex items-center gap-2">
                            <Input id={`student-${group.id}`} value={group.studentName} onChange={(e) => updateStudentName(group.id, e.target.value)} placeholder="Nombre del estudiante..." className="flex-1" />
                            {group.isExtractingName && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                          </div>
                        </div>
                        <Badge variant="secondary">{group.files.length} archivo{group.files.length !== 1 ? "s" : ""}</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {group.files.map((filePreview) => (
                          <FilePreviewCard key={filePreview.id} filePreview={filePreview} groupId={group.id} />
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle>Rúbrica de Evaluación</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rubrica">Rúbrica de Desarrollo</Label>
                  <Textarea id="rubrica" value={currentEvaluation.rubrica} onChange={(e) => setCurrentEvaluation((prev) => ({ ...prev, rubrica: e.target.value }))} placeholder="Ej: Criterio 1: Identifica 3 causas (6 Puntos)..." rows={6} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preguntas-objetivas">Preguntas Objetivas (Opcional)</Label>
                  <Textarea id="preguntas-objetivas" value={currentEvaluation.preguntasObjetivas} onChange={(e) => setCurrentEvaluation((prev) => ({ ...prev, preguntasObjetivas: e.target.value }))} placeholder="Ej: Pregunta 1 (V/F): La respuesta correcta es Verdadero. (2 Puntos)" rows={4} />
                </div>
                <Button onClick={evaluateDocuments} disabled={isLoading || studentGroups.length === 0 || !currentEvaluation.rubrica.trim()} className="w-full" size="lg">
                  {isLoading ? (<><Clock className="w-4 h-4 mr-2 animate-spin" />{loadingMessage}</>) : (<><Brain className="w-4 h-4 mr-2" /> Iniciar Evaluación</>)}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Resultados de Evaluación</CardTitle></CardHeader>
              <CardContent>
                {!evaluations || evaluations.length === 0 ? (
                  <div className="text-center py-8"><GraduationCap className="w-16 h-16 mx-auto text-gray-400 mb-4" /><p className="text-gray-600">No hay evaluaciones disponibles</p></div>
                ) : (
                  <div className="space-y-4">
                    {evaluations.map((evaluation) => (
                      <Dialog key={evaluation.id}>
                        <DialogTrigger asChild>
                          <Card className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-md transition-shadow">
                            <CardContent className="pt-6">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="font-semibold text-lg">{evaluation.nombreEstudiante}</h3>
                                  <p className="text-gray-600 text-sm">{evaluation.nombrePrueba} - {evaluation.curso}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-lg px-3 py-1">{typeof evaluation.notaFinal === 'number' ? evaluation.notaFinal.toFixed(1) : 'N/A'}</Badge>
                                  <Eye className="w-4 h-4 text-gray-400" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader><DialogTitle className="flex items-center gap-2"><GraduationCap className="w-5 h-5" /> Carpeta de {evaluation.nombreEstudiante}</DialogTitle></DialogHeader>
                          <div className="space-y-6 p-1">
                            <div className="grid grid-cols-2 gap-4 border-b pb-4">
                              <div><Label className="text-sm font-medium">Evaluación</Label><p className="text-sm">{evaluation.nombrePrueba}</p></div>
                              <div><Label className="text-sm font-medium">Curso</Label><p className="text-sm">{evaluation.curso}</p></div>
                              <div><Label className="text-sm font-medium">Nota Final</Label><Badge variant="secondary" className="text-lg">{typeof evaluation.notaFinal === 'number' ? evaluation.notaFinal.toFixed(1) : 'N/A'}</Badge></div>
                              <div><Label className="text-sm font-medium">Puntaje</Label><p className="text-sm">{evaluation.puntajeObtenido}/{evaluation.configuracion?.puntajeMaximo || 'N/A'}</p></div>
                            </div>
                            {evaluation.filesPreviews && evaluation.filesPreviews.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium mb-2 block">Archivos Evaluados</h4>
                                <div className="grid grid-cols-4 gap-2">
                                  {evaluation.filesPreviews.map((filePreview) => (
                                    <FilePreviewCard key={filePreview.id} filePreview={filePreview} groupId="" isDraggable={false} />
                                  ))}
                                </div>
                              </div>
                            )}
                            {evaluation.feedback_estudiante && (
                              <div className="space-y-4">
                                <div><h4 className="text-sm font-medium">Resumen General</h4><p className="text-sm text-gray-600 mt-1">{evaluation.feedback_estudiante.resumen}</p></div>
                                <div>
                                  <h4 className="text-sm font-medium text-green-700">🌟 Fortalezas</h4>
                                  <div className="space-y-2 mt-1">
                                    {evaluation.feedback_estudiante.fortalezas?.map((fortaleza: any, index: number) => (<div key={index} className="bg-green-50 p-3 rounded-lg"><p className="font-medium text-sm">{fortaleza.descripcion}</p><p className="text-xs text-gray-600 mt-1 italic">"{fortaleza.cita}"</p></div>))}
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-sm font-medium text-orange-700">🚀 Oportunidades de Mejora</h4>
                                  <div className="space-y-2 mt-1">
                                    {evaluation.feedback_estudiante.oportunidades?.map((oportunidad: any, index: number) => (<div key={index} className="bg-orange-50 p-3 rounded-lg"><p className="font-medium text-sm">{oportunidad.descripcion}</p><p className="text-xs text-gray-600 mt-1 italic">"{oportunidad.cita}"</p></div>))}
                                  </div>
                                </div>
                                {evaluation.feedback_estudiante.siguiente_paso_sugerido && (<div><h4 className="text-sm font-medium text-blue-700">🎯 Siguiente Paso</h4><p className="text-sm text-gray-600 mt-1 bg-blue-50 p-3 rounded-lg">{evaluation.feedback_estudiante.siguiente_paso_sugerido}</p></div>)}
                              </div>
                            )}
                            {evaluation.analisis_detallado && evaluation.analisis_detallado.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium mb-2 block">Análisis por Criterio</h4>
                                <div className="space-y-2">
                                  {evaluation.analisis_detallado.map((criterio: any, index: number) => (
                                    <div key={index} className="border rounded-lg p-3">
                                      <div className="flex justify-between items-start mb-2"><h5 className="font-medium text-sm">{criterio.criterio}</h5><Badge variant="outline">{criterio.puntaje}</Badge></div>
                                      <p className="text-xs text-gray-700 mb-1"><span className="font-semibold">Evidencia:</span> {criterio.evidencia}</p>
                                      <p className="text-xs text-gray-500"><span className="font-semibold">Justificación:</span> {criterio.justificacion}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
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
                    <Button onClick={copyToClipboard} variant="outline" size="sm"><Copy className="w-4 h-4 mr-2" /> Copiar</Button>
                    <Button onClick={exportToCSV} variant="outline" size="sm"><Download className="w-4 h-4 mr-2" /> CSV</Button>
                    <Button onClick={clearHistory} variant="destructive" size="sm"><Trash2 className="w-4 h-4 mr-2" /> Limpiar</Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!evaluations || evaluations.length === 0 ? (
                   <div className="text-center py-8"><FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" /><p className="text-gray-600">No hay historial disponible</p></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead><tr className="border-b"><th className="text-left p-2">Estudiante</th><th className="text-left p-2">Curso</th><th className="text-left p-2">Evaluación</th><th className="text-left p-2">Nota</th><th className="text-left p-2">Puntaje</th><th className="text-left p-2">Fecha</th></tr></thead>
                      <tbody>
                        {evaluations.map((evaluation) => (
                          <tr key={evaluation.id} className="border-b hover:bg-gray-50">
                            <td className="p-2">{evaluation.nombreEstudiante}</td>
                            <td className="p-2">{evaluation.curso}</td>
                            <td className="p-2">{evaluation.nombrePrueba}</td>
                            <td className="p-2"><Badge variant="secondary">{typeof evaluation.notaFinal === 'number' ? evaluation.notaFinal.toFixed(1) : 'N/A'}</Badge></td>
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
      </div>
    </div>
  );
}
```