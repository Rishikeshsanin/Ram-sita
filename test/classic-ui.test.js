'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ui = fs.readFileSync(path.join(__dirname, '../public/app.js'),'utf8');
const readme = fs.readFileSync(path.join(__dirname,'../README.md'),'utf8');
test('classic interface excludes experimental mystery and symbol mechanics',()=>{
  assert.doesNotMatch(ui,/Court of Whispers|mysteryArea|data-action="claim"|Real royal sigil|THE COURT CHALLENGE|sigil-claim/);
  assert.match(ui,/Classic Ram–Sita/);
  assert.match(ui,/function ramaControls/);
  assert.match(ui,/function renderReveal/);
});
test('players can create, join, ready, guess, reveal and rematch',()=>{
  for(const action of ["'create'","'join'","'ready'","'guess'","'next'","'rematch'"]) assert.ok(ui.includes(action),action);
  assert.match(readme,/Classic only/);
});
