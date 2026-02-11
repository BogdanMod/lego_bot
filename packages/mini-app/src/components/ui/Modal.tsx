import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, children, className }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in"
        style={{ animationDuration: '300ms' }}
        onClick={onClose}
      />
      <div
        className={['relative w-full max-w-md animate-in zoom-in', className || ''].filter(Boolean).join(' ')}
        style={{ animationDuration: '300ms' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

