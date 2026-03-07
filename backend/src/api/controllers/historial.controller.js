import { jobRepository } from '../../database/repositories/job.repository.js';
import { imagenRepository } from '../../database/repositories/imagen.repository.js';

export async function historialController(request, reply) {
  try {
    const jobs = await jobRepository.listarTodos();

    // Para cada job obtener sus URLs
    const resultado = await Promise.all(jobs.map(async (job) => {
      const imagenes = await imagenRepository.listarPorJob(job.job_id);

      return {
        jobId:       job.job_id,
        estado:      job.estado,
        fechaInicio: job.fecha_inicio,
        fechaFin:    job.fecha_fin,
        tiempoTotalSeg: job.fecha_fin
          ? parseFloat(((new Date(job.fecha_fin) - new Date(job.fecha_inicio)) / 1000).toFixed(2))
          : null,

        workers: {
          descarga:    job.workers_descarga,
          redimension: job.workers_redimension,
          conversion:  job.workers_conversion,
          marcaAgua:   job.workers_marca_agua,
        },

        resumen: {
          totalImagenes:  job.urls_totales,
          completadas:    job.agua_procesados - job.agua_fallidos,
          fallidas:       job.desc_fallidos + job.agua_fallidos,
        },

        urls: imagenes.map(img => ({
          url:    img.url_original,
          estado: img.estado,
        })),
      };
    }));

    return reply.send(resultado);

  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Error al obtener el historial' });
  }
}