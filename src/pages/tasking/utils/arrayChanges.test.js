import { describe, it, expect } from 'vitest';
import ko from 'knockout';
import { subscribeMembership } from './arrayChanges.js';

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('subscribeMembership', () => {
    it('reports only items that joined or left', () => {
        const list = ko.observableArray(range(1, 30));
        const calls = [];
        subscribeMembership(list, (c) => calls.push(c));
        // Two leave, three join. KO's own arrayChange diff reports most of
        // 3..30 as moved delete/add pairs here.
        list(range(3, 33));
        expect(calls).toEqual([{ added: [31, 32, 33], removed: [1, 2] }]);
    });

    it('treats items present at subscribe time as handled', () => {
        const list = ko.observableArray(['a', 'b']);
        const calls = [];
        subscribeMembership(list, (c) => calls.push(c));
        list(['b', 'c']);
        expect(calls).toEqual([{ added: ['c'], removed: ['a'] }]);
    });

    it('ignores reorders and unchanged values', () => {
        const list = ko.observableArray(['a', 'b', 'c']);
        const calls = [];
        subscribeMembership(list, (c) => calls.push(c));
        list(['c', 'a', 'b']);
        list.valueHasMutated();
        expect(calls).toEqual([]);
    });

    it('follows a rate-limited pure computed', async () => {
        const src = ko.observableArray([1, 2, 3]);
        const filtered = ko.pureComputed(() => src().filter(n => n % 2))
            .extend({ rateLimit: { timeout: 1, method: 'notifyWhenChangesStop' } });
        const calls = [];
        subscribeMembership(filtered, (c) => calls.push(c));
        src.push(5);
        src.remove(1);
        await new Promise(r => setTimeout(r, 20));
        expect(calls).toEqual([{ added: [5], removed: [1] }]);
    });
});
