// Vercel Serverless Function
// Экспортируем Express app для работы в Vercel
// После build команды, dist/index.js будет доступен
// @ts-ignore - dist файлы могут не иметь типов
import app from '../dist/index';

export default app;

