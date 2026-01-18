// Excel to CSV conversion utility
// Converts XLS and XLSX files to CSV format for import

import * as XLSX from 'xlsx';

/**
 * Check if a file is an Excel file based on extension
 */
export function isExcelFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.xls') || name.endsWith('.xlsx');
}

/**
 * Convert an Excel file to CSV string
 * Uses the first sheet by default, or finds the most relevant sheet
 */
export async function excelToCsv(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Failed to read file'));
          return;
        }

        // Parse the workbook
        const workbook = XLSX.read(data, { type: 'array' });

        // Get the best sheet to use
        const sheetName = selectBestSheet(workbook);
        const worksheet = workbook.Sheets[sheetName];

        if (!worksheet) {
          reject(new Error('No valid worksheet found in Excel file'));
          return;
        }

        // Convert to CSV
        const csv = XLSX.utils.sheet_to_csv(worksheet, {
          blankrows: false,
          strip: true
        });

        resolve(csv);
      } catch (err) {
        reject(new Error(`Failed to parse Excel file: ${err instanceof Error ? err.message : 'Unknown error'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error(`Failed to read file: ${file.name}`));
    };

    // Read as ArrayBuffer for xlsx library
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Select the best sheet from a workbook
 * Prioritizes sheets with relevant names, falls back to first sheet
 */
function selectBestSheet(workbook: XLSX.WorkBook): string {
  const sheetNames = workbook.SheetNames;

  if (sheetNames.length === 0) {
    throw new Error('Excel file has no sheets');
  }

  if (sheetNames.length === 1) {
    return sheetNames[0];
  }

  // Look for sheets with relevant names
  const relevantPatterns = [
    /data/i,
    /report/i,
    /export/i,
    /candidates/i,
    /requisitions/i,
    /jobs/i,
    /applications/i,
    /sheet1/i
  ];

  for (const pattern of relevantPatterns) {
    const match = sheetNames.find(name => pattern.test(name));
    if (match) {
      return match;
    }
  }

  // Default to first sheet
  return sheetNames[0];
}

/**
 * Read a file as text, converting Excel to CSV if needed
 */
export async function readFileAsTextOrExcel(file: File): Promise<string> {
  if (isExcelFile(file)) {
    return excelToCsv(file);
  }

  // Regular text file (CSV)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

/**
 * Get supported file extensions for display
 */
export const SUPPORTED_EXTENSIONS = '.csv, .xls, .xlsx';

/**
 * Get accept string for file inputs
 */
export const FILE_ACCEPT = '.csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
