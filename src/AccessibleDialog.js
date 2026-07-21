import React, { useEffect, useRef } from 'react';
import './Modal.css';

/**
 * AccessibleDialog – A reusable wrapper around native <dialog> that handles
 * showModal/close lifecycle and Escape-key support.
 * Extracted from OnlineLobby.js so all modals use the same accessible pattern.
 */
const AccessibleDialog = ({ isOpen, onClose, labelledBy, describedBy, children, className = '' }) => {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) {
        previousFocusRef.current = document.activeElement;
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
        // Restore focus to the element that triggered the dialog
        if (previousFocusRef.current && previousFocusRef.current.focus) {
          previousFocusRef.current.focus();
        }
      }
    }
  }, [isOpen]);

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
    >
      {children}
    </dialog>
  );
};

export default AccessibleDialog;
