// Libel-IA.tsx
'use client';

import { useState } from 'react';
import { useEvaluatorClient } from './EvaluatorClient';
import SmartCameraModal from './smart-camera-modal';

export default function LibelIA() {
  const [fileUrl, setFileUrl] = useState<string>('');
  const [rubrica, setRubrica] = useState<string>('');
  const { evaluate, loading, result } = useEvaluatorClient();

  const handleEvaluate = () => {
    if (!fileUrl) {
      alert('Primero debes tomar o subir una imagen.');
      return;
    }
    if (!rubrica.trim()) {
      alert('Por favor, ingresa una rúbrica de evaluación.');
      return;
    }
    evaluate(fileUrl, rubrica);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">📝 Evaluación con IA</h1>

      {/* Rúbrica */}
      <div className="mb-6">
        <label className="block mb-2 font-medium text-gray-700">
          Rúbrica de evaluación
        </label>
        <textarea
          value={rubrica}
          onChange={(e) => setRubrica(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          rows={4}
          placeholder="Ej: Evalúa ortografía, claridad, estructura, coherencia, uso de vocabulario técnico..."
        />
      </div>

      {/* Módulo de cámara y subida */}
      <SmartCameraModal onCapture={setFileUrl} />

      {/* Resultado de evaluación */}
      {result && (
        <div
          className={`mt-6 p-4 rounded-lg border-l-4 ${
            result.success
              ? 'bg-green-50 border-green-400 text-green-800'
              : 'bg-red-50 border-red-400 text-red-800'
          }`}
        >
          <h3 className="font-bold text-lg">{result.success ? '✅ Éxito' : '❌ Error'}</h3>
          <p className="mt-1">{result.feedback || result.error}</p>
        </div>
      )}

      {/* Botón de evaluar */}
      <div className="mt-6">
        <button
          onClick={handleEvaluate}
          disabled={loading || !fileUrl || !rubrica.trim()}
          className={`w-full py-3 px-6 rounded-lg font-medium text-white transition
            ${loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
            }`}
        >
          {loading ? '🔄 Evaluando con IA...' : '⚡ Evaluar con IA'}
        </button>
      </div>
    </div>
  );
}