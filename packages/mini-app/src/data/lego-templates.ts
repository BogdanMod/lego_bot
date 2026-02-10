import { createElement } from 'react';
import type * as React from 'react';
import { Car, Coffee, Dumbbell, Flower, Layers, Scissors, Sparkles } from 'lucide-react';
import type { Brick } from '../types';

export interface LegoTemplate {
  id: string;
  name: { RU: string; EN: string };
  description: { RU: string; EN: string };
  icon: React.ReactNode; // Lucide icon component
  color: string; // Gradient class from PROJECT_THEMES
  bricks: Brick[];
}

export const LEGO_TEMPLATES: LegoTemplate[] = [
  {
    id: 'blank',
    name: { RU: 'Blank Project', EN: 'Blank Project' },
    description: { RU: 'Start from scratch', EN: 'Start from scratch' },
    icon: createElement(Layers, { size: 20 }),
    color: 'from-indigo-500 to-purple-600',
    bricks: [{ id: 'start', type: 'start', content: '' }],
  },
  {
    id: 'smart-coffee',
    name: { RU: 'Smart Coffee', EN: 'Smart Coffee' },
    description: { RU: 'Кофейня с предзаказом', EN: 'Coffee pre-order' },
    icon: createElement(Coffee, { size: 20 }),
    color: 'from-rose-500 to-orange-500',
    bricks: [
      { id: 'start', type: 'start', content: 'Добро пожаловать в Smart Coffee!', nextId: 'drink_menu' },
      {
        id: 'drink_menu',
        type: 'menu',
        content: 'Выберите напиток:',
        options: [
          { text: 'Капучино', targetId: 'customize_menu' },
          { text: 'Латте', targetId: 'customize_menu' },
          { text: 'Американо', targetId: 'customize_menu' },
        ],
      },
      {
        id: 'customize_menu',
        type: 'menu',
        content: 'Кастомизация напитка:',
        options: [
          { text: 'Маленький', targetId: 'pickup_time' },
          { text: 'Средний', targetId: 'pickup_time' },
          { text: 'Большой', targetId: 'pickup_time' },
        ],
      },
      { id: 'pickup_time', type: 'input', content: 'Введите время самовывоза:', nextId: 'confirm' },
      { id: 'confirm', type: 'message', content: 'Спасибо! Предзаказ подтвержден.' },
    ],
  },
  {
    id: 'barber-shop-pro',
    name: { RU: 'Barber Shop Pro', EN: 'Barber Shop Pro' },
    description: { RU: 'Барбершоп с записью', EN: 'Barbershop booking' },
    icon: createElement(Scissors, { size: 20 }),
    color: 'from-blue-500 to-cyan-500',
    bricks: [
      { id: 'start', type: 'start', content: 'Добро пожаловать в Barber Shop Pro!', nextId: 'master_menu' },
      {
        id: 'master_menu',
        type: 'menu',
        content: 'Выберите мастера:',
        options: [
          { text: 'Мастер 1', targetId: 'service_menu' },
          { text: 'Мастер 2', targetId: 'service_menu' },
          { text: 'Мастер 3', targetId: 'service_menu' },
        ],
      },
      {
        id: 'service_menu',
        type: 'menu',
        content: 'Выберите услугу:',
        options: [
          { text: 'Стрижка', targetId: 'date_input' },
          { text: 'Борода', targetId: 'date_input' },
          { text: 'Комплекс', targetId: 'date_input' },
        ],
      },
      { id: 'date_input', type: 'input', content: 'Введите дату и время:', nextId: 'phone_input' },
      { id: 'phone_input', type: 'input', content: 'Введите телефон:', nextId: 'confirm' },
      { id: 'confirm', type: 'message', content: 'Спасибо! Запись подтверждена.' },
    ],
  },
  {
    id: 'beauty-studio',
    name: { RU: 'Beauty Studio', EN: 'Beauty Studio' },
    description: { RU: 'Студия красоты', EN: 'Beauty studio booking' },
    icon: createElement(Sparkles, { size: 20 }),
    color: 'from-indigo-500 to-purple-600',
    bricks: [
      { id: 'start', type: 'start', content: 'Добро пожаловать в Beauty Studio!', nextId: 'category_menu' },
      {
        id: 'category_menu',
        type: 'menu',
        content: 'Выберите категорию:',
        options: [
          { text: 'Маникюр', targetId: 'procedure_menu' },
          { text: 'Педикюр', targetId: 'procedure_menu' },
          { text: 'Брови', targetId: 'procedure_menu' },
        ],
      },
      {
        id: 'procedure_menu',
        type: 'menu',
        content: 'Выберите процедуру:',
        options: [
          { text: 'Процедура 1', targetId: 'time_input' },
          { text: 'Процедура 2', targetId: 'time_input' },
          { text: 'Процедура 3', targetId: 'time_input' },
        ],
      },
      { id: 'time_input', type: 'input', content: 'Введите удобное время:', nextId: 'contact_input' },
      { id: 'contact_input', type: 'input', content: 'Введите контакт для связи:', nextId: 'confirm' },
      { id: 'confirm', type: 'message', content: 'Спасибо! Запись подтверждена.' },
    ],
  },
  {
    id: 'fitness-helper',
    name: { RU: 'Fitness Helper', EN: 'Fitness Helper' },
    description: { RU: 'Фитнес с абонементами', EN: 'Fitness memberships' },
    icon: createElement(Dumbbell, { size: 20 }),
    color: 'from-emerald-500 to-teal-600',
    bricks: [
      { id: 'start', type: 'start', content: 'Добро пожаловать в Fitness Helper!', nextId: 'goal_menu' },
      {
        id: 'goal_menu',
        type: 'menu',
        content: 'Выберите цель:',
        options: [
          { text: 'Похудение', targetId: 'trainer_menu' },
          { text: 'Набор массы', targetId: 'trainer_menu' },
          { text: 'Тонус', targetId: 'trainer_menu' },
        ],
      },
      {
        id: 'trainer_menu',
        type: 'menu',
        content: 'Выберите тренера:',
        options: [
          { text: 'Тренер 1', targetId: 'membership_menu' },
          { text: 'Тренер 2', targetId: 'membership_menu' },
          { text: 'Тренер 3', targetId: 'membership_menu' },
        ],
      },
      {
        id: 'membership_menu',
        type: 'menu',
        content: 'Выберите абонемент:',
        options: [
          { text: '1 месяц', targetId: 'phone_input' },
          { text: '3 месяца', targetId: 'phone_input' },
          { text: '12 месяцев', targetId: 'phone_input' },
        ],
      },
      { id: 'phone_input', type: 'input', content: 'Введите телефон:' },
    ],
  },
  {
    id: 'flower-delivery',
    name: { RU: 'Flower Delivery', EN: 'Flower Delivery' },
    description: { RU: 'Доставка цветов', EN: 'Flower delivery' },
    icon: createElement(Flower, { size: 20 }),
    color: 'from-amber-500 to-yellow-500',
    bricks: [
      { id: 'start', type: 'start', content: 'Добро пожаловать в Flower Delivery!', nextId: 'occasion_menu' },
      {
        id: 'occasion_menu',
        type: 'menu',
        content: 'Выберите повод:',
        options: [
          { text: 'День рождения', targetId: 'style_menu' },
          { text: 'Свидание', targetId: 'style_menu' },
          { text: 'Просто так', targetId: 'style_menu' },
        ],
      },
      {
        id: 'style_menu',
        type: 'menu',
        content: 'Выберите стиль:',
        options: [
          { text: 'Классика', targetId: 'budget_menu' },
          { text: 'Минимализм', targetId: 'budget_menu' },
          { text: 'Яркий', targetId: 'budget_menu' },
        ],
      },
      {
        id: 'budget_menu',
        type: 'menu',
        content: 'Выберите бюджет:',
        options: [
          { text: 'до 3000', targetId: 'address_input' },
          { text: '3000-7000', targetId: 'address_input' },
          { text: '7000+', targetId: 'address_input' },
        ],
      },
      { id: 'address_input', type: 'input', content: 'Введите адрес доставки:', nextId: 'card_text_input' },
      { id: 'card_text_input', type: 'input', content: 'Введите текст открытки:' },
    ],
  },
  {
    id: 'auto-service',
    name: { RU: 'Auto Service', EN: 'Auto Service' },
    description: { RU: 'Автосервис/мойка', EN: 'Auto service' },
    icon: createElement(Car, { size: 20 }),
    color: 'from-blue-500 to-cyan-500',
    bricks: [
      { id: 'start', type: 'start', content: 'Добро пожаловать в Auto Service!', nextId: 'service_menu' },
      {
        id: 'service_menu',
        type: 'menu',
        content: 'Выберите услугу:',
        options: [
          { text: 'Мойка', targetId: 'car_input' },
          { text: 'Диагностика', targetId: 'car_input' },
          { text: 'ТО', targetId: 'car_input' },
        ],
      },
      { id: 'car_input', type: 'input', content: 'Введите марку авто:', nextId: 'time_input' },
      { id: 'time_input', type: 'input', content: 'Введите удобное время:', nextId: 'confirm' },
      { id: 'confirm', type: 'message', content: 'Спасибо! Заявка принята.' },
    ],
  },
];
