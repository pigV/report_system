import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveZoom } from '../src/editor/effective-zoom.mjs';

test('effective zoom combines zoomed ancestors when translating viewport coordinates', () => {
  const document = { defaultView: { getComputedStyle: node => ({ zoom: node.zoom }) } };
  const root = { ownerDocument: document, parentElement: null, zoom: '1.25' };
  const parent = { ownerDocument: document, parentElement: root, zoom: '0.8' };
  const child = { ownerDocument: document, parentElement: parent, zoom: 'normal' };

  assert.equal(effectiveZoom(child), 1);
  assert.equal(effectiveZoom(root), 1.25);
});
