import { stateStore } from '../../core/stateStore.js';

export async function estadoController(request, reply) {
  const { jobId } = request.params;

  try {
    const respuesta = await stateStore.construirRespuestaEstado(jobId);

    if (!respuesta) {
      return reply.status(404).send({
        error:   'Job no encontrado',
        mensaje: `No existe ningún job con id: ${jobId}`
      });
    }

    return reply.send(respuesta);

  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      error:   'Error interno',
      mensaje: 'No se pudo obtener el estado del job'
    });
  }
}