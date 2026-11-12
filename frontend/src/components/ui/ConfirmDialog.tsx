import { useId, type ReactNode } from 'react';
import { Button } from './Button';
import { DialogLayer } from './DialogLayer';
import './ConfirmDialog.css';

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();

  return (
    <DialogLayer
      open={open}
      onClose={onCancel}
      closeOnBackdrop={!danger && !loading}
      closeOnEscape={!loading}
      className="ui-dialog-backdrop"
    >
      <div
        className="ui-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId}>{title}</h2>
        <div className="ui-dialog__body">{children}</div>
        <div className="ui-dialog__actions">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </DialogLayer>
  );
}
