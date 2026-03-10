// ═══════════════════════════════════════════════════════════════
// GESTOR DE HILOS DE CONVERSIÓN — Trabaja EN PARALELO con resize y watermark
// Toma el archivo descargado original, NO depende de otra etapa
// ═══════════════════════════════════════════════════════════════
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { stateStore } from '../core/stateStore.js';
import { errorManager } from '../core/errorManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function lanzarWorkersConversion(n, jobId, qm) {
  console.log(`[CONVERSION] Lanzando ${n} HILOS REALES para job ${jobId.slice(0, 8)}...`);
  const cola = qm.conversion;
  const threads = [];

  for (let i = 1; i <= n; i++) {
    const workerNombre = `Conversion-W${i}`;

    const thread = new Worker(
      path.join(__dirname, 'convert.thread.js'),
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
          'conversion', msg.item.imagenId, jobId, true,
          msg.resultado.tiempoSeg, msg.resultado
        );
        // ⭐ NO empuja a ninguna cola — esta etapa es independiente
      } else if (msg.tipo === 'error') {
        await errorManager.registrarError(
          'conversion', msg.item, new Error(msg.error), msg.tiempoSeg
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