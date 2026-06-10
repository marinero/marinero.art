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
