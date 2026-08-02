import type { ButtonHTMLAttributes, ReactNode } from 'react';

type IconButtonProps = {
  label: string;
  children: ReactNode;
  variant?: 'default' | 'danger' | 'primary';
  size?: 'sm' | 'md';
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'>;

/**
 * Compact icon-only control. Always provide a clear `label` for screen readers.
 */
export function IconButton({
  label,
  children,
  variant = 'default',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: IconButtonProps) {
  const classes = [
    'icon-btn',
    `icon-btn-${variant}`,
    `icon-btn-${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  );
}
