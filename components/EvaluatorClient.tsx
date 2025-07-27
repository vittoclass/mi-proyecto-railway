'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EvaluatorClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Diagnóstico de Variables de Entorno</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold">NEXT_PUBLIC_SUPABASE_URL:</h3>
            {supabaseUrl ? (
              <p className="text-green-600 break-all">{supabaseUrl}</p>
            ) : (
              <p className="text-red-600 font-bold">NO ENCONTRADA (undefined)</p>
            )}
          </div>
          <div className="border-t pt-4">
            <h3 className="font-semibold">NEXT_PUBLIC_SUPABASE_ANON_KEY:</h3>
            {supabaseKey ? (
              <p className="text-green-600 break-all">{supabaseKey}</p>
            ) : (
              <p className="text-red-600 font-bold">NO ENCONTRADA (undefined)</p>
            )}
          </div>
          <div className="pt-4 border-t mt-4">
            <p className="text-sm text-gray-600">
              Si alguna de estas variables aparece como "NO ENCONTRADA", la aplicación no puede funcionar. Verifica que los nombres y valores estén escritos **exactamente** igual en la pestaña "Variables" de tu proyecto en Railway.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}