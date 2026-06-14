#!/usr/bin/env bash
# Diagnose EC2 SSH connectivity from AWS side.
# Prereq: aws configure  (Access Key from IAM user marinero-deploy)
# Usage:  ./scripts/aws-check-ec2.sh [instance-ip-or-id]
set -euo pipefail

TARGET="${1:-13.49.72.22}"
REGION="${AWS_REGION:-eu-north-1}"

echo "==> AWS identity"
aws sts get-caller-identity --output table

echo ""
echo "==> Looking for instance with IP $TARGET in $REGION..."

INSTANCE_JSON=$(aws ec2 describe-instances \
  --region "$REGION" \
  --filters "Name=ip-address,Values=$TARGET" \
  --query 'Reservations[].Instances[]' \
  --output json 2>/dev/null || echo '[]')

if [ "$INSTANCE_JSON" = "[]" ] || [ "$INSTANCE_JSON" = "null" ] || [ -z "$INSTANCE_JSON" ]; then
  echo "No instance with public IP $TARGET. Trying Elastic IP..."
  INSTANCE_JSON=$(aws ec2 describe-instances \
    --region "$REGION" \
    --filters "Name=instance-state-name,Values=running,stopped,stopping,pending" \
    --query "Reservations[].Instances[?PublicIpAddress=='$TARGET' || contains(join(',', NetworkInterfaces[].Association.PublicIp), '$TARGET')]" \
    --output json)
fi

# Fallback: list all instances
if [ "$INSTANCE_JSON" = "[]" ] || [ "$INSTANCE_JSON" = "null" ]; then
  echo ""
  echo "==> All instances in $REGION:"
  aws ec2 describe-instances \
    --region "$REGION" \
    --query 'Reservations[].Instances[].[InstanceId,State.Name,PublicIpAddress,PrivateIpAddress,Tags[?Key==`Name`].Value|[0]]' \
    --output table
  echo ""
  echo "Pass instance ID: ./scripts/aws-check-ec2.sh i-xxxxxxxx"
  exit 1
fi

INSTANCE_ID=$(echo "$INSTANCE_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['InstanceId'] if isinstance(d,list) and d else d.get('InstanceId',''))" 2>/dev/null || true)

if [ -z "$INSTANCE_ID" ]; then
  INSTANCE_ID="$TARGET"
fi

echo ""
echo "==> Instance $INSTANCE_ID"
aws ec2 describe-instances \
  --region "$REGION" \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].{Id:InstanceId,State:State.Name,PublicIp:PublicIpAddress,PrivateIp:PrivateIpAddress,Subnet:SubnetId,Vpc:VpcId,SG:SecurityGroups[*].GroupId,Name:Tags[?Key==`Name`].Value|[0]}' \
  --output table 2>/dev/null || aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE_ID" --output json | head -80

SG_IDS=$(aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].SecurityGroups[*].GroupId' --output text)

echo ""
echo "==> Security Group inbound rules (SSH = port 22)"
for sg in $SG_IDS; do
  echo "--- $sg ---"
  aws ec2 describe-security-groups --region "$REGION" --group-ids "$sg" \
    --query 'SecurityGroups[0].{Name:GroupName,Inbound:IpPermissions}' --output json
done

echo ""
echo "==> Elastic IPs in $REGION"
aws ec2 describe-addresses --region "$REGION" \
  --query 'Addresses[].[PublicIp,InstanceId,AssociationId]' --output table

echo ""
echo "==> Your current public IP (compare with SSH rule Source)"
curl -s --max-time 5 ifconfig.me || true
echo ""
