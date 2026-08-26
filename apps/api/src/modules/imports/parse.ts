import ExcelJS from 'exceljs';
import mammoth from 'mammoth';
import { HttpError } from '#shared/lib';

// Turns an uploaded file into a flat table: the first non-empty row is the header,
// everything after it is data. Only what the two ends of the import need — no
// formatting, formulas, or multiple sheets; the first sheet wins.

export interface ParsedSheet {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

// Bound on what one import may hold. A bigger file is refused at upload-parse time
// rather than half-imported later.
export const MAX_IMPORT_ROWS = 1000;

const ALLOWED_EXTENSIONS = ['.xlsx', '.csv', '.docx'] as const;

export function assertImportFilename(filename: string): void {
  const lower = filename.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    throw new HttpError(
      400,
      'Unsupported file type. Use .xlsx, .csv, or .docx (an old .xls file can be saved as .xlsx).',
    );
  }
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'object' && 'text' in value) return String(value.text ?? '');
  if (typeof value === 'object' && 'result' in value) return String(value.result ?? '');
  const text = String(value);
  return text === 'undefined' || text === 'null' ? '' : text;
}

async function parseXlsx(bytes: Buffer): Promise<ParsedSheet> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new HttpError(400, 'The file is not a readable .xlsx workbook');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new HttpError(400, 'The workbook has no sheets');

  const table: string[][] = [];
  sheet.eachRow((row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const col = Number(cell.col);
      cells[col - 1] = cellText(cell.value);
    });
    for (let i = 0; i < cells.length; i++) cells[i] ??= '';
    table.push(cells);
  });
  return fromTable(table, 'The sheet is empty');
}

// Reads CSV with comma or semicolon delimiters, quoted fields, and escaped quotes.
// Small enough to own here: the alternatives either bring the whole SheetJS package
// (whose npm build has known advisories) or mis-handle quoting.
export function parseCsv(text: string): string[][] {
  const delimiter = sniffDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function sniffDelimiter(text: string): ',' | ';' {
  const head = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'));
  const commas = (head.match(/,/g) ?? []).length;
  const semicolons = (head.match(/;/g) ?? []).length;
  return semicolons > commas ? ';' : ',';
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

async function parseDocx(bytes: Buffer): Promise<ParsedSheet> {
  let html: string;
  try {
    ({ value: html } = await mammoth.convertToHtml({ buffer: bytes }));
  } catch {
    throw new HttpError(400, 'The file is not a readable .docx document');
  }
  const tableHtml = html.match(/<table[\s\S]*?<\/table>/i)?.[0];
  if (!tableHtml) {
    throw new HttpError(
      400,
      'No table found in the document. Put the tasks in a table, or use .xlsx/.csv.',
    );
  }
  const table = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((rowMatch) =>
    [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellMatch) =>
      decodeEntities(cellMatch[1].replace(/<[^>]+>/g, '')).trim(),
    ),
  );
  return fromTable(table, 'The table in the document is empty');
}

// Takes raw grid rows, makes the first non-empty one the header, and keeps the
// rest that carry any value.
function fromTable(table: string[][], emptyMessage: string): ParsedSheet {
  const firstRow = table.findIndex((row) => row.some((cell) => cell.trim() !== ''));
  if (firstRow === -1) throw new HttpError(400, emptyMessage);

  const width = Math.max(...table.map((row) => row.length));
  const headers = table[firstRow].map((cell) => cell.trim());
  while (headers.length < width) headers.push('');

  const rows = table
    .slice(firstRow + 1)
    .filter((row) => row.some((cell) => cell.trim() !== ''))
    .map((row) => {
      const filled = row.map((cell) => cell.trim());
      while (filled.length < width) filled.push('');
      return filled;
    });
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new HttpError(400, `The file holds more than ${MAX_IMPORT_ROWS} rows; split it first.`);
  }
  return { headers, rows, totalRows: rows.length };
}

export async function parseImportFile(bytes: Buffer, filename: string): Promise<ParsedSheet> {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.xlsx')) return parseXlsx(bytes);
  if (lower.endsWith('.csv'))
    return fromTable(parseCsv(bytes.toString('utf8')), 'The CSV file is empty');
  if (lower.endsWith('.docx')) return parseDocx(bytes);
  throw new HttpError(400, 'Unsupported file type');
}
