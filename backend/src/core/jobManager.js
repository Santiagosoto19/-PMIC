import { v4 as uuidv4 } from 'uuid';
import { stateStore } from './stateStore.js';
import { ejecutarPipeline } from './pipeline.js';

class JobManager {

  async crearYLanzarJob(urls, workersConfig) {
    const jobId = uuidv4();

    // 1. Crear job en memoria y BD, obtener workItems
    const workItems = await stateStore.crearJob(jobId, urls, workersConfig);

    // 2. Lanzar el pipeline SIN await — retorna inmediatamente
    // El pipeline corre en segundo plano mientras la API ya respondió
    ejecutarPipeline(jobId, workItems, workersConfig)
      .catch(error => {
        console.error(`[JOB MANAGER] Pipeline ${jobId} falló:`, error.message);
      });

    return jobId;
  }
}

export const jobManager = new JobManager();