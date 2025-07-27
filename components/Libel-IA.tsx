// Libel-IA.tsx
'use client';

import { useState } from 'react';
import { useEvaluatorClient } from './EvaluatorClient';
import SmartCameraModal from './smart-camera-modal';

export default function LibelIA() {
  const [fileUrl, setFileUrl] = useState<string>('');
  const [rubrica, setRubrica] = useState<string>(''); // Puedes cambiar esto por una selección real
  const { evaluate, loading, result } = useEvaluatorClient();

  const handleEvaluate = () => {
    if (!fileUrl) {
      alert('Primero debes tomar o subir una imagen.');
      return;
    }
    if (!rubrica.trim()) {
      alert('Debes ingresar una rúbrica.');
      return;
    }
    evaluate(fileUrl, rubrica);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Evaluación con IA</h1>

      <div className="mb-4">
        <label className="block mb-2 font-medium">Rúbrica de evaluación</label>
        <textarea
          value={rubrica}
          onChange={(e) => setRubrica(e.target.value)}
          className="w-full p-2 border rounded"
          rows={5}
          placeholder="Ej: Evaluar ortografía, claridad, estructura..."
        />
      </div>

      <SmartCameraModal onCapture={setFileUrl} />

      {fileUrl && (
        <div className="mt-4">
          <img src={fileUrl} alt="Capturada" className="max-w-full h-auto border rounded" />
        </div>
      )}

      <button
        onClick={handleEvaluate}
        disabled={loading}
        className="mt-4 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Evaluando...' : 'Evaluar con IA'}
      </button>

      {result && (
        <div className={`mt-6 p-4 border rounded ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <h3 className="font-bold">{result.success ? 'Éxito' : 'Error'}</h3>
          <p>{result.feedback || result.error}</p>
        </div>
      )}
    </div>
  );
}