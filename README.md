# PMIC — Plataforma de Procesamiento Masivo de Imágenes Concurrente

## Requisitos

- Node.js v18+
- Docker Desktop

## Cómo ejecutar

```bash
# 1. Instalar dependencias
cd backend
npm install

# 2. Levantar base de datos (Docker Desktop debe estar abierto)
cd ..
docker compose up -d

# 3. Iniciar el servidor
cd backend
npm start
```

Abrir en el navegador: **http://localhost:3000**
