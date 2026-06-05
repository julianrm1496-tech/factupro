# FactuPro — Guía de instalación y despliegue

App de gestión de facturas y cobros para equipos pequeños.

---

## Stack
- **Frontend**: React + Vite
- **Base de datos**: Supabase (PostgreSQL)
- **Hosting**: Vercel
- **Autenticación**: Supabase Auth

---

## Paso 1 — Crear proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com) y crea una cuenta gratuita
2. Crea un nuevo proyecto (elige la región más cercana: US East o Europe)
3. En el menú izquierdo ve a **SQL Editor**
4. Copia y pega todo el contenido de `supabase_schema.sql` y ejecuta
5. Ve a **Project Settings → API** y copia:
   - `Project URL` → este es tu `VITE_SUPABASE_URL`
   - `anon public key` → este es tu `VITE_SUPABASE_ANON_KEY`

## Paso 2 — Crear usuarios

1. En Supabase ve a **Authentication → Users**
2. Haz clic en **Add user** y crea los correos/contraseñas para tu equipo (máx 5)

## Paso 3 — Configurar variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

## Paso 4 — Correr localmente (opcional)

```bash
npm install
npm run dev
```

Abre http://localhost:5173

## Paso 5 — Desplegar en Vercel

### Opción A: desde GitHub (recomendada)
1. Sube el proyecto a un repositorio de GitHub
2. Ve a [https://vercel.com](https://vercel.com) y conéctate con tu cuenta de GitHub
3. Haz clic en **New Project** y selecciona el repositorio
4. En **Environment Variables** agrega:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Haz clic en **Deploy**

### Opción B: con Vercel CLI
```bash
npm install -g vercel
vercel
# Sigue las instrucciones y agrega las variables de entorno cuando te lo pida
```

---

## Funcionalidades incluidas

- ✅ Login con email y contraseña
- ✅ Dashboard con gráficas (cobros por mes, estado de facturas, clientes con saldo)
- ✅ Gestión completa de clientes (crear, editar, eliminar)
- ✅ Gestión de facturas con estados automáticos (pagada / pendiente / vencida)
- ✅ Registro de pagos y abonos parciales con validación de saldo
- ✅ Historial completo de pagos
- ✅ Responsive — funciona en PC y celular
- ✅ Instalable como PWA en Android/iOS

---

## Estructura del proyecto

```
factupro/
├── src/
│   ├── components/
│   │   └── Layout.jsx        # Sidebar + topbar
│   ├── hooks/
│   │   └── useAuth.jsx       # Contexto de autenticación
│   ├── lib/
│   │   ├── supabase.js       # Cliente Supabase
│   │   └── utils.js          # Helpers (formato COP, fechas, etc.)
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx     # Métricas + gráficas
│   │   ├── Facturas.jsx
│   │   ├── Clientes.jsx
│   │   └── Pagos.jsx
│   ├── App.jsx               # Router principal
│   ├── main.jsx
│   └── index.css
├── supabase_schema.sql       # Schema de base de datos
├── .env.example              # Plantilla de variables de entorno
└── package.json
```

---

## Soporte

Para agregar funciones adicionales (PDF de facturas, notificaciones por email, etc.), contacta al desarrollador.
