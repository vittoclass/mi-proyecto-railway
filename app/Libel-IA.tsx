// app/Libel-IA.tsx
'use client';

import { useState } from 'react';
import { useEvaluator } from '@/hooks/useEvaluator'; // <-- 1. Importa el nuevo hook
import SmartCameraModal from '../components/smart-camera-modal'; // <-- Ajusta la ruta si es necesario

export default function LibelIA() {
  const [fileUrl, setFileUrl] = useState<string>('');
  const [rubrica, setRubrica] = useState<string>('');
  
  // 2. Usa el hook para obtener la lógica y el estado
  const { evaluate, isLoading, result } = useEvaluator();

  const handleEvaluate = () => {
    if (!fileUrl) {
      alert('Primero debes tomar o subir una imagen.');
      return;
    }
    if (!rubrica.trim()) {
      alert('Por favor, ingresa una rúbrica de evaluación.');
      return;
    }
    // 3. Llama a la función 'evaluate' del hook
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

      {/* Resultado de evaluación (ahora viene del hook) */}
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
          disabled={isLoading || !fileUrl || !rubrica.trim()} // <-- 4. Usa el estado 'isLoading' del hook
          className={`w-full py-3 px-6 rounded-lg font-medium text-white transition
            ${isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
            }`}
        >
          {isLoading ? '🔄 Evaluando con IA...' : '⚡ Evaluar con IA'}
        </button>
      </div>
    </div>
  );
}