import { describe, expect, it, vi } from 'vitest';
import ko from 'knockout';
import { createEntityPicker } from './entityPicker.js';

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function makePicker(overrides = {}) {
  const searchEntities = overrides.searchEntities || vi.fn(async () => ({ results: [] }));
  const resolveEntity = overrides.resolveEntity || vi.fn(async () => null);
  const onChange = overrides.onChange || vi.fn();
  const picker = createEntityPicker({
    ko,
    debounce: (fn) => fn, // synchronous in tests -- no need to wait out a real debounce window
    searchEntities,
    resolveEntity,
    ctx: async () => ({ host: 'h', userId: 'u', token: 't' }),
    onChange,
    ...overrides,
  });
  return { picker, searchEntities, resolveEntity, onChange };
}

describe('createEntityPicker', () => {
  it('starts with the given initial id/name and no input', () => {
    const { picker } = makePicker({ initialId: '42', initialName: 'Zone HQ' });
    expect(picker.id()).toBe('42');
    expect(picker.name()).toBe('Zone HQ');
    expect(picker.input()).toBe('');
  });

  it('clear() resets the selection and fires onChange', () => {
    const { picker, onChange } = makePicker({ initialId: '42', initialName: 'Zone HQ' });
    picker.clear();
    expect(picker.id()).toBeNull();
    expect(picker.name()).toBe('');
    expect(onChange).toHaveBeenCalledWith(null, '');
  });

  it('selecting a suggestion by keyboard index wins over text auto-match', async () => {
    const { picker, onChange } = makePicker({
      searchEntities: vi.fn(async () => ({
        results: [
          { Id: 1, Name: 'Alpha HQ' },
          { Id: 2, Name: 'Alpha Base' },
        ],
      })),
    });
    picker.input('Alpha');
    picker.onInput();
    await flush();
    const second = picker.suggestions()[1]; // whichever suggestion ranking put second
    picker.suggestionIndex(1); // arrowed down to it
    await picker.select();
    expect(onChange).toHaveBeenCalledWith(second.Id, second.Name);
    expect(picker.input()).toBe('');
    expect(picker.suggestions()).toEqual([]);
  });

  it('falls back to resolveEntity when nothing in suggestions matches, storing the resolved numeric id', async () => {
    const resolveEntity = vi.fn(async () => ({ Id: 99, Name: 'HLS', Code: 'HLS' }));
    const { picker, onChange } = makePicker({ resolveEntity });
    picker.input('hls');
    await picker.select();
    expect(resolveEntity).toHaveBeenCalledWith('hls', expect.any(Object));
    expect(onChange).toHaveBeenCalledWith(99, 'HLS');
    expect(picker.loadError()).toBe('');
  });

  it('sets loadError and does not call onChange when resolveEntity finds nothing', async () => {
    const resolveEntity = vi.fn(async () => null);
    const { picker, onChange } = makePicker({ resolveEntity });
    picker.input('doesnotexist');
    await picker.select();
    expect(onChange).not.toHaveBeenCalled();
    expect(picker.loadError()).toContain('doesnotexist');
  });

  it('drops a stale search response that resolves after a newer one', async () => {
    let resolveFirst;
    const searchEntities = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(async () => ({ results: [{ Id: 2, Name: 'Parramatta HQ' }] }));
    const { picker } = makePicker({ searchEntities });

    picker.input('Par');
    picker.onInput(); // fires the first (slow) search
    picker.input('Parramatta HQ');
    picker.onInput(); // fires the second (fast) search, which resolves first below

    await flush();
    expect(picker.suggestions().map((s) => s.Name)).toEqual(['Parramatta HQ']);

    resolveFirst({ results: [{ Id: 1, Name: 'Parkes' }] }); // the stale first response lands late
    await flush();
    expect(picker.suggestions().map((s) => s.Name)).toEqual(['Parramatta HQ']);
  });

  it('onInputKeydown navigates suggestions and Enter selects the highlighted one', async () => {
    const { picker, onChange } = makePicker({
      searchEntities: vi.fn(async () => ({ results: [{ Id: 1, Name: 'Alpha' }, { Id: 2, Name: 'Beta' }] })),
    });
    picker.input('a');
    picker.onInput();
    await flush();

    picker.onInputKeydown(null, { key: 'ArrowDown', preventDefault: vi.fn() });
    expect(picker.suggestionIndex()).toBe(0);
    picker.onInputKeydown(null, { key: 'ArrowDown', preventDefault: vi.fn() });
    expect(picker.suggestionIndex()).toBe(1);

    await picker.onInputKeydown(null, { key: 'Enter', preventDefault: vi.fn() });
    expect(onChange).toHaveBeenCalledWith(2, 'Beta');
  });

  it('onInputKeydown Escape dismisses suggestions without selecting', () => {
    const { picker, onChange } = makePicker();
    picker.suggestions([{ Id: 1, Name: 'Alpha' }]);
    picker.onInputKeydown(null, { key: 'Escape', preventDefault: vi.fn() });
    expect(picker.suggestions()).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('pickSuggestion sets the selection directly and clears input/suggestions', () => {
    const { picker, onChange } = makePicker();
    picker.input('al');
    picker.suggestions([{ Id: 5, Name: 'Alpha' }]);
    picker.pickSuggestion({ Id: 5, Name: 'Alpha' });
    expect(onChange).toHaveBeenCalledWith(5, 'Alpha');
    expect(picker.input()).toBe('');
    expect(picker.suggestions()).toEqual([]);
  });

  describe('onBlur (tab/click away)', () => {
    it('dismisses the dropdown shortly after blur, not instantly (so a click on a suggestion still registers)', () => {
      vi.useFakeTimers();
      try {
        const { picker } = makePicker();
        picker.suggestions([{ Id: 1, Name: 'Alpha' }]);
        picker.onBlur();
        expect(picker.suggestions()).toEqual([{ Id: 1, Name: 'Alpha' }]); // still visible immediately after blur
        vi.advanceTimersByTime(150);
        expect(picker.suggestions()).toEqual([]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('drops a search response that resolves after the field was blurred, so the dropdown does not reopen', async () => {
      let resolveSearch;
      const searchEntities = vi.fn(() => new Promise((resolve) => { resolveSearch = resolve; }));
      const { picker } = makePicker({ searchEntities });

      picker.input('Alpha');
      picker.onInput(); // fires the (still-pending) search
      await flush(); // let the async ctx()/searchEntities call actually start
      vi.useFakeTimers();
      try {
        picker.onBlur(); // tab away before the response lands
        vi.advanceTimersByTime(150);
      } finally {
        vi.useRealTimers();
      }

      resolveSearch({ results: [{ Id: 1, Name: 'Alpha HQ' }] });
      await flush();
      expect(picker.suggestions()).toEqual([]);
    });

    it('typing again after a blur re-arms the dropdown', async () => {
      const { picker } = makePicker({
        searchEntities: vi.fn(async () => ({ results: [{ Id: 1, Name: 'Alpha' }] })),
      });
      vi.useFakeTimers();
      try {
        picker.onBlur();
        vi.advanceTimersByTime(150);
      } finally {
        vi.useRealTimers();
      }

      picker.input('a');
      picker.onInput();
      await flush();
      expect(picker.suggestions()).toEqual([{ Id: 1, Name: 'Alpha' }]);
    });
  });
});
