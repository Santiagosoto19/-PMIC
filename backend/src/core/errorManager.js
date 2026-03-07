import { stateStore } from './stateStore.js';

class ErrorManager {

  // Registra un error ocurrido en cualquier etapa del pipeline.
  async registrarError(etapa, workItem, error, tiempoSeg = 0) {
    const { jobId, imagenId } = workItem;
    const mensajeError = error?.message || String(error);

    console.error(
      `[EM] Error en etapa ${etapa.toUpperCase()} | ` +
      `Job: ${jobId.slice(0, 8)}... | ` +
      `Imagen: ${imagenId.slice(0, 8)}... | ` +
      `Error: ${mensajeError}`
    );

    // Mapeo de etapa → estado de error y datos para la BD
    const estadosError = {
      descarga:    { estado: 'ERROR_DESCARGA',    datos: { estado: 'ERROR_DESCARGA',    error: mensajeError, tiempoSeg, workerNombre: workItem.workerNombre || 'desconocido', ruta: null, tamanoMb: null } },
      redimension: { estado: 'ERROR_REDIMENSION', datos: { estado: 'ERROR_REDIMENSION', error: mensajeError, tiempoSeg, workerNombre: workItem.workerNombre || 'desconocido', ruta: null, anchoOriginal: null, altoOriginal: null, anchoFinal: null, altoFinal: null } },
      conversion:  { estado: 'ERROR_CONVERSION',  datos: { estado: 'ERROR_CONVERSION',  error: mensajeError, tiempoSeg, workerNombre: workItem.workerNombre || 'desconocido', ruta: null, formatoOriginal: null } },
      marcaAgua:   { estado: 'ERROR_MARCA_AGUA',  datos: { estado: 'ERROR_MARCA_AGUA',  error: mensajeError, tiempoSeg, workerNombre: workItem.workerNombre || 'desconocido', ruta: null } },
    };

    const config = estadosError[etapa];
    if (!config) {
      console.error(`[EM] Etapa desconocida: ${etapa}`);
      return;
    }

    // Registrar en stateStore (que a su vez actualiza PostgreSQL y memoria)
    await stateStore.registrarResultado(
      etapa,
      imagenId,
      jobId,
      false,        
      tiempoSeg,
      config.datos
    );

    console.log(`[EM] Error registrado para imagen ${imagenId.slice(0, 8)}... — pipeline continúa`);
  }
}

export const errorManager = new ErrorManager();
