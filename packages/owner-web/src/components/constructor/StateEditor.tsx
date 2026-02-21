'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { BotSchema } from '@/lib/templates/types';

interface StateEditorProps {
  schema: BotSchema;
  stateName: string;
  onUpdate: (updates: Partial<BotSchema['states'][string]>) => void;
  onSetInitial: () => void;
  isInitial: boolean;
}

type ButtonItem = {
  text: string;
  nextState: string;
  type?: string;
  url?: string;
  track?: { event?: 'lead' | 'appointment' };
};

function normalizeButton(b: ButtonItem): ButtonItem {
  const type = (b.type === 'request_contact' || b.type === 'url' ? b.type : undefined) || 'navigation';
  return {
    text: b.text || '',
    nextState: b.nextState || '',
    ...(type === 'request_contact' && { type: 'request_contact', track: b.track || { event: 'lead' } }),
    ...(type === 'url' && { type: 'url', url: b.url || '' }),
  };
}

function SortableButton({
  button,
  index,
  states,
  onUpdate,
  onDelete,
}: {
  button: ButtonItem;
  index: number;
  states: string[];
  onUpdate: (index: number, updates: Partial<ButtonItem>) => void;
  onDelete: (index: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `button-${index}` });
  const btn = normalizeButton(button);
  const type = btn.type === 'request_contact' ? 'request_contact' : btn.type === 'url' ? 'url' : 'navigation';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleTypeChange = (newType: 'navigation' | 'request_contact' | 'url') => {
    if (newType === 'request_contact') {
      onUpdate(index, { type: 'request_contact', track: { event: 'lead' }, url: undefined });
    } else if (newType === 'url') {
      onUpdate(index, { type: 'url', url: btn.url || 'https://', track: undefined });
    } else {
      onUpdate(index, { type: undefined, track: undefined, url: undefined });
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <select
        value={type}
        onChange={(e) => handleTypeChange(e.target.value as 'navigation' | 'request_contact' | 'url')}
        className="w-[140px] px-2 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100"
      >
        <option value="navigation">Переход</option>
        <option value="request_contact">Контакт (телефон)</option>
        <option value="url">Ссылка</option>
      </select>
      <input
        type="text"
        value={btn.text}
        onChange={(e) => onUpdate(index, { text: e.target.value })}
        placeholder={type === 'request_contact' ? 'Поделиться номером' : 'Текст кнопки'}
        className="flex-1 min-w-[120px] px-3 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 focus:border-transparent"
      />
      {type === 'url' ? (
        <input
          type="url"
          value={btn.url || ''}
          onChange={(e) => onUpdate(index, { url: e.target.value })}
          placeholder="https://..."
          className="flex-1 min-w-[140px] px-3 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100"
        />
      ) : (
        <>
          <select
            value={btn.nextState}
            onChange={(e) => onUpdate(index, { nextState: e.target.value })}
            className="px-3 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100"
          >
            {states.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          {type === 'request_contact' && (
            <select
              value={btn.track?.event || 'lead'}
              onChange={(e) => onUpdate(index, { track: { event: e.target.value as 'lead' | 'appointment' } })}
              title="Событие для аналитики"
              className="px-2 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100"
            >
              <option value="lead">Заявка</option>
              <option value="appointment">Запись</option>
            </select>
          )}
        </>
      )}
      <button
        onClick={() => onDelete(index)}
        className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export function StateEditor({
  schema,
  stateName,
  onUpdate,
  onSetInitial,
  isInitial,
}: StateEditorProps) {
  const state = schema.states[stateName];
  const buttons = state.buttons || [];
  const states = Object.keys(schema.states);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const oldIndex = buttons.findIndex(
      (_, i) => `button-${i}` === active.id
    );
    const newIndex = buttons.findIndex(
      (_, i) => `button-${i}` === over.id
    );

    if (oldIndex !== newIndex) {
      const newButtons = arrayMove(buttons, oldIndex, newIndex);
      onUpdate({ buttons: newButtons });
    }
  };

  const handleButtonUpdate = (index: number, updates: Partial<ButtonItem>) => {
    const newButtons = [...buttons];
    newButtons[index] = { ...newButtons[index], ...updates };
    onUpdate({ buttons: newButtons });
  };

  const handleAddButton = () => {
    const newButtons = [
      ...buttons,
      { text: '', nextState: schema.initialState } as ButtonItem,
    ];
    onUpdate({ buttons: newButtons });
  };

  const handleDeleteButton = (index: number) => {
    const newButtons = buttons.filter((_, i) => i !== index);
    onUpdate({ buttons: newButtons });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {stateName}
            </h2>
            {isInitial && (
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 inline-block">
                Стартовый экран
              </span>
            )}
          </div>
          {!isInitial && (
            <button
              onClick={onSetInitial}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Сделать стартовым
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Message */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Сообщение пользователю
          </label>
          <textarea
            value={state.message || ''}
            onChange={(e) => onUpdate({ message: e.target.value })}
            placeholder="Текст, который увидит пользователь..."
            className="w-full px-4 py-3 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 focus:border-transparent resize-none min-h-[120px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        {/* Buttons */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Кнопки (при нажатии → переход на другой экран)
            </label>
            <button
              onClick={handleAddButton}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Добавить кнопку
            </button>
          </div>

          {buttons.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                Пока нет кнопок
              </p>
              <button
                onClick={handleAddButton}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline"
              >
                Добавить кнопку
              </button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={buttons.map((_, i) => `button-${i}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {buttons.map((button, index) => (
                    <SortableButton
                      key={`button-${index}`}
                      button={button}
                      index={index}
                      states={states}
                      onUpdate={handleButtonUpdate}
                      onDelete={handleDeleteButton}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
}

