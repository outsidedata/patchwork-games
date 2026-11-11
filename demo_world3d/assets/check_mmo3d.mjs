// Checks a place's mmo3d file against what its bake wrote: every person the file places is a spot of the baked people
// file, with the class and the record the file gives them, and every zone stands on a spot.
//   node check_mmo3d.mjs hills/hills.mmo3d.json
// The people file is the one the mmo3d file's `landmarks` names, `<landmarks>.json` in the mmo3d file's folder. A
// name's dots are the people file's slashes (`smithy 1.smith 1` is the spot `smithy 1/smith 1`). It prints one line
// for each placement and zone, and ends with 1 when any of them is wrong.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const given = process.argv[2];
if (!given) {
  console.error('usage: node check_mmo3d.mjs <place>.mmo3d.json');
  process.exit(2);
}
const file = resolve(given);
const mmo = JSON.parse(readFileSync(file, 'utf8'));
const peopleFile = join(dirname(file), `${mmo.landmarks}.json`);
const spots = JSON.parse(readFileSync(peopleFile, 'utf8')).landmarks;
const spot = (name) => spots[name.split('.').join('/')];
console.log(`mmo3d file   ${file}`);
console.log(`people file  ${peopleFile}`);

let wrong = 0;
const say = (ok, line) => {
  if (!ok) wrong++;
  console.log(`${ok ? 'ok    ' : 'WRONG '} ${line}`);
};

console.log('--- placements');
for (const p of mmo.placements) {
  const want = `${p.kind}${p.record === undefined ? '' : ` / ${p.record}`}`;
  const l = spot(p.at);
  if (!l) { say(false, `${p.at}: wanted ${want}, and the people file has no such spot`); continue; }
  if (l.class === undefined) { say(false, `${p.at}: wanted ${want}, and the spot has no class`); continue; }
  const got = `${l.class}${l.record === undefined ? '' : ` / ${l.record}`}`;
  say(got === want, got === want ? `${p.at}: ${got}` : `${p.at}: wanted ${want}, the bake wrote ${got}`);
}

console.log('--- zones');
for (const z of mmo.zones) {
  if (typeof z.at !== 'string') { say(true, `${z.name}: at ${z.at.join(', ')}`); continue; }
  say(spot(z.at) !== undefined, spot(z.at) ? `${z.name}: on ${z.at}` : `${z.name}: ${z.at} is no spot of the people file`);
}

console.log(wrong ? `--- ${wrong} wrong` : '--- all right');
process.exit(wrong ? 1 : 0);
