import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled]):not([tabindex="-1"])',
  'a[href]:not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[contenteditable]:not([tabindex="-1"])',
  'details > summary:not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusable(dialog) {
  return Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR));
}

/**
 * useDialogFocus – Manage focus for a native `<dialog>` modal.
 *
 * When `isOpen` becomes true the hook:
 * - Records the previously focused element for later restoration.
 * - Focuses the first focusable element inside the dialog, or the dialog itself.
 *
 * When `isOpen` becomes false it restores focus to the previously focused element.
 *
 * While open it traps focus with Tab/Shift+Tab so keyboard users cannot leave the modal.
 *
 * @param {boolean} isOpen - Whether the dialog is open.
 * @returns {React.RefObject<HTMLDialogElement>} ref to attach to the `<dialog>` element.
 */
export function useDialogFocus(isOpen) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Auto-focus and restore focus
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      const focusable = getFocusable(dialog);
      if (focusable.length > 0) {
        // Focus first interactive element. If it is the close button, users can
        // still tab to other controls immediately.
        focusable[0].focus({ preventScroll: true });
      } else {
        dialog.focus({ preventScroll: true });
      }
    } else if (previousFocusRef.current && previousFocusRef.current.focus) {
      // Restore focus when the modal closes.
      previousFocusRef.current.focus({ preventScroll: true });
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  // Restore focus if the dialog is unmounted while still open
  useEffect(() => {
    return () => {
      if (previousFocusRef.current && previousFocusRef.current.focus) {
        previousFocusRef.current.focus({ preventScroll: true });
        previousFocusRef.current = null;
      }
    };
  }, []);

  // Focus trap
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== 'Tab') return;

      const focusable = getFocusable(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return dialogRef;
}
