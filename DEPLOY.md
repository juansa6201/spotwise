# Deploy en AWS (EC2 + docker compose + RDS)

Despliegue de SpotWise con **EC2** (corre `docker compose` con las imágenes de
GHCR), **RDS PostgreSQL/PostGIS** como base, y **GitHub Actions** para CI/CD.

```
GitHub push a main
  └─ Actions: build imágenes → GHCR (backend, frontend)
       └─ SSH a la EC2: docker compose pull + up
              ├─ frontend (nginx :80)  → sirve el SPA y proxea /api
              └─ backend  (gunicorn)   → migra + importa barrios + collectstatic
                     └─ RDS PostgreSQL/PostGIS
```

## 0) Pre-requisitos
- Cuenta de AWS (mirá AWS Educate / GitHub Student Pack para créditos).
- Repo en GitHub con permiso para crear secrets y packages (GHCR).
- Keys de Google: una de **Maps JavaScript** (frontend) y una de **Places** (backend).

## 1) RDS PostgreSQL con PostGIS
1. Creá una instancia **RDS PostgreSQL** (free tier: `db.t4g.micro`, 20 GB).
2. En *Connectivity*: misma VPC que la EC2, **no público**, y un *security group*
   que permita el puerto 5432 **solo desde el security group de la EC2**.
3. Anotá endpoint, usuario, password y db (van al `.env.prod`).
4. Activá la extensión PostGIS (conectado a la base, p. ej. con `psql`):
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```

## 2) EC2
1. Lanzá una **EC2 `t3.micro`** (Ubuntu 22.04/24.04), en la misma VPC que RDS.
2. *Security group*: abrí **80** (y 443 si vas a usar TLS) a internet y **22**
   solo a tu IP.
3. Instalá Docker + compose plugin:
   ```bash
   sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin
   sudo usermod -aG docker $USER && newgrp docker
   ```
4. Preparé el directorio y el `.env.prod`:
   ```bash
   sudo mkdir -p /opt/spotwise && sudo chown $USER /opt/spotwise
   cd /opt/spotwise
   # subí tu .env.prod (basado en .env.prod.example del repo) con los datos de RDS
   ```
   `POSTGRES_HOST` apunta al endpoint de RDS; `DJANGO_ALLOWED_HOSTS` incluye el
   DNS/IP público de la EC2 (y tu dominio si tenés).

## 3) Secrets en GitHub (Settings → Secrets and variables → Actions)
| Secret | Para qué |
|---|---|
| `EC2_HOST` | IP o DNS público de la EC2 |
| `EC2_USER` | usuario SSH (`ubuntu`) |
| `EC2_SSH_KEY` | clave **privada** SSH de acceso a la EC2 |
| `GHCR_PULL_TOKEN` | PAT con `read:packages` para que la EC2 baje las imágenes |
| `VITE_GOOGLE_MAPS_API_KEY` | key de Maps (se hornea en el build del frontend) |

> Si hacés **públicos** los packages de GHCR, podés omitir `GHCR_PULL_TOKEN` y el
> `docker login` del workflow.

## 4) Primer deploy
1. Asegurate de que el workflow de CI (`ci.yml`) pase y **protegé `main`** para que
   los tests sean obligatorios antes de mergear.
2. Push/merge a `main` → el workflow `deploy.yml`:
   - buildea y publica `backend` y `frontend` en GHCR (tag = SHA del commit),
   - copia `docker-compose.prod.yml` a `/opt/spotwise`,
   - hace `docker compose pull && up -d` en la EC2.
3. El backend, al levantar, corre `migrate`, `importar_barrios` y `collectstatic`.

Abrí `http://<DNS-EC2>/` → debería cargar el SPA y responder `/api`.

## 5) Post-deploy
- **Superusuario** del admin:
  ```bash
  docker compose -f /opt/spotwise/docker-compose.prod.yml exec backend \
    python manage.py createsuperuser
  ```
- **Restringí las API keys de Google**:
  - Maps (frontend): restricción por *HTTP referrer* = tu dominio/DNS.
  - Places (backend): restricción por IP de la EC2 (o sin referrer).
- **HTTPS** (recomendado): poné un **CloudFront** o un **ALB** con certificado de
  ACM delante, o agregá Caddy/nginx con Let's Encrypt. Cuando tengas TLS, poné
  en `.env.prod`: `DJANGO_SECURE_SSL_REDIRECT=True` y `DJANGO_COOKIE_SECURE=True`.

## 6) Operación
- **Logs**: `docker compose -f /opt/spotwise/docker-compose.prod.yml logs -f`
- **Rollback**: redeploy de un SHA anterior →
  `TAG=<sha-anterior> docker compose -f docker-compose.prod.yml up -d`
- **Reimportar barrios** (manual): ya corre en cada `up`; para forzar:
  `docker compose -f docker-compose.prod.yml exec backend python manage.py importar_barrios`

## Notas
- El KML de barrios está versionado (`backend/data/`), así que viaja dentro de la
  imagen del backend; no hay que subirlo a la EC2.
- Esta arquitectura no tiene cero-downtime (un `up -d` reinicia el contenedor unos
  segundos). Para eso ya entrarías en ALB + ECS (camino "profesional").
```
