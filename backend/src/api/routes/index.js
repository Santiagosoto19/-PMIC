import { procesarRoutes }  from './procesar.route.js';
import { estadoRoutes }    from './estado.route.js';
import { historialRoutes } from './historial.route.js';

export async function registerRoutes(fastify) {
  fastify.register(procesarRoutes,  { prefix: '/api/v1' });
  fastify.register(estadoRoutes,    { prefix: '/api/v1' });
  fastify.register(historialRoutes, { prefix: '/api/v1' });
}