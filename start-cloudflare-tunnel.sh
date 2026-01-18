#!/bin/bash

# Скрипт для запуска Cloudflare Tunnel

echo "🚀 Запуск Cloudflare Tunnel для роутера..."
echo "URL: https://vancouver-dimensional-pushed-condo.trycloudflare.com"
echo "Локальный сервер: http://localhost:3001"
echo ""

# Проверяем, запущен ли роутер
if ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "⚠️  Внимание: Роутер не отвечает на http://localhost:3001"
    echo "Убедитесь, что роутер запущен: npm run dev"
    echo ""
fi

# Запускаем туннель
cloudflared tunnel --url http://localhost:3001

