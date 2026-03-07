import { historialController } from '../controllers/historial.controller.js';

export async function historialRoutes(fastify) {
  fastify.get('/jobs', {
    schema: {
      tags:    ['Historial'],
      summary: 'Lista todos los jobs realizados',
    }
  }, historialController);
}