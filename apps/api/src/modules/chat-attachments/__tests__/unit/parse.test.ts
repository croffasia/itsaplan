import { describe, it, expect } from 'bun:test';
import { isTableFilename, parseCsv, parseImportFile } from '../../parse';

describe('csv parser', () => {
  it('reads quoted fields, escaped quotes, and blank lines', () => {
    const rows = parseCsv('a,b\r\n"1,5","say ""hi"""\r\n\r\n   , \r\nx,y\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['1,5', 'say "hi"'],
      ['x', 'y'],
    ]);
  });

  it('sniffs a semicolon delimiter', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('import file routing', () => {
  it('refuses an unsupported extension', async () => {
    await expect(parseImportFile(Buffer.from('x'), 'file.xls')).rejects.toThrow('Unsupported');
  });

  it('parses a csv buffer end to end', async () => {
    const parsed = await parseImportFile(Buffer.from('Task,Notes\nA,B'), 't.csv');
    expect(parsed.headers).toEqual(['Task', 'Notes']);
    expect(parsed.totalRows).toBe(1);
  });

  it('knows which filenames parse into a table', () => {
    expect(isTableFilename('tasks.xlsx')).toBe(true);
    expect(isTableFilename('JIRA.CSV')).toBe(true);
    expect(isTableFilename('spec.docx')).toBe(true);
    expect(isTableFilename('server.log')).toBe(false);
  });
});
