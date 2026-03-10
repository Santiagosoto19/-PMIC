import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerRoutes } from './api/routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true }
      }
    }
  });

  // CORS: permite que el frontend (otro puerto) llame a la API
  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST']
  });

  // Swagger: documentación automática en http://localhost:3000/docs
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'PMIC API',
        description: 'Plataforma de Procesamiento Masivo de Imágenes Concurrente',
        version: '1.0.0'
      }
    }
  });
  await fastify.register(swaggerUi, { routePrefix: '/docs' });

  // Archivos estáticos: sirve el frontend desde la misma URL
  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, '..', '..', 'frontend'),
    prefix: '/',
  });

  // Registrar todas las rutas de la API
  await registerRoutes(fastify);

  // Manejador global de errores de validación
  fastify.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.status(400).send({
        error: 'Datos inválidos',
        detalle: error.message,
        campos: error.validation
      });
    }
    fastify.log.error(error);
    reply.status(500).send({ error: 'Error interno del servidor' });
  });

  return fastify;
}