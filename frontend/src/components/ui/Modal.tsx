import { useId, type ReactNode } from 'react';
import { DialogLayer } from './DialogLayer';
import './Modal.css';

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  width?: 'md' | 'lg';
};

export function Modal({ open, title, children, onClose, width = 'md' }: Props) {
  const titleId = useId();

  return (
    <DialogLayer open={open} onClose={onClose} className="ui-modal-backdrop">
      <div
        className={`ui-modal ui-modal--${width}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="ui-modal__header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="ui-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="ui-modal__body">{children}</div>
      </div>
    </DialogLayer>
  );
}
