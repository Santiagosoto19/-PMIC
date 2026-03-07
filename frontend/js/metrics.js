const params        = new URLSearchParams(window.location.search);
const jobId         = params.get('jobId') || sessionStorage.getItem('jobId');
const totalImagenes = parseInt(sessionStorage.getItem('totalImagenes')) || 0;

let intervalo = null;

if (!jobId) {
  window.location.href = 'index.html';
}

document.getElementById('job-id').textContent        = jobId;
document.getElementById('total-recibidos').textContent = totalImagenes;

intervalo = setInterval(consultarEstado, 2000);
consultarEstado();

async function consultarEstado() {
  try {
    const data = await getEstado(jobId);
    actualizarUI(data);
    if (['COMPLETADO', 'COMPLETADO_CON_ERRORES', 'FALLIDO'].includes(data.estado)) {
      clearInterval(intervalo);
    }
  } catch (error) {
    console.error('Error consultando estado:', error.message);
  }
}

function actualizarUI(data) {
  const badge = document.getElementById('estado-badge');
  const clases = {
    'EN_PROCESO':             ['badge-proceso', 'EN PROCESO'],
    'COMPLETADO':             ['badge-ok',      'COMPLETADO'],
    'COMPLETADO_CON_ERRORES': ['badge-errores', 'CON ERRORES'],
    'FALLIDO':                ['badge-fallido', 'FALLIDO'],
  };
  const [clase, texto] = clases[data.estado] || ['badge-proceso', data.estado];
  badge.className  = `badge ${clase}`;
  badge.textContent = texto;

  document.getElementById('fecha-inicio').textContent =
    new Date(data.fechaInicio).toLocaleTimeString('es-CO');
  document.getElementById('fecha-fin').textContent =
    data.fechaFin ? new Date(data.fechaFin).toLocaleTimeString('es-CO') : '—';
  document.getElementById('tiempo-total').textContent = `${data.tiempoTotalSeg}s`;

  const total = data.resumenGlobal.totalRecibidos;

  actualizarEtapa('desc', data.metricasDescarga,    total);
  actualizarEtapa('redi', data.metricasRedimension, total);
  actualizarEtapa('conv', data.metricasConversion,  total);
  actualizarEtapa('agua', data.metricasMarcaAgua,   total);

  const barras = {
    'barra-descarga':    data.metricasDescarga,
    'barra-redimension': data.metricasRedimension,
    'barra-conversion':  data.metricasConversion,
    'barra-marcaagua':   data.metricasMarcaAgua,
  };

  for (const [id, m] of Object.entries(barras)) {
    const pct = total > 0 ? (m.totalProcesados / total) * 100 : 0;
    document.getElementById(id).style.width = `${Math.min(pct, 100)}%`;
  }

  const ok  = total - data.resumenGlobal.totalConError;
  const err = data.resumenGlobal.totalConError;

  document.getElementById('total-ok').textContent  = ok;
  document.getElementById('total-err').textContent = err;
  document.getElementById('pct-exito').textContent = `${data.resumenGlobal.porcentajeExito}%`;
  document.getElementById('pct-error').textContent = `${parseFloat((100 - data.resumenGlobal.porcentajeExito).toFixed(2))}%`;
}

function actualizarEtapa(prefijo, metricas, total) {
  document.getElementById(`${prefijo}-procesados`).textContent = metricas.totalProcesados;
  document.getElementById(`${prefijo}-fallidos`).textContent   = metricas.totalFallidos;
  document.getElementById(`${prefijo}-promedio`).textContent   =
    metricas.tiempoPromedioSeg > 0 ? `${metricas.tiempoPromedioSeg}s` : '—';
}