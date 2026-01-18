#!/bin/bash

echo "🔑 Генерация ключа шифрования..."
echo ""

# Генерация ключа
if command -v openssl &> /dev/null; then
    KEY=$(openssl rand -base64 32)
    echo "✅ Ключ сгенерирован:"
    echo ""
    echo "ENCRYPTION_KEY=$KEY"
    echo ""
    echo "Скопируйте этот ключ и добавьте в .env файл"
else
    echo "❌ openssl не найден. Используйте Node.js для генерации:"
    echo ""
    echo "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
fi
