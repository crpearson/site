import assert from "node:assert/strict";
import { publicCsvProblems } from "../lib/public-csv.mjs";

const rows = (text) => {
  const [head, ...body] = text.trim().split(/\r?\n/).map((line) => line.split(","));
  return body.map((cells) => Object.fromEntries(head.map((key, index) => [key, cells[index] ?? ""])));
};
const check = (text) => publicCsvProblems("t.csv", text, rows(text));

assert.deepEqual(check("session,channel,notes\n2026-10-23,DX8-1 Channel 1,P1 then P2 in log order\n2026-10-23,,\n"), []);
assert.deepEqual(check("session,channel,notes\r\n2026-10-23,DX8-2 Channel 2,ok\r\n"), []);
const bad = [
  ["session,charger_alias,channel\nS1,DX8-1,DX8-1 Channel 1\n", /charger_alias column/],
  ["session,channel,file_nnn\nS1,DX8-1 Channel 1,386\n", /file_nnn column/],
  ["session,channel,nnn_first,nnn_last\nS1,DX8-1 Channel 1,1,3\n", /nnn_first column/],
  ["session,channel\nS1,CH1\n", /not a full name/],
  ["session,channel,notes\nS1,DX8-1 Channel 1,NNN 386 388\n", /NNN/],
  ["session,channel,notes\nS1,DX8-1 Channel 1,on CH2 tonight\n", /short channel tag/],
  ["session,channel,notes\nS1,DX8-1 Channel 1,488=P3 490=P6\n", /file mapping/],
  ["session,channel,notes\nS1,DX8-1 Channel 1,(#0 = first run)\n", /#n file number/],
  ["session,channel,notes\nS1,DX8-1 Channel 1,LiPo[Storage_412_CH1].txt\n", /Storage_/],
  ["session,channel,notes\nS1,DX8-1 Channel 1,SN2603022837\n", /serial/],
];
for (const [text, want] of bad) {
  const problems = check(text);
  assert.ok(problems.some((problem) => want.test(problem)), `${JSON.stringify(text)} -> ${JSON.stringify(problems)}`);
}
console.log(`public csv shape self-test passed (${bad.length} bad cases)`);
