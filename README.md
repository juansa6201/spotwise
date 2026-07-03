# SpotWise

**Sistema inteligente de análisis geoespacial para la ubicación óptima de negocios.**

Prototipo del Trabajo Final de Grado (Ingeniería en Software, UES21). Dado un punto
en el mapa de la ciudad de Córdoba y un rubro comercial, el sistema calcula un
**score de viabilidad comercial (0–100)** combinando:

- **Competencia y actividad comercial** → Google Places API (negocios cercanos en un radio fijo).
- **Contexto demográfico** → datos abiertos de Gobierno Abierto Córdoba (densidad poblacional,
  índice socioeconómico por barrio — IPS), normalizados mediante un proceso ETL.

El score pondera tres indicadores (poblacional/socioeconómico, actividad económica y competencia)
y se traduce en un semáforo de decisión (alta / media / baja viabilidad).

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React + Vite · Google Maps (`@vis.gl/react-google-maps`) |
| Backend / API | Django + Django REST Framework |
| Base de datos | PostgreSQL + PostGIS |
| Autenticación | JWT (SimpleJWT) |
| Fuente externa | Google Places API (búsqueda + Autocomplete) |
| Infraestructura | Docker (dev) · AWS EC2 + RDS + Caddy/HTTPS (deploy) · CI/CD con GitHub Actions |

## Estructura

```
spotwise/
├── backend/          # API Django + DRF (corre en Docker)
│   ├── config/       # Proyecto Django (settings, urls)
│   ├── data/         # KML de barrios (IPS) de Córdoba — fuente del ETL
│   └── apps/
│       ├── users/    # Usuario custom (email + JWT)         — HU-001, HU-002
│       ├── catalog/  # Barrio (PostGIS) y Rubro + ETL KML   — HU-005
│       ├── places/   # Integración/caché de Google Places   — HU-004
│       └── analysis/ # Análisis, indicadores, score, guardados — HU-006..010
├── frontend/         # SPA React (Vite) — también corre en compose
├── docker-compose.yml        # Entorno de desarrollo (db + backend + frontend)
├── docker-compose.prod.yml   # Despliegue en producción
├── Caddyfile                 # Reverse proxy + HTTPS (Let's Encrypt)
└── DEPLOY.md                 # Guía de despliegue en AWS
```

El ETL de barrios se ejecuta con `python manage.py importar_barrios` (idempotente); en
desarrollo corre automáticamente al levantar el backend.

## Puesta en marcha (desarrollo)

Requisitos: Docker.

```bash
cp .env.example .env                    # config del backend + DB (obligatorio)
cp frontend/.env.example frontend/.env  # config del frontend (necesario para el mapa)
docker compose up -d --build            # levanta Postgres+PostGIS, la API y el frontend
```

Completá las API keys de Google en ambos archivos: `GOOGLE_PLACES_API_KEY` en `.env` y
`VITE_GOOGLE_MAPS_API_KEY` en `frontend/.env`. Sin el `frontend/.env` el sitio igual
levanta, pero el mapa de Google no se renderiza.

Al iniciar, el backend corre las migraciones e importa los barrios (ETL) automáticamente.
Para crear un superusuario del admin de Django:

```bash
docker compose exec backend python manage.py createsuperuser
```

Servicios disponibles:

- Frontend (SPA): http://localhost:5173 — las llamadas a `/api` se redirigen al backend.
- API: http://localhost:8000 — health check: http://localhost:8000/api/health/

> El despliegue en producción (AWS EC2 + RDS + Caddy/HTTPS) está documentado en [DEPLOY.md](DEPLOY.md).

## Estado del proyecto

- [x] **Fase 0** — Base: Docker, Django+DRF, React+Vite, modelos y migraciones.
- [x] **Fase 1** — Registro + login (JWT) y selección de ubicación en el mapa.
- [x] **Fase 2** — Integración Google Places + ETL de datos demográficos (KML → PostGIS).
- [x] **Fase 3** — Cálculo de indicadores y score de viabilidad.
- [x] **Fase 4** — Visualización de resultados y mapa analítico.
- [x] **Fase 5** — Guardado y consulta de ubicaciones.

Extras ya implementados: despliegue en AWS con HTTPS (Caddy + Let's Encrypt), CI/CD con
GitHub Actions, logging estructurado y buscador de direcciones (Places Autocomplete).
