import React, { useEffect, useRef } from 'react';
import './Modal.css';

const Modal = ({ isOpen, onClose, title, children }) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [isOpen]);

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
  }, [onClose]);

  return (
    <dialog ref={dialogRef} className="modal-dialog" aria-labelledby="modal-title">
      <div className="modal-content">
        <div className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="modal-close-button" onClick={onClose} aria-label="Close dialog">
            &times;
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </dialog>
  );
};

export default Modal;