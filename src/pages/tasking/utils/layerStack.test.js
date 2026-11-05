// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import L from 'leaflet';
import {
    clampOpacityPct, defaultStackIds, insertStackId, mergeKnownOrder, normaliseStackIds,
    stackZIndexes, installStackPaneRemap, overlayPaneName,
} from './layerStack.js';

describe('clampOpacityPct', () => {
    it('rounds and clamps to 10-100', () => {
        expect(clampOpacityPct('55')).toBe(55);
        expect(clampOpacityPct(4)).toBe(10);
        expect(clampOpacityPct(140)).toBe(100);
        expect(clampOpacityPct('x')).toBe(100);
    });
});

describe('insertStackId', () => {
    const kinds = { 'ov:radar': 'tiles', 'ov:sat': 'tiles', 'ov:zones': 'vector' };
    const kindOf = (id) => kinds[id];

    it('puts collaborative layers just above asset markers', () => {
        const ids = ['pane-tippy-top', 'ov:c1', 'pane-top', 'ov:zones'];
        expect(insertStackId(ids, 'ov:c2', 'collab', kindOf))
            .toEqual(['pane-tippy-top', 'ov:c1', 'ov:c2', 'pane-top', 'ov:zones']);
    });

    it('puts tile layers at the bottom', () => {
        expect(insertStackId(defaultStackIds(), 'ov:radar', 'tiles', kindOf))
            .toEqual(['pane-tippy-top', 'pane-top', 'lh-drawn', 'ov:radar']);
    });

    it('puts vector layers above the first tile layer', () => {
        const ids = ['pane-tippy-top', 'pane-top', 'ov:zones', 'ov:radar', 'ov:sat'];
        expect(insertStackId(ids, 'ov:power', 'vector', kindOf))
            .toEqual(['pane-tippy-top', 'pane-top', 'ov:zones', 'ov:power', 'ov:radar', 'ov:sat']);
    });
});

describe('mergeKnownOrder', () => {
    it('reorders known ids in their own slots and leaves the rest in place', () => {
        const ids = ['a', 'ghost', 'b', 'c'];
        expect(mergeKnownOrder(ids, ['c', 'a', 'b'])).toEqual(['c', 'ghost', 'a', 'b']);
    });

    it('appends known ids that were missing', () => {
        expect(mergeKnownOrder(['a'], ['a', 'b'])).toEqual(['a', 'b']);
    });
});

describe('normaliseStackIds', () => {
    it('reads an old marker-pane order, dropping the panes no longer listed', () => {
        const old = ['pane-top', 'pane-tippy-top', 'pane-collab', 'pane-middle', 'pane-lowest'];
        expect(normaliseStackIds(old)).toEqual(['pane-top', 'pane-tippy-top', 'lh-drawn']);
    });

    it('keeps overlay ids and adds missing built-in panes at their default position', () => {
        expect(normaliseStackIds(['ov:a', 'pane-top', 'ov:a', 7])).toEqual(['ov:a', 'pane-tippy-top', 'pane-top', 'lh-drawn']);
        expect(normaliseStackIds(undefined)).toEqual(defaultStackIds());
    });
});

describe('stackZIndexes', () => {
    it('matches the old fixed panes for a short list', () => {
        expect(stackZIndexes(5)).toEqual([700, 600, 500, 400, 300]);
    });

    it('keeps rows at least 4 apart, top highest', () => {
        const zs = stackZIndexes(60);
        expect(zs[0]).toBe(700);
        for (let i = 1; i < zs.length; i++) expect(zs[i - 1] - zs[i]).toBeGreaterThanOrEqual(4);
    });
});

describe('installStackPaneRemap', () => {
    const makeMap = () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        return L.map(el).setView([-33.8, 151.2], 10);
    };

    it("draws an overlay's layers into its own pane container, keeping their relative order", () => {
        const map = makeMap();
        const attach = installStackPaneRemap(L, map);
        const group = L.layerGroup();
        attach(group, 'zones');
        group.addTo(map);

        const poly = L.polygon([[-33.8, 151.2], [-33.9, 151.3], [-33.7, 151.3]], { pane: 'pane-lowest' });
        const labels = L.geoJSON(null, { pointToLayer: (_, ll) => L.marker(ll, { pane: 'pane-middle' }) });
        group.addLayer(poly);
        group.addLayer(labels);
        labels.addData({ type: 'Feature', geometry: { type: 'Point', coordinates: [151.2, -33.8] }, properties: {} });

        const container = map.getPane(overlayPaneName('zones'));
        expect(poly.options.pane).toBe('ov-zones--pane-lowest');
        expect(map.getPane('ov-zones--pane-lowest').parentNode).toBe(container);
        const marker = labels.getLayers()[0];
        expect(marker.options.pane).toBe('ov-zones--pane-middle');
        expect(container.contains(marker.getElement())).toBe(true);
        expect(Number(map.getPane('ov-zones--pane-middle').style.zIndex))
            .toBeGreaterThan(Number(map.getPane('ov-zones--pane-lowest').style.zIndex));
        map.remove();
    });

    it('leaves groups that are not overlays alone', () => {
        const map = makeMap();
        installStackPaneRemap(L, map);
        const m = L.marker([-33.8, 151.2], { pane: 'markerPane' });
        L.layerGroup().addTo(map).addLayer(m);
        expect(m.options.pane).toBe('markerPane');
        map.remove();
    });
});
