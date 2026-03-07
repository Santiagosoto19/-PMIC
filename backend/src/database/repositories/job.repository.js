import pool from '../db.js';

export const jobRepository = {

  async crear(jobData) {
    const result = await pool.query(`
      INSERT INTO jobs (
        job_id, urls_totales,
        workers_descarga, workers_redimension,
        workers_conversion, workers_marca_agua
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      jobData.jobId,
      jobData.urlsTotales,
      jobData.workers.descarga,
      jobData.workers.redimension,
      jobData.workers.conversion,
      jobData.workers.marcaAgua,
    ]);
    return result.rows[0];
  },

  async obtenerPorId(jobId) {
    const result = await pool.query(
      'SELECT * FROM jobs WHERE job_id = $1',
      [jobId]
    );
    return result.rows[0] || null;
  },

  async actualizarEstado(jobId, estado) {
    await pool.query(
      `UPDATE jobs SET estado = $1, fecha_fin = NOW()
       WHERE job_id = $2`,
      [estado, jobId]
    );
  },

  // Se llama cada vez que un worker termina una imagen,
  // ya sea con éxito o con error capturado por el EM
  async incrementarMetrica(jobId, etapa, exito, tiempoSeg) {
    const cols = {
      descarga:    { proc: 'desc_procesados', fall: 'desc_fallidos', t: 'desc_tiempo_total' },
      redimension: { proc: 'redi_procesados', fall: 'redi_fallidos', t: 'redi_tiempo_total' },
      conversion:  { proc: 'conv_procesados', fall: 'conv_fallidos', t: 'conv_tiempo_total' },
      marcaAgua:   { proc: 'agua_procesados', fall: 'agua_fallidos', t: 'agua_tiempo_total' },
    }[etapa];

    const query = exito
      ? `UPDATE jobs SET ${cols.proc} = ${cols.proc} + 1,
                         ${cols.t}    = ${cols.t}    + $1
         WHERE job_id = $2`
      : `UPDATE jobs SET ${cols.proc} = ${cols.proc} + 1,
                         ${cols.fall} = ${cols.fall} + 1,
                         ${cols.t}    = ${cols.t}    + $1
         WHERE job_id = $2`;

    await pool.query(query, [tiempoSeg, jobId]);
  },


async verificarCompletado(jobId) {
  const result = await pool.query(`
    SELECT COUNT(*) AS pendientes
    FROM imagenes
    WHERE job_id = $1
      AND estado NOT IN (
        'COMPLETADA',
        'ERROR_DESCARGA',
        'ERROR_REDIMENSION',
        'ERROR_CONVERSION',
        'ERROR_MARCA_AGUA'
      )
  `, [jobId]);
  return parseInt(result.rows[0].pendientes) === 0;
}, 

  async determinarEstadoFinal(jobId) {
    const job = await this.obtenerPorId(jobId);
    const errores = job.desc_fallidos + job.agua_fallidos;

    const estado = errores === 0            ? 'COMPLETADO'
                 : errores < job.urls_totales ? 'COMPLETADO_CON_ERRORES'
                 :                             'FALLIDO';

    await this.actualizarEstado(jobId, estado);
    return estado;
  },


async listarTodos() {
    const result = await pool.query(`
      SELECT * FROM jobs
      ORDER BY fecha_inicio DESC
    `);
    return result.rows;
  },



};