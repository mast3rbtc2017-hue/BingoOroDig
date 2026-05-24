# Bingo OroDig — Firebase Hosting (gratis)

La **app** vive en Firebase Hosting. La **API** va en **Render** (gratis) — ver [RENDER.md](./RENDER.md).

## URLs

- App: https://bingoorodig.web.app
- API: la URL de tu servicio Render + `/api/healthz`

## Requisitos Firebase (Spark, sin pagar)

1. **Authentication → Email/Password** activado.
2. **Firestore** activo (reglas ya en el repo).
3. No hace falta plan Blaze si usas Render para la API.

## Desplegar solo la web

1. Crea `artifacts/bingo-orodig/.env.production` con tu API de Render:

```env
VITE_API_URL=https://tu-servicio.onrender.com
```

2. Compila y despliega:

```bash
pnpm install --ignore-scripts
cd artifacts/bingo-orodig && PORT=4173 BASE_PATH=/ pnpm run build && cd ../..
firebase deploy --only hosting --project bingoorodig
```

## Primera cuenta admin

Registra usuario **`admin`** si no hay ningún admin en Firestore.

## Variables frontend

Ver `artifacts/bingo-orodig/.env.production.example` y `.env.example`.
