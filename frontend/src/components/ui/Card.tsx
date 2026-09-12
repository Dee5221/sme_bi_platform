import type { ReactNode } from 'react';
import './Card.css';

type Props = {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
};

export function Card({ children, className = '', title, action }: Props) {
  return (
    <section className={`ui-card ${className}`.trim()}>
      {(title || action) && (
        <header className="ui-card__header">
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </header>
      )}
      <div className="ui-card__body">{children}</div>
    </section>
  );
}
