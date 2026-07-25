# Деплой marinero.art на AWS EC2

Архитектура: **Nginx + Next.js + PostgreSQL** в Docker на EC2, файлы в **S3**.

## Локально (разработка)

```bash
cp .env.local.example .env.local   # заполнить секреты
docker compose up -d               # postgres + minio
pnpm dev                           # http://localhost:3000
```

## Prod (EC2)

| Компонент | Где |
|-----------|-----|
| Next.js, Nginx, PostgreSQL | Docker на EC2 |
| Фото, MP3 | S3 (`marinero-public`, `marinero-private`) |
| DNS | A-запись `marinero.art` → Elastic IP |
| SSL | Let's Encrypt (certbot) |
| Доступ к S3 | IAM Role `marinero-ec2-s3` на инстансе |

### 1. Подготовка AWS (один раз)

Уже должно быть настроено:

- S3 бакеты в `eu-north-1`
- EC2 `t3.small`, Ubuntu 24/26 LTS
- Security Group: 22 (ваш IP), 80/443 (0.0.0.0/0)
- Elastic IP привязан к инстансу
- IAM instance profile: `marinero-ec2-s3`
- DNS: `marinero.art` и `www.marinero.art` → Elastic IP

### SSH без постоянного добавления IP

Домашний IP меняется — в `marinero-sg` (регион **eu-north-1**) whitelist только для SSH.

**Вариант A — одна команда перед входом (рекомендуется сейчас):**

```bash
chmod +x scripts/ssh-allow-my-ip.sh
./scripts/ssh-allow-my-ip.sh
ssh -i AWS/marinero-prod.pem ubuntu@13.48.222.198
```

Скрипт добавляет текущий IP в `marinero-sg`. Старые IP можно иногда удалять в консоли вручную.

**Вариант B — AWS Session Manager (без порта 22 с интернета):**

1. IAM role `marinero-ec2-s3` → Attach policy `AmazonSSMManagedInstanceCore`
2. Подождать ~5 мин, проверить: EC2 → Instances → marinero-prod → Connect → Session Manager
3. С Mac: `aws ssm start-session --region eu-north-1 --target i-0b960c6bff0999bf6`
4. После проверки можно убрать правило SSH (22) из `marinero-sg` для 0.0.0.0/0 (если было)

**Вариант C — Tailscale на EC2:** VPN с постоянным адресом, SSH только внутри tailnet.

**Не рекомендуется:** открыть SSH для `0.0.0.0/0` — брутфорс 24/7.

### 2. Первичная настройка сервера

```bash
ssh -i marinero-prod.pem ubuntu@<ELASTIC_IP>

# Установить Docker
git clone <YOUR_REPO_URL> /opt/marinero
cd /opt/marinero
bash scripts/ec2-bootstrap.sh
# перелогиниться для группы docker

cd /opt/marinero
cp .env.production.example .env.production
nano .env.production   # секреты, POSTGRES_PASSWORD, NEXTAUTH_SECRET, Google OAuth
```

Google OAuth redirect URI для prod: `https://marinero.art/api/auth/callback/google`

### 3. Первый деплой

Скопируйте дамп БД на сервер (не в git):

```bash
scp -i marinero-prod.pem full_backup.sql ubuntu@<ELASTIC_IP>:/opt/marinero/
```

На сервере:

```bash
cd /opt/marinero
chmod +x scripts/*.sh
./scripts/deploy.sh --first-run
```

Импорт файлов в S3 (с Mac, если архив ещё не загружен):

```bash
# без S3_ENDPOINT — скрипт использует AWS S3 и IAM role / ключи
pnpm storage:import -- --source ./data/blob-archive
```

### 4. SSL (Let's Encrypt)

После того как DNS указывает на EC2:

```bash
CERTBOT_EMAIL=you@example.com ./scripts/ssl-init.sh
# раскомментировать HTTPS-блоки в docker/nginx/default.conf
docker compose -f docker-compose.prod.yml restart nginx
docker compose -f docker-compose.prod.yml up -d certbot
```

### 5. Обновление после изменений в git

```bash
cd /opt/marinero
git pull
./scripts/deploy.sh
```

## Troubleshooting

### Фото работают, аудио / загрузки не работают

**S3 не «сломался»** — файлы на месте. Контейнер `nextjs` потерял ключи доступа к приватному бакету `marinero-private`.

Симптом: фото из галереи открываются, `/api/audio/stream` зависает, загрузка аудио/мультитреков падает.

Причина: `docker compose restart` **не** обновляет переменные из `.env.production`. Ключи есть в файле, но не в контейнере.

**Быстрый фикс на сервере:**

```bash
cd /home/ubuntu/marinero
./scripts/fix-prod-s3.sh
```

Или вручную:

```bash
cd /home/ubuntu/marinero
set -a && source .env.production && set +a
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --force-recreate nextjs
```

**Не используйте** `docker compose restart nextjs` после правки `.env.production`.

**Проверка:**

```bash
docker exec marinero_nextjs sh -c 'echo "S3 key set: ${S3_ACCESS_KEY_ID:+yes}"'
curl -sI "http://localhost/api/audio/stream?key=marinero%2Faudio%2F1778946982781-z593f.mp3" | head -1
```

**SSH не пускает?** Security group `marinero-sg` в регионе **eu-north-1 (Stockholm)** — добавьте свой IP в правило SSH (22). Текущий IP: `curl ifconfig.me`.

**Альтернатива** — hop limit для IMDS (без ключей в env): (чтобы Docker видел IAM role):

```bash
aws ec2 modify-instance-metadata-options --region eu-north-1 \
  --instance-id i-0b960c6bff0999bf6 \
  --http-put-response-hop-limit 3 \
  --http-endpoint enabled --http-tokens required
docker compose -f docker-compose.prod.yml restart nextjs
```

Проверка с Mac:

```bash
# должно вернуть HTTP 200 за < 2 сек (не зависать)
curl -sI "https://marinero.art/api/audio/stream?key=marinero%2Faudio%2F1778946982781-z593f.mp3"
```

Диагностика на сервере:

```bash
ENV_FILE=.env.production pnpm storage:check-audio -- --limit 5
docker compose -f docker-compose.prod.yml logs nextjs --tail 50
```

## Git

```bash
# локально
git init
git add .
git commit -m "Initial commit"
git remote add origin <YOUR_REPO_URL>
git push -u origin main
```

**Не коммитить:** `.env.local`, `.env.production`, `*.pem`, `full_backup.sql`.

## Переменные prod (.env.production)

См. `.env.production.example`. На EC2 с IAM role **не задавайте** `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` — SDK возьмёт credentials с инстанса.
