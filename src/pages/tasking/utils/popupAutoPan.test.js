// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { initPopupAutoPan } from './popupAutoPan.js';

const MIN_PADDING = 16;
const EXTRA_MARGIN = 8;

function rect({ top, left, right, bottom }) {
  return { top, left, right, bottom, width: right - left, height: bottom - top };
}

/**
 * Builds a fake Leaflet map: a container with the four standard corner
 * divs, wired so getBoundingClientRect() on the container and any corner
 * returns the values from `rects` (jsdom itself never computes layout).
 */
function fakeMap({ containerRect, corners = {} }) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(rect(containerRect));

  const cornerClasses = {
    topleft: 'leaflet-top leaflet-left',
    topright: 'leaflet-top leaflet-right',
    bottomleft: 'leaflet-bottom leaflet-left',
    bottomright: 'leaflet-bottom leaflet-right',
  };

  for (const [key, className] of Object.entries(cornerClasses)) {
    const el = document.createElement('div');
    el.className = className;
    container.appendChild(el);
    if (corners[key]) {
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect(corners[key]));
    } else {
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect({ top: 0, left: 0, right: 0, bottom: 0 }));
    }
  }

  return { getContainer: () => container };
}

describe('initPopupAutoPan', () => {
  it('defaults every side to MIN_PADDING with nothing docked in any corner', () => {
    const map = fakeMap({ containerRect: { top: 0, left: 0, right: 1000, bottom: 800 } });
    const { topLeft, bottomRight } = initPopupAutoPan(map);
    expect(topLeft.x).toBe(MIN_PADDING);
    expect(topLeft.y).toBe(MIN_PADDING);
    expect(bottomRight.x).toBe(MIN_PADDING);
    expect(bottomRight.y).toBe(MIN_PADDING);
  });

  it('grows top padding to clear a control docked in the top-left corner, plus EXTRA_MARGIN', () => {
    const map = fakeMap({
      containerRect: { top: 0, left: 0, right: 1000, bottom: 800 },
      corners: { topleft: { top: 0, left: 0, right: 100, bottom: 50 } },
    });
    const { topLeft } = initPopupAutoPan(map);
    expect(topLeft.y).toBe(50 + EXTRA_MARGIN); // rect.bottom - mapRect.top + EXTRA_MARGIN
    expect(topLeft.x).toBe(100 + EXTRA_MARGIN); // also widens left padding (it's in leaflet-left)
  });

  it('grows bottom-right padding to clear a control docked in the bottom-right corner', () => {
    const map = fakeMap({
      containerRect: { top: 0, left: 0, right: 1000, bottom: 800 },
      corners: { bottomright: { top: 700, left: 850, right: 1000, bottom: 800 } },
    });
    const { bottomRight } = initPopupAutoPan(map);
    expect(bottomRight.y).toBe(100 + EXTRA_MARGIN); // mapRect.bottom - rect.top + EXTRA_MARGIN
    expect(bottomRight.x).toBe(150 + EXTRA_MARGIN); // mapRect.right - rect.left + EXTRA_MARGIN
  });

  it('caps a single corner control at MAX_PADDING_SHARE of the map dimension', () => {
    const map = fakeMap({
      containerRect: { top: 0, left: 0, right: 1000, bottom: 800 },
      // An oversized top-left control that would otherwise demand ~90% of the height.
      corners: { topleft: { top: 0, left: 0, right: 50, bottom: 720 } },
    });
    const { topLeft } = initPopupAutoPan(map);
    expect(topLeft.y).toBeLessThanOrEqual(800 * 0.35);
  });

  it('shrinks opposing paddings proportionally so a popup still fits across the axis (fitPadding)', () => {
    // Both top and bottom controls are large enough that, uncapped, their
    // combined padding would leave no room for a MIN_POPUP_HEIGHT (320px)
    // popup on an 800px-tall map -- fitPadding should scale them down
    // together (never below MIN_PADDING) rather than let autoPan stall.
    const map = fakeMap({
      containerRect: { top: 0, left: 0, right: 1000, bottom: 800 },
      corners: {
        topleft: { top: 0, left: 0, right: 50, bottom: 260 },     // ~268px top padding pre-cap
        bottomleft: { top: 560, left: 0, right: 50, bottom: 800 }, // ~248px bottom padding pre-cap
      },
    });
    const { topLeft, bottomRight } = initPopupAutoPan(map);
    expect(topLeft.y + bottomRight.y).toBeLessThanOrEqual(800 - 320 + 1); // room left for MIN_POPUP_HEIGHT
    expect(topLeft.y).toBeGreaterThanOrEqual(MIN_PADDING);
    expect(bottomRight.y).toBeGreaterThanOrEqual(MIN_PADDING);
  });

  it('does not touch bottom padding when only a top corner is occupied', () => {
    const map = fakeMap({
      containerRect: { top: 0, left: 0, right: 1000, bottom: 800 },
      corners: { topright: { top: 0, left: 900, right: 1000, bottom: 40 } },
    });
    const { bottomRight } = initPopupAutoPan(map);
    expect(bottomRight.y).toBe(MIN_PADDING);
  });

  it('unions a corner control with its descendants that escape its own box (e.g. an absolutely-positioned flyout)', () => {
    const map = fakeMap({
      containerRect: { top: 0, left: 0, right: 1000, bottom: 800 },
      corners: { topleft: { top: 0, left: 0, right: 40, bottom: 40 } }, // small collapsed control
    });
    const container = map.getContainer();
    const topleft = container.querySelector('.leaflet-top.leaflet-left');
    const flyout = document.createElement('div');
    topleft.appendChild(flyout);
    vi.spyOn(flyout, 'getBoundingClientRect').mockReturnValue(rect({ top: 0, left: 0, right: 300, bottom: 40 }));

    const { topLeft } = initPopupAutoPan(map);
    expect(topLeft.x).toBe(300 + EXTRA_MARGIN); // widened by the flyout, not just the 40px collapsed box
  });

  it('returns a working recompute() that can be called again after the DOM changes', () => {
    const map = fakeMap({ containerRect: { top: 0, left: 0, right: 1000, bottom: 800 } });
    const { topLeft, recompute } = initPopupAutoPan(map);
    expect(topLeft.y).toBe(MIN_PADDING);

    const container = map.getContainer();
    const topleft = container.querySelector('.leaflet-top.leaflet-left');
    vi.spyOn(topleft, 'getBoundingClientRect').mockReturnValue(rect({ top: 0, left: 0, right: 60, bottom: 60 }));
    recompute();
    expect(topLeft.y).toBe(60 + EXTRA_MARGIN);
  });
});
