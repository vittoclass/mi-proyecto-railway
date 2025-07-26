'use client'

import { useState } from 'react';
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from '@supabase/supabase-js';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Esquema simple para el formulario de prueba
const formSchema = z.object({
  nombre: z.string().min(2, "El nombre es muy corto."),
});

export default function LibelIA() {
  const [formResult, setFormResult] = useState<string>("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { nombre: "" },
  });

  // La conexión a Supabase se define, pero aún no se usa activamente
  const getSupabaseClient = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("Datos del formulario:", values);
    setFormResult(`Formulario enviado con el nombre: ${values.nombre}`);
    alert(`Formulario enviado con el nombre: ${values.nombre}`);
  }

  return (
    <main className="p-8 max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Prueba de Formulario y Supabase</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            Ahora probamos que `react-hook-form` y el cliente de Supabase se cargan correctamente.
          </p>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Escribe un nombre..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">Enviar Formulario</Button>
            </form>
          </Form>
          {formResult && <p className="mt-4 font-semibold text-green-600">{formResult}</p>}
        </CardContent>
      </Card>
    </main>
  );
}