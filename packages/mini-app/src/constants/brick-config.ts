export const BRICK_LIMITS = {
  Free: { bots: 1, bricksPerBot: 10 },
  Premium: { bots: 5, bricksPerBot: 50 }
} as const;

export const BRICK_TYPE_COLORS = {
  start: 'bg-purple-500',
  message: 'bg-blue-500',
  menu: 'bg-amber-500',
  input: 'bg-emerald-500'
} as const;

export const PROJECT_THEMES = [
  'from-indigo-500 to-purple-600',
  'from-rose-500 to-orange-500',
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-cyan-500',
  'from-amber-500 to-yellow-500'
] as const;

export const DEFAULT_BRICK_CONTENT = {
  start: 'Добро пожаловать!',
  message: 'Введите текст сообщения...',
  menu: 'Выберите опцию:',
  input: 'Введите ваш ответ:'
} as const;

