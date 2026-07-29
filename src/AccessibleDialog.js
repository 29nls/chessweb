import React, { useEffect } from 'react';
import './Modal.css';
import { useDialogFocus } from './hooks/useDialogFocus';

/**
 * AccessibleDialog – A reusable wrapper around native <dialog> that handles
 * showModal/close lifecycle and Escape-key support.
 * Extracted from OnlineLobby.js so all modals use the same accessible pattern.
 */
const AccessibleDialog = ({ isOpen, onClose, labelledBy, describedBy, children, className = '' }) => {
  const dialogRef = useDialogFocus(isOpen);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen, dialogRef]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e) => { e.preventDefault(); onClose(); };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  // Click outside to close (click on backdrop)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClick = (e) => {
      if (e.target === dialog) onClose();
    };
    dialog.addEventListener('click', handleClick);
    return () => dialog.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className={`accessible-dialog ${className}`}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-modal="true"
      tabIndex={-1}
    >
      {children}
    </dialog>
  );
};

export default AccessibleDialog;
