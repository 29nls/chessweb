import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDialogFocus } from './useDialogFocus';
import AccessibleDialog from '../AccessibleDialog';
import Modal from '../Modal';

// jsdom doesn't implement the native <dialog> API, so provide minimal stubs.
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = jest.fn(function () { this.setAttribute('open', ''); });
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = jest.fn(function () { this.removeAttribute('open'); });
  }
});

function TestDialog({ isOpen, noFocusable = false }) {
  const ref = useDialogFocus(isOpen);
  return (
    <dialog ref={ref} data-testid="dialog" tabIndex={-1} open={isOpen || undefined}>
      {!noFocusable && (
        <>
          <button type="button">First</button>
          <button type="button">Second</button>
          <button type="button">Third</button>
        </>
      )}
    </dialog>
  );
}

describe('useDialogFocus', () => {
  let trigger;

  beforeEach(() => {
    trigger = document.createElement('button');
    document.body.appendChild(trigger);
  });

  afterEach(() => {
    trigger.remove();
  });

  test('focuses first focusable element when opened', () => {
    const { rerender } = render(<TestDialog isOpen={false} />);
    trigger.focus();
    rerender(<TestDialog isOpen={true} />);

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
  });

  test('focus trap: Tab from last focusable moves to first', () => {
    const { rerender } = render(<TestDialog isOpen={false} />);
    trigger.focus();
    rerender(<TestDialog isOpen={true} />);

    const last = screen.getByRole('button', { name: 'Third' });
    const first = screen.getByRole('button', { name: 'First' });

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });

    expect(document.activeElement).toBe(first);
  });

  test('focus trap: Shift+Tab from first focusable moves to last', () => {
    const { rerender } = render(<TestDialog isOpen={false} />);
    trigger.focus();
    rerender(<TestDialog isOpen={true} />);

    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Third' });

    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(last);
  });

  test('focuses the dialog itself when no focusable children exist', () => {
    const { rerender } = render(<TestDialog isOpen={false} noFocusable />);
    trigger.focus();
    rerender(<TestDialog isOpen={true} noFocusable />);

    expect(document.activeElement).toBe(screen.getByTestId('dialog'));
  });

  test('restores focus to the previously focused element when closed', () => {
    const { rerender } = render(<TestDialog isOpen={false} />);
    trigger.focus();
    rerender(<TestDialog isOpen={true} />);
    rerender(<TestDialog isOpen={false} />);

    expect(document.activeElement).toBe(trigger);
  });
});

describe('AccessibleDialog', () => {
  test('has aria-modal and tabIndex attributes', () => {
    render(
      <AccessibleDialog isOpen={true} onClose={jest.fn()} labelledBy="title">
        <p>content</p>
      </AccessibleDialog>
    );
    const dialog = document.querySelector('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('tabIndex', '-1');
  });
});

describe('Modal', () => {
  test('has aria-modal and tabIndex attributes', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="Title">
        <p>content</p>
      </Modal>
    );
    const dialog = document.querySelector('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('tabIndex', '-1');
  });
});
