# slovek-pixel-ru

Монорепозиторий сервисов на [Turborepo](https://turborepo.dev) и [pnpm](https://pnpm.io).

## Стек

- Node.js `>=24`, pnpm `11.25.0`, Turborepo `2.10`
- AdonisJS `7` (Edge) в приложениях
- Docker Compose: сервисы + общий **nginx** (HTTPS) + certbot + TeamSpeak 3

## Структура

```
apps/
  ts3-server/         сайт статуса TS (AdonisJS)
deploy/
  nginx/              общий reverse proxy проекта
  certbot/            Let's Encrypt init / renew
packages/
  ...
docker-compose.yml
```

## Быстрый старт после клона (production / VPS)

Инструкция есть здесь. Кратко: **DNS + `.env` + `docker compose up`**, затем один раз выпустить сертификат.

### 1. DNS и firewall (до или сразу после clone)

- `A` (и при наличии `AAAA`) **`ts.slovekpixel.ru` → IP VPS**
- Открыть: `80/tcp`, `443/tcp`, `9987/udp`, `30033/tcp`
- Не открывать снаружи: `10011`, `3333`
- Если на сервере уже крутится старый TeamSpeak из архива — остановите его (конфликт `9987/udp`)

### 2. Env

```sh
git clone <repo-url> && cd slovek-pixel-ru
cp .env.example .env
```

Обязательно заполните в `.env`:

| Переменная | Пример |
|------------|--------|
| `APP_KEY` | `cd apps/ts3-server && node ace generate:key` (нужен локальный Node) или любая длинная случайная строка ≥32 символов |
| `CERTBOT_EMAIL` | ваш email для Let's Encrypt |
| `TS3_SERVERADMIN_PASSWORD` | пароль ServerQuery |
| `TS3_QUERY_PASSWORD` | **тот же**, что `TS3_SERVERADMIN_PASSWORD` |
| `DOMAIN` / `APP_URL` | по умолчанию `ts.slovekpixel.ru` / `https://ts.slovekpixel.ru` |

Остальное из `.env.example` можно оставить.

### 3. Поднять стек

```sh
docker compose up --build -d
```

Поднятся: `web`, `teamspeak`, общий контейнер **`nginx`**.  
Пока нет Let's Encrypt, nginx использует временный self-signed сертификат (браузер покажет предупреждение).

### 4. Настоящий HTTPS (один раз, когда DNS уже указывает на VPS)

```sh
chmod +x deploy/certbot/*.sh
./deploy/certbot/init-certs.sh
```

Продление позже (cron раз в неделю): `./deploy/certbot/renew.sh`

### 5. Проверка

| Что | Адрес |
|-----|--------|
| Сайт | `https://ts.slovekpixel.ru` (логин `admin` / `admin`) |
| TeamSpeak | сервер `ts.slovekpixel.ru`, порт **9987** |
| Privilege key | `docker compose logs teamspeak \| grep -i privilege` |

**Итого после клона:** заполнить `.env` и `docker compose up --build -d` достаточно, чтобы сервисы работали. Для доверенного HTTPS без предупреждения браузера нужен ещё шаг 4 (DNS должен уже смотреть на сервер).

> `TS3_SERVERADMIN_PASSWORD` применяется при **первой** инициализации volume. Смена пароля Query: `docker compose down -v` и снова `up` (данные TS удалятся). На Windows сохраняйте `.env` с LF.

## Один домен `ts.slovekpixel.ru`

Сайт и голос на одном имени, разные порты. Nginx **не** проксирует UDP TeamSpeak — только HTTP(S) к приложениям. В `deploy/nginx/conf.d/` позже можно добавить server-блоки для новых сервисов; контейнер nginx общий на весь проект.

## Локальная разработка (без полного стека)

```sh
pnpm install
docker compose up teamspeak -d
# apps/ts3-server/.env: TS3_QUERY_HOST=127.0.0.1
pnpm dev --filter=ts3-server
```

Сайт: `http://127.0.0.1:3333`.

## Команды monorepo

```sh
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm check-types
pnpm format
```
