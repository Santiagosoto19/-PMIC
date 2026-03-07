import path from 'path';
import sharp from 'sharp';
import { stateStore } from '../core/stateStore.js';
import { errorManager } from '../core/errorManager.js';
import { config } from '../config/config.js';

export function lanzarWorkersMarcaAgua(n, jobId, qm) {
  console.log(`[MARCA_AGUA] Lanzando ${n} workers para job ${jobId.slice(0, 8)}...`);
  for (let i = 1; i <= n; i++) {
    escucharCola(`MarcaAgua-W${i}`, jobId, qm);
  }
}

function escucharCola(workerNombre, jobId, qm) {
  const cola = qm.marcaAgua;

  cola.on('itemDisponible', async () => {
    const item = cola.pop();
    if (!item) return;

    item.workerNombre = workerNombre;
    await procesarMarcaAgua(item);
    cola.terminarItem();
  });
}

async function procesarMarcaAgua(item) {
  const inicio = Date.now();

  try {
    console.log(`[${item.workerNombre}] Aplicando marca de agua: ${path.basename(item.rutaActual)}`);

    const metadata = await sharp(item.rutaActual).metadata();
    const ancho    = metadata.width;
    const alto     = metadata.height;

    const tamanoFuente = Math.max(16, Math.round(ancho / 15));
    const texto        = 'PMIC © 2024';

    const svgMarcaAgua = Buffer.from(`
      <svg width="${ancho}" height="${alto}">
        <style>
          .marca  { fill: rgba(255,255,255,0.65); font-size: ${tamanoFuente}px; font-family: Arial, sans-serif; font-weight: bold; }
          .sombra { fill: rgba(0,0,0,0.4);        font-size: ${tamanoFuente}px; font-family: Arial, sans-serif; font-weight: bold; }
        </style>
        <text x="${ancho - 20}" y="${alto - 18}" text-anchor="end" class="sombra">${texto}</text>
        <text x="${ancho - 22}" y="${alto - 20}" text-anchor="end" class="marca">${texto}</text>
      </svg>
    `);

    const nombreSalida = `${item.nombreBase}_marca_agua.png`;
    const rutaSalida   = path.join(config.storage.watermarked, nombreSalida);

    await sharp(item.rutaActual)
      .composite([{ input: svgMarcaAgua, blend: 'over' }])
      .png()
      .toFile(rutaSalida);

    const tiempoSeg = (Date.now() - inicio) / 1000;

    await stateStore.registrarResultado('marcaAgua', item.imagenId, item.jobId, true, tiempoSeg, {
      estado:       'COMPLETADA',
      workerNombre: item.workerNombre,
      tiempoSeg,
      ruta:         rutaSalida,
      error:        null,
    });

    console.log(`[${item.workerNombre}] ✓ Marca de agua aplicada en ${tiempoSeg.toFixed(2)}s`);

  } catch (error) {
    const tiempoSeg = (Date.now() - inicio) / 1000;
    await errorManager.registrarError('marcaAgua', item, error, tiempoSeg);
  }
}