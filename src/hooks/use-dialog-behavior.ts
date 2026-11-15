'use client';

import { useEffect, useId, useRef } from 'react';

/**
 * 共享弹窗行为：
 * - 打开时把焦点移入弹窗，关闭后归还；
 * - Escape 关闭最上层弹窗；
 * - Tab / Shift+Tab 在弹窗内循环；
 * - 锁定 body 滚动（支持弹窗嵌套，只有全部关闭后恢复）。
 *
 * 返回的 ref 需要挂到 role="dialog" 的容器上。
 */
const dialogStack: string[] = [];
let overflowBeforeOpen = '';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDialogBehavior(open: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const id = useId();

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    dialogStack.push(id);
    if (dialogStack.length === 1) {
      overflowBeforeOpen = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    const getFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));

    const focusFirst = () => {
      const items = getFocusable();
      (items[0] ?? dialog).focus({ preventScroll: true });
    };

    // 等一帧，确保弹窗内容已经挂载/可聚焦。
    const raf = requestAnimationFrame(focusFirst);

    const handleKeyDown = (event: KeyboardEvent) => {
      // 只让最上层弹窗响应键盘事件（充值 -> VIP 这种嵌套场景）。
      if (dialogStack[dialogStack.length - 1] !== id) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const items = getFocusable();
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown, true);

      const index = dialogStack.lastIndexOf(id);
      if (index !== -1) dialogStack.splice(index, 1);
      if (dialogStack.length === 0) {
        document.body.style.overflow = overflowBeforeOpen;
      }

      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [open, id]);

  return dialogRef;
}
