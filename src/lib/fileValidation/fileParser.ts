import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParsedFile {
  headers: string[];
  rows: AsyncGenerator<Record<string, any>>;
}

export const parseUploadedFile = async (file: File): Promise<ParsedFile> => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    return parseCsv(file);
  }
  return parseXlsx(file);
};

function parseCsv(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const queue: any[] = [];
    let resolveNext: ((value: IteratorResult<any>) => void) | null = null;
    let done = false;
    let headers: string[] | undefined;

    const rows: AsyncGenerator<any> = {
      async next() {
        if (queue.length) {
          return { value: queue.shift(), done: false };
        }
        if (done) {
          return { value: undefined, done: true };
        }
        return new Promise(res => (resolveNext = res));
      },
      [Symbol.asyncIterator]() {
        return this;
      }
    } as AsyncGenerator<any>;

    Papa.parse<Record<string, any>>(file, {
      header: true,
      skipEmptyLines: true,
      step: (row) => {
        if (!headers) {
          headers = row.meta.fields || [];
          resolve({ headers, rows });
        }
        const data = row.data;
        if (resolveNext) {
          resolveNext({ value: data, done: false });
          resolveNext = null;
        } else {
          queue.push(data);
        }
      },
      complete: () => {
        done = true;
        if (!headers) {
          headers = [];
          resolve({ headers, rows });
        }
        if (resolveNext) {
          resolveNext({ value: undefined, done: true });
        }
      },
      error: (err) => {
        done = true;
        if (resolveNext) {
          resolveNext({ value: undefined, done: true });
        }
        reject(err);
      }
    });
  });
}

async function parseXlsx(file: File): Promise<ParsedFile> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

  const headers: string[] = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
    const cell = worksheet[cellAddress];
    headers.push(cell ? String(cell.v) : `Column ${col + 1}`);
  }

  async function* rowGenerator() {
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const obj: Record<string, any> = {};
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        obj[headers[col - range.s.c]] = cell ? String(cell.v) : '';
      }
      yield obj;
    }
  }

  return { headers, rows: rowGenerator() };
}

