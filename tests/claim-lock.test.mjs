import assert from "node:assert/strict";

const taken = new Set();
function claim(token, customer) {
  if (taken.has(token)) return { ok: false, customer };
  taken.add(token);
  return { ok: true, customer };
}
const a = claim("slot", "luis");
const b = claim("slot", "sam");
assert.equal(a.ok, true);
assert.equal(b.ok, false);
console.log("claim lock: one winner");
