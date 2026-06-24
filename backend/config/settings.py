"""
Configuración de Django para el proyecto SpotWise.
Las variables sensibles se leen del entorno (.env) mediante django-environ.
"""
from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env()
# En local lee el .env del directorio raíz del repo; en Docker las variables
# llegan por env_file (no falla si el archivo no existe).
environ.Env.read_env(str(BASE_DIR.parent / ".env"))

# ---------------------------------------------------------------------------
# Núcleo
# ---------------------------------------------------------------------------
SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-insecure-key")
DEBUG = env.bool("DJANGO_DEBUG", default=True)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.gis",
    # Terceros
    "rest_framework",
    "corsheaders",
    # Apps locales
    "apps.users",
    "apps.catalog",
    "apps.places",
    "apps.analysis",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    # Sirve los estáticos del admin/DRF en producción (gunicorn) sin un nginx aparte.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ---------------------------------------------------------------------------
# Base de datos (PostgreSQL + PostGIS)
# ---------------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": env("POSTGRES_DB", default="spotwise"),
        "USER": env("POSTGRES_USER", default="spotwise"),
        "PASSWORD": env("POSTGRES_PASSWORD", default="spotwise"),
        "HOST": env("POSTGRES_HOST", default="localhost"),
        "PORT": env("POSTGRES_PORT", default="5432"),
        # SSL: "prefer" en local (cae a sin cifrar) y "require" en RDS (lo exige).
        "OPTIONS": {"sslmode": env("POSTGRES_SSLMODE", default="prefer")},
    }
}

# ---------------------------------------------------------------------------
# Autenticación y contraseñas
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "users.Usuario"

# Política de contraseñas del prototipo (mín. 8, al menos 1 mayúscula y 1 minúscula).
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "apps.users.validators.UpperLowerCaseValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# Internacionalización
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "es-ar"
TIME_ZONE = "America/Argentina/Cordoba"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Archivos estáticos
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# WhiteNoise comprime los estáticos (sin manifest: no rompe en dev ni en tests).
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Seguridad en producción (DEBUG=False detrás de un proxy que termina TLS)
# ---------------------------------------------------------------------------
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])
if not DEBUG:
    # nginx/ALB delante reenvía el esquema original en este header.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=False)
    SESSION_COOKIE_SECURE = env.bool("DJANGO_COOKIE_SECURE", default=False)
    CSRF_COOKIE_SECURE = env.bool("DJANGO_COOKIE_SECURE", default=False)

# ---------------------------------------------------------------------------
# Django REST Framework + JWT
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

# ---------------------------------------------------------------------------
# CORS (frontend React en desarrollo)
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:5173", "http://127.0.0.1:5173"],
)

# ---------------------------------------------------------------------------
# Integraciones externas
# ---------------------------------------------------------------------------
GOOGLE_PLACES_API_KEY = env("GOOGLE_PLACES_API_KEY", default="")

# Radio fijo de análisis (metros) — definido por el sistema (HU-004).
ANALISIS_RADIO_METROS = env.int("ANALISIS_RADIO_METROS", default=500)

# Área de cobertura del prototipo: bounding box de la ciudad de Córdoba
# (lat_min, lat_max, lng_min, lng_max). Usado para validar ubicaciones (HU-003).
CORDOBA_BBOX = (-31.55, -31.30, -64.36, -64.04)
