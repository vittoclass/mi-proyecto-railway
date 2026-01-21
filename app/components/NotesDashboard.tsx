'use client';

import { useState, useEffect } from 'react';
import EvaluacionPDF from './EvaluacionPDF';

interface NotesDashboardProps {
  studentGroups?: any[];
  curso?: string;
  fecha?: Date;
}

const NotesDashboard = ({ studentGroups, curso, fecha }: NotesDashboardProps) => {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ✅ Si se pasan evaluaciones por props, usarlas directamente
    if (studentGroups) {
      const evaluated = studentGroups.filter(g => g.isEvaluated);
      setEvaluations(evaluated);
      setLoading(false);
    } else {
      // ❌ Si no, cargar desde API (comportamiento original)
      const fetchEvaluations = async () => {
        try {
          const res = await fetch('/api/evaluations');
          if (res.ok) {
            const data = await res.json();
            setEvaluations(data);
          }
        } catch (error) {
          console.error('Error al cargar evaluaciones:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchEvaluations();
    }
  }, [studentGroups]);

  if (loading) {
    return <div className="p-6">Cargando evaluaciones...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Mis Evaluaciones</h1>

      {evaluations.length === 0 ? (
        <p>No tienes evaluaciones aún.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {evaluations.map((evaluacion) => (
            <div
              key={evaluacion.id || evaluacion.studentName}
              className="border rounded-lg p-4 hover:shadow-md cursor-pointer"
              onClick={() => setSelectedEvaluation(evaluacion)}
            >
              <h3 className="font-semibold">{evaluacion.studentName || 'Estudiante'}</h3>
              <p>Nota: {evaluacion.nota}</p>
              <p>Área: {evaluacion.areaConocimiento}</p>
              <p className="text-sm text-gray-500">
                {curso || fecha ? `${curso} · ${fecha?.toLocaleDateString()}` : 'Sin fecha'}
              </p>
            </div>
          ))}
        </div>
      )}

      {selectedEvaluation && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Vista Previa del PDF</h3>
          <EvaluacionPDF
            nombreEstudiante={selectedEvaluation.studentName}
            puntaje={selectedEvaluation.puntaje}
            nota={selectedEvaluation.nota}
            retroalimentacion={selectedEvaluation.retroalimentacion}
            areaConocimiento={selectedEvaluation.areaConocimiento}
          />
        </div>
      )}
    </div>
  );
};

export default NotesDashboard;