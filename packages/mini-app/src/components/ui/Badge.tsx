import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'error' | 'warning' | 'info';
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'info', size = 'md' }: BadgeProps) {
  const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
    success: 'bg-emerald-500 text-white',
    error: 'bg-rose-500 text-white',
    warning: 'bg-amber-500 text-white',
    info: 'bg-indigo-500 text-white',
  };

  const sizeClasses: Record<NonNullable<BadgeProps['size']>, string> = {
    sm: 'px-2 py-1 text-[9px]',
    md: 'px-3 py-1.5 text-[10px]',
  };

  const classes = [
    'inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-widest',
    variantClasses[variant],
    sizeClasses[size],
  ].join(' ');

  return <span className={classes}>{children}</span>;
}

