// ═══════════════════════════════════════════════════════════════
// HILO REAL DE CONVERSIÓN — Se ejecuta en un thread del SO
// ═══════════════════════════════════════════════════════════════
import { parentPort, workerData, threadId } from 'worker_threads';
import path from 'path';
import sharp from 'sharp';
import { config } from '../config/config.js';

const { workerNombre } = workerData;

console.log(`  [HILO] ${workerNombre} creado (threadId: ${threadId})`);

parentPort.on('message', async ({ item }) => {
    const inicio = Date.now();
    const formatoOriginal = item.extension.replace('.', '').toUpperCase();

    try {
        const nombreSalida = `${item.imagenId}_formato_cambiado.png`;
        const rutaSalida = path.join(config.storage.converted, nombreSalida);

        await sharp(item.rutaActual)
            .png({ quality: 90, compressionLevel: 6 })
            .toFile(rutaSalida);

        const tiempoSeg = (Date.now() - inicio) / 1000;

        console.log(`  [${workerNombre}] ✓ ${formatoOriginal} → PNG en ${tiempoSeg.toFixed(2)}s`);

        parentPort.postMessage({
            tipo: 'completado',
            item: {
                ...item,
                rutaActual: rutaSalida,
                nombreBase: `${item.nombreBase}_formato_cambiado`,
                extension: '.png',
            },
            resultado: {
                estado: 'CONVERTIDA',
                workerNombre,
                tiempoSeg,
                ruta: rutaSalida,
                formatoOriginal,
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
