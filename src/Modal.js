import React, { useEffect } from 'react';
import './Modal.css';
import { useDialogFocus } from './hooks/useDialogFocus';

const Modal = ({ isOpen, onClose, title, children }) => {
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

  // Allow Escape key to trigger onClose callback
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose, dialogRef]);

  // Close when the user clicks on the dialog backdrop
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClick = (e) => {
      if (e.target === dialog) onClose();
    };
    dialog.addEventListener('click', handleClick);
    return () => dialog.removeEventListener('click', handleClick);
  }, [onClose, dialogRef]);

  return (
    <dialog
      ref={dialogRef}
      className="modal-dialog"
      aria-labelledby="modal-title"
      aria-describedby="modal-desc"
      aria-modal="true"
      tabIndex={-1}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="modal-close-button" onClick={onClose} aria-label="Close dialog">
            &times;
          </button>
        </div>
        <div className="modal-body" id="modal-desc">
          {children}
        </div>
      </div>
    </dialog>
  );
};

export default Modal;