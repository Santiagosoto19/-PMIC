let todosLosJobs = [];

cargarHistorial();

async function cargarHistorial() {
  try {
    todosLosJobs = await getHistorial();
    renderizar(todosLosJobs);
  } catch (error) {
    document.getElementById('contenido').innerHTML =
      `<div class="sin-resultados">Error: ${error.message}</div>`;
  }
}

function filtrar() {
  const texto  = document.getElementById('input-busqueda').value.toLowerCase().trim();
  const estado = document.getElementById('filtro-estado').value;

  const filtrados = todosLosJobs.filter(job => {
    const coincideEstado = !estado || job.estado === estado;
    const coincideTexto  = !texto
      || job.jobId.toLowerCase().includes(texto)
      || job.urls.some(u => u.url.toLowerCase().includes(texto));
    return coincideEstado && coincideTexto;
  });

  document.getElementById('resultado-texto').textContent =
    texto || estado
      ? `${filtrados.length} resultado${filtrados.length !== 1 ? 's' : ''} encontrado${filtrados.length !== 1 ? 's' : ''}`
      : '';

  renderizar(filtrados);
}

function limpiarFiltros() {
  document.getElementById('input-busqueda').value = '';
  document.getElementById('filtro-estado').value  = '';
  document.getElementById('resultado-texto').textContent = '';
  renderizar(todosLosJobs);
}

function toggleUrls(jobId) {
  const el  = document.getElementById(`urls-${jobId}`);
  const btn = document.getElementById(`btn-urls-${jobId}`);
  const abierto = el.classList.toggle('abierto');
  btn.textContent = abierto ? '▲ Ocultar URLs' : `▼ Ver ${el.dataset.total} URLs`;
}

function renderizar(jobs) {
  const contenido = document.getElementById('contenido');

  if (jobs.length === 0) {
    contenido.innerHTML = '<div class="sin-resultados">No se encontraron jobs.</div>';
    return;
  }

  const cards = jobs.map(job => {
    const badgeClase = {
      'COMPLETADO':             'badge-ok',
      'COMPLETADO_CON_ERRORES': 'badge-errores',
      'FALLIDO':                'badge-fallido',
      'EN_PROCESO':             'badge-proceso',
    }[job.estado] || 'badge-proceso';

    const fechaInicio = job.fechaInicio
      ? new Date(job.fechaInicio).toLocaleString('es-CO') : '—';

    const fechaFin = job.fechaFin
      ? new Date(job.fechaFin).toLocaleString('es-CO') : '—';

    const tiempo = job.tiempoTotalSeg !== null
      ? `${job.tiempoTotalSeg}s` : 'En curso...';

    const urlsHtml = job.urls.map(u => {
      const esOk  = u.estado === 'COMPLETADA';
      const esErr = u.estado.startsWith('ERROR');
      const clase = esOk ? 'dot-ok' : esErr ? 'dot-err' : 'dot-pen';
      return `
        <div class="url-fila">
          <div class="url-dot ${clase}"></div>
          <span class="url-link" title="${u.url}">${u.url}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="job-card">

        <div class="job-card-header">
          <div class="job-card-id">
            ${job.jobId.slice(0, 8)}...
            <small title="${job.jobId}">${job.jobId}</small>
          </div>
          <div style="display:flex; gap:.8rem; align-items:center; flex-wrap:wrap;">
            <span class="badge ${badgeClase}">${job.estado.replace(/_/g, ' ')}</span>
            <div class="job-acciones">
              <button class="btn-ver"
                onclick="window.location.href='status.html?jobId=${job.jobId}'">
                Ver detalle →
              </button>
            </div>
          </div>
        </div>

        <div class="job-card-body">

          <div class="info-bloque">
            <div class="info-bloque-titulo">Tiempos</div>
            <div class="info-bloque-valor">▶ ${fechaInicio}</div>
            <div class="info-bloque-valor">⏹ ${fechaFin}</div>
            <div class="info-bloque-valor" style="color:var(--cyan)">⏱ ${tiempo}</div>
          </div>

          <div class="info-bloque">
            <div class="info-bloque-titulo">Workers (D/R/C/M)</div>
            <div class="workers-row">
              <div class="wtag">
                <span class="wtag-label">Desc</span>
                <span class="wtag-val">${job.workers.descarga}</span>
              </div>
              <div class="wtag">
                <span class="wtag-label">Redi</span>
                <span class="wtag-val">${job.workers.redimension}</span>
              </div>
              <div class="wtag">
                <span class="wtag-label">Conv</span>
                <span class="wtag-val">${job.workers.conversion}</span>
              </div>
              <div class="wtag">
                <span class="wtag-label">Marc</span>
                <span class="wtag-val">${job.workers.marcaAgua}</span>
              </div>
            </div>
          </div>

          <div class="info-bloque">
            <div class="info-bloque-titulo">Resumen</div>
            <div class="stats-row">
              <div class="stat-item">
                <span class="stat-num stat-tot">${job.resumen.totalImagenes}</span>
                <span class="stat-lbl">Total</span>
              </div>
              <div class="stat-item">
                <span class="stat-num stat-ok">${job.resumen.completadas}</span>
                <span class="stat-lbl">✓ OK</span>
              </div>
              <div class="stat-item">
                <span class="stat-num stat-err">${job.resumen.fallidas}</span>
                <span class="stat-lbl">✗ Error</span>
              </div>
            </div>
          </div>

        </div>

        <button
          id="btn-urls-${job.jobId}"
          class="urls-toggle"
          onclick="toggleUrls('${job.jobId}')">
          ▼ Ver ${job.urls.length} URLs
        </button>

        <div
          id="urls-${job.jobId}"
          class="urls-accordion"
          data-total="${job.urls.length}">
          <div class="urls-grid">${urlsHtml}</div>
        </div>

      </div>
    `;
  }).join('');

  contenido.innerHTML = `<div class="jobs-grid">${cards}</div>`;
}
