// ═══════════════════════════════════════════════════════════════
// GESTOR DE HILOS DE MARCA DE AGUA — Crea Worker Threads reales
// ═══════════════════════════════════════════════════════════════
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { stateStore } from '../core/stateStore.js';
import { errorManager } from '../core/errorManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function lanzarWorkersMarcaAgua(n, jobId, qm) {
  console.log(`[MARCA_AGUA] Lanzando ${n} HILOS REALES para job ${jobId.slice(0, 8)}...`);
  const cola = qm.marcaAgua;
  const threads = [];

  for (let i = 1; i <= n; i++) {
    const workerNombre = `MarcaAgua-W${i}`;

    const thread = new Worker(
      path.join(__dirname, 'watermark.thread.js'),
      { workerData: { workerNombre } }
    );

    let ocupado = false;

    const intentarProcesar = () => {
      if (ocupado) return;
      const item = cola.pop();
      if (!item) return;
      ocupado = true;
      item.workerNombre = workerNombre;
      thread.postMessage({ item });
    };

    cola.on('itemDisponible', intentarProcesar);

    thread.on('message', async (msg) => {
      ocupado = false;

      if (msg.tipo === 'completado') {
        await stateStore.registrarResultado(
          'marcaAgua', msg.item.imagenId, jobId, true,
          msg.resultado.tiempoSeg, msg.resultado
        );
      } else if (msg.tipo === 'error') {
        await errorManager.registrarError(
          'marcaAgua', msg.item, new Error(msg.error), msg.tiempoSeg
        );
      }

      cola.terminarItem();
      intentarProcesar();
    });

    thread.on('error', (err) => {
      console.error(`[${workerNombre}] Error fatal del hilo:`, err);
      ocupado = false;
    });

    threads.push(thread);
  }

  return threads;
}