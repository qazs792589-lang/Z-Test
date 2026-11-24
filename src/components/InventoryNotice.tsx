import { useEffect, useRef } from 'react';

export function InventoryNotice({ message, theme, onClose }: {
  message: string;
  theme: 'gold' | 'cyan' | 'ocean' | 'light' | 'zen';
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return (
    <dialog ref={ref} role="alertdialog" data-theme={theme}
      aria-labelledby="inventory-notice-title" aria-describedby="inventory-notice-message"
      onCancel={event => { event.preventDefault(); onClose(); }}
      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)', borderColor: 'var(--border)', colorScheme: theme === 'light' || theme === 'zen' ? 'light' : 'dark' }}
      className="inventory-notice m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-2xl border p-6">
      <h2 id="inventory-notice-title" className="text-lg font-bold mb-3">目前股數餘額不足</h2>
      <p id="inventory-notice-message" className="text-sm leading-6" style={{ color: 'var(--text-dim)' }}>{message}</p>
      <button autoFocus type="button" onClick={onClose}
        style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
        className="mt-5 w-full rounded-xl px-4 py-3 font-bold">知道了</button>
    </dialog>
  );
}
