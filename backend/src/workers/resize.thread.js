// ═══════════════════════════════════════════════════════════════
// HILO REAL DE REDIMENSIÓN — Se ejecuta en un thread del SO
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
        const anchoOriginal = metadata.width;
        const altoOriginal = metadata.height;
        const maxDim = config.pipeline.maxDimension;

        let anchoFinal = anchoOriginal;
        let altoFinal = altoOriginal;

        if (anchoOriginal > maxDim || altoOriginal > maxDim) {
            const ratio = Math.min(maxDim / anchoOriginal, maxDim / altoOriginal);
            anchoFinal = Math.round(anchoOriginal * ratio);
            altoFinal = Math.round(altoOriginal * ratio);
        }

        const nombreSalida = `${item.imagenId}_redimensionado${item.extension}`;
        const rutaSalida = path.join(config.storage.resized, nombreSalida);

        await sharp(item.rutaActual)
            .resize(anchoFinal, altoFinal, { fit: 'inside', withoutEnlargement: true })
            .toFile(rutaSalida);

        const tiempoSeg = (Date.now() - inicio) / 1000;

        console.log(`  [${workerNombre}] ✓ ${anchoOriginal}x${altoOriginal} → ${anchoFinal}x${altoFinal} en ${tiempoSeg.toFixed(2)}s`);

        parentPort.postMessage({
            tipo: 'completado',
            item: {
                ...item,
                rutaActual: rutaSalida,
                nombreBase: `${item.nombreBase}_redimensionado`,
            },
            resultado: {
                estado: 'REDIMENSIONADA',
                workerNombre,
                tiempoSeg,
                ruta: rutaSalida,
                anchoOriginal,
                altoOriginal,
                anchoFinal,
                altoFinal,
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
