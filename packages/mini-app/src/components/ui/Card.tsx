import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  gradient?: string;
}

export function Card({ children, className, onClick, gradient }: CardProps) {
  const classes = [
    'rounded-[2rem] p-6 border transition-all duration-300',
    'bg-white border-slate-100 shadow-lg',
    'dark:bg-slate-900 dark:border-slate-800 dark:shadow-xl',
    onClick ? 'cursor-pointer hover:scale-[1.01] active:scale-[0.98]' : '',
    gradient ? `bg-gradient-to-br ${gradient}` : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} onClick={onClick}>
      {children}
    </div>
  );
}

