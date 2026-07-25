#!/usr/bin/env bash
# Добавляет ваш текущий публичный IP в marinero-sg (SSH, eu-north-1).
# Запускайте с Mac перед ssh, когда провайдер сменил IP:
#   ./scripts/ssh-allow-my-ip.sh
#   ssh -i .../marinero-prod.pem ubuntu@13.48.222.198
set -euo pipefail

REGION="${AWS_REGION:-eu-north-1}"
SG_ID="${MARINERO_SG_ID:-sg-0204cc52a8ed0e29e}"
PORT=22

MY_IP="$(curl -sf --max-time 5 ifconfig.me || curl -sf --max-time 5 https://checkip.amazonaws.com)"
MY_IP="${MY_IP//$'\r'/}"
MY_IP="${MY_IP//$'\n'/}"

if [ -z "$MY_IP" ]; then
  echo "Could not detect public IP"
  exit 1
fi

CIDR="${MY_IP}/32"
echo "==> Allow SSH from $CIDR to $SG_ID ($REGION)"

if aws ec2 authorize-security-group-ingress \
  --region "$REGION" \
  --group-id "$SG_ID" \
  --protocol tcp \
  --port "$PORT" \
  --cidr "$CIDR" 2>/dev/null; then
  echo "    Rule added."
elif aws ec2 describe-security-groups --region "$REGION" --group-ids "$SG_ID" \
  --query "SecurityGroups[0].IpPermissions[?FromPort==\`22\`].IpRanges[?CidrIp==\`$CIDR\`]" \
  --output text | grep -q "$CIDR"; then
  echo "    Rule already exists."
else
  echo "    Failed to add rule (check aws configure / permissions)."
  exit 1
fi

echo ""
echo "Connect:"
echo "  ssh -i /path/to/marinero-prod.pem ubuntu@13.48.222.198"
