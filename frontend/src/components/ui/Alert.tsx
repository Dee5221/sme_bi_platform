import type { ReactNode } from 'react';
import './Alert.css';

type Tone = 'info' | 'success' | 'error' | 'warning';

type Props = {
  tone?: Tone;
  children: ReactNode;
  title?: string;
};

export function Alert({ tone = 'info', children, title }: Props) {
  const urgent = tone === 'error' || tone === 'warning';
  return (
    <div
      className={`ui-alert ui-alert--${tone}`}
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? 'assertive' : 'polite'}
    >
      {title ? <strong>{title}</strong> : null}
      <div>{children}</div>
    </div>
  );
}
