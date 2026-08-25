"""
Django settings for the B2B VoIP SaaS & CRM Platform.

Stack: Django + Django REST Framework + PostgreSQL + Celery/Redis + Telnyx + Gemini.
"""

import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
import telnyx
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env (local dev). In production these
# should be injected directly by the hosting platform / systemd / Docker.
load_dotenv(BASE_DIR / ".env")


def env_bool(key: str, default: bool = False) -> bool:
    return os.environ.get(key, str(default)).strip().lower() in ("1", "true", "yes", "on")


def env_list(key: str, default: str = "") -> list:
    raw = os.environ.get(key, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# ------------------------------------------------------------------------------------
# Core / Security
# ------------------------------------------------------------------------------------

SECRET_KEY = os.environ.get("SECRET_KEY", "unsafe-dev-key-change-me")
DEBUG = env_bool("DEBUG", False)

ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")

AUTH_USER_MODEL = "core.CustomUser"

# ------------------------------------------------------------------------------------
# Applications
# ------------------------------------------------------------------------------------

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_celery_beat",
    # Local apps
    "core",  # Tenant, CustomUser, Lead, Interaction, PhoneNumber, Invoice, SupportMessage, ScrapeTask
    "users",  # Employee management (ADMIN creates AGENT accounts)
    "telephony",  # Telnyx WebRTC, voice, and SMS webhooks
    "billing",  # Monthly invoicing Celery task
    "scraper",  # $0 Agentic Lead Generation
    "crm",  # Lead + Interaction API (list/detail/create for the CRM UI)
    "support",  # Boss-only support chat
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",  # must sit high, before CommonMiddleware
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "core.middleware.IsSubscriptionActive",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ------------------------------------------------------------------------------------
# Database (Postgres via DATABASE_URL)
# ------------------------------------------------------------------------------------

DATABASES = {
    "default": dj_database_url.config(
        env="DATABASE_URL",
        default="postgres://postgres:postgres@localhost:5432/voip_saas",
        conn_max_age=600,
        ssl_require=not DEBUG,
    )
}

# ------------------------------------------------------------------------------------
# Password validation
# ------------------------------------------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ------------------------------------------------------------------------------------
# Internationalization
# ------------------------------------------------------------------------------------

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# ------------------------------------------------------------------------------------
# Static files
# ------------------------------------------------------------------------------------

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ------------------------------------------------------------------------------------
# Django REST Framework
# ------------------------------------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        # Used by the Agentic Lead Generation scrape-search endpoint (Part 2F).
        "scrape_search": "5/hour",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "UPDATE_LAST_LOGIN": True,
}

# ------------------------------------------------------------------------------------
# CORS (frontend is hosted separately, e.g. on Vercel)
# ------------------------------------------------------------------------------------

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)
CORS_ALLOW_CREDENTIALS = True

# ------------------------------------------------------------------------------------
# Celery / Redis
# ------------------------------------------------------------------------------------

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

# django-celery-beat's DatabaseScheduler syncs entries defined here into the
# DB on startup, so this is the single source of truth for periodic tasks —
# no separate admin step needed to create them.
CELERY_BEAT_SCHEDULE = {
    "generate-monthly-invoices": {
        "task": "billing.tasks.generate_monthly_invoices",
        "schedule": timedelta(days=30),
    },
}

# Shared cache — used by django-ratelimit (scrape-search throttling) and by
# telephony.services' WebRTC credential cache. Redis-backed so counts/values
# are consistent across every worker process, not just per-process memory.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    }
}
RATELIMIT_USE_CACHE = "default"

# ------------------------------------------------------------------------------------
# Third-party API keys (Telnyx / Gemini) — consumed by later-phase apps
# ------------------------------------------------------------------------------------

TELNYX_API_KEY = os.environ.get("TELNYX_API_KEY", "")
TELNYX_PUBLIC_KEY = os.environ.get("TELNYX_PUBLIC_KEY", "")
TELNYX_WEBHOOK_SECRET = os.environ.get("TELNYX_WEBHOOK_SECRET", "")
TELNYX_CONNECTION_ID = os.environ.get("TELNYX_CONNECTION_ID", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
TELNYX_MESSAGING_PROFILE_ID = os.environ.get("TELNYX_MESSAGING_PROFILE_ID", "")

# The telnyx SDK reads its key off this module-level attribute rather than
# taking it per-call, so every telephony view/service can just `import telnyx`
# and call telnyx.Message.create(...) / telnyx.Call() etc. directly.
telnyx.api_key = TELNYX_API_KEY

# ------------------------------------------------------------------------------------
# Email (used by the monthly invoicing task)
# ------------------------------------------------------------------------------------

EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = os.environ.get("EMAIL_HOST", "")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "billing@yourdomain.com")

# ------------------------------------------------------------------------------------
# Manual billing — monthly amount + Bank AL Habib transfer details shown on
# every invoice email / SupportMessage. All plaintext, no gateway involved
# (this is Version 1's manual billing_mode; see Part 7 roadmap for gateways).
# ------------------------------------------------------------------------------------

MONTHLY_SUBSCRIPTION_AMOUNT = os.environ.get("MONTHLY_SUBSCRIPTION_AMOUNT", "5000.00")
BANK_NAME = os.environ.get("BANK_NAME", "Bank AL Habib")
BANK_ACCOUNT_TITLE = os.environ.get("BANK_ACCOUNT_TITLE", "Your Company Name")
BANK_ACCOUNT_NUMBER = os.environ.get("BANK_ACCOUNT_NUMBER", "")
BANK_IBAN = os.environ.get("BANK_IBAN", "")

# ------------------------------------------------------------------------------------
# Production security hardening (only enforced when DEBUG=False)
# ------------------------------------------------------------------------------------

if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_BROWSER_XSS_FILTER = True
    X_FRAME_OPTIONS = "DENY"
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    CSRF_TRUSTED_ORIGINS = [
        origin if origin.startswith("http") else f"https://{origin}"
        for origin in CORS_ALLOWED_ORIGINS
    ]
