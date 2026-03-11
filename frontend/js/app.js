const workers = { descarga: 2, redimension: 2, conversion: 2, marcaAgua: 2 };
const MIN = 1;

// Actualizar contador de URLs al escribir
document.getElementById('urls').addEventListener('input', function () {
  const lista  = this.value.split('\n').map(u => u.trim()).filter(u => u.length > 0);
  document.getElementById('url-count').textContent = `${lista.length} URLs`;
});

function cambiarWorker(etapa, delta) {
  const nuevo = workers[etapa] + delta;
  if (nuevo < MIN) return;  
  workers[etapa] = nuevo;
  document.getElementById(`val-${etapa}`).textContent = nuevo;
}

async function procesarImagenes() {
  const textarea = document.getElementById('urls');
  const errorDiv = document.getElementById('error-msg');
  const btnProcesar = document.getElementById('btn-procesar');

  // Limpiar error anterior
  errorDiv.classList.add('hidden');
  errorDiv.textContent = '';

  // Parsear URLs
  const urls = textarea.value
    .split('\n')
    .map(u => u.trim())
    .filter(u => u.length > 0);

  // Validaciones
  if (urls.length === 0) {
    errorDiv.textContent = 'Ingresa al menos una URL.';
    errorDiv.classList.remove('hidden');
    return;
  }

  if (urls.length > 500) {
    errorDiv.textContent = 'Máximo 500 URLs por solicitud.';
    errorDiv.classList.remove('hidden');
    return;
  }

  const urlInvalida = urls.find(u => {
    try { new URL(u); return false; }
    catch { return true; }
  });

  if (urlInvalida) {
    errorDiv.textContent = `URL inválida: ${urlInvalida}`;
    errorDiv.classList.remove('hidden');
    return;
  }

  // Deshabilitar botón mientras procesa
  btnProcesar.disabled = true;
  btnProcesar.textContent = 'Iniciando...';

  try {
    const respuesta = await postProcesar(urls, workers);

    // Guardar jobId y redirigir al dashboard
    sessionStorage.setItem('jobId',        respuesta.jobId);
    sessionStorage.setItem('totalImagenes', respuesta.totalImagenes);
    window.location.href = 'status.html';

  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.classList.remove('hidden');
    btnProcesar.disabled = false;
    btnProcesar.textContent = 'Iniciar procesamiento';
  }
}