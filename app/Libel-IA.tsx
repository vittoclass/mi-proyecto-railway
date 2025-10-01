// app/Libel-IA.tsx
'use client';

import { useState } from 'react';
// CORRECCIÓN: Se ajusta la ruta de importación para que apunte al archivo correcto en la misma carpeta.
import { useEvaluator } from './useEvaluator';
import SmartCameraModal from '@/components/smart-camera-modal'; // Asegúrate que esta ruta sea correcta

export default function LibelIA() {
  // ==================================================================
  // INICIO DE LA ZONA DE HOOKS
  // Todos los hooks deben estar aquí, al principio y sin condiciones.
  // ==================================================================
  const [fileUrl, setFileUrl] = useState<string>('');
  const [rubrica, setRubrica] = useState<string>('');
  const { evaluate, isLoading, result } = useEvaluator();
  // ==================================================================
  // FIN DE LA ZONA DE HOOKS
  // ==================================================================


  const handleEvaluate = () => {
    if (!fileUrl) {
      alert('Primero debes tomar o subir una imagen.');
      return;
    }
    if (!rubrica.trim()) {
      alert('Por favor, ingresa una rúbrica de evaluación.');
      return;
    }
    // NOTA: La función 'evaluate' espera un objeto como payload.
    // Esto se deberá ajustar según la definición real en 'useEvaluator.ts'
    // Por ahora, lo dejamos conceptual.
    // evaluate(fileUrl, rubrica); 
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
      {/* OJO: La ruta de importación de SmartCameraModal debe ser correcta.  
           Aquí asumimos que está en la carpeta 'components' en la raíz. */}
      <SmartCameraModal onCapture={setFileUrl} />

      {/* Resultado de evaluación */}
      {isLoading && <p className="text-center mt-6">🔄 Evaluando con IA...</p>}
      
      {result && (
        <div
          className={`mt-6 p-4 rounded-lg border-l-4 ${
            result.success
              ? 'bg-green-50 border-green-400 text-green-800'
              : 'bg-red-50 border-red-400 text-red-800'
          }`}
        >
          <h3 className="font-bold text-lg">{result.success ? '✅ Éxito' : '❌ Error'}</h3>
          {result.success ? (
            <div>
              {/* Ajustar los campos según la respuesta real del hook */}
              {/* <p className="mt-2"><strong>Retroalimentación:</strong> {result.retroalimentacion}</p>
              <p className="mt-1"><strong>Puntaje:</strong> {result.puntaje}</p>
              <p className="mt-1"><strong>Nota:</strong> {result.nota}</p> */}
            </div>
          ) : (
            <p className="mt-1">{result.error}</p>
          )}
        </div>
      )}

      {/* Botón de evaluar */}
      <div className="mt-6">
        <button
          onClick={handleEvaluate}
          disabled={isLoading || !fileUrl || !rubrica.trim()}
          className={`w-full py-3 px-6 rounded-lg font-medium text-white transition
            ${isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
            }`}
        >
          {isLoading ? 'Evaluando...' : '⚡ Evaluar con IA'}
        </button>
      </div>
    </div>
  );
}