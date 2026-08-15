# Changes to guide.pdf for Azure + Azure Database for PostgreSQL

Your guide's phases 1–12 (local setup and QA) are **100% unchanged** — none
of that touches Oracle or Azure. Everything below is phases 13 onward, plus
one fix that affects Phase 3.

---

### Phase 3 — Local backend setup
`pip install -r requirements.txt` may fail to resolve `Django>=5.0,<5.1` on
newer Python (3.12/3.13) because Django 5.0 is past end-of-life (final
release was 5.0.14). **Use the `requirements.txt` in this package** — it
pins `Django>=5.2,<5.3` (the current LTS) instead. No other line changed.

### Phase 1 — Accounts and things to gather
Replace "Oracle Cloud account" with an **Azure account** (portal.azure.com)
and the **Azure CLI** (`az`) installed locally, logged in via `az login`.
Everything else in that table (Telnyx, Google AI Studio, domain, SMTP, bank
details, GitHub repo) is unchanged.

### Phase 4 — Local database and Redis setup
No change — this phase is about your *local dev machine*, not production.
Keep using local/Docker Postgres and Redis for local QA regardless of where
production lives.

### Phase 5 — Backend `.env`
Only `DATABASE_URL`'s *production* value changes (local dev value stays the
same). See `.env.example` in this package. `REDIS_URL` also changes only if
you choose Azure Cache for Redis over self-hosted — optional, see README.

### Phases 6–12 — unchanged
Migrations, running locally, frontend setup, Telnyx setup, local QA script,
troubleshooting table, and the pre-production hardening checklist all apply
exactly as written.

### Phase 13 — Provisioning the server
Replace the entire "OCI Console → Compute → Instances" walkthrough with
`00-provision-vm.sh` in this package (Azure CLI). Key differences:
- No "Always Free" ARM shape decision — pick a normal Azure VM size
  (`Standard_B2s` is a reasonable default; the script uses it).
- SSH key handling is the same idea (generate or supply a public key) but
  done via `--ssh-key-values` instead of the Console's key-pair step.
- "Assign a public IPv4 address" → `--public-ip-sku Standard` flag.

### Phase 14 — Getting your code onto the server
Unchanged — git clone or scp both work identically on an Azure VM.

### Phase 15 — Running the deployment scripts
| Old step (Oracle) | New step (Azure) |
|---|---|
| 15.1 `01-system-prerequisites.sh` (installs local Postgres) | `01-system-prerequisites.sh` in this package — **no Postgres install**. Run `00b-provision-postgres.sh` from your local machine instead (creates Azure Database for PostgreSQL Flexible Server + the app DB + role). |
| 15.2 `02-idle-fix.sh` | **Delete — do not run.** Azure does not reclaim idle VMs; there is no equivalent step. |
| 15.3 `03-firewall.sh` + manual OCI VCN Security List step | Already done by `00-provision-vm.sh` (`az vm open-port`). If you provision the VM manually instead, open ports via `az network nsg rule create` on the VM's NSG — no OS-level iptables step needed on Azure since the NSG already filters at the network edge, though keeping host-level `ufw`/iptables rules is still fine as defense-in-depth. |
| 15.4 DNS | Unchanged — point your A record at the Azure VM's public IP instead of the Oracle IP. |
| 15.5 `04-nginx-ssl.sh` | Renamed `02-nginx-ssl.sh` in this package, logic identical. |
| 15.6 Configure `.env` | Use `DATABASE_URL` from `00b-provision-postgres.sh`'s output. Everything else unchanged. |
| 15.7 Migrate/collectstatic/superuser | Unchanged. |
| 15.8 systemd services | Unchanged commands — but use the `systemd/*.service` files in this package (dropped the `postgresql.service`/`Wants=postgresql.service` lines since Postgres is no longer a local service). |
| 15.9 `install-backup-cron.sh` | Use the version in this package — dumps over the network from the Azure Postgres FQDN with `sslmode=require`, instead of `localhost`. Treat it as a supplementary backup: Azure Database for PostgreSQL already does automated backups with point-in-time restore (7–35 day retention, configurable in the Portal or via `az postgres flexible-server parameter set`). |

### Phase 16 — DNS
Unchanged mechanically — just resolves to your Azure VM's IP instead of an
Oracle one.

### Phase 17 — systemd services reference commands
Unchanged.

### Phase 18 — Pointing Telnyx at your live domain
Unchanged.

### Phase 19 — Deploying the frontend
Unchanged.

### Phase 20 — Production QA
Unchanged — same checklist, just run against your Azure-hosted domain.

### Phase 21 — Going live checklist
Same items, with one addition: confirm Azure Database for PostgreSQL's
firewall rule only allows your VM's IP (tighten it per the note at the
bottom of `00b-provision-postgres.sh` — it starts wide-open for setup
convenience and should not stay that way).

### Phase 22 — Day-2 operations
- "SSL renewal" — unchanged, Certbot's timer works the same anywhere.
- "Backups" — supplement the weekly local-backup check with a look at
  Azure Portal → your Postgres server → Backup and restore, to confirm
  Azure's own automated backups are healthy too.
- Drop the row about the idle-fix cron log entirely — it no longer exists.

### Phase 23 — Troubleshooting cheat sheet
Add a row: **"Django install fails / `Django>=5.0,<5.1` version error"** →
you're hitting Django 5.0's end-of-life; use the fixed `requirements.txt`
pinning `Django>=5.2,<5.3`.

Drop the row **"Instance got reclaimed by Oracle"** — not applicable on
Azure.

### Phase 24 — Ongoing maintenance calendar
Drop "idle-fix runs once a day" from the Daily row. Everything else
(backups, log review, restore drills, `certbot renew --dry-run`, dependency
updates) applies the same way.

---

## Summary of files in this package
```
requirements.txt              — Django>=5.2,<5.3 fix (replaces backend/requirements.txt)
.env.example                  — Azure DATABASE_URL / optional REDIS_URL (replaces backend/.env.example)
00-provision-vm.sh             — run locally: creates the Azure VM + opens 80/443
00b-provision-postgres.sh      — run locally: creates Azure DB for PostgreSQL + app DB/role
01-system-prerequisites.sh     — run on VM: no local Postgres, no idle-fix, no ARM assumption
02-nginx-ssl.sh                — run on VM: same as old 04-nginx-ssl.sh, comments updated
backup-db.sh                   — run on VM (via cron): dumps from remote Azure Postgres
install-backup-cron.sh         — run on VM: sets up .pgpass for the remote host + cron
systemd/*.service              — same 3 units, dropped local postgresql.service dependency
README.md                      — ordered walkthrough tying it all together
```

Nothing in `backend/config/settings.py`, any Django app, or the frontend
needed to change — the app was already 12-factor (env-var driven), which is
exactly why this migration is infra-only.
