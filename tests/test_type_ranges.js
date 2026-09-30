/* Pure mapping tests. These mocks do not validate Photoshop's host API. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
class Descriptor {
  constructor(values = {}) { this.values = values; }
  toStream() { return JSON.stringify(this.values); }
  fromStream(stream) { this.values = JSON.parse(stream); }
  getInteger(key) { return this.values[key]; }
  putInteger(key, value) { this.values[key] = value; }
}
class List {
  constructor(entries = []) { this.entries = entries; }
  get count() { return this.entries.length; }
  getObjectValue(i) { return this.entries[i]; }
  getObjectType() { return 'range'; }
  putObject(type, value) { this.entries.push(value); }
}
const context = vm.createContext({
  ActionDescriptor: Descriptor, ActionList: List, stringIDToTypeID: x => x
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../scripts/preserve_type.jsx'), 'utf8'), context);
const offsets = context.sourceOffsets('ab\rcd\r', 'ABCDE\rXYZ\r!');
assert.deepEqual(Array.from(offsets), [0,1,1,1,1,1,3,4,4,4,3,4]);
const source = new List([
  new Descriptor({from:0,to:1,tracking:100}),
  new Descriptor({from:1,to:3,tracking:20}),
  new Descriptor({from:3,to:4,tracking:0}),
  new Descriptor({from:4,to:6,tracking:-20})
]);
const remapped = context.remapTypeRanges(source, offsets, false, 'ABCDE\rXYZ\r!');
assert.deepEqual(remapped.entries.map(x => x.values), [
  {from:0,to:1,tracking:100}, {from:1,to:6,tracking:20},
  {from:6,to:7,tracking:0}, {from:7,to:10,tracking:-20},
  {from:10,to:11,tracking:0}, {from:11,to:12,tracking:-20}
]);
const manual = new List([new Descriptor({from:1,to:2,kerning:-180})]);
const kern = context.remapKerning(manual, offsets, 'ABCDE\rXYZ\r!');
assert.deepEqual(kern.entries.map(x => x.values), [
  {from:1,to:2,kerning:-180}, {from:2,to:3,kerning:-180},
  {from:3,to:4,kerning:-180}, {from:4,to:5,kerning:-180}
]);
console.log('Passed: per-line offsets, mixed tracking ranges, manual kerning, added lines.');
