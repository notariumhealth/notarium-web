// Run: node --test tools/test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from './render.mjs';

test('trailing single-line dash block is the signature', () => {
  const { sections } = parse('# T\n\nlead\n\n## S\n\nbody\n\n- Sophia');
  assert.equal(sections[0].signature, '- Sophia');
  assert.equal(sections[0].blocks.length, 1);
});

test('multi-line dash block is a list, not a signature', () => {
  const md = '# T\n\nlead\n\n## S\n\n- one\n- two\n- three';
  const { sections } = parse(md);
  assert.equal(sections[0].signature, null);
  assert.deepEqual(sections[0].blocks, [
    { kind: 'ul', items: ['one', 'two', 'three'] },
  ]);
});

test('a list followed by more prose is still a list', () => {
  const md = '# T\n\nlead\n\n## S\n\n- one\n- two\n\nafter';
  const { sections } = parse(md);
  assert.equal(sections[0].signature, null);
  assert.equal(sections[0].blocks[0].kind, 'ul');
  assert.deepEqual(sections[0].blocks[1], { kind: 'p', text: 'after' });
});

test('h3 becomes a subsection block, not literal text', () => {
  const { sections } = parse('# T\n\nlead\n\n## S\n\n### Sub\n\nbody');
  assert.deepEqual(sections[0].blocks[0], { kind: 'h3', text: 'Sub' });
  assert.deepEqual(sections[0].blocks[1], { kind: 'p', text: 'body' });
});

test('board.md renders its reasons as a list with no signature', () => {
  const md = [
    '# Board', '', 'lead', '', '## Why a board, and why now', '',
    'Notarium shipped its first public alpha.', '',
    '- Opens grant channels the LLC could not access.',
    '- Locks the mission.',
    '- Supports long-term sustainability.', '',
    'A working board is the anchor for all three.',
  ].join('\n');
  const { sections } = parse(md);
  assert.equal(sections[0].signature, null);
  assert.equal(sections[0].blocks[1].kind, 'ul');
  assert.equal(sections[0].blocks[1].items.length, 3);
});
