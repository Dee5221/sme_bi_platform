import type { ReactNode } from 'react';
import './DataTable.css';

type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyTitle = 'No records found',
  emptyDescription,
}: Props<T>) {
  if (rows.length === 0) {
    return (
      <div className="data-table-empty">
        <h3>{emptyTitle}</h3>
        {emptyDescription ? <p>{emptyDescription}</p> : null}
      </div>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.className}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} className={column.className}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
