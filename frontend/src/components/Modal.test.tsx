import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders a dialog with the given title', () => {
    render(
      <Modal title="Edit item" onClose={() => undefined}>
        <p>Body content</p>
      </Modal>
    );

    expect(screen.getByRole('dialog', { name: 'Edit item' })).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('closes on Escape when not busy', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Confirm" onClose={onClose}>
        <button type="button">OK</button>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on Escape while busy', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Saving" onClose={onClose} busy>
        <button type="button">Wait</button>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
