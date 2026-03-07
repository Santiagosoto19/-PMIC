import path from 'path';
import sharp from 'sharp';
import { stateStore } from '../core/stateStore.js';
import { errorManager } from '../core/errorManager.js';
import { config } from '../config/config.js';

export function lanzarWorkersRedimension(n, jobId, qm) {
  console.log(`[REDIMENSION] Lanzando ${n} workers para job ${jobId.slice(0, 8)}...`);
  for (let i = 1; i <= n; i++) {
    escucharCola(`Redimension-W${i}`, jobId, qm);
  }
}

function escucharCola(workerNombre, jobId, qm) {
  const cola = qm.redimension;

  cola.on('itemDisponible', async () => {
    const item = cola.pop();
    if (!item) return;

    item.workerNombre = workerNombre;
    await procesarRedimension(item, qm);
    cola.terminarItem();
  });
}

async function procesarRedimension(item, qm) {
  const inicio = Date.now();

  try {
    console.log(`[${item.workerNombre}] Redimensionando: ${path.basename(item.rutaActual)}`);

    const metadata      = await sharp(item.rutaActual).metadata();
    const anchoOriginal = metadata.width;
    const altoOriginal  = metadata.height;
    const maxDim        = config.pipeline.maxDimension;

    let anchoFinal = anchoOriginal;
    let altoFinal  = altoOriginal;

    if (anchoOriginal > maxDim || altoOriginal > maxDim) {
      const ratio = Math.min(maxDim / anchoOriginal, maxDim / altoOriginal);
      anchoFinal  = Math.round(anchoOriginal * ratio);
      altoFinal   = Math.round(altoOriginal  * ratio);
    }

    const nombreSalida = `${item.nombreBase}_redimensionado${item.extension}`;
    const rutaSalida   = path.join(config.storage.resized, nombreSalida);

    await sharp(item.rutaActual)
      .resize(anchoFinal, altoFinal, { fit: 'inside', withoutEnlargement: true })
      .toFile(rutaSalida);

    const tiempoSeg = (Date.now() - inicio) / 1000;

    item.rutaActual = rutaSalida;
    item.nombreBase = `${item.nombreBase}_redimensionado`;

    await stateStore.registrarResultado('redimension', item.imagenId, item.jobId, true, tiempoSeg, {
      estado:       'REDIMENSIONADA',
      workerNombre: item.workerNombre,
      tiempoSeg,
      ruta:         rutaSalida,
      anchoOriginal,
      altoOriginal,
      anchoFinal,
      altoFinal,
      error:        null,
    });

    console.log(`[${item.workerNombre}] ✓ ${anchoOriginal}x${altoOriginal} → ${anchoFinal}x${altoFinal} en ${tiempoSeg.toFixed(2)}s`);

    qm.conversion.push(item);

  } catch (error) {
    const tiempoSeg = (Date.now() - inicio) / 1000;
    await errorManager.registrarError('redimension', item, error, tiempoSeg);
  }
}