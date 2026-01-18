# Настройка публичного URL для роутера

Для работы webhook от Telegram необходимо, чтобы роутер был доступен по публичному HTTPS URL.

## Быстрые решения для разработки

### Вариант 1: ngrok (рекомендуется для разработки)

**ngrok** - самый простой способ получить публичный URL для локального сервера.

#### Установка ngrok:

```bash
# macOS
brew install ngrok

# Или скачайте с https://ngrok.com/download
```

#### Регистрация и настройка:

1. Зарегистрируйтесь на https://ngrok.com (бесплатно)
2. Получите токен авторизации в dashboard
3. Авторизуйтесь:

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

#### Запуск ngrok:

```bash
# Запустите ngrok на порту 3001 (порт роутера)
ngrok http 3001
```

#### Результат:

Вы получите публичный URL, например:
```
https://abc123def456.ngrok-free.app
```

#### Использование:

1. Скопируйте HTTPS URL (например, `https://abc123def456.ngrok-free.app`)
2. Добавьте в `.env`:

```bash
ROUTER_URL=https://abc123def456.ngrok-free.app
```

3. Перезапустите core сервис

#### Важно:
- Бесплатный ngrok дает случайный URL при каждом запуске
- Для постоянного URL нужен платный план или домен
- URL меняется при перезапуске ngrok

---

### Вариант 2: Cloudflare Tunnel (бесплатно, постоянный URL)

**Cloudflare Tunnel** - бесплатное решение с постоянным URL.

#### Установка:

```bash
# macOS
brew install cloudflared

# Или скачайте с https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

#### Настройка:

1. Запустите туннель:

```bash
cloudflared tunnel --url http://localhost:3001
```

2. Вы получите URL вида:
```
https://random-words-1234.trycloudflare.com
```

#### Постоянный туннель (рекомендуется):

1. Создайте туннель:

```bash
cloudflared tunnel create router-tunnel
```

2. Настройте конфигурацию в `~/.cloudflared/config.yml`:

```yaml
tunnel: router-tunnel
credentials-file: /Users/your-user/.cloudflared/xxxxx.json

ingress:
  - hostname: router.yourdomain.com
    service: http://localhost:3001
  - service: http_status:404
```

3. Запустите туннель:

```bash
cloudflared tunnel run router-tunnel
```

---

### Вариант 3: localtunnel (простой, без регистрации)

#### Установка:

```bash
npm install -g localtunnel
```

#### Запуск:

```bash
lt --port 3001 --subdomain your-custom-name
```

#### Результат:

```
https://your-custom-name.loca.lt
```

#### Важно:
- Бесплатно, но требует установку через npm
- Может быть нестабильным

---

## Production решение: Настройка реального домена

### Шаг 1: Получите домен

Купите домен у регистратора (например, Namecheap, GoDaddy, Cloudflare).

### Шаг 2: Разверните роутер на сервере

Варианты:
- **VPS** (DigitalOcean, Hetzner, AWS EC2)
- **Cloud Platform** (AWS, Google Cloud, Azure)
- **Platform as a Service** (Railway, Render, Fly.io)

### Шаг 3: Настройте SSL/TLS сертификат

#### Вариант A: Используйте Let's Encrypt (бесплатно)

1. Установите Certbot:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install certbot

# macOS
brew install certbot
```

2. Получите сертификат:

```bash
sudo certbot certonly --standalone -d router.yourdomain.com
```

3. Сертификаты будут в:
```
/etc/letsencrypt/live/router.yourdomain.com/
```

#### Вариант B: Используйте nginx как reverse proxy

1. Установите nginx:

```bash
# Ubuntu/Debian
sudo apt-get install nginx

# macOS
brew install nginx
```

2. Создайте конфигурацию `/etc/nginx/sites-available/router`:

```nginx
server {
    listen 80;
    server_name router.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. Включите сайт:

```bash
sudo ln -s /etc/nginx/sites-available/router /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

4. Настройте SSL с Certbot:

```bash
sudo certbot --nginx -d router.yourdomain.com
```

Certbot автоматически обновит конфигурацию nginx для HTTPS.

### Шаг 4: Настройте DNS

#### A Record:

```
Type: A
Name: router (или @)
Value: IP_адрес_вашего_сервера
TTL: 300
```

#### Или CNAME (если используете Cloudflare/CDN):

```
Type: CNAME
Name: router
Value: ваш-сервер.com
TTL: Auto
```

### Шаг 5: Обновите .env

```bash
ROUTER_URL=https://router.yourdomain.com
```

### Шаг 6: Настройте firewall

Откройте порты 80 и 443:

```bash
# Ubuntu/Debian (UFW)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Или для iptables
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
```

---

## Использование с Express и HTTPS

Если вы хотите настроить HTTPS напрямую в Express:

### Обновление router/src/index.ts:

```typescript
import https from 'https';
import fs from 'fs';

// Загрузите SSL сертификаты
const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/router.yourdomain.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/router.yourdomain.com/fullchain.pem'),
};

// Запустите HTTPS сервер
https.createServer(options, app).listen(443, () => {
  console.log(`✅ Router server is running on HTTPS port 443`);
});
```

---

## Проверка настройки

### 1. Проверьте доступность:

```bash
curl https://your-router-url.com/health
```

Ожидаемый ответ:
```json
{
  "status": "ok",
  "service": "router",
  "timestamp": "..."
}
```

### 2. Проверьте webhook от Telegram:

```bash
curl -X POST https://api.telegram.org/bot<BOT_TOKEN>/setWebhook \
  -d "url=https://your-router-url.com/webhook/bot-id"
```

### 3. Проверьте информацию о webhook:

```bash
curl https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo
```

---

## Рекомендации

### Для разработки:
- ✅ **ngrok** - самый простой вариант
- ✅ **Cloudflare Tunnel** - постоянный URL, бесплатно

### Для production:
- ✅ Используйте реальный домен с SSL (Let's Encrypt)
- ✅ Настройте nginx как reverse proxy
- ✅ Используйте CDN (Cloudflare) для защиты от DDoS
- ✅ Настройте мониторинг (UptimeRobot, Pingdom)
- ✅ Настройте автоматическое обновление SSL (certbot renew)

---

## Безопасность

1. **HTTPS обязателен** - Telegram требует HTTPS для webhook
2. **Защита от DDoS** - используйте Cloudflare или другую CDN
3. **Rate Limiting** - добавьте ограничение запросов
4. **Аутентификация** - рассмотрите добавление токена для защиты endpoints
5. **Мониторинг** - отслеживайте логи и ошибки

---

## Troubleshooting

### Проблема: Telegram не принимает webhook

**Решение:**
- Убедитесь, что URL начинается с `https://`
- Проверьте, что сервер доступен публично
- Проверьте SSL сертификат: `openssl s_client -connect your-domain.com:443`
- Убедитесь, что порт 443 открыт

### Проблема: SSL сертификат не действителен

**Решение:**
- Проверьте срок действия: `certbot certificates`
- Обновите сертификат: `sudo certbot renew`
- Убедитесь, что DNS настроен правильно

### Проблема: Webhook получает ошибку 404

**Решение:**
- Проверьте путь: должен быть `/webhook/:botId`
- Проверьте, что роутер запущен и доступен
- Проверьте логи роутера

---

## Дополнительные ресурсы

- [ngrok Documentation](https://ngrok.com/docs)
- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Telegram Bot API - setWebhook](https://core.telegram.org/bots/api#setwebhook)

