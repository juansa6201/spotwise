# SpotWise

**Sistema inteligente de análisis geoespacial para la ubicación óptima de negocios.**

Prototipo del Trabajo Final de Grado (Ingeniería en Software, UES21). Dado un punto
en el mapa de la ciudad de Córdoba y un rubro comercial, el sistema calcula un
**score de viabilidad comercial (0–100)** combinando:

- **Competencia y actividad comercial** → Google Places API (negocios cercanos en un radio fijo).
- **Contexto demográfico** → datos abiertos de Gobierno Abierto Córdoba (densidad poblacional,
  índice socioeconómico por barrio), normalizados mediante un proceso ETL.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React + Vite |
| Backend / API | Django + Django REST Framework |
| Base de datos | PostgreSQL + PostGIS |
| Autenticación | JWT (SimpleJWT) |
| Fuente externa | Google Places API |
| Infraestructura | Docker (dev) · AWS (deploy objetivo) |

## Estructura

```
spotwise/
├── backend/          # API Django + DRF (corre en Docker)
│   ├── config/       # Proyecto Django (settings, urls)
│   └── apps/
│       ├── users/    # Usuario custom (email + JWT)  — HU-001, HU-002
│       ├── catalog/  # Barrio (PostGIS) y Rubro       — datos de referencia
│       ├── places/   # Caché de Google Places         — HU-004
│       └── analysis/ # Análisis, indicadores, score   — HU-006..010
├── frontend/         # SPA React (corre local con Vite)
├── data/             # KML/datasets + scripts ETL     — HU-005
└── docker-compose.yml
```

## Puesta en marcha (desarrollo)

Requisitos: Docker y Node 20+.

### 1. Backend + base de datos (Docker)

```bash
cp .env.example .env          # (ya incluido un .env de dev)
docker compose up -d --build  # levanta Postgres+PostGIS y la API
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

API disponible en http://localhost:8000 — health check: http://localhost:8000/api/health/

### 2. Frontend (local)

```bash
cd frontend
npm install
npm run dev
```

App disponible en http://localhost:5173 (las llamadas a `/api` se redirigen al backend).

## Estado del proyecto

- [x] **Fase 0** — Base: Docker, Django+DRF, React+Vite, modelos y migraciones.
- [ ] **Fase 1** — Registro + login (JWT) y selección de ubicación en el mapa.
- [ ] **Fase 2** — Integración Google Places + ETL de datos demográficos (KML → PostGIS).
- [ ] **Fase 3** — Cálculo de indicadores y score de viabilidad.
- [ ] **Fase 4** — Visualización de resultados y mapa analítico.
- [ ] **Fase 5** — Guardado y consulta de ubicaciones.
