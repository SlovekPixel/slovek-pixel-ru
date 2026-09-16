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

#### Поднятие всего сервиса в Docker и установка сертификата
```sh
docker compose up --build -d
```
```sh
chmod +x deploy/certbot/*.sh
./deploy/certbot/init-certs.sh
```

## TeamSpeak 3

Публичный дашборд статуса TeamSpeak + TS3 Server

#### Получение ключа привилегий для администратора
```sh
docker compose logs teamspeak | grep -i privilege
```
