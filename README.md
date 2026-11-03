# slovek-pixel-ru

Всякое разное

#### Клонирование репозитория
```sh
git clone https://github.com/SlovekPixel/slovek-pixel-ru
```

#### Установка env-переменных
```sh
cd slovek-pixel-ru
cp .env.example .env
```

#### Поднятие всего сервиса в Docker
Нужна A-запись `DOMAIN` (из `.env`) на IP сервера и открытые порты 80/443.
```sh
docker compose up --build -d
```
HTTPS-сертификат Let's Encrypt контейнер `certbot` получает сам (как только DNS
указывает на сервер) и продлевает дважды в сутки; nginx подхватывает его в течение
минуты. Скриптов и cron не нужно.
```sh
docker compose logs -f certbot   # посмотреть, как идёт выдача
```

## TeamSpeak 3

TS3 Server + публичная страница статуса на https://ts3.slovekpixel.ru

Веб — один файл на `node:http` без зависимостей ([apps/ts3-server/src](apps/ts3-server/src)).
Node 24 запускает `.ts` напрямую, сборки нет. Статус берётся из ServerQuery
и кэшируется на 10 с — страница опрашивает `/api/status` с тем же интервалом.

#### Локальный запуск веба
```sh
pnpm install
pnpm dev     # читает .env из корня, нужен доступ к ServerQuery (127.0.0.1:10011)
pnpm check   # tsc + prettier
```

#### Получение ключа привилегий для администратора
```sh
docker compose logs teamspeak | grep -i privilege
```
