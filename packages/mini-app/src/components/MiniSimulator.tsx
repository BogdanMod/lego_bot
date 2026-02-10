import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BotProject, Brick } from '../types';
import { findBrickById, getNextBrick } from '../utils/brick-helpers';
import { useLanguage } from '../hooks/useLanguage';

export interface MiniSimulatorProps {
  project: BotProject;
}

export interface MessageHistoryItem {
  id: string;
  content: string;
  type: 'bot' | 'user';
  timestamp: number;
}

function brickText(brick: Brick): string {
  const text = brick.content || '';
  return text.trim().length > 0 ? text : '...';
}

function limitHistory(items: MessageHistoryItem[]): MessageHistoryItem[] {
  if (items.length <= 50) return items;
  return items.slice(items.length - 50);
}

function makeHistoryId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function MiniSimulator({ project }: MiniSimulatorProps) {
  const { t } = useLanguage();

  const [currentBrickId, setCurrentBrickId] = useState<string | null>(null);
  const [history, setHistory] = useState<MessageHistoryItem[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  const [isWaitingForInput, setIsWaitingForInput] = useState<boolean>(false);

  const chatRef = useRef<HTMLDivElement | null>(null);
  const visitCountsRef = useRef<Map<string, number>>(new Map());
  const transitionCountRef = useRef<number>(0);

  const MAX_VISITS_PER_BRICK = 5;
  const MAX_TOTAL_TRANSITIONS = 200;

  const startBrick = useMemo(() => project.bricks.find((b) => b.type === 'start') || null, [project.bricks]);

  const currentBrick = useMemo(() => {
    if (!currentBrickId) return null;
    return findBrickById(project.bricks, currentBrickId) || null;
  }, [project.bricks, currentBrickId]);

  const pushHistoryItem = useCallback((item: MessageHistoryItem) => {
    setHistory((prev) => limitHistory([...prev, item]));
  }, []);

  const pushBotMessage = useCallback(
    (brick: Brick) => {
      pushHistoryItem({
        id: makeHistoryId('bot'),
        type: 'bot',
        content: brickText(brick),
        timestamp: Date.now(),
      });
    },
    [pushHistoryItem],
  );

  const pushUserMessage = useCallback(
    (content: string) => {
      pushHistoryItem({
        id: makeHistoryId('user'),
        type: 'user',
        content,
        timestamp: Date.now(),
      });
    },
    [pushHistoryItem],
  );

  const endConversation = useCallback(() => {
    pushHistoryItem({
      id: makeHistoryId('bot_end'),
      type: 'bot',
      content: t.simulator.endOfFlow,
      timestamp: Date.now(),
    });
    setCurrentBrickId(null);
    setIsWaitingForInput(false);
  }, [pushHistoryItem, t.simulator.endOfFlow]);

  const recordVisit = useCallback(
    (brickId: string): boolean => {
      transitionCountRef.current += 1;
      if (transitionCountRef.current > MAX_TOTAL_TRANSITIONS) return false;

      const prev = visitCountsRef.current.get(brickId) ?? 0;
      const next = prev + 1;
      visitCountsRef.current.set(brickId, next);

      return next <= MAX_VISITS_PER_BRICK;
    },
    [MAX_TOTAL_TRANSITIONS, MAX_VISITS_PER_BRICK],
  );

  const handleStart = useCallback(() => {
    setHistory([]);
    setUserInput('');
    setIsWaitingForInput(false);
    visitCountsRef.current = new Map();
    transitionCountRef.current = 0;

    if (!startBrick) {
      setCurrentBrickId(null);
      return;
    }

    recordVisit(startBrick.id);
    setCurrentBrickId(startBrick.id);
  }, [startBrick, recordVisit]);

  const handleRestart = useCallback(() => {
    handleStart();
  }, [handleStart]);

  const moveToNextBrick = useCallback(
    (brick: Brick) => {
      const next = getNextBrick(project.bricks, brick);
      if (!next) {
        endConversation();
        return;
      }

      if (!recordVisit(next.id)) {
        endConversation();
        return;
      }

      setCurrentBrickId(next.id);
    },
    [project.bricks, endConversation, recordVisit],
  );

  const handleMenuClick = useCallback(
    (targetId: string) => {
      if (!currentBrick) return;

      pushBotMessage(currentBrick);

      const optionText =
        currentBrick.options?.find((o) => o.targetId === targetId)?.text ||
        currentBrick.options?.find((o) => !o.targetId && targetId === '')?.text ||
        '';
      if (optionText) {
        pushUserMessage(optionText);
      }

      if (!targetId) {
        endConversation();
        return;
      }

      const target = findBrickById(project.bricks, targetId);
      if (!target) {
        endConversation();
        return;
      }

      if (!recordVisit(target.id)) {
        endConversation();
        return;
      }

      setCurrentBrickId(target.id);
    },
    [currentBrick, project.bricks, pushBotMessage, pushUserMessage, endConversation, recordVisit],
  );

  const handleInputSubmit = useCallback(() => {
    if (!currentBrick) return;
    const content = userInput.trim();
    if (!content) return;

    pushBotMessage(currentBrick);
    pushUserMessage(content);
    setUserInput('');
    setIsWaitingForInput(false);

    moveToNextBrick(currentBrick);
  }, [currentBrick, userInput, pushBotMessage, pushUserMessage, moveToNextBrick]);

  useEffect(() => {
    if (!startBrick) return;
    if (currentBrickId !== null) return;
    if (history.length > 0) return;
    handleStart();
  }, [startBrick, currentBrickId, history.length, handleStart]);

  useEffect(() => {
    if (!chatRef.current) return;
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [history, currentBrickId]);

  useEffect(() => {
    if (!currentBrick) return;

    if (currentBrick.type === 'input') {
      setIsWaitingForInput(true);
      return;
    }

    setIsWaitingForInput(false);

    if (currentBrick.type === 'start' || currentBrick.type === 'message') {
      pushBotMessage(currentBrick);
      moveToNextBrick(currentBrick);
    }
  }, [currentBrick, pushBotMessage, moveToNextBrick]);

  if (!startBrick) {
    return (
      <div className="w-full h-full rounded-[2.5rem] bg-slate-950/80 border border-white/5 overflow-hidden flex items-center justify-center p-8">
        <p className="text-slate-200 text-sm text-center">{t.simulator.noStartBlock}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-[2.5rem] bg-slate-950/80 border border-white/5 overflow-hidden flex flex-col shadow-2xl">
      <header className="px-6 py-5 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">
            {t.simulator.liveMode}
          </span>
        </div>
        <button
          type="button"
          onClick={handleRestart}
          className="px-4 py-2 rounded-2xl bg-white/5 border border-white/5 text-slate-200 text-xs font-semibold active:scale-95 transition-all duration-200 hover:bg-white/10"
        >
          {t.simulator.restart}
        </button>
      </header>

      <div ref={chatRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {history.map((item, idx) => {
          const isCurrentHistoryItem = !currentBrick && idx === history.length - 1;
          return (
          <div
            key={item.id}
            className={[
              'flex',
              item.type === 'user' ? 'justify-end' : 'justify-start',
              isCurrentHistoryItem ? '' : 'opacity-30 scale-95',
            ].join(' ')}
          >
            <div
              className={[
                'max-w-[80%] whitespace-pre-wrap break-words px-4 py-3 rounded-[1.5rem] shadow-lg',
                item.type === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-md'
                  : 'bg-white text-slate-900 rounded-bl-md',
                isCurrentHistoryItem ? 'animate-in slide-in-from-bottom-2 duration-300' : '',
              ].join(' ')}
            >
              {item.content}
            </div>
          </div>
          );
        })}

        {currentBrick ? (
          <div className="space-y-4">
            <div className="flex justify-start">
              <div
                key={currentBrick.id}
                className="max-w-[80%] whitespace-pre-wrap break-words px-4 py-3 rounded-[1.5rem] shadow-lg bg-white text-slate-900 rounded-bl-md animate-in slide-in-from-bottom-2 duration-300"
              >
                {brickText(currentBrick)}
              </div>
            </div>

            {currentBrick.type === 'menu' ? (
              <div className="grid grid-cols-1 gap-3">
                {(currentBrick.options || []).map((opt, idx) => (
                  <button
                    key={`${currentBrick.id}_opt_${idx}`}
                    type="button"
                    className="px-4 py-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/20 text-slate-100 text-sm font-semibold hover:bg-indigo-600/30 active:scale-95 transition-all duration-200"
                    onClick={() => handleMenuClick(opt.targetId || '')}
                    disabled={!opt.text}
                  >
                    {opt.text}
                  </button>
                ))}
              </div>
            ) : null}

            {currentBrick.type === 'input' ? (
              <div className="flex items-center gap-3">
                <input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder={t.simulator.typeMessage}
                  className="flex-1 px-4 py-3 rounded-2xl bg-white/5 border border-white/5 text-slate-100 placeholder:text-slate-400 outline-none focus:border-indigo-500/40 transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleInputSubmit();
                    }
                  }}
                  disabled={!isWaitingForInput}
                />
                <button
                  type="button"
                  onClick={handleInputSubmit}
                  className="px-5 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-semibold shadow-lg hover:bg-indigo-700 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!isWaitingForInput || userInput.trim().length === 0}
                >
                  {t.simulator.send}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
