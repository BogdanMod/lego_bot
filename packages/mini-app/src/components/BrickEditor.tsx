import React from 'react';
import { ArrowDown, MessageSquare, Layout, Type as TypeIcon, Rocket, Trash2, X } from 'lucide-react';
import type { Brick, BrickType, MenuOption } from '../types';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { BRICK_TYPE_COLORS } from '../constants/brick-config';
import { useLanguage } from '../hooks/useLanguage';
import { useTheme } from '../hooks/useTheme';

interface BrickEditorProps {
  brick: Brick;
  index: number;
  allBricks: Brick[];
  onUpdate: (updates: Partial<Brick>) => void;
  onDelete: () => void;
  onAddOption?: () => void;
  onUpdateOption?: (optionIndex: number, updates: Partial<MenuOption>) => void;
  onRemoveOption?: (optionIndex: number) => void;
  showArrow?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export function BrickEditor({
  brick,
  index,
  allBricks,
  onUpdate,
  onDelete,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  showArrow = true,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
}: BrickEditorProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();

  const typeIcons: Record<BrickType, React.ReactNode> = {
    start: <Rocket size={20} />,
    message: <MessageSquare size={20} />,
    menu: <Layout size={20} />,
    input: <TypeIcon size={20} />,
  };

  const availableTargets = allBricks.filter((b) => b.id !== brick.id);

  return (
    <div className="relative group">
      <div
        data-brick-id={brick.id}
        className={`rounded-[2.5rem] border-2 flex flex-col transition-all hover:shadow-2xl hover:-translate-y-1 ${
          theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-lg'
        }`}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-black/5">
          <div className="flex items-center gap-4">
            <div
              className={`w-10 h-10 rounded-2xl ${BRICK_TYPE_COLORS[brick.type]} flex items-center justify-center text-white shadow-lg`}
            >
              {typeIcons[brick.type]}
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">
                {t.editor.blockNumber}
                {index + 1}
              </span>
              <span
                className={`font-black text-sm uppercase tracking-wider ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}
              >
                {t.editor.blockTypes[brick.type]}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {brick.type !== 'start' && (
              <Button variant="ghost" size="sm" onClick={onDelete} className="text-rose-500 hover:bg-rose-50">
                <Trash2 size={18} />
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Message Content */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">
              {brick.type === 'input' ? t.editor.placeholders.input : t.editor.placeholders.message}
            </label>
            <Textarea
              value={brick.content}
              onChange={(e) => onUpdate({ content: e.target.value })}
              placeholder={t.editor.placeholders[brick.type]}
              rows={2}
              className={`w-full border-none p-5 rounded-[1.75rem] text-sm font-semibold outline-none transition-all resize-none ${
                theme === 'dark'
                  ? 'bg-slate-800 text-white focus:bg-slate-700'
                  : 'bg-slate-50 text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-100/50 shadow-inner'
              }`}
            />
          </div>

          {/* Menu Options */}
          {brick.type === 'menu' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  {t.editor.editButtons}
                </span>
                <button
                  onClick={onAddOption}
                  className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-400"
                >
                  {t.editor.addButton}
                </button>
              </div>
              <div className="grid gap-3">
                {brick.options?.map((opt, oIdx) => (
                  <div
                    key={oIdx}
                    className={`p-4 rounded-3xl border flex flex-col gap-3 ${
                      theme === 'dark' ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <div className="flex gap-3">
                      <input
                        placeholder={t.editor.placeholders.buttonText}
                        value={opt.text}
                        onChange={(e) => onUpdateOption?.(oIdx, { text: e.target.value })}
                        className={`flex-1 bg-transparent border-b border-transparent focus:border-indigo-500 text-sm font-bold outline-none py-1 ${
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        }`}
                      />
                      <button
                        onClick={() => onRemoveOption?.(oIdx)}
                        className="text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest shrink-0">
                        {t.editor.connectTo}
                      </span>
                      <select
                        value={opt.targetId || ''}
                        onChange={(e) => onUpdateOption?.(oIdx, { targetId: e.target.value })}
                        className={`flex-1 bg-transparent text-[11px] font-bold outline-none cursor-pointer ${
                          theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
                        }`}
                      >
                        <option value="">{t.editor.noNext}</option>
                        {availableTargets.map((b) => (
                          <option key={b.id} value={b.id}>
                            {t.editor.blockNumber}
                            {allBricks.indexOf(b) + 1} ({b.content.slice(0, 15)}...)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next Block Selection for message/input/start */}
          {(brick.type === 'message' || brick.type === 'input' || brick.type === 'start') && (
            <div className="flex items-center gap-3 px-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest shrink-0">
                {t.editor.connectTo}
              </span>
              <select
                value={brick.nextId || ''}
                onChange={(e) => onUpdate({ nextId: e.target.value })}
                className={`flex-1 bg-transparent text-[11px] font-bold outline-none cursor-pointer ${
                  theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
                }`}
              >
                <option value="">{t.editor.noNext}</option>
                {availableTargets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {t.editor.blockNumber}
                    {allBricks.indexOf(b) + 1} ({b.content.slice(0, 15)}...)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Arrow Indicator */}
      {showArrow && (
        <div className="h-10 w-full flex justify-center items-center">
          <div className="w-0.5 h-full bg-slate-800/20 dark:bg-slate-100/10 border-dashed border-r-2" />
          <ArrowDown size={14} className="text-slate-400 absolute" />
        </div>
      )}
    </div>
  );
}
