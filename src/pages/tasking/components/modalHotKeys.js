// hotkeys/modalHotKeys.js
export function installModalHotkeys({
  modalEl,
  onSave,
  onClose,
  allowInInputs = false
}) {
  if (!modalEl) return;

  const handler = (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    const isInput = ['input', 'textarea', 'select'].includes(tag);
    if (isInput && !allowInInputs && !(e.ctrlKey || e.metaKey)) return;

    // ESC → close
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose?.();
    }

    // Ctrl/Cmd + Enter → save
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onSave?.();
    }
  };

  modalEl.addEventListener('keydown', handler);
  modalEl.addEventListener(
    'hidden.bs.modal',
    () => modalEl.removeEventListener('keydown', handler),
    { once: true }
  );
}
