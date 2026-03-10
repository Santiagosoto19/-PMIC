import pool from '../db.js';

export const imagenRepository = {

  async crearMuchas(imagenes) {
    if (imagenes.length === 0) return;

    const valores = [];
    const placeholders = imagenes.map((img, i) => {
      const b = i * 3;
      valores.push(img.imagenId, img.jobId, img.urlOriginal);
      return `($${b + 1}, $${b + 2}, $${b + 3})`;
    });

    await pool.query(
      `INSERT INTO imagenes (imagen_id, job_id, url_original)
       VALUES ${placeholders.join(', ')}`,
      valores
    );
  },

  // ── Descarga ──
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

  // ── Redimensión (paralela) ──
  // NO sobreescribe estado — solo actualiza sus propias columnas
  async actualizarRedimension(imagenId, datos) {
    await pool.query(`
      UPDATE imagenes SET
        ancho_original = $1, alto_original = $2,
        ancho_final = $3,    alto_final = $4,
        tiempo_redimension_seg = $5,
        worker_redimension = $6, ruta_redimensionada = $7,
        error_redimension = $8
      WHERE imagen_id = $9
    `, [
      datos.anchoOriginal, datos.altoOriginal,
      datos.anchoFinal, datos.altoFinal,
      datos.tiempoSeg,
      datos.workerNombre, datos.ruta,
      datos.error || null, imagenId
    ]);
    // Verificar si las 3 etapas paralelas terminaron
    await this.verificarImagenCompleta(imagenId);
  },

  // ── Conversión (paralela) ──
  async actualizarConversion(imagenId, datos) {
    await pool.query(`
      UPDATE imagenes SET
        formato_original = $1,
        tiempo_conversion_seg = $2,
        worker_conversion = $3, ruta_convertida = $4,
        error_conversion = $5
      WHERE imagen_id = $6
    `, [
      datos.formatoOriginal, datos.tiempoSeg,
      datos.workerNombre, datos.ruta,
      datos.error || null, imagenId
    ]);
    await this.verificarImagenCompleta(imagenId);
  },

  // ── Marca de Agua (paralela) ──
  async actualizarMarcaAgua(imagenId, datos) {
    await pool.query(`
      UPDATE imagenes SET
        tiempo_marca_agua_seg = $1,
        worker_marca_agua = $2, ruta_marca_agua = $3,
        error_marca_agua = $4
      WHERE imagen_id = $5
    `, [
      datos.tiempoSeg,
      datos.workerNombre, datos.ruta,
      datos.error || null, imagenId
    ]);
    await this.verificarImagenCompleta(imagenId);
  },

  // ⭐ Verificar si las 3 etapas paralelas terminaron para esta imagen
  // Una imagen se completa cuando resize + convert + watermark están hechas
  async verificarImagenCompleta(imagenId) {
    const result = await pool.query(`
      SELECT
        (ruta_redimensionada IS NOT NULL OR error_redimension IS NOT NULL) AS resize_done,
        (ruta_convertida     IS NOT NULL OR error_conversion  IS NOT NULL) AS convert_done,
        (ruta_marca_agua     IS NOT NULL OR error_marca_agua  IS NOT NULL) AS watermark_done,
        error_redimension, error_conversion, error_marca_agua
      FROM imagenes WHERE imagen_id = $1
    `, [imagenId]);

    const img = result.rows[0];
    if (!img) return;

    // ¿Las 3 terminaron?
    if (img.resize_done && img.convert_done && img.watermark_done) {
      const tieneError = img.error_redimension || img.error_conversion || img.error_marca_agua;
      const nuevoEstado = tieneError ? 'COMPLETADA' : 'COMPLETADA';
      await pool.query(
        `UPDATE imagenes SET estado = $1 WHERE imagen_id = $2`,
        [nuevoEstado, imagenId]
      );
    }
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