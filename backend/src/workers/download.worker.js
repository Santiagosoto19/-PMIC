// ═══════════════════════════════════════════════════════════════
// GESTOR DE HILOS DE DESCARGA — Crea Worker Threads reales
// Después de descargar, empuja a las 3 colas EN PARALELO
// ═══════════════════════════════════════════════════════════════
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { stateStore } from '../core/stateStore.js';
import { errorManager } from '../core/errorManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function lanzarWorkersDescarga(n, jobId, qm) {
  console.log(`[DESCARGA] Lanzando ${n} HILOS REALES para job ${jobId.slice(0, 8)}...`);
  const cola = qm.descarga;
  const threads = [];

  for (let i = 1; i <= n; i++) {
    const workerNombre = `Descarga-W${i}`;

    const thread = new Worker(
      path.join(__dirname, 'download.thread.js'),
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
          'descarga', msg.item.imagenId, jobId, true,
          msg.resultado.tiempoSeg, msg.resultado
        );

        // ⭐ CLAVE: Empujar a las 3 colas AL MISMO TIEMPO
        // Cada cola recibe una COPIA del item con la ruta del archivo descargado
        qm.redimension.push({ ...msg.item });
        qm.conversion.push({ ...msg.item });
        qm.marcaAgua.push({ ...msg.item });

      } else if (msg.tipo === 'error') {
        await errorManager.registrarError(
          'descarga', msg.item, new Error(msg.error), msg.tiempoSeg
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