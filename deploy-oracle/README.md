# Oracle Cloud "Always Free" ARM Deployment

Run these in order on a fresh Ubuntu 22.04/24.04 Ampere A1 instance.

## 1. Get your code onto the instance
```
sudo mkdir -p /opt/voip-saas
sudo chown $USER:$USER /opt/voip-saas
git clone <your-repo> /opt/voip-saas   # or scp backend/ and frontend/ up
```

## 2. System prerequisites
```
sudo bash 01-system-prerequisites.sh
```
Edit the Postgres password in the script (or the DB manually) before running —
it uses a placeholder `CHANGE_ME_BEFORE_RUNNING`.

## 3. Idle-prevention cron
```
sudo bash 02-idle-fix.sh
```

## 4. Firewall
```
sudo bash 03-firewall.sh
```
**Then go to the OCI Console and open 80/443 on your VCN's Security List too**
— the script prints a reminder, but this step happens in the browser, not
on the instance.

## 5. Nginx + SSL
```
sudo DOMAIN=api.yourdomain.com bash 04-nginx-ssl.sh
```

## 6. Configure `/opt/voip-saas/backend/.env`
Copy `.env.example` → `.env` and fill in every value (see the master manual
setup checklist for the full list). Then:
```
cd /opt/voip-saas/backend
source /opt/voip-saas/venv/bin/activate
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

## 7. Install and start the systemd services
```
sudo cp systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gunicorn celery-worker celery-beat
sudo systemctl status gunicorn celery-worker celery-beat
```

## 8. Database backups
```
sudo bash install-backup-cron.sh
```
Do the restore drill the script prints at the end — don't wait for an
emergency to find out `pg_dump`/`.pgpass` was misconfigured.

## 9. Point Telnyx at your domain
In the Telnyx portal, set:
- Voice webhook: `https://api.yourdomain.com/api/telephony/webhooks/voice/`
- SMS webhook: `https://api.yourdomain.com/api/telephony/webhooks/sms/`

## 10. Deploy the frontend
Build it (`npm run build` inside `frontend/`) and serve the `dist/` folder —
either via Vercel/Netlify (matching `CORS_ALLOWED_ORIGINS` in the backend
`.env`), or add another Nginx `location` block on this same instance.

## Logs
- Gunicorn: `/var/log/voip-saas/gunicorn-{access,error}.log`
- Celery worker: `/var/log/voip-saas/celery-worker.log`
- Celery beat: `/var/log/voip-saas/celery-beat.log`
- DB backups: `/var/log/voip-saas/db-backup.log`
- Idle-fix cron: `/var/log/cpu-spike.log`
