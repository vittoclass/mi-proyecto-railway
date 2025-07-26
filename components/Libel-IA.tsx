'use client'

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LibelIA() {
  const [count, setCount] = useState(0);

  console.log("Renderizando componente de prueba...");

  return (
    <main className="p-8 max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Prueba de Renderizado</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            Si ves este botón y puedes hacer clic en él, la base de tu aplicación y el despliegue son correctos. El problema está en uno de los componentes más complejos que quitamos.
          </p>
          <Button onClick={() => setCount(c => c + 1)}>
            Has hecho clic {count} veces
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}