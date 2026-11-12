import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { acquireDialogLock, isTopDialog, releaseDialogLock } from './dialogLock';
import './DialogLayer.css';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type Props = {
  open: boolean;
  children: ReactNode;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  className?: string;
};

function focusableElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((node) => {
    if (node.getAttribute('aria-hidden') === 'true') return false;
    if (node.tabIndex < 0) return false;
    return node.getClientRects().length > 0;
  });
}

function dialogPanel(root: HTMLElement) {
  return (
    root.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]') || root
  );
}

export function DialogLayer({
  open,
  children,
  onClose,
  closeOnBackdrop = true,
  closeOnEscape = true,
  className = '',
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const layerIdRef = useRef<number | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const pointerOnBackdropRef = useRef(false);
  const [zIndex, setZIndex] = useState<number | undefined>();

  useLayoutEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const layer = acquireDialogLock();
    layerIdRef.current = layer.id;
    setZIndex(layer.zIndex);
    const frame = window.requestAnimationFrame(() => {
      const root = rootRef.current;
      if (!root) return;
      dialogPanel(root).focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (layerIdRef.current != null) {
        releaseDialogLock(layerIdRef.current);
        layerIdRef.current = null;
      }
      setZIndex(undefined);
      const previous = previousFocusRef.current;
      previousFocusRef.current = null;
      if (previous && document.contains(previous)) {
        previous.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event: KeyboardEvent) {
      const id = layerIdRef.current;
      if (id == null || !isTopDialog(id)) return;
      const root = rootRef.current;
      if (!root) return;

      if (event.key === 'Escape') {
        if (!closeOnEscape || !onClose) return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const panel = dialogPanel(root);
      const nodes = focusableElements(root);
      if (nodes.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      const inside = root.contains(active);
      if (event.shiftKey && (active === first || active === panel || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    pointerOnBackdropRef.current = event.target === event.currentTarget;
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    const clickedBackdrop = pointerOnBackdropRef.current && event.target === event.currentTarget;
    pointerOnBackdropRef.current = false;
    if (clickedBackdrop && closeOnBackdrop) {
      onClose?.();
    }
  }

  return createPortal(
    <div
      ref={rootRef}
      className={`ui-dialog-layer ${className}`.trim()}
      style={zIndex != null ? { zIndex } : undefined}
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      {children}
    </div>,
    document.body
  );
}
