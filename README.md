# slovek-pixel-ru

Монорепозиторий: публичный дашборд статуса TeamSpeak (AdonisJS) + TS3 + nginx/HTTPS.

## Запуск с нуля на новом VPS

### 1. DNS и порты

- `A`-запись **`ts.slovekpixel.ru` → IP сервера** (допустим другой домен — тогда поменяйте его в `.env` и в `deploy/nginx/conf.d/`)
- Открыть: `80/tcp`, `443/tcp`, `9987/udp`, `30033/tcp`
- Снаружи **не** открывать: `10011`, `3333`

### 2. Clone и `.env`

```sh
git clone <repo-url>
cd slovek-pixel-ru
cp .env.example .env
```

В **корневом** `.env` укажите только:

| Переменная | Что поставить |
|------------|----------------|
| `APP_KEY` | случайная строка ≥32 символов |
| `CERTBOT_EMAIL` | email для Let's Encrypt |
| `TS3_QUERY_USER` | логин ServerQuery (обычно `serveradmin`) |
| `TS3_PASSWORD` | пароль ServerQuery **и** входа в клиент TeamSpeak |
| `DOMAIN` / `APP_URL` | оставьте `ts.slovekpixel.ru` / `https://ts.slovekpixel.ru`, если домен тот же |

Остальное в `.env` нужно только для локальной разработки; в Docker его перекрывает `docker-compose.yml`.

### 3. Поднять стек

```sh
docker compose up --build -d
```

Поднятся: `teamspeak-web`, `teamspeak`, `nginx`.  
Сайт уже отвечает; пока нет Let's Encrypt, nginx отдаёт временный self-signed сертификат.

### 4. HTTPS (когда DNS уже смотрит на этот сервер)

```sh
chmod +x deploy/certbot/*.sh
./deploy/certbot/init-certs.sh
```

Продление позже: `./deploy/certbot/renew.sh` (cron раз в неделю).

### 5. Проверка

| Что | Куда |
|-----|------|
| Дашборд | `https://ts.slovekpixel.ru` |
| TeamSpeak | `ts.slovekpixel.ru:9987`, пароль из `TS3_PASSWORD` в `.env` |
| Privilege key (первый админ) | `docker compose logs teamspeak \| grep -i privilege` |

---

## Локальная разработка

```sh
cp .env.example .env   # если ещё нет
pnpm install
docker compose up teamspeak -d
pnpm dev --filter=ts3-server
```

Сайт: `http://127.0.0.1:3333` (в `.env` уже `TS3_QUERY_HOST=127.0.0.1`).

## Структура

```
apps/ts3-server/     дашборд статуса TS
deploy/nginx/        reverse proxy
deploy/certbot/      Let's Encrypt
docker-compose.yml
.env                 единственный env (корень репо)
```
