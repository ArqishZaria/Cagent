# B2B VoIP SaaS & CRM Platform

Complete project — Django/DRF backend, React/Vite/Tailwind frontend, and
Oracle Cloud deployment scripts.

```
backend/    Django REST API — Postgres, Celery/Redis, Telnyx, Gemini
frontend/   React + Vite + Tailwind — CRM, dialer, prospector, billing UI
deploy/     Oracle Cloud "Always Free" ARM deployment scripts + systemd units
```

See the chat conversation this project came from for the full day-by-day
build log, or `deploy/README.md` for deployment steps, or ask your assistant
for the complete Day 1–6 manual setup checklist.

## Quick local dev start

```
# Backend
cd backend
pip install -r requirements.txt
playwright install --with-deps chromium
cp .env.example .env   # fill in real values
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

# In separate terminals:
celery -A config worker -l info
celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler

# Frontend
cd frontend
npm install
cp .env.example .env
npm run dev
```
