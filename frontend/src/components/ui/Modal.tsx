import type { ReactNode } from 'react';
import './Modal.css';

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  width?: 'md' | 'lg';
};

export function Modal({ open, title, children, onClose, width = 'md' }: Props) {
  if (!open) return null;

  return (
    <div className="ui-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`ui-modal ui-modal--${width}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ui-modal__header">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="ui-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="ui-modal__body">{children}</div>
      </div>
    </div>
  );
}
