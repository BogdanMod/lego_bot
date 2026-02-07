import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg',
    secondary: 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white',
    danger: 'bg-rose-500 text-white hover:bg-rose-600',
    ghost: 'bg-transparent text-slate-600 dark:text-slate-300',
  };

  const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-5 py-3.5 text-lg',
  };

  const classes = [
    'inline-flex items-center justify-center gap-2 rounded-2xl font-medium',
    'active:scale-95 transition-all duration-200',
    variantClasses[variant],
    sizeClasses[size],
    disabled ? 'opacity-50 cursor-not-allowed' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled} {...props}>
      {loading ? (
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : null}
      {icon ? <span className="inline-flex">{icon}</span> : null}
      {children}
    </button>
  );
}

