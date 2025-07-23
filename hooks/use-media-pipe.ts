"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { ObjectDetector, FilesetResolver } from "@mediapipe/tasks-vision"

interface DetectedObject {
  label: string
  boundingBox: { x: number; y: number; width: number; height: number }
}

export const useMediaPipe = () => {
  const [objectDetector, setObjectDetector] = useState<ObjectDetector | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const initialize = useCallback(async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      )
      const detector = await ObjectDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite`,
          delegate: "GPU",
        },
        scoreThreshold: 0.5,
        runningMode: "VIDEO",
        categoryAllowlist: ["book"],
      })
      setObjectDetector(detector)
      setIsLoading(false)
    } catch (err) {
      console.error("Error al inicializar MediaPipe:", err)
      setError("No se pudo cargar la IA de la cámara.")
      setIsLoading(false)
    }
  }, [])

  const detectObjects = useCallback(
    (video: HTMLVideoElement): DetectedObject[] => {
      if (!objectDetector || video.readyState < 2) return []

      const detections = objectDetector.detectForVideo(video, Date.now())
      return (
        detections.detections.map((detection) => ({
          label: detection.categories[0].categoryName,
          boundingBox: detection.boundingBox!,
        })) || []
      )
    },
    [objectDetector],
  )

  useEffect(() => {
    initialize()
  }, [initialize])

  return { isLoading, error, detectObjects }
}