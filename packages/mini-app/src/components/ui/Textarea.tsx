import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rows?: number;
}

export function Textarea({ label, error, icon, rows = 4, className, ...props }: TextareaProps) {
  const textareaClasses = [
    'w-full px-4 py-3 rounded-2xl border outline-none transition-all resize-vertical',
    'bg-white border-slate-200 text-slate-900 focus:ring-4 focus:ring-indigo-100',
    'dark:bg-slate-900 dark:border-slate-800 dark:text-white dark:focus:ring-indigo-900/20',
    icon ? 'pl-11' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="w-full">
      {label ? <label className="mb-2 block text-sm text-slate-600 dark:text-slate-300">{label}</label> : null}
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute left-4 top-4 text-slate-400 dark:text-slate-500">
            {icon}
          </span>
        ) : null}
        <textarea className={textareaClasses} rows={rows} {...props} />
      </div>
      {error ? <div className="mt-2 text-sm text-rose-500">{error}</div> : null}
    </div>
  );
}

