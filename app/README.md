# Genius Evaluator X

Sistema de evaluación inteligente con IA que permite a los profesores evaluar automáticamente documentos de estudiantes usando Mistral AI y Azure Vision.

## Características

- 🧠 **Evaluación con IA**: Utiliza Mistral AI para evaluar trabajos según rúbricas personalizadas
- 📷 **OCR Avanzado**: Extrae texto de imágenes y PDFs usando Azure Vision
- 📊 **Múltiples Sistemas**: Soporta calificación chilena (2.0-7.0), estándar (1-10) y porcentual
- 📈 **Análisis Detallado**: Genera feedback constructivo y análisis de habilidades
- 💾 **Exportación**: Exporta resultados a CSV o copia al portapapeles
- 🎯 **Flexibilidad**: Configura el nivel de rigidez/flexibilidad de la evaluación

## Configuración para Railway

### Variables de Entorno Requeridas

Configura estas variables en tu proyecto de Railway:

- `MISTRAL_API_KEY`: Tu clave API de Mistral AI
- `AZURE_VISION_KEY`: Tu clave de Azure Computer Vision
- `AZURE_VISION_ENDPOINT`: El endpoint de tu recurso Azure (ej: https://tu-recurso.cognitiveservices.azure.com/)

### APIs Requeridas

#### Mistral AI
- Regístrate en [Mistral AI](https://mistral.ai/)
- Obtén tu API key desde el dashboard
- Usado para: Evaluación inteligente y análisis de contenido

#### Azure Vision
- Crea un recurso de Computer Vision en Azure
- Obtén la clave y endpoint
- Usado para: OCR (extracción de texto de imágenes y PDFs)

## Despliegue en Railway

1. Conecta tu repositorio a Railway
2. Configura las variables de entorno en Railway:
   - `MISTRAL_API_KEY`
   - `AZURE_VISION_KEY` 
   - `AZURE_VISION_ENDPOINT`
3. Despliega automáticamente

## Desarrollo Local

1. Clona el repositorio
2. Instala las dependencias: `npm install`
3. Copia `.env.example` a `.env.local` y configura tus API keys
4. Ejecuta el proyecto: `npm run dev`

## Uso

1. **Evaluación**: Sube documentos de estudiantes y define la rúbrica
2. **Resultados**: Revisa las evaluaciones generadas automáticamente
3. **Historial**: Gestiona y exporta todas las evaluaciones

## Tecnologías

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **UI**: shadcn/ui components
- **IA**: Mistral AI API
- **OCR**: Azure Computer Vision API
