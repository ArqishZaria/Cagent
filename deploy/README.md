# Azure Deployment — VoIP SaaS (Cagent)

Replaces the old Oracle Cloud deploy. Run in this order.

**Canonical names used by every script and systemd unit (don't mix them):**

| Thing | Value |
|---|---|
| Code directory on the VM | `/opt/cagent` |
| App Linux user | `cagentapp` |
| Logs | `/var/log/voip-saas/` |
| Azure resource group | `voip-saas-rg` |
| VM name | `voip-saas-prod` |
| Postgres server / database / admin user | `cagent` / `cagent` / `cagent_admin` |

## 1. Provision infrastructure (from your LOCAL machine, needs `az login`)
```
export PG_ADMIN_PASSWORD='a-long-random-password-you-generate-yourself'
bash 00-provision-vm.sh
bash 00b-provision-postgres.sh
```
Run them in this order — 00b looks up the VM's IP and opens the database
firewall to **that IP only**. The password is read from your environment,
never stored in a file.

## 2. Get your code onto the VM
```
ssh azureuser@<public-ip>
sudo mkdir -p /opt/cagent && sudo chown azureuser:azureuser /opt/cagent
git clone <your-repo> /opt/cagent
```
(Step 3 hands ownership of `/opt/cagent` to the `cagentapp` user. For later
updates use `sudo -u cagentapp git -C /opt/cagent pull`.)

## 3. System prerequisites (on the VM)
```
cd /opt/cagent/deploy
sudo bash 01-system-prerequisites.sh
```
Installs packages, creates the `cagentapp` user, the log directory, the
virtualenv and dependencies. No Postgres server is installed.

## 3b. Create the database app role (on the VM)
Use the `psql` commands printed at the end of `00b-provision-postgres.sh`
(connect as `cagent_admin`, create `cagent_app`, make it the DB owner).
It must be run **from the VM** — the VM is the only IP the database allows.

## 4. DNS
Point an A record at the VM's public IP, wait for propagation
(`dig +short api.yourdomain.com` should return that IP).

## 5. Nginx + SSL
```
cd /opt/cagent/deploy
sudo DOMAIN=api.yourdomain.com bash 02-nginx-ssl.sh
```

## 6. Configure `.env`
```
cd /opt/cagent/backend
sudo -u cagentapp cp .env.example .env
sudo -u cagentapp nano .env
sudo chmod 600 /opt/cagent/backend/.env
```
Set `DEBUG=False`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, a real
`SECRET_KEY`, and `DATABASE_URL` (the `cagent_app` URL from step 3b).

## 7. Migrate + superuser
```
cd /opt/cagent/backend
sudo -u cagentapp /opt/cagent/venv/bin/python manage.py migrate
sudo -u cagentapp /opt/cagent/venv/bin/python manage.py collectstatic --noinput
sudo -u cagentapp /opt/cagent/venv/bin/python manage.py createsuperuser
```

## 8. systemd services
```
cd /opt/cagent/deploy
sudo cp systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gunicorn celery-worker celery-beat
sudo systemctl status gunicorn celery-worker celery-beat
```

## 9. Database backups (supplementary — Azure also auto-backs-up)
```
cd /opt/cagent/deploy
sudo bash install-backup-cron.sh
```
The script reads host/db/user from `backup-db.sh` (edit `DB_HOST` there
first if your server name differs), asks for the DB password once, and runs
one test backup immediately so you know authentication works.

## 10. Point Telnyx at your domain
Voice/SMS webhook URLs: `https://<your-domain>/api/telephony/webhooks/voice/`
and `.../sms/`.

## 11. Deploy the frontend
Vercel/Netlify, or a same-VM Nginx block.

## Logs
- Gunicorn: `/var/log/voip-saas/gunicorn-{access,error}.log`
- Celery worker: `/var/log/voip-saas/celery-worker.log`
- Celery beat: `/var/log/voip-saas/celery-beat.log`
- DB backups: `/var/log/voip-saas/db-backup.log`
- Nginx: `/var/log/nginx/{access,error}.log`

## Optional: Azure Cache for Redis instead of self-hosted
```
az redis create --resource-group voip-saas-rg --name voip-saas-cache \
  --location polandcentral --sku Basic --vm-size c0
```
Then set `REDIS_URL=rediss://:<key>@voip-saas-cache.redis.cache.windows.net:6380/0`
in `.env` (get the key with `az redis list-keys`), and skip enabling
`redis-server` in step 3. No code changes needed either way.