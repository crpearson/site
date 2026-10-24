// Public CSV shape: no log file numbers, one full-name channel column, no short channel tags.
// Used by scripts/validate-v4.mjs (build) and scripts/public-csv.test.mjs (npm test).
export const BANNED_COLUMNS = ["file_nnn", "nnn_first", "nnn_last", "charger_alias", "charger_sn", "upload_path", "raw_file"];
export const CHANNEL_NAME = /^DX8-[12] Channel [12]$/;
const LOG_NUMBER_TEXT = [
  [/\bfile_nnn\b|\bnnn_(first|last)\b/i, "a log-number field name"],
  [/\bNNN\b/i, "NNN"],
  [/Storage_\d+/i, "a Storage_ file name"],
  [/(^|[\s(;,/])#\d+/, "a #n file number"],
  [/(^|[\s(;,/])\d+=P\d\b/, "an n=Pn file mapping"],
  [/\bCH[12]\b/i, "a short channel tag"],
  [/2603022837|2604012839/, "a charger serial"],
];

function headerOf(text) {
  const line = text.split(/\r?\n/, 1)[0] ?? "";
  return line.split(",").map((cell) => cell.replace(/^"|"$/g, ""));
}

// rows: parsed objects for the file (header -> value). Returns a list of problems.
export function publicCsvProblems(file, text, rows) {
  const problems = [];
  const header = headerOf(text);
  for (const column of BANNED_COLUMNS) {
    if (header.includes(column)) problems.push(`${file} has a ${column} column`);
  }
  if (header.includes("channel")) {
    rows.forEach((row, index) => {
      if (row.channel !== "" && !CHANNEL_NAME.test(row.channel)) {
        problems.push(`${file} row ${index + 2} channel "${row.channel}" is not a full name like "DX8-1 Channel 1"`);
      }
    });
  }
  text.split(/\r?\n/).forEach((line, index) => {
    for (const [pattern, what] of LOG_NUMBER_TEXT) {
      const hit = line.match(pattern);
      if (hit) problems.push(`${file} line ${index + 1} carries ${what} (${hit[0].trim()})`);
    }
  });
  return problems;
}
