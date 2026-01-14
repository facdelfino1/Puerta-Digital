# Sistema de Control de Acceso Empresarial

## Introduccion
Plataforma integral para controlar ingresos y egresos de personal propio y proveedores, con autenticacion basada en roles, gestion documental y herramientas de analitica en tiempo real. Este README se actualizo para dejar documentadas las funcionalidades y cambios mas recientes del sistema.

## Arquitectura general
- Frontend en Next.js 14 (App Router) con React y TypeScript.
- Backend Express desacoplado (`backend/server.js`) con JWT, WebSocket y acceso a SQL Server mediante `mssql`.
- Comunicacion cliente-servidor mediante API REST (JSON) y WebSocket (`/ws/access`).
- Base de datos principal: Microsoft SQL Server.
- Integracion opcional con hardware Shelly para automatizar apertura de portones o molinetes.

## Modificaciones y capacidades principales
- **Autenticacion y roles**: Login con JWT y cookies HTTP-only, verificacion de correo electronico opcional, gestion de sesiones y middleware que protege rutas por rol (guardia, supervisor, administrador).
- **Dashboard interactivo**: Estadisticas de ocupacion y flujos diarios con vistas emergentes filtrables, alertas sobre proveedores por vencer y tarjetas adaptadas al rol.
- **Control de accesos unificado**: Busqueda por DNI, seleccion rapida por nombre o vehiculo, registro de notas, validaciones contra documentacion y opcion de disparar Shelly. Gestiona ingresos y egresos en un mismo flujo.
- **Gestion documental de proveedores**: Carga de PDFs con historial completo, control de vencimientos, permisos vehiculares, borrado seguro, descarga y previsualizacion. Actualiza automaticamente el estado vehicular del proveedor.
- **Catalogos de personas, vehiculos y areas**: CRUD completo con filtros, estado activo/inactivo, carga de fotos, asignacion de vehiculos y relacion con areas para reporteria.
- **Reporteria avanzada**: Endpoints `/reports/stats`, `/reports/area-entries` y `/reports/detailed` con filtros por fecha, area, persona y vehiculos. Exporta a Excel con formato y nombres dinamicos. El backend valida rangos y evita PDF mientras se completa la implementacion.
- **Resumen de proveedores**: Endpoint `/providers/summary` y vistas dedicadas para contabilizar vigentes, por vencer y vencidos, con modal de detalle e indicadores por rol.
- **Monitoreo en tiempo real**: Servidor WebSocket (`backend/realtime`) que emite eventos `access_event` consumidos por el dashboard; incluye heartbeat y manejo de desconexiones.
- **Integracion Shelly**: Cliente resiliente con reintentos, pulsos temporizados y reversa programada. Proteccion opcional con `SHELLY_SHARED_SECRET` y reportes de errores en la UI.
- **Seguridad y auditoria**: Registro de guardias en cada log, bloqueo de ingreso a proveedores en estado invalido, limpieza de uploads al fallar y manejo consistente de zonas horarias.

## Modulos de la aplicacion
- Dashboard: vision general, estadisticas y detalle en dialogos.
- Control de accesos: registro manual, validaciones y disparo Shelly.
- Personas: altas, bajas, fotos, asignacion de areas y vehiculos.
- Proveedores: administracion de catalogo y documentacion vinculada.
- Vehiculos: registro, edicion y relacion con personas o proveedores.
- Areas: organizacion jerarquica y soporte para reportes.
- Usuarios: CRUD de cuentas de acceso, roles, verificacion de correo.
- Reportes: generacion y descarga de datos historicos en Excel.
- Configuracion: parametros generales, secretos y datos de la compania.

## Requisitos previos
- Node.js 18.17 o superior.
- SQL Server 2019 o superior (local o remoto).
- npm 9+ (o pnpm/yarn si se prefiere).
- Opcional: cuenta SMTP para verificacion de correo y hardware Shelly compatible.

## Configuracion de variables de entorno
Duplicar los archivos de ejemplo, ajustar segun el entorno y nunca subirlos a control de versiones.

### Frontend (`.env.local`)
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
JWT_SECRET=rellenar-con-llave-segura
SESSION_SECRET=clave-para-cookies
DATABASE_URL=sqlserver://usuario:password@localhost:1433/access_control_db
DB_HOST=localhost\SQLEXPRESS
DB_PORT=1433
DB_NAME=access_control_db
DB_USER=sa
DB_PASSWORD=tuPassword
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=usuario@gmail.com
SMTP_PASS=clave-o-token
CLOUDINARY_URL=opcional
REPORTS_TEMP_DIR=/tmp/reports
SHELLY_SHARED_SECRET=opcional-si-se-usa-hardware
```

### Backend (`backend/.env`)
```env
PORT=3001
JWT_SECRET=llave-super-secreta
DB_HOST=localhost\SQLEXPRESS
DB_PORT=1433
DB_NAME=access_control_db
DB_USER=sa
DB_PASSWORD=tuPassword
UPLOADS_DIR=uploads/providers
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=usuario@gmail.com
SMTP_PASS=token-app
SMTP_FROM=Puerta Digital <usuario@gmail.com>
TRUSTED_EMAILS=admin@empresa.com,supervisor@empresa.com,guardia@empresa.com
SHELLY_BASE_URL=http://192.168.0.10
SHELLY_RELAY_CHANNEL=1
SHELLY_TIMEOUT_MS=4000
SHELLY_RETRY_ATTEMPTS=3
SHELLY_RETRY_DELAY_MS=1000
SHELLY_PULSE_DURATION_MS=3000
SHELLY_OPEN_STATE=off
SHELLY_SHARED_SECRET=opcional
SHELLY_GUARD_USER_ID=1
```

## Instalacion y puesta en marcha
1. Clonar el repositorio y entrar al directorio del proyecto.
2. Instalar dependencias: `npm install`.
3. Configurar las variables de entorno descritas arriba.
4. Crear la base de datos y correr los scripts SQL.
5. Ejecutar el backend: `npm run dev:api` (usa nodemon).
6. Ejecutar el frontend: `npm run dev:web` o `npm run dev` para ambos procesos en paralelo.
7. Abrir `http://localhost:3000` y autenticarse con usuarios de prueba.

## Base de datos
- `scripts/01-create-database.sql`: crea `access_control_db` con tablas de personas, proveedores, vehiculos, areas, usuarios y logs.
- `scripts/02-seed-data.sql`: inserta datos iniciales (roles, areas y usuarios base).
- El backend usa consultas parametrizadas y pool reutilizable (`backend/lib/database.js`), compatible con autenticacion SQL y Windows.

## Scripts npm disponibles
- `npm run dev:web`: inicia Next.js en modo desarrollo puerto 3000.
- `npm run dev:api`: levanta Express con nodemon en puerto 3001.
- `npm run dev`: arranca frontend y backend en paralelo mediante `concurrently`.
- `npm run build`: compila la aplicacion Next.js para produccion.
- `npm run start`: sirve la compilacion en modo produccion.
- `npm run lint`: ejecuta `next lint` sobre componentes y paginas.

## API principal (backend)
- `POST /auth/login`, `POST /auth/resend-verification`, `GET /auth/me`, `POST /auth/logout`.
- `GET /providers`, `POST /providers`, `PATCH /providers/:id`, `DELETE /providers/:id`.
- `GET /providers/:id/docs`, `POST /providers/:id/docs`, `DELETE /providers/:id/docs/:docId`.
- `GET /providers/status`, `GET /providers/status/resumen`, `GET /providers/summary`.
- `GET /people`, `POST /people`, `PATCH /people/:id`, `DELETE /people/:id`.
- `GET /vehicles`, `POST /vehicles`, `PATCH /vehicles/:id`, `DELETE /vehicles/:id`.
- `POST /access_logs`, `GET /access_logs`.
- `GET /dashboard/summary`, `GET /dashboard/inside`, `GET /dashboard/providers`.
- `GET /reports/stats`, `GET /reports/area-entries`, `POST /reports/detailed` (JSON o Excel).
- `GET /users`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id`.
- `POST /shelly/scan` y `POST /api/scan/log-access`: integracion con hardware de lectura de DNI.

Todas las rutas usan middlewares `authenticateToken`, `requireAnyRole`, `requireSupervisor` o `requireAdmin` segun corresponda.

## Reportes y exportaciones
- Estadisticas de hoy (`/reports/stats`) y por area (`/reports/area-entries`).
- Reporte detallado (`/reports/detailed`) acepta filtros de fecha, areas multiples, persona y opcion de incluir datos vehiculares.
- Exporta a Excel con cabeceras ajustadas, fechas formateadas y filas congeladas. El nombre del archivo se genera con las fechas solicitadas.
- La API devuelve JSON cuando `format` no es `excel` (PDF se encuentra temporalmente deshabilitado).

## Integracion con Shelly
- Configuracion mediante variables `SHELLY_BASE_URL`, `SHELLY_RELAY_CHANNEL`, `SHELLY_OPEN_STATE`, tiempos de retraso y reintentos.
- `backend/lib/shellyClient.js` maneja timeouts, reintentos y restauracion del estado del rele.
- Rutas `/shelly/scan` y `handleScan` validan DNI, estado del proveedor, documentacion y retornan payloads listos para el firmware.
- Eventos de Shelly se emiten via WebSocket para actualizar dashboards en vivo.

## Monitoreo en tiempo real
- Servidor WebSocket (`ws://localhost:3001/ws/access`) inicializado por `initRealtime`.
- Emite eventos `connected` al abrir la sesion y `access_event` cada vez que se registra un ingreso, egreso o lectura de Shelly.
- Incluye latidos cada 30 segundos para limpiar conexiones inactivas.

## Estructura del proyecto
```text
app/
  dashboard/
    access/
    users/
    reports/
  login/
backend/
  routes/
    access_logs.js
    dashboard.js
    providers.js
    reports.js
    shelly.js
  lib/
    database.js
    shellyClient.js
  realtime/
    index.js
components/
  access/
  dashboard/
  providers/
  layout/
scripts/
  01-create-database.sql
  02-seed-data.sql
```

## Credenciales de prueba (desarrollo)
- Administrador: `admin@empresa.com` / `admin123`
- Supervisor: `supervisor@empresa.com` / `super123`
- Guardia: `guardia@empresa.com` / `guard123`

## Recursos adicionales
- `backend/scripts/hash.js` para generar hashes Bcrypt al crear usuarios manualmente.
- `utils/api.ts` centraliza la comunicacion con el backend y manejo de tokens.
- `useAuth.ts` expone hooks para proteger paginas en el frontend.

## Soporte
Ante dudas o incidencias contactar al equipo administrador del sistema. Registrar cualquier ajuste adicional en este documento para mantener la trazabilidad.
