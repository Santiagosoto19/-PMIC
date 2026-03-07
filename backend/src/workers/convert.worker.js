import path from 'path';
import sharp from 'sharp';
import { stateStore } from '../core/stateStore.js';
import { errorManager } from '../core/errorManager.js';
import { config } from '../config/config.js';

export function lanzarWorkersConversion(n, jobId, qm) {
  console.log(`[CONVERSION] Lanzando ${n} workers para job ${jobId.slice(0, 8)}...`);
  for (let i = 1; i <= n; i++) {
    escucharCola(`Conversion-W${i}`, jobId, qm);
  }
}

function escucharCola(workerNombre, jobId, qm) {
  const cola = qm.conversion;

  cola.on('itemDisponible', async () => {
    const item = cola.pop();
    if (!item) return;

    item.workerNombre = workerNombre;
    await procesarConversion(item, qm);
    cola.terminarItem();
  });
}

async function procesarConversion(item, qm) {
  const inicio          = Date.now();
  const formatoOriginal = item.extension.replace('.', '').toUpperCase();

  try {
    console.log(`[${item.workerNombre}] Convirtiendo: ${path.basename(item.rutaActual)} → PNG`);

    const nombreSalida = `${item.nombreBase}_formato_cambiado.png`;
    const rutaSalida   = path.join(config.storage.converted, nombreSalida);

    await sharp(item.rutaActual)
      .png({ quality: 90, compressionLevel: 6 })
      .toFile(rutaSalida);

    const tiempoSeg = (Date.now() - inicio) / 1000;

    item.rutaActual = rutaSalida;
    item.nombreBase = `${item.nombreBase}_formato_cambiado`;
    item.extension  = '.png';

    await stateStore.registrarResultado('conversion', item.imagenId, item.jobId, true, tiempoSeg, {
      estado:          'CONVERTIDA',
      workerNombre:    item.workerNombre,
      tiempoSeg,
      ruta:            rutaSalida,
      formatoOriginal,
      error:           null,
    });

    console.log(`[${item.workerNombre}] ✓ ${formatoOriginal} → PNG en ${tiempoSeg.toFixed(2)}s`);

    qm.marcaAgua.push(item);

  } catch (error) {
    const tiempoSeg = (Date.now() - inicio) / 1000;
    await errorManager.registrarError('conversion', item, error, tiempoSeg);
  }
}