// DataTableShell - Davos Glass Design System
import React from 'react';

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  numeric?: boolean;
  width?: string;
}

interface DataTableShellProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  maxHeight?: string;
  className?: string;
}

export function DataTableShell<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  onRowClick,
  emptyMessage = 'No data available',
  maxHeight,
  className = ''
}: DataTableShellProps<T>) {
  if (data.length === 0) {
    return (
      <div className={`data-table-shell ${className}`}>
        <div className="empty-state">
          <div className="empty-state-icon">
            <i className="bi bi-inbox"></i>
          </div>
          <p className="empty-state-description">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`data-table-shell ${className}`}>
      <div
        className="table-wrapper"
        style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
      >
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={col.numeric ? 'text-right' : ''}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={String(row[keyField])}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={col.numeric ? 'numeric' : ''}
                  >
                    {col.render
                      ? col.render(row)
                      : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
