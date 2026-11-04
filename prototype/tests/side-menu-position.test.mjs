import test from 'node:test';
import assert from 'node:assert/strict';
import { sideMenuOffset } from '../src/editor/side-menu-position.mjs';

test('menu stays left of the current block when the editor is zoomed', () => {
  const settings = {
    rect: { right: 538.75, top: 577.25, height: 32.5 },
    view: { top: 570, bottom: 950 },
    anchorLeft: 441.25,
    anchorTop: 580,
    previous: { x: 0, y: 0 },
    menuScale: 1.25,
    editorScale: 1.25,
  };
  const offset = sideMenuOffset(settings);
  assert.equal(settings.rect.right + offset.x * settings.menuScale, 428.75);
  assert.equal(settings.rect.top + offset.y * settings.menuScale, 580);

  const moved = {
    ...settings,
    rect: { ...settings.rect, right: 428.75, top: 580 },
    previous: offset,
  };
  assert.deepEqual(sideMenuOffset(moved), offset);
});

test('menu remains within the editor vertically after the block moves', () => {
  const offset = sideMenuOffset({
    rect: { right: 343, top: 500, height: 26 },
    view: { top: 400, bottom: 600 },
    anchorLeft: 353,
    anchorTop: 590,
    previous: { x: 0, y: 0 },
    menuScale: 1,
    editorScale: 1,
  });
  assert.equal(offset.x, 0);
  assert.equal(offset.y, 74);
});
