// lib/redis.ts
import Redis from 'ioredis';

// Esta línea lee la URL de conexión que Railway configura automáticamente
const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
    console.error("No se encontró la variable de entorno REDIS_URL. Asegúrate de que Redis esté añadido en Railway.");
}

// Creamos y exportamos una única instancia del cliente de Redis
export const redis = new Redis(redisUrl as string);