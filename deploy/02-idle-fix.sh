#!/usr/bin/env bash
# ==============================================================================
# 02-idle-fix.sh
# Oracle Cloud reclaims "Always Free" instances that sit idle (low CPU, low
# network) for 7 consecutive days. This installs a small daily cron job that
# spikes CPU to ~25% for a few minutes — enough to keep the instance counted
# as "active" without meaningfully affecting the app.
#
# Usage: sudo bash 02-idle-fix.sh
# ==============================================================================
set -euo pipefail

SCRIPT_PATH="/opt/voip-saas/scripts/cpu-spike.sh"
mkdir -p "$(dirname "$SCRIPT_PATH")"

cat > "$SCRIPT_PATH" << 'EOF'
#!/usr/bin/env bash
# Spikes CPU on ~1 of 4 OCPUs (~25% of an Ampere A1 4-OCPU shape) for 5
# minutes. Adjust --cpu to match your instance's core count / 4 if you sized
# the free-tier shape differently.
LOG="/var/log/cpu-spike.log"
echo "$(date -Iseconds) — starting daily CPU spike (5 min)" >> "$LOG"
stress --cpu 1 --timeout 300s >> "$LOG" 2>&1
echo "$(date -Iseconds) — CPU spike complete" >> "$LOG"
EOF

chmod +x "$SCRIPT_PATH"

# Install the cron job (idempotent — replaces any prior entry for this script).
CRON_LINE="17 9 * * * root $SCRIPT_PATH"
CRON_FILE="/etc/cron.d/voip-saas-idle-fix"
echo "$CRON_LINE" > "$CRON_FILE"
chmod 644 "$CRON_FILE"

echo "==> Installed daily idle-prevention cron job: $CRON_FILE"
echo "    Runs at 09:17 UTC daily. Change the schedule by editing that file."
echo "    Logs: /var/log/cpu-spike.log"
