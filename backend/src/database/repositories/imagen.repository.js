import pool from '../db.js';

export const imagenRepository = {

  // Inserta todas las imágenes del job en una sola query.
  // Mucho más eficiente que N inserciones individuales.
  async crearMuchas(imagenes) {
    if (imagenes.length === 0) return;

    const valores = [];
    const placeholders = imagenes.map((img, i) => {
      const b = i * 3;
      valores.push(img.imagenId, img.jobId, img.urlOriginal);
      return `($${b+1}, $${b+2}, $${b+3})`;
    });

    await pool.query(
      `INSERT INTO imagenes (imagen_id, job_id, url_original)
       VALUES ${placeholders.join(', ')}`,
      valores
    );
  },

  // Cada método de actualización corresponde a una etapa del pipeline.
  // El EM usa estos mismos métodos pero con estado ERROR_* y
  // el campo de error lleno en lugar de null.

  async actualizarDescarga(imagenId, datos) {
    await pool.query(`
      UPDATE imagenes SET
        estado = $1, fecha_descarga = NOW(),
        tamano_mb = $2, tiempo_descarga_seg = $3,
        worker_descarga = $4, ruta_descargada = $5,
        error_descarga = $6
      WHERE imagen_id = $7
    `, [
      datos.estado, datos.tamanoMb, datos.tiempoSeg,
      datos.workerNombre, datos.ruta,
      datos.error || null, imagenId
    ]);
  },

  async actualizarRedimension(imagenId, datos) {
    await pool.query(`
      UPDATE imagenes SET
        estado = $1,
        ancho_original = $2, alto_original = $3,
        ancho_final = $4,    alto_final = $5,
        tiempo_redimension_seg = $6,
        worker_redimension = $7, ruta_redimensionada = $8,
        error_redimension = $9
      WHERE imagen_id = $10
    `, [
      datos.estado,
      datos.anchoOriginal, datos.altoOriginal,
      datos.anchoFinal,    datos.altoFinal,
      datos.tiempoSeg,
      datos.workerNombre,  datos.ruta,
      datos.error || null, imagenId
    ]);
  },

  async actualizarConversion(imagenId, datos) {
    await pool.query(`
      UPDATE imagenes SET
        estado = $1, formato_original = $2,
        tiempo_conversion_seg = $3,
        worker_conversion = $4, ruta_convertida = $5,
        error_conversion = $6
      WHERE imagen_id = $7
    `, [
      datos.estado, datos.formatoOriginal, datos.tiempoSeg,
      datos.workerNombre, datos.ruta,
      datos.error || null, imagenId
    ]);
  },

  async actualizarMarcaAgua(imagenId, datos) {
    await pool.query(`
      UPDATE imagenes SET
        estado = $1, tiempo_marca_agua_seg = $2,
        worker_marca_agua = $3, ruta_marca_agua = $4,
        error_marca_agua = $5
      WHERE imagen_id = $6
    `, [
      datos.estado, datos.tiempoSeg,
      datos.workerNombre, datos.ruta,
      datos.error || null, imagenId
    ]);
  },


  async listarPorJob(jobId) {
    const result = await pool.query(`
      SELECT url_original, estado
      FROM imagenes
      WHERE job_id = $1
      ORDER BY imagen_id
    `, [jobId]);
    return result.rows;
  },



};