#!/usr/bin/env node
/**
 * Railway Start Script
 * 
 * Определяет, какой пакет запускать, на основе переменной окружения RAILWAY_SERVICE_NAME.
 * Это позволяет использовать один railway.json для всех сервисов.
 * 
 * Railway автоматически устанавливает RAILWAY_SERVICE_NAME для каждого сервиса.
 */

const { execSync } = require('child_process');
const path = require('path');

// Маппинг имени сервиса в Railway на имя пакета
const SERVICE_TO_PACKAGE = {
  'core': '@dialogue-constructor/core',
  'owner-web': '@dialogue-constructor/owner-web',
  'router': '@dialogue-constructor/router',
  'worker': '@dialogue-constructor/worker',
  'miniapp': '@dialogue-constructor/mini-app',
  'mini-app': '@dialogue-constructor/mini-app',
  'frontend': '@dialogue-constructor/frontend',
};

// Получаем имя сервиса из переменной окружения
const serviceName = process.env.RAILWAY_SERVICE_NAME || process.env.SERVICE_NAME;

if (!serviceName) {
  console.error('❌ RAILWAY_SERVICE_NAME or SERVICE_NAME is not set');
  console.error('Available services:', Object.keys(SERVICE_TO_PACKAGE).join(', '));
  process.exit(1);
}

const packageName = SERVICE_TO_PACKAGE[serviceName.toLowerCase()];

if (!packageName) {
  console.error(`❌ Unknown service: ${serviceName}`);
  console.error('Available services:', Object.keys(SERVICE_TO_PACKAGE).join(', '));
  process.exit(1);
}

console.log(`🚀 Starting service: ${serviceName} → ${packageName}`);

try {
  // Запускаем pnpm --filter для нужного пакета
  execSync(`pnpm --filter ${packageName} start`, {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
  });
} catch (error) {
  console.error(`❌ Failed to start ${packageName}:`, error.message);
  process.exit(1);
}

