#!/usr/bin/env bash
# ==============================================================================
# 00-provision-vm.sh
# Run this on YOUR LOCAL MACHINE (not the server) — it uses the Azure CLI to
# create the resource group, VM, and NSG rules that replace Oracle Cloud's
# Console-based instance + Security List setup (guide.pdf Phase 13).
#
# Prereqs: az CLI installed and logged in (`az login`).
# Usage: bash 00-provision-vm.sh
# ==============================================================================
set -euo pipefail

RESOURCE_GROUP="voip-saas-rg"
LOCATION="polandcentral"             # pick the Azure region closest to your users
VM_NAME="voip-saas-prod"
VM_SIZE="Standard_B2ls_v2"         # 2 vCPU / 4GB — bump to B2ms/D2s_v5 if the scraper needs more RAM
ADMIN_USER="azureuser"
SSH_KEY_PATH="$HOME/.ssh/id_rsa.pub"  # generate with: ssh-keygen -t rsa -b 4096

echo "==> Creating resource group"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION"

echo "==> Creating VM (Ubuntu 24.04 LTS)"
az vm create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$VM_NAME" \
  --image "Canonical:ubuntu-24_04-lts:server:latest" \
  --size "$VM_SIZE" \
  --admin-username "$ADMIN_USER" \
  --ssh-key-values "$SSH_KEY_PATH" \
  --public-ip-sku Standard

echo "==> Opening ports 80 and 443 on the VM's Network Security Group"
# This is the Azure equivalent of Oracle's "VCN Security List -> Add Ingress
# Rules" step — port 22 is already open by default from --generate-ssh-keys.
az vm open-port --resource-group "$RESOURCE_GROUP" --name "$VM_NAME" --port 80 --priority 900
az vm open-port --resource-group "$RESOURCE_GROUP" --name "$VM_NAME" --port 443 --priority 901

echo "==> Fetching public IP"
PUBLIC_IP=$(az vm show -d --resource-group "$RESOURCE_GROUP" --name "$VM_NAME" --query publicIps -o tsv)
echo "==> Done. Public IP: $PUBLIC_IP"
echo "    SSH in with: ssh ${ADMIN_USER}@${PUBLIC_IP}"
echo "    Point your DNS A record at this IP (guide.pdf Phase 16 — otherwise unchanged)."
