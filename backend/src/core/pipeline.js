import { QueueManager } from '../queues/queueManager.js';
import { lanzarWorkersDescarga }    from '../workers/download.worker.js';
import { lanzarWorkersRedimension } from '../workers/resize.worker.js';
import { lanzarWorkersConversion }  from '../workers/convert.worker.js';
import { lanzarWorkersMarcaAgua }   from '../workers/watermark.worker.js';

export async function ejecutarPipeline(jobId, workItems, workersConfig) {
  console.log(`[PIPELINE] Iniciando job ${jobId.slice(0,8)}... con ${workItems.length} imágenes`);

  // Crear un QueueManager NUEVO por cada job
  const qm = new QueueManager();

  lanzarWorkersDescarga(workersConfig.descarga,       jobId, qm);
  lanzarWorkersRedimension(workersConfig.redimension, jobId, qm);
  lanzarWorkersConversion(workersConfig.conversion,   jobId, qm);
  lanzarWorkersMarcaAgua(workersConfig.marcaAgua,     jobId, qm);

  qm.descarga.pushMuchos(workItems);

  await qm.descarga.esperarVacia();
  console.log(`[PIPELINE] Etapa DESCARGA completada`);

  await qm.redimension.esperarVacia();
  console.log(`[PIPELINE] Etapa REDIMENSION completada`);

  await qm.conversion.esperarVacia();
  console.log(`[PIPELINE] Etapa CONVERSION completada`);

  await qm.marcaAgua.esperarVacia();
  console.log(`[PIPELINE] Etapa MARCA_AGUA completada`);

  console.log(`[PIPELINE] Job ${jobId.slice(0,8)}... finalizado`);
}