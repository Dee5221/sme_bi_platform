import type { ReactNode } from 'react';
import './Alert.css';

type Tone = 'info' | 'success' | 'error' | 'warning';

type Props = {
  tone?: Tone;
  children: ReactNode;
  title?: string;
};

export function Alert({ tone = 'info', children, title }: Props) {
  return (
    <div className={`ui-alert ui-alert--${tone}`} role="alert">
      {title ? <strong>{title}</strong> : null}
      <div>{children}</div>
    </div>
  );
}
