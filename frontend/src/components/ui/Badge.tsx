import type { ReactNode } from 'react';
import './Badge.css';

type Props = {
  children: ReactNode;
  tone?: 'neutral' | 'blue' | 'green' | 'orange' | 'red';
};

export function Badge({ children, tone = 'neutral' }: Props) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}
