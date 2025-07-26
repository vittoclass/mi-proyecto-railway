'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { EvaluatorClient } from './EvaluatorClient';
import { ThemeProvider } from './theme-provider';

// ? Importación dinámica del modal de cámara
const SmartCameraModal = dynamic(
  () => import('./smart-camera-modal'),
  {
    ssr: false,
    loading: () => <p>Cargando cámara...</p>,
  }
);

export default function LibelIA() {
  const [file, setFile] = useState<File | null>(null);
  const [rubric, setRubric] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleCapture = (file: File) => {
    setFile(file);
    setShowCamera(false);
  };

  const handleSubmit = async () => {
    if (!file || !rubric.trim()) return;

    setLoading(true);
    try {
      const result = await EvaluatorClient.evaluate(file, rubric);
      setEvaluation(result);
    } catch (err) {
      console.error(err);
      alert('Error al evaluar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-2 text-gray-800">
            LibelIA
          </h1>
          <p className="text-center text-gray-600 mb-12">
            Evalúa trabajos estudiantiles con inteligencia artificial
          </p>

          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subir trabajo estudiantil
                </label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" /> Subir Imagen
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowCamera(true)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="mr-2 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    Cámara
                  </Button>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {file && (
                  <p className="mt-2 text-sm text-gray-600">
                    Archivo: {file.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rúbrica de evaluación
                </label>
                <textarea
                  value={rubric}
                  onChange={(e) => setRubric(e.target.value)}
                  placeholder="Ej: Creatividad, organización, contenido, ortografía..."
                  className="w-full p-3 border border-gray-300 rounded-md h-32 resize-none"
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!file || !rubric.trim() || loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? 'Evaluando...' : 'Evaluar con IA'}
              </Button>
            </div>

            {evaluation && (
              <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Resultado</h3>
                <p><strong>Nota:</strong> {evaluation.grade}</p>
                <p><strong>Puntaje:</strong> {evaluation.score}/100</p>
                <p><strong>Feedback:</strong> {evaluation.feedback}</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal de cámara */}
        <SmartCameraModal
          open={showCamera}
          onClose={() => setShowCamera(false)}
          onCapture={handleCapture}
        />
      </div>
    </ThemeProvider>
  );
}