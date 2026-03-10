import { QueueManager } from '../queues/queueManager.js';
import { lanzarWorkersDescarga } from '../workers/download.worker.js';
import { lanzarWorkersRedimension } from '../workers/resize.worker.js';
import { lanzarWorkersConversion } from '../workers/convert.worker.js';
import { lanzarWorkersMarcaAgua } from '../workers/watermark.worker.js';

export async function ejecutarPipeline(jobId, workItems, workersConfig) {
  console.log(`[PIPELINE] Iniciando job ${jobId.slice(0, 8)}... con ${workItems.length} imágenes`);
  console.log(`[PIPELINE] Hilos: Descarga=${workersConfig.descarga}, Redimensión=${workersConfig.redimension}, Conversión=${workersConfig.conversion}, MarcaAgua=${workersConfig.marcaAgua}`);

  const qm = new QueueManager();

  // ⭐ Lanzar TODOS los hilos de TODAS las etapas
  const hilosDescarga = lanzarWorkersDescarga(workersConfig.descarga, jobId, qm);
  const hilosRedimension = lanzarWorkersRedimension(workersConfig.redimension, jobId, qm);
  const hilosConversion = lanzarWorkersConversion(workersConfig.conversion, jobId, qm);
  const hilosMarcaAgua = lanzarWorkersMarcaAgua(workersConfig.marcaAgua, jobId, qm);

  // Empujar todas las URLs a la cola de descarga
  qm.descarga.pushMuchos(workItems);

  // 1. Esperar que TODAS las descargas terminen
  await qm.descarga.esperarVacia();
  hilosDescarga.forEach(t => t.terminate());
  console.log(`[PIPELINE] ✓ DESCARGA completada`);

  // 2. ⭐ Esperar las 3 etapas EN PARALELO (corren AL MISMO TIEMPO)
  console.log(`[PIPELINE] ⚡ Ejecutando RESIZE + CONVERT + WATERMARK en PARALELO...`);
  await Promise.all([
    qm.redimension.esperarVacia(),
    qm.conversion.esperarVacia(),
    qm.marcaAgua.esperarVacia(),
  ]);

  // Terminar todos los hilos
  [...hilosRedimension, ...hilosConversion, ...hilosMarcaAgua].forEach(t => t.terminate());
  console.log(`[PIPELINE] ✓ RESIZE + CONVERT + WATERMARK completadas en paralelo`);
  console.log(`[PIPELINE] Job ${jobId.slice(0, 8)}... finalizado — todos los hilos terminados`);
}