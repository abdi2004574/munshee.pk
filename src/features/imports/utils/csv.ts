export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

function parseLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      current += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ",") {
      cells.push(current);
      current = "";
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  cells.push(current);
  return cells;
}

function splitLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '""';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      current += ch;
      i += 1;
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      lines.push(current);
      current = "";
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  if (current.length > 0 || lines.length === 0) {
    lines.push(current);
  }

  return lines;
}

export function parseCsv(text: string): ParsedCsv {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error("CSV input is empty");
  }

  const rawLines = splitLines(trimmed)
    .map((l) => l.replace(/^\uFEFF/, ""))
    .filter((l) => l.length > 0);

  if (rawLines.length === 0) {
    throw new Error("CSV input is empty");
  }

  const headerCells = parseLine(rawLines[0]).map((c) => c.trim());
  if (headerCells.length === 0 || headerCells.every((c) => c === "")) {
    throw new Error("CSV has no headers");
  }

  const rows: string[][] = [];
  for (let i = 1; i < rawLines.length; i += 1) {
    const cells = parseLine(rawLines[i]).map((c) => c.trim());
    if (cells.every((c) => c === "")) continue;
    while (cells.length < headerCells.length) {
      cells.push("");
    }
    rows.push(cells);
  }

  return { headers: headerCells, rows };
}
