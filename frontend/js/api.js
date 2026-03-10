const API_BASE = '/api/v1';

async function postProcesar(urls, workers) {
  const response = await fetch(`${API_BASE}/procesar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls, workers }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detalle || err.error || 'Error al iniciar el procesamiento');
  }
  return response.json();
}

async function getEstado(jobId) {
  const response = await fetch(`${API_BASE}/estado/${jobId}`);
  if (!response.ok) throw new Error('Job no encontrado');
  return response.json();
}

async function getHistorial() {
  const response = await fetch(`${API_BASE}/jobs`);
  if (!response.ok) throw new Error('Error al obtener el historial');
  return response.json();
}