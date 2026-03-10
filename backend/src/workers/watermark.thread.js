// ═══════════════════════════════════════════════════════════════
// HILO REAL DE MARCA DE AGUA — Se ejecuta en un thread del SO
// ═══════════════════════════════════════════════════════════════
import { parentPort, workerData, threadId } from 'worker_threads';
import path from 'path';
import sharp from 'sharp';
import { config } from '../config/config.js';

const { workerNombre } = workerData;

console.log(`  [HILO] ${workerNombre} creado (threadId: ${threadId})`);

parentPort.on('message', async ({ item }) => {
    const inicio = Date.now();

    try {
        const metadata = await sharp(item.rutaActual).metadata();
        const ancho = metadata.width;
        const alto = metadata.height;

        const tamanoFuente = Math.max(16, Math.round(ancho / 15));
        const texto = 'PMIC © 2024';

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

        const nombreSalida = `${item.imagenId}_marca_agua.png`;
        const rutaSalida = path.join(config.storage.watermarked, nombreSalida);

        await sharp(item.rutaActual)
            .composite([{ input: svgMarcaAgua, blend: 'over' }])
            .png()
            .toFile(rutaSalida);

        const tiempoSeg = (Date.now() - inicio) / 1000;

        console.log(`  [${workerNombre}] ✓ Marca de agua aplicada en ${tiempoSeg.toFixed(2)}s`);

        parentPort.postMessage({
            tipo: 'completado',
            item: {
                ...item,
                rutaActual: rutaSalida,
                nombreBase: `${item.nombreBase}_marca_agua`,
            },
            resultado: {
                estado: 'COMPLETADA',
                workerNombre,
                tiempoSeg,
                ruta: rutaSalida,
                error: null,
            }
        });
    } catch (error) {
        const tiempoSeg = (Date.now() - inicio) / 1000;
        console.error(`  [${workerNombre}] ✗ Error: ${error.message}`);
        parentPort.postMessage({
            tipo: 'error',
            item,
            error: error.message,
            tiempoSeg,
        });
    }
});
