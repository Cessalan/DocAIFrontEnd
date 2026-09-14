import { paperOriginStyle, paperMode } from './paperTransition';

/* The failure this file exists for: the frames are viewport rects, but
   clip-path resolves against the animating element's own border box. Study
   mode's container is inset by the sidebar, so an un-offset origin makes the
   sheet unfold from a point that drifts as the sidebar opens and closes —
   visible only to a human looking at a real screen. */

const firstPoint = path => path.match(/M ([\d.-]+) ([\d.-]+)/).slice(1).map(Number);
const bounds = { left: 260, top: 0, width: 1000, height: 800 };

test('the fold starts at the tapped rect, expressed in the sheet own box', () => {
  const origin = { left: 460, top: 120, width: 200, height: 60 };
  const [x, y] = firstPoint(paperOriginStyle(origin, bounds)['--paper-source']);
  // 460 - 260 = 200, plus the 22px corner radius the contour starts after.
  expect(x).toBe(222);
  expect(y).toBe(120);
});

test('an origin outside the sheet is clamped rather than thrown off-screen', () => {
  // A control in the sidebar, left of the container entirely.
  const [x] = firstPoint(paperOriginStyle({ left: 20, top: 400, width: 120, height: 40 }, bounds)['--paper-source']);
  expect(x).toBe(22);
  const style = paperOriginStyle({ left: 3000, top: 4000, width: 200, height: 60 }, bounds);
  expect(style['--paper-source']).toContain('1000');
});

test('a programmatic launch with no origin falls back to a centred sheet', () => {
  const centred = paperOriginStyle(null, bounds);
  const [x, y] = firstPoint(centred['--paper-source']);
  expect(x).toBe(1000 * .3 + 22);
  expect(y).toBe(800 * .3);
  // A zero-sized rect is the same thing: a detached or unlaid-out element.
  expect(paperOriginStyle({ left: 10, top: 10, width: 0, height: 0 }, bounds)).toEqual(centred);
});

test('the sheet always ends up filling its own box, not the viewport', () => {
  const full = paperOriginStyle({ left: 460, top: 120, width: 200, height: 60 }, bounds)['--paper-full'];
  expect(full).toContain('M 0 0');
  expect(full).toContain('1000');
  expect(full).toContain('800');
});

test('the shading is anchored to the same foot the silhouette is pinched at', () => {
  const style = paperOriginStyle({ left: 460, top: 120, width: 200, height: 60 }, bounds);
  // The rect spans 460..660; in the sheet's own space that is 200..400.
  expect(style['--paper-foot-x']).toBe('300px');
  expect(style['--paper-foot-width']).toBe('200px');
  expect(style['--paper-foot-y']).toBe('180px');
  expect(style['--paper-height']).toBe('800px');
});

describe('paperMode', () => {
  const nav = navigator;
  const set = value => Object.defineProperty(window, 'navigator', { value: { ...nav, ...value }, configurable: true });
  afterEach(() => { Object.defineProperty(window, 'navigator', { value: nav, configurable: true }); window.localStorage.clear(); });

  test('a machine with little to spare gets the compositor-only open', () => {
    set({ hardwareConcurrency: 4, deviceMemory: 4 });
    expect(paperMode()).toBe('simple');
  });

  test('a capable machine gets the fold', () => {
    set({ hardwareConcurrency: 12, deviceMemory: 16 });
    expect(paperMode()).toBe('full');
  });

  test('the override wins, so a slow machine can be diagnosed by hand', () => {
    set({ hardwareConcurrency: 12, deviceMemory: 16 });
    window.localStorage.setItem('nqPaperFold', 'plain');
    expect(paperMode()).toBe('plain');
    window.localStorage.setItem('nqPaperFold', 'nonsense');
    expect(paperMode()).toBe('full');
  });
});
