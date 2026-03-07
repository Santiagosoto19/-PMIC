import { jobManager } from '../../core/jobManager.js';

export async function procesarController(request, reply) {
  const { urls, workers } = request.body;

  try {
    // Lanza el pipeline en segundo plano y retorna el jobId inmediatamente.
    const jobId = await jobManager.crearYLanzarJob(urls, workers);

    return reply.status(202).send({
      jobId,
      mensaje:       'Pipeline iniciado correctamente',
      totalImagenes: urls.length,
      estado:        'EN_PROCESO',
      fechaInicio:   new Date().toISOString()
    });

  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      error:   'Error interno',
      mensaje: 'No se pudo iniciar el procesamiento'
    });
  }
}