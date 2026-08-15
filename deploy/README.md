# Azure Deployment — VoIP SaaS

Replaces `deploy/` (Oracle Cloud version). Run in this order.

## 1. Provision infrastructure (from your LOCAL machine, needs `az login`)
```
bash 00-provision-vm.sh
bash 00b-provision-postgres.sh
```
Edit the variables at the top of each script first (resource group name,
region, passwords — **do not leave `CHANGE_ME_STRONG_PASSWORD` in
00b-provision-postgres.sh**).

## 2. Get your code onto the VM
```
ssh azureuser@<public-ip>
sudo mkdir -p /opt/voip-saas && sudo chown azureuser:azureuser /opt/voip-saas
git clone <your-repo> /opt/voip-saas
```

## 3. System prerequisites (on the VM)
```
sudo bash 01-system-prerequisites.sh
```
No Postgres install, no `stress` package, no idle-fix cron — see
`AZURE_MIGRATION_CHANGES.md` for why.

## 4. DNS
Point an A record at the VM's public IP, wait for propagation
(`dig +short api.yourdomain.com` should return that IP).

## 5. Nginx + SSL
```
sudo DOMAIN=api.yourdomain.com bash 02-nginx-ssl.sh
```

## 6. Configure `.env`
```
cd /opt/voip-saas/backend
cp ../../.env.example .env   # use the Azure .env.example from this folder
nano .env
```
Fill in `DATABASE_URL` with the connection string `00b-provision-postgres.sh`
printed at the end. Everything else is unchanged from your existing Oracle
`.env` values.

## 7. Migrate + superuser
```
source /opt/voip-saas/venv/bin/activate
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

## 8. systemd services
```
sudo cp systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gunicorn celery-worker celery-beat
sudo systemctl status gunicorn celery-worker celery-beat
```

## 9. Database backups (supplementary — Azure already auto-backs-up)
```
sudo bash install-backup-cron.sh
```
Edit `DB_HOST` in `backup-db.sh` and `install-backup-cron.sh` to your
Postgres server's FQDN first.

## 10. Point Telnyx at your domain
Same as before — voice/SMS webhook URLs unchanged, just your new domain.

## 11. Deploy the frontend
Unchanged from the Oracle guide (Vercel/Netlify or same-VM Nginx block).

## Logs (unchanged paths)
- Gunicorn: `/var/log/voip-saas/gunicorn-{access,error}.log`
- Celery worker: `/var/log/voip-saas/celery-worker.log`
- Celery beat: `/var/log/voip-saas/celery-beat.log`
- DB backups: `/var/log/voip-saas/db-backup.log`
- Nginx: `/var/log/nginx/{access,error}.log`

## Optional: Azure Cache for Redis instead of self-hosted
```
az redis create --resource-group voip-saas-rg --name voip-saas-cache \
  --location eastus --sku Basic --vm-size c0
```
Then set `REDIS_URL=rediss://:<key>@voip-saas-cache.redis.cache.windows.net:6380/0`
in `.env` (get the key with `az redis list-keys`), and skip installing/
enabling `redis-server` in step 3. No code changes needed either way.
