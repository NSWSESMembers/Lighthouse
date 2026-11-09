import { describe, it, expect } from 'vitest';
import { TASKING_CONFIG_KEY, taskingConfigKey } from './taskingConfigStorage.js';

describe('taskingConfigKey', () => {
  it('keeps the original key for production and unknown environments', () => {
    expect(taskingConfigKey('production')).toBe(TASKING_CONFIG_KEY);
    expect(taskingConfigKey(null)).toBe(TASKING_CONFIG_KEY);
  });

  it('gives every other environment its own key', () => {
    expect(new Set(['train', 'test', 'dev'].map(taskingConfigKey)).size).toBe(3);
    expect(taskingConfigKey('train')).not.toBe(TASKING_CONFIG_KEY);
  });
});
