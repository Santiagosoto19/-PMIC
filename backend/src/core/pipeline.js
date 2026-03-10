import { QueueManager } from '../queues/queueManager.js';
import { lanzarWorkersDescarga } from '../workers/download.worker.js';
import { lanzarWorkersRedimension } from '../workers/resize.worker.js';
import { lanzarWorkersConversion } from '../workers/convert.worker.js';
import { lanzarWorkersMarcaAgua } from '../workers/watermark.worker.js';

export async function ejecutarPipeline(jobId, workItems, workersConfig) {
  console.log(`[PIPELINE] Iniciando job ${jobId.slice(0, 8)}... con ${workItems.length} imágenes`);
  console.log(`[PIPELINE] Hilos: Descarga=${workersConfig.descarga}, Redimensión=${workersConfig.redimension}, Conversión=${workersConfig.conversion}, MarcaAgua=${workersConfig.marcaAgua}`);

  const qm = new QueueManager();
  const total = workItems.length;

  // ⭐ Decirle a cada cola cuántos items esperar
  // Así no resuelven prematuramente cuando empiezan vacías
  qm.redimension.setEsperados(total);
  qm.conversion.setEsperados(total);
  qm.marcaAgua.setEsperados(total);

  // ⭐ Lanzar TODOS los hilos de las 4 etapas AL INICIO
  const hilosDescarga = lanzarWorkersDescarga(workersConfig.descarga, jobId, qm);
  const hilosRedimension = lanzarWorkersRedimension(workersConfig.redimension, jobId, qm);
  const hilosConversion = lanzarWorkersConversion(workersConfig.conversion, jobId, qm);
  const hilosMarcaAgua = lanzarWorkersMarcaAgua(workersConfig.marcaAgua, jobId, qm);

  // Empujar URLs a la cola de descarga
  qm.descarga.pushMuchos(workItems);

  // ⭐⭐ LAS 4 ETAPAS CORREN EN PARALELO ⭐⭐
  // - Descarga descarga imagen 5 mientras...
  // - Resize redimensiona imagen 3 mientras...
  // - Convert convierte imagen 2 mientras...
  // - Watermark marca imagen 1
  // TODO AL MISMO TIEMPO
  console.log(`[PIPELINE] ⚡ Las 4 etapas corren EN PARALELO con hilos reales del SO`);

  await Promise.all([
    qm.descarga.esperarVacia(),
    qm.redimension.esperarVacia(),
    qm.conversion.esperarVacia(),
    qm.marcaAgua.esperarVacia(),
  ]);

  // Terminar TODOS los hilos
  [...hilosDescarga, ...hilosRedimension, ...hilosConversion, ...hilosMarcaAgua]
    .forEach(t => t.terminate());

  console.log(`[PIPELINE] ✓ Job ${jobId.slice(0, 8)}... finalizado — todos los hilos terminados`);
}