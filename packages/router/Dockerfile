FROM node:18-alpine AS builder

WORKDIR /app

# Копируем корневой package.json для workspace
COPY package.json ./

# Копируем shared пакет (нужен для компиляции типов)
COPY packages/shared ./packages/shared

# Копируем package.json router
COPY packages/router/package.json ./packages/router/

# Устанавливаем зависимости (workspace установит все пакеты)
RUN npm install

# Собираем shared пакет (нужен для типов при компиляции router)
WORKDIR /app/packages/shared
RUN npm run build || echo "Shared build skipped"

# Возвращаемся к router
WORKDIR /app/packages/router

# Копируем tsconfig.json и исходный код router
COPY packages/router/tsconfig.json ./
COPY packages/router/src ./src

# Обновляем tsconfig.json для сборки в Docker
# Устанавливаем rootDir на ../.. (корень монорепо), чтобы TypeScript мог разрешать импорты из shared
RUN node -e "const fs = require('fs'); const config = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8')); config.compilerOptions.rootDir = '../..'; fs.writeFileSync('tsconfig.json', JSON.stringify(config, null, 2));"

# Компилируем TypeScript
RUN npm run build

# Исправляем структуру dist после компиляции
# При rootDir="../.." файлы попадают в dist/packages/router/src/...
# Перемещаем их в dist/
RUN if [ -d dist/packages/router/src ]; then \
      mv dist/packages/router/src/* dist/ && \
      rm -rf dist/packages; \
    fi

# Production stage
FROM node:18-alpine

WORKDIR /app

# Копируем package.json router
COPY packages/router/package.json ./

# Удаляем зависимость от shared из package.json (локальная workspace, не нужна в runtime)
# В собранном JS коде уже нет импортов типов
RUN apk add --no-cache jq && \
    jq 'del(.dependencies["@dialogue-constructor/shared"])' package.json > package.json.tmp && \
    mv package.json.tmp package.json && \
    apk del jq

# Устанавливаем только production зависимости (без shared)
RUN npm install --omit=dev --no-save || npm install --production --no-save

# Копируем собранный код из builder (уже с исправленной структурой)
COPY --from=builder /app/packages/router/dist ./dist

# Открываем порт
EXPOSE 3001

# Запускаем приложение
CMD ["npm", "start"]

