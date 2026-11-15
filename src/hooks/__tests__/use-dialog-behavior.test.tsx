import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useDialogBehavior } from '@/hooks/use-dialog-behavior';

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useDialogBehavior(open, () => {
    setOpen(false);
    onClose();
  });

  return (
    <div>
      <button onClick={() => setOpen(true)}>打开弹窗</button>
      {open && (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="测试弹窗" tabIndex={-1}>
          <button>第一个</button>
          <button>最后一个</button>
        </div>
      )}
    </div>
  );
}

describe('useDialogBehavior', () => {
  it('locks body scroll, focuses inside, closes on Escape and restores overflow', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: '打开弹窗' }));

    await waitFor(() => {
      expect(document.body.style.overflow).toBe('hidden');
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: '第一个' }));
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe('');
  });

  it('traps Tab between the first and last focusable element', async () => {
    render(<Harness onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '打开弹窗' }));

    const first = screen.getByRole('button', { name: '第一个' });
    const last = screen.getByRole('button', { name: '最后一个' });
    await waitFor(() => expect(document.activeElement).toBe(first));

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
