/**
 * Table - UI Primitive
 * Tailwind-based table components matching V0 reference design
 */
import React from 'react';
import { cn } from './utils';

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {}

export function Table({ className, children, ...props }: TableProps) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export function TableHeader({ className, children, ...props }: TableHeaderProps) {
  return (
    <thead
      className={cn('[&_tr]:border-b [&_tr]:border-border', className)}
      {...props}
    >
      {children}
    </thead>
  );
}

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export function TableBody({ className, children, ...props }: TableBodyProps) {
  return (
    <tbody
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    >
      {children}
    </tbody>
  );
}

export interface TableFooterProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export function TableFooter({ className, children, ...props }: TableFooterProps) {
  return (
    <tfoot
      className={cn(
        'bg-card/50 border-t border-border font-medium [&>tr]:last:border-b-0',
        className
      )}
      {...props}
    >
      {children}
    </tfoot>
  );
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
}

export function TableRow({ className, selected, children, ...props }: TableRowProps) {
  return (
    <tr
      className={cn(
        'border-b border-border transition-colors',
        'hover:bg-muted/50',
        selected && 'bg-muted',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {}

export function TableHead({ className, children, ...props }: TableHeadProps) {
  return (
    <th
      className={cn(
        'h-10 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap',
        'text-xs uppercase tracking-wider',
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {}

export function TableCell({ className, children, ...props }: TableCellProps) {
  return (
    <td
      className={cn(
        'p-3 align-middle text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

export interface TableCaptionProps extends React.HTMLAttributes<HTMLTableCaptionElement> {}

export function TableCaption({ className, children, ...props }: TableCaptionProps) {
  return (
    <caption
      className={cn('mt-4 text-sm text-muted-foreground', className)}
      {...props}
    >
      {children}
    </caption>
  );
}

export default Table;
