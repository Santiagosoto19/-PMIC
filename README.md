# PMIC — Plataforma de Procesamiento Masivo de Imágenes Concurrente
```bash
Integrantes:

- Santiago Soto 
- Benis Adrian 
- Carlos Olaya 
```

## Requisitos

- Node.js v18+
- Docker Desktop

## Cómo ejecutar

```bash
# 1. Ir a la carpeta del backend
cd backend

# 2. Instalar dependencias
npm install

# 3. Levantar base de datos (Docker Desktop debe estar abierto)
docker compose up -d

# 4. Iniciar el servidor
npm start
```

Abrir en el navegador: **http://localhost:3000**

## Exponer a internet con ngrok

```bash
# 1. Instalar ngrok
npm install -g ngrok

# 2. Registrarse en https://dashboard.ngrok.com/signup (gratis)

# 3. Copiar authtoken de https://dashboard.ngrok.com/get-started/your-authtoken y configurar
npx ngrok config add-authtoken TU_AUTHTOKEN_AQUI

# 4. Crear túnel (en otra terminal, con el servidor corriendo)
npx ngrok http 3000
```

Compartir la URL que aparece (ej: `https://abc123.ngrok-free.app`)
