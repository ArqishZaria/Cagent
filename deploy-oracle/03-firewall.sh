#!/usr/bin/env bash
# ==============================================================================
# 03-firewall.sh
# Opens ports 80 and 443 on the INSTANCE's own iptables firewall.
#
# IMPORTANT — this is only half of Oracle Cloud's firewall. OCI also filters
# traffic at the VCN level via a Security List / Network Security Group,
# BEFORE it ever reaches your instance's iptables rules. If Telnyx webhooks
# still time out after running this script, go to:
#   OCI Console -> Networking -> Virtual Cloud Networks -> (your VCN)
#     -> Security Lists -> (default list) -> Add Ingress Rules:
#       - Source CIDR: 0.0.0.0/0, IP Protocol: TCP, Destination Port: 80
#       - Source CIDR: 0.0.0.0/0, IP Protocol: TCP, Destination Port: 443
# Both layers must allow the traffic — this script only handles the OS layer.
#
# Usage: sudo bash 03-firewall.sh
# ==============================================================================
set -euo pipefail

echo "==> Allowing inbound HTTP (80) and HTTPS (443)"
iptables -I INPUT -p tcp --dport 80 -j ACCEPT
iptables -I INPUT -p tcp --dport 443 -j ACCEPT

# Oracle's default Ubuntu images already allow SSH (22) — don't touch that rule.
# Explicitly re-affirm it here in case your base image differs:
iptables -I INPUT -p tcp --dport 22 -j ACCEPT

echo "==> Current INPUT chain:"
iptables -L INPUT -n --line-numbers

echo "==> Persisting rules across reboots"
apt-get install -y iptables-persistent netfilter-persistent
netfilter-persistent save

echo "==> Done. REMINDER: also open 80/443 in the OCI Console's VCN Security"
echo "    List (see comment at the top of this script) — iptables alone is"
echo "    not enough on Oracle Cloud."
