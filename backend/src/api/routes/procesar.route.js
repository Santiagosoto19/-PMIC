import { procesarController } from '../controllers/procesar.controller.js';
import { procesarBodySchema, procesarResponseSchema } from '../schemas/procesar.schema.js';

export async function procesarRoutes(fastify) {
  fastify.post('/procesar', {
    schema: {
      body:        procesarBodySchema,
      response:    procesarResponseSchema,
      tags:        ['Pipeline'],
      summary:     'Inicia el procesamiento masivo de imágenes',
      description: 'Recibe URLs y configuración de workers. Retorna jobId para monitorear el progreso.'
    }
  }, procesarController);
}