import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@tiptap/pm/state';
import { templateSchema, moveFieldTransaction } from '../src/editor/template-schema.mjs';
import { seedTemplate, moveField, fieldsFor } from '../src/report-model.mjs';

const ids = doc => fieldsFor(doc).map(field => field.attrs.fieldId);

function drag(doc, from, to) {
  const state = EditorState.create({ schema: templateSchema, doc: templateSchema.nodeFromJSON(doc) });
  const tr = moveFieldTransaction(state, from, to);
  assert.ok(tr, `expected a transaction for ${from} -> ${to}`);
  return state.apply(tr).doc.toJSON();
}

test('field drag lands where the binding list would move it', () => {
  const doc = seedTemplate('a').header;
  const list = ids(doc);
  assert.deepEqual(ids(drag(doc, list[0], list[2])), ids(moveField(doc, list[0], list[2])));
  assert.deepEqual(ids(drag(doc, list.at(-1), list[0])), ids(moveField(doc, list.at(-1), list[0])));
});

test('field drag ignores identical and unknown targets', () => {
  const doc = seedTemplate('a').header;
  const state = EditorState.create({ schema: templateSchema, doc: templateSchema.nodeFromJSON(doc) });
  const list = ids(doc);
  assert.equal(moveFieldTransaction(state, list[0], list[0]), null);
  assert.equal(moveFieldTransaction(state, 'missing_field', list[0]), null);
});
