# Desplegar la API en Render (gratis) + web en Firebase

Repositorio: **https://github.com/mast3rbtc2017-hue/BingoOroDig**

Arquitectura:

| Parte | Dónde | URL |
|-------|--------|-----|
| App (jugadores) | Firebase Hosting | https://bingoorodig.web.app |
| API REST | Render (plan free) | https://TU-SERVICIO.onrender.com |
| Auth + datos | Firebase (Spark) | Auth + Firestore |

---

## Parte 1 — Cuenta de servicio Firebase (5 min)

1. Abre [Firebase Console → Configuración del proyecto → Cuentas de servicio](https://console.firebase.google.com/project/bingoorodig/settings/serviceaccounts/adminsdk).
2. **Generar nueva clave privada** → descarga el `.json`.
3. Guárdalo en un lugar seguro (no lo subas a GitHub).

4. En [Authentication](https://console.firebase.google.com/project/bingoorodig/authentication/providers) activa **Correo electrónico/Contraseña**.

---

## Parte 2 — Crear el servicio en Render (10 min)

1. Entra en [render.com](https://render.com) (cuenta ya creada).
2. **New +** → **Blueprint** (recomendado) o **Web Service**.
3. Conecta GitHub y elige el repo **`mast3rbtc2017-hue/BingoOroDig`**.
4. Si usas **Blueprint**, Render lee `render.yaml` y crea `bingoorodig-api` solo.
5. Si usas **Web Service** manual, configura:

| Campo | Valor |
|-------|--------|
| **Name** | `bingoorodig-api` (o el que quieras) |
| **Root Directory** | `functions` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Plan** | Free |

5. En **Environment** → **Add Environment Variable**:

| Key | Value |
|-----|--------|
| `NODE_VERSION` | `20` |
| `NODE_ENV` | `production` |
| `GOOGLE_CLOUD_PROJECT` | `bingoorodig` |
| `FRONTEND_URL` | `https://bingoorodig.web.app,https://bingoorodig.firebaseapp.com` |
| `FIREBASE_SERVICE_ACCOUNT` | Pega **todo** el contenido del JSON de la cuenta de servicio (en una línea) |

> Para pegar el JSON en Render: abre el `.json` con un editor, copia todo, o usa un minificador. Debe empezar con `{"type":"service_account",...}`.

6. **Create Web Service** y espera el primer deploy (5–10 min).

7. Copia la URL pública, por ejemplo:  
   `https://bingoorodig-api.onrender.com`

8. Prueba en el navegador:  
   `https://TU-URL.onrender.com/api/healthz`  
   Debe responder `{"status":"ok",...}`.

---

## Parte 3 — Enlazar la web con la API

En tu PC, en la raíz del proyecto:

1. Crea el archivo `artifacts/bingo-orodig/.env.production` (no lo subas a git si tiene datos sensibles; solo tiene la URL pública):

```env
VITE_API_URL=https://TU-URL.onrender.com
```

Sustituye `TU-URL` por la URL real de Render (sin barra final).

2. Compila y sube solo el hosting:

```powershell
cd c:\Users\Usuario\Desktop\Bingo-OroDig
pnpm install --ignore-scripts
cd artifacts\bingo-orodig
$env:PORT="4173"
$env:BASE_PATH="/"
pnpm run build
cd ..\..
firebase deploy --only hosting --project bingoorodig
```

3. Abre https://bingoorodig.web.app → regístrate o inicia sesión.

---

## Primera cuenta admin

Usuario: **`admin`** (primera cuenta si no hay admins en Firestore).

---

## Notas del plan free de Render

- El servicio **se duerme** tras ~15 min sin tráfico; el primer request puede tardar **30–60 s** (cold start).
- 750 h/mes gratis suele bastar para pruebas y pocos usuarios.
- Si cambias la URL de Render, vuelve a compilar el frontend con el nuevo `VITE_API_URL` y haz `firebase deploy --only hosting`.

---

## Desarrollo local

Terminal 1 — API:

```powershell
cd functions
copy .env.example .env
# Edita .env y pega FIREBASE_SERVICE_ACCOUNT=...
npm install
npm run dev
```

Terminal 2 — Frontend:

```powershell
cd artifacts\bingo-orodig
# .env.local:
# VITE_API_URL=http://localhost:8080
pnpm run dev
```

---

## Resumen de URLs finales

- **App:** https://bingoorodig.web.app  
- **API:** https://TU-SERVICIO.onrender.com/api/healthz  
- **Firebase Console:** https://console.firebase.google.com/project/bingoorodig  
