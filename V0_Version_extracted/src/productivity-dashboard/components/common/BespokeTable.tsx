// BespokeTable Component
// Single source of truth for all data tables with Swiss Modern styling

import React, { useMemo, useCallback } from 'react';

// ============================================
// TYPES
// ============================================

export interface BespokeTableColumn<T> {
    /** Unique key for this column (used for sorting) */
    key: string;
    /** Header label text */
    header: string;
    /** Column width (CSS value, e.g., '120px', '20%') */
    width?: string;
    /** Text alignment */
    align?: 'left' | 'center' | 'right';
    /** Whether this column is sortable */
    sortable?: boolean;
    /** Custom render function for cell content */
    render?: (item: T, index: number) => React.ReactNode;
    /** Cell CSS class (e.g., 'cell-numeric', 'cell-truncate') */
    cellClass?: string;
    /** Header CSS class */
    headerClass?: string;
    /** Whether to hide this column conditionally */
    hidden?: boolean;
}

export interface BespokeTableProps<T> {
    /** Column definitions */
    columns: BespokeTableColumn<T>[];
    /** Data array */
    data: T[];
    /** Extract unique key from each item */
    keyExtractor: (item: T) => string;
    /** Current sort column key */
    sortColumn?: string;
    /** Current sort direction */
    sortDirection?: 'asc' | 'desc';
    /** Called when user clicks a sortable header */
    onSort?: (key: string, direction: 'asc' | 'desc') => void;
    /** Called when user clicks a row */
    onRowClick?: (item: T) => void;
    /** Enable row selection with checkboxes */
    selectable?: boolean;
    /** Currently selected keys */
    selectedKeys?: Set<string>;
    /** Called when selection changes */
    onSelectionChange?: (keys: Set<string>) => void;
    /** Custom empty state content */
    emptyState?: React.ReactNode;
    /** Minimum table width for horizontal scroll */
    minWidth?: string;
    /** Additional table class names */
    className?: string;
}

// ============================================
// COMPONENT
// ============================================

export function BespokeTable<T>({
    columns,
    data,
    keyExtractor,
    sortColumn,
    sortDirection = 'desc',
    onSort,
    onRowClick,
    selectable = false,
    selectedKeys = new Set(),
    onSelectionChange,
    emptyState,
    minWidth,
    className = ''
}: BespokeTableProps<T>) {
    // Filter out hidden columns
    const visibleColumns = useMemo(
        () => columns.filter(col => !col.hidden),
        [columns]
    );

    // Handle header click for sorting
    const handleHeaderClick = useCallback(
        (column: BespokeTableColumn<T>) => {
            if (!column.sortable || !onSort) return;
            const newDirection = sortColumn === column.key && sortDirection === 'desc' ? 'asc' : 'desc';
            onSort(column.key, newDirection);
        },
        [sortColumn, sortDirection, onSort]
    );

    // Handle select all toggle
    const handleSelectAll = useCallback(() => {
        if (!onSelectionChange) return;
        if (selectedKeys.size === data.length) {
            onSelectionChange(new Set());
        } else {
            onSelectionChange(new Set(data.map(keyExtractor)));
        }
    }, [data, keyExtractor, selectedKeys, onSelectionChange]);

    // Handle single row selection toggle
    const handleRowSelect = useCallback(
        (key: string) => {
            if (!onSelectionChange) return;
            const next = new Set(selectedKeys);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            onSelectionChange(next);
        },
        [selectedKeys, onSelectionChange]
    );

    // Render cell content
    const renderCell = (column: BespokeTableColumn<T>, item: T, index: number): React.ReactNode => {
        if (column.render) {
            return column.render(item, index);
        }
        // Default: access item[key]
        const value = (item as Record<string, unknown>)[column.key];
        return value !== undefined && value !== null ? String(value) : '—';
    };

    // Build header class
    const getHeaderClass = (column: BespokeTableColumn<T>): string => {
        const classes: string[] = [];
        if (column.align === 'right') classes.push('text-right');
        if (column.align === 'center') classes.push('text-center');
        if (column.sortable) classes.push('sortable');
        if (sortColumn === column.key) classes.push('sorted');
        if (column.headerClass) classes.push(column.headerClass);
        return classes.join(' ');
    };

    // Build cell class
    const getCellClass = (column: BespokeTableColumn<T>): string => {
        const classes: string[] = [];
        if (column.align === 'right') classes.push('text-right');
        if (column.align === 'center') classes.push('text-center');
        if (column.cellClass) classes.push(column.cellClass);
        return classes.join(' ');
    };

    const isAllSelected = data.length > 0 && selectedKeys.size === data.length;

    // Build table style
    const tableStyle: React.CSSProperties = { tableLayout: 'fixed' };
    if (minWidth) tableStyle.minWidth = minWidth;

    return (
        <div className="table-responsive">
            <table
                className={`table table-bespoke table-hover mb-0 ${className}`}
                style={tableStyle}
            >
                <thead>
                    <tr>
                        {selectable && (
                            <th style={{ width: '40px' }}>
                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={isAllSelected}
                                    onChange={handleSelectAll}
                                    title="Select all"
                                />
                            </th>
                        )}
                        {visibleColumns.map(column => (
                            <th
                                key={column.key}
                                className={getHeaderClass(column)}
                                style={column.width ? { width: column.width } : undefined}
                                onClick={() => handleHeaderClick(column)}
                            >
                                {column.header}
                                {column.sortable && sortColumn === column.key && (
                                    <span className="sort-indicator">
                                        {sortDirection === 'desc' ? '▼' : '▲'}
                                    </span>
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.length === 0 ? (
                        <tr>
                            <td
                                colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                                className="empty-state"
                            >
                                {emptyState || (
                                    <div>
                                        <div className="empty-state-icon">📭</div>
                                        <div>No data available</div>
                                    </div>
                                )}
                            </td>
                        </tr>
                    ) : (
                        data.map((item, index) => {
                            const key = keyExtractor(item);
                            const isSelected = selectedKeys.has(key);
                            return (
                                <tr
                                    key={key}
                                    className={`${onRowClick ? 'cursor-pointer' : ''} ${isSelected ? 'selected' : ''}`}
                                    onClick={() => onRowClick?.(item)}
                                >
                                    {selectable && (
                                        <td onClick={e => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                className="form-check-input"
                                                checked={isSelected}
                                                onChange={() => handleRowSelect(key)}
                                            />
                                        </td>
                                    )}
                                    {visibleColumns.map(column => (
                                        <td key={column.key} className={getCellClass(column)}>
                                            {renderCell(column, item, index)}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}

// ============================================
// HELPER FUNCTIONS FOR COMMON PATTERNS
// ============================================

/** Creates a badge cell renderer */
export function badgeCell<T>(
    getValue: (item: T) => string | number,
    getBadgeClass: (item: T) => string
): (item: T) => React.ReactNode {
    return (item: T) => (
        <span className={`badge-bespoke ${getBadgeClass(item)}`}>
            {getValue(item)}
        </span>
    );
}

/** Creates a primary text with subtitle renderer */
export function primaryWithSubtitle<T>(
    getPrimary: (item: T) => string,
    getSubtitle: (item: T) => string
): (item: T) => React.ReactNode {
    return (item: T) => (
        <div>
            <div className="cell-primary text-truncate" title={getPrimary(item)}>
                {getPrimary(item)}
            </div>
            <small className="cell-muted cell-small">{getSubtitle(item)}</small>
        </div>
    );
}

/** Creates a numeric cell with optional suffix */
export function numericCell<T>(
    getValue: (item: T) => number | null,
    suffix?: string
): (item: T) => React.ReactNode {
    return (item: T) => {
        const value = getValue(item);
        if (value === null || value === undefined) return <span className="cell-muted">—</span>;
        return (
            <span className="cell-numeric">
                {value}{suffix || ''}
            </span>
        );
    };
}

export default BespokeTable;
