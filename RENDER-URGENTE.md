# Arreglar Render en 3 minutos

Tu variable `FIREBASE_SERVICE_ACCOUNT` está **incompleta** (solo tiene `type` y `project_id`).  
Falta `private_key` y `client_email`. Por eso la API no funciona.

## Solución (recomendada)

1. Abre el archivo `.json` que descargaste de Firebase.
2. En Render → **Environment**, **borra** `FIREBASE_SERVICE_ACCOUNT`.
3. Añade **dos** variables nuevas:

| Variable | Valor (del JSON) |
|----------|------------------|
| `FIREBASE_CLIENT_EMAIL` | El campo `"client_email"` (ej: `firebase-adminsdk-xxxxx@bingoorodig.iam.gserviceaccount.com`) |
| `FIREBASE_PRIVATE_KEY` | El campo `"private_key"` **entero**, incluyendo `-----BEGIN PRIVATE KEY-----` y `-----END PRIVATE KEY-----` |

4. **Save** → Render redespliega solo.
5. Prueba: https://bingoorodig-api.onrender.com/api/healthz  
   Debe decir `"firebase":{"ok":true}`.

## App

https://bingoorodig.web.app (ya apunta a Render)
