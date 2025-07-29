'use client'

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from 'lucide-react';
import { format } from "date-fns";

// Definimos los tipos de datos que este componente recibirá
interface StudentGroup {
  id: string;
  studentName: string;
  nota?: number | string; // Acepta número o string desde la API
  decimasAdicionales: number;
  isEvaluated: boolean;
}

interface NotesDashboardProps {
  studentGroups: StudentGroup[];
  curso?: string;
  fecha?: Date;
}

type SortKey = 'studentName' | 'finalNota';
type SortDirection = 'ascending' | 'descending';

export function NotesDashboard({ studentGroups, curso, fecha }: NotesDashboardProps) {
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: SortDirection }>({
    key: 'studentName',
    direction: 'ascending'
  });

  const evaluatedStudents = studentGroups.filter(g => g.isEvaluated);

  const sortedStudents = React.useMemo(() => {
    let sortableItems = [...evaluatedStudents];
    sortableItems.sort((a, b) => {
      let aValue: string | number, bValue: string | number;

      if (sortConfig.key === 'finalNota') {
        aValue = (Number(a.nota) || 0) + a.decimasAdicionales;
        bValue = (Number(b.nota) || 0) + b.decimasAdicionales;
      } else { // 'studentName'
        aValue = a.studentName.toLowerCase();
        bValue = b.studentName.toLowerCase();
      }

      if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
      return 0;
    });
    return sortableItems;
  }, [evaluatedStudents, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  if (evaluatedStudents.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Resumen de Notas</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Aún no se han completado evaluaciones en esta sesión.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen de Notas</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" onClick={() => requestSort('studentName')}>
                  Alumno <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">
                 <Button variant="ghost" onClick={() => requestSort('finalNota')}>
                  Nota Final <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedStudents.map((group) => {
              // ===== INICIO DE LA CORRECCIÓN =====
              const finalNota = (Number(group.nota) || 0) + group.decimasAdicionales;
              // ===== FIN DE LA CORRECCIÓN =====
              return (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.studentName}</TableCell>
                  <TableCell>{curso || 'N/A'}</TableCell>
                  <TableCell>{fecha ? format(fecha, "dd/MM/yyyy") : 'N/A'}</TableCell>
                  <TableCell className="text-right font-bold text-lg text-blue-600">{finalNota.toFixed(1)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}