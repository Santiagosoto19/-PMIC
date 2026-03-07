import { estadoController } from '../controllers/estado.controller.js';
import { estadoResponseSchema } from '../schemas/estado.schema.js';

export async function estadoRoutes(fastify) {
  fastify.get('/estado/:jobId', {
    schema: {
      params: {
        type: 'object',
        required: ['jobId'],
        properties: {
          jobId: {
            type:        'string',
            description: 'Identificador único del job'
          }
        }
      },
      response:    estadoResponseSchema,
      tags:        ['Pipeline'],
      summary:     'Consulta estado y métricas de un job',
      description: 'Retorna estado actual, métricas por etapa y resumen global.'
    }
  }, estadoController);
}