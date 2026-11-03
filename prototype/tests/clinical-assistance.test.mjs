import test from 'node:test';
import assert from 'node:assert/strict';
import {historyFor, filterTemplates} from '../src/clinical-assistance.mjs';

test('history is restricted to hospital, case and patient identity, with an empty case',()=>{
  const entries=historyFor('a','a-1','A000128');
  assert.equal(entries.length,3);
  assert.ok(entries[0].date>entries[1].date);
  assert.deepEqual(historyFor('a','a-1','B000082'),[]);
  assert.deepEqual(historyFor('b','a-1','A000128'),[]);
  assert.deepEqual(historyFor('a','a-2','A000129'),[]);
  assert.equal(historyFor('b','b-1','B000082').length,3);
});
test('template search combines category and trimmed case-insensitive keywords',()=>{
  assert.equal(filterTemplates('  ct  ','胸部').length,2);
  assert.equal(filterTemplates('CT','腹部').length,0);
  assert.equal(filterTemplates('不存在').length,0);
  assert.equal(filterTemplates('随访')[0].id,'chest-followup');
});
