import { useState, useEffect } from 'react';
import { FaFileDownload, FaColumns } from 'react-icons/fa';
import { docuwareService } from '../../services/docuwareService';
import StatusConfig from '../Semaforos/StatusConfig';
import ColumnFilter from './ColumnFilter';
import ColumnSelector from './ColumnSelector';

const ResultsTable = ({ results, totalDocs, cabinetId, renderCustomColumn, initialVisibleColumns, getCustomStatusValue, selectable = false, selectedIds = [], onSelectionChange }) => {
    const [visibleColumns, setVisibleColumns] = useState({});
    const [allColumns, setAllColumns] = useState([]);
    const [statusConfig, setStatusConfig] = useState(null);
    const [columnFilters, setColumnFilters] = useState({});
    const [filteredResults, setFilteredResults] = useState([]);
    const [sortColumn, setSortColumn] = useState(null);
    const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);

    // Extract all unique columns from results
    useEffect(() => {
        if (results.length === 0) {
            setAllColumns([]);
            setVisibleColumns({});
            setFilteredResults([]);
            return;
        }

        const firstDoc = results[0];
        const columns = [];

        // Add standard columns
        columns.push({ name: 'Id', label: 'Document ID', type: 'standard' });
        columns.push({ name: 'Title', label: 'Title', type: 'standard' });
        columns.push({ name: 'ContentType', label: 'Type', type: 'standard' });
        columns.push({ name: 'FileSize', label: 'Size', type: 'standard' });
        columns.push({ name: 'CreatedAt', label: 'Created At', type: 'standard' });
        columns.push({ name: 'LastModified', label: 'Last Modified', type: 'standard' });

        // Add custom fields from Fields array
        if (firstDoc.Fields && Array.isArray(firstDoc.Fields)) {
            firstDoc.Fields.forEach(field => {
                if (!field.SystemField) {
                    columns.push({
                        name: field.FieldName,
                        label: field.FieldLabel || field.FieldName,
                        type: 'field'
                    });
                }
            });
        }

        // SMART DEFAULT SORTING & VISIBILITY
        // Requirement: ID, Tipo de documento, Estatuto, Data de armazenamento, Tamanho

        const preferredRules = [
            { key: 'id', match: ['id', 'dwdocid', 'document id'] },
            { key: 'doctype', match: ['tipo de documento', 'dwdoctype'] },
            { key: 'docnumber', match: ['número do documento', 'numero do documento', 'document number', 'nº do documento', 'no.', 'n_de_documento', 'nº documento', 'no de documento'] },
            { key: 'status', match: ['estatuto', 'status', 'state'] },
            { key: 'date', match: ['dwstoredatetime', 'store date', 'data de armazenamento', 'created at'] },
            { key: 'size', match: ['dwdisksize', 'filesize', 'size', 'tamanho'] }
        ];

        // Helper to score columns (0 is best/highest priority)
        const getMatchScore = (col) => {
            const name = col.name.toLowerCase();
            const label = col.label.toLowerCase();
            return preferredRules.findIndex(rule =>
                rule.match.some(m => name === m || label === m || label.includes(m))
            );
        };

        // 1. Sort Columns
        if (!initialVisibleColumns || initialVisibleColumns.length === 0) {
            columns.sort((a, b) => {
                const scoreA = getMatchScore(a);
                const scoreB = getMatchScore(b);

                // If both are preferred, lower index = better priority
                if (scoreA !== -1 && scoreB !== -1) return scoreA - scoreB;
                // Preferred comes before non-preferred
                if (scoreA !== -1) return -1;
                if (scoreB !== -1) return 1;
                return 0;
            });
        }

        setAllColumns(columns);

        // 2. Set Visibility: STRICT MODE
        const defaultVisible = {};

        if (initialVisibleColumns && initialVisibleColumns.length > 0) {
            initialVisibleColumns.forEach(c => defaultVisible[c] = true);
        } else {
            // Find trusted matches for the 5 preferred categories
            preferredRules.forEach(rule => {
                const match = columns.find(col => {
                    const name = col.name.toLowerCase();
                    const label = col.label.toLowerCase();
                    return rule.match.some(m => name === m || label === m || label.includes(m));
                });
                if (match) defaultVisible[match.name] = true;
            });

            // Fallback only if absolutely nothing found
            if (Object.keys(defaultVisible).length === 0) {
                columns.slice(0, 6).forEach(c => defaultVisible[c.name] = true);
            }
        }

        setVisibleColumns(defaultVisible);
        setFilteredResults(results);
    }, [results, initialVisibleColumns]);

    // Apply column filters and sorting
    useEffect(() => {
        if (results.length === 0) {
            setFilteredResults([]);
            return;
        }

        let filtered = [...results];

        // Apply each column filter
        Object.keys(columnFilters).forEach(columnName => {
            const selectedValues = columnFilters[columnName];
            if (selectedValues && selectedValues.length > 0) {
                filtered = filtered.filter(doc => {
                    let cellValue;
                    if (columnName === 'customStatus' && getCustomStatusValue) {
                        cellValue = getCustomStatusValue(doc);
                    } else {
                        const column = allColumns.find(col => col.name === columnName);
                        if (!column) return true;
                        cellValue = getFieldValue(doc, column);
                    }
                    return selectedValues.includes(String(cellValue));
                });
            }
        });

        // Apply sorting
        if (sortColumn) {
            filtered.sort((a, b) => {
                let aValue, bValue;

                if (sortColumn === 'customStatus' && getCustomStatusValue) {
                    aValue = getCustomStatusValue(a);
                    bValue = getCustomStatusValue(b);
                } else {
                    const column = allColumns.find(col => col.name === sortColumn);
                    if (!column) return 0;
                    aValue = getFieldValue(a, column);
                    bValue = getFieldValue(b, column);
                }

                // Handle different types
                let comparison = 0;
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    comparison = aValue - bValue;
                } else {
                    comparison = String(aValue || '').localeCompare(String(bValue || ''));
                }

                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }

        setFilteredResults(filtered);
    }, [columnFilters, results, allColumns, sortColumn, sortDirection, getCustomStatusValue]);

    // Reset to page 1 when filters or sorting changes
    useEffect(() => {
        setCurrentPage(1);
    }, [columnFilters, sortColumn, sortDirection]);

    // Get unique values for a column
    const getUniqueValues = (column) => {
        const values = new Set();
        results.forEach(doc => {
            let value;
            if (column.name === 'customStatus' && getCustomStatusValue) {
                value = getCustomStatusValue(doc);
            } else {
                value = getFieldValue(doc, column);
            }
            values.add(String(value || ''));
        });
        return Array.from(values).sort();
    };

    const toggleFilterValue = (columnName, value) => {
        setColumnFilters(prev => {
            const current = prev[columnName] || [];
            const newValues = current.includes(value)
                ? current.filter(v => v !== value)
                : [...current, value];

            if (newValues.length === 0) {
                const { [columnName]: _, ...rest } = prev;
                return rest;
            }

            return { ...prev, [columnName]: newValues };
        });
    };

    const selectAllValues = (columnName) => {
        const column = allColumns.find(col => col.name === columnName);
        if (!column) return;

        const allValues = getUniqueValues(column);
        setColumnFilters(prev => ({ ...prev, [columnName]: allValues }));
    };

    const clearColumnFilter = (columnName) => {
        setColumnFilters(prev => {
            const { [columnName]: _, ...rest } = prev;
            return rest;
        });
    };

    const clearAllFilters = () => {
        setColumnFilters({});
    };

    const handleSort = (columnName) => {
        if (sortColumn === columnName) {
            // Toggle direction
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // New column, start with ascending
            setSortColumn(columnName);
            setSortDirection('asc');
        }
    };

    const toggleColumn = (columnName) => {
        setVisibleColumns(prev => ({
            ...prev,
            [columnName]: !prev[columnName]
        }));
    };

    const toggleAll = (show) => {
        const newVisible = {};
        allColumns.forEach(col => {
            newVisible[col.name] = show;
        });
        setVisibleColumns(newVisible);
    };

    const formatDate = (value) => {
        if (!value) return '-';

        try {
            let date;

            if (typeof value === 'string') {
                // Handle ASP.NET AJAX JSON format: /Date(1234567890)/
                const msDateMatch = value.match(/\/Date\((\d+)\)\//);
                if (msDateMatch) {
                    date = new Date(parseInt(msDateMatch[1], 10));
                } else {
                    date = new Date(value);
                }
            } else if (typeof value === 'number') {
                date = new Date(value);
            } else {
                return '-';
            }

            if (isNaN(date.getTime())) {
                return '-';
            }

            return date.toLocaleString();
        } catch (error) {
            console.error('Date formatting error:', error);
            return '-';
        }
    };

    const formatFileSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const getFieldValue = (doc, column) => {
        // Helper to find a field case-insensitive
        const findField = (obj, key) => {
            if (!obj) return undefined;
            const searchKey = key.toLowerCase();
            return Object.keys(doc).find(k => k.toLowerCase() === searchKey);
        };

        const findInFieldsArray = (fields, key) => {
            if (!fields || !Array.isArray(fields)) return undefined;
            const searchKey = key.toLowerCase();
            return fields.find(f =>
                (f.FieldName && f.FieldName.toLowerCase() === searchKey) ||
                (f.DBName && f.DBName.toLowerCase() === searchKey)
            );
        };

        if (column.type === 'standard') {
            // 1. Try direct property access (case-insensitive)
            let value;
            const directKey = findField(doc, column.name);
            if (directKey) {
                value = doc[directKey];
            }

            // 2. Special handling for Date fields
            if (column.name === 'CreatedAt') {
                // Try specific DocuWare date keys
                const dateKeys = ['DWStoreDateTime', 'StoreDateTime', 'CreatedAt', 'dwstoredatetime'];
                for (const key of dateKeys) {
                    const foundKey = findField(doc, key);
                    if (foundKey) {
                        value = doc[foundKey];
                        break;
                    }
                }

                // Fallback to Fields array
                if (!value) {
                    const field = findInFieldsArray(doc.Fields, 'DWSTOREDATETIME');
                    if (field) value = field.Item;
                }
            } else if (column.name === 'LastModified') {
                const dateKeys = ['DWModDateTime', 'ModDateTime', 'LastModified', 'dwmoddatetime'];
                for (const key of dateKeys) {
                    const foundKey = findField(doc, key);
                    if (foundKey) {
                        value = doc[foundKey];
                        break;
                    }
                }

                // Fallback to Fields array
                if (!value) {
                    const field = findInFieldsArray(doc.Fields, 'DWMODDATETIME');
                    if (field) value = field.Item;
                }
            }

            if (column.name === 'FileSize') {
                return formatFileSize(value);
            }
            if (column.name === 'CreatedAt' || column.name === 'LastModified') {
                return formatDate(value);
            }

            return value || '-';
        }

        // Handle Custom Fields
        const field = findInFieldsArray(doc.Fields, column.name);
        if (field) {
            // Check for Date or DateTime types
            if (field.ItemElementName === 'Date' || field.ItemElementName === 'DateTime' || (field.FieldName && field.FieldName.toLowerCase().includes('date'))) {
                return formatDate(field.Item);
            }
            return field.Item || '-';
        }

        return '-';
    };

    const getStatusColor = (doc) => {
        if (!statusConfig) return null;

        const fieldValue = getFieldValue(doc, { name: statusConfig.field, type: 'field' });
        const rule = statusConfig.rules.find(r =>
            r.value.toLowerCase() === fieldValue.toString().toLowerCase()
        );

        if (!rule) return null;

        const colorMap = {
            green: 'bg-green-500',
            yellow: 'bg-yellow-500',
            red: 'bg-red-500',
            blue: 'bg-blue-500',
            gray: 'bg-gray-500'
        };

        return colorMap[rule.color] || 'bg-gray-500';
    };

    const handleViewDocument = (docId) => {
        if (!cabinetId) {
            alert('Cabinet ID not available');
            return;
        }

        const viewUrl = docuwareService.getDocumentViewUrl(cabinetId, docId);
        window.open(viewUrl, '_blank');
    };

    const handleDownloadDocument = async (docId) => {
        if (!cabinetId) {
            alert('Cabinet ID not available');
            return;
        }

        try {
            const blob = await docuwareService.downloadDocument(cabinetId, docId);

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `document_${docId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download document: ' + error.message);
        }
    };

    if (results.length === 0) {
        return (
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <p className="text-center text-gray-500">No results found.</p>
                </div>
            </div>
        );
    }

    const visibleCols = allColumns.filter(col => visibleColumns[col.name]);
    const activeFiltersCount = Object.keys(columnFilters).length;

    // Pagination calculations
    const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedResults = filteredResults.slice(startIndex, endIndex);

    const handlePageChange = (page) => {
        setCurrentPage(page);
    };

    const handleItemsPerPageChange = (value) => {
        setItemsPerPage(value);
        setCurrentPage(1);
    };

    const handleExportCSV = () => {
        if (filteredResults.length === 0) return;

        // Get headers from visible columns
        const headers = visibleCols.map(col => col.name);

        // Convert data to CSV format
        const csvContent = [
            headers.join(','), // Header row
            ...filteredResults.map(row =>
                visibleCols.map(col => {
                    let value = row[col.name] || '';
                    // Handle special characters and quotes
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                        value = `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');

        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `docuware_export_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleColumnDragStart = (e, index) => {
        e.dataTransfer.setData("colIndex", index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleColumnDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleColumnDrop = (e, targetIndex) => {
        e.preventDefault();
        const sourceIndex = parseInt(e.dataTransfer.getData("colIndex"));
        if (sourceIndex === targetIndex || isNaN(sourceIndex)) return;

        const visibleColsList = allColumns.filter(col => visibleColumns[col.name]);
        const sourceCol = visibleColsList[sourceIndex];
        const targetCol = visibleColsList[targetIndex];

        if (!sourceCol || !targetCol) return;

        const newAllColumns = [...allColumns];
        const sourceRealIndex = newAllColumns.findIndex(c => c.name === sourceCol.name);

        // Remove source
        newAllColumns.splice(sourceRealIndex, 1);

        // Find target index in the array *after* removal
        let targetRealIndex = newAllColumns.findIndex(c => c.name === targetCol.name);

        // If moving down/right, insert AFTER the target
        if (sourceIndex < targetIndex) {
            targetRealIndex += 1;
        }

        // Insert at target
        newAllColumns.splice(targetRealIndex, 0, sourceCol);

        setAllColumns(newAllColumns);
    };

    // Selection Handlers (New)
    const handleSelectAll = (e) => {
        if (!onSelectionChange) return;

        if (e.target.checked) {
            // Select all items on current page
            const newSelected = [...new Set([...selectedIds, ...paginatedResults.map(r => r.Id)])];
            onSelectionChange(newSelected);
        } else {
            // Deselect all items on current page
            const pageIds = paginatedResults.map(r => r.Id);
            const newSelected = selectedIds.filter(id => !pageIds.includes(id));
            onSelectionChange(newSelected);
        }
    };

    const handleSelectRow = (id) => {
        if (!onSelectionChange) return;

        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter(sid => sid !== id));
        } else {
            onSelectionChange([...selectedIds, id]);
        }
    };

    const allPageSelected = paginatedResults.length > 0 && paginatedResults.every(r => selectedIds.includes(r.Id));
    const somePageSelected = paginatedResults.some(r => selectedIds.includes(r.Id));

    return (
        <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="card-title">
                        Search Results: <span className="text-primary">{totalDocs} Found</span>
                        <span className="text-sm font-normal text-gray-500 ml-2">
                            (Showing {filteredResults.length} items)
                        </span>
                        {activeFiltersCount > 0 && (
                            <span className="badge badge-primary badge-sm ml-2">{activeFiltersCount} filters</span>
                        )}
                    </h2>

                    <div className="flex gap-2">
                        <ColumnSelector
                            allColumns={allColumns}
                            visibleColumns={visibleColumns}
                            onToggleColumn={toggleColumn}
                            onToggleAll={toggleAll}
                            customTrigger={(onClick) => (
                                <button
                                    className="btn btn-sm btn-outline btn-primary gap-2"
                                    onClick={onClick}
                                    title="Manage Columns"
                                >
                                    <FaColumns /> Columns
                                </button>
                            )}
                        />

                        <button
                            className="btn btn-sm btn-outline btn-primary gap-2"
                            onClick={handleExportCSV}
                            title="Download CSV"
                        >
                            <FaFileDownload /> Export CSV
                        </button>

                        {activeFiltersCount > 0 && (
                            <button
                                onClick={clearAllFilters}
                                className="btn btn-sm btn-ghost text-error gap-2"
                                title="Clear all filters"
                            >
                                🗑️ Clear Filters
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="table table-zebra table-sm">
                        <thead>
                            <tr>
                                {selectable && (
                                    <th className="w-10">
                                        <label>
                                            <input
                                                type="checkbox"
                                                className="checkbox checkbox-sm checkbox-primary"
                                                checked={allPageSelected}
                                                ref={input => {
                                                    if (input) input.indeterminate = somePageSelected && !allPageSelected;
                                                }}
                                                onChange={handleSelectAll}
                                            />
                                        </label>
                                    </th>
                                )}
                                {renderCustomColumn && (
                                    <th className="text-xs">
                                        <div className="flex items-center gap-1">
                                            <span
                                                className="cursor-pointer hover:text-primary transition-colors select-none flex items-center gap-1"
                                                onClick={() => handleSort('customStatus')}
                                                title="Click to sort by Status"
                                            >
                                                Status
                                                {sortColumn === 'customStatus' && (
                                                    <span className="text-primary text-[10px]">
                                                        {sortDirection === 'asc' ? '▲' : '▼'}
                                                    </span>
                                                )}
                                            </span>
                                            {getCustomStatusValue && (
                                                <ColumnFilter
                                                    column={{ name: 'customStatus', label: 'Status' }}
                                                    uniqueValues={getUniqueValues({ name: 'customStatus' })}
                                                    selectedValues={columnFilters['customStatus'] || []}
                                                    onToggleValue={toggleFilterValue}
                                                    onSelectAll={selectAllValues}
                                                    onClear={clearColumnFilter}
                                                />
                                            )}
                                        </div>
                                    </th>
                                )}
                                {statusConfig && <th className="text-xs">Indicator</th>}
                                {visibleCols.map((col, idx) => {
                                    const hasFilter = columnFilters[col.name] && columnFilters[col.name].length > 0;
                                    const uniqueValues = getUniqueValues(col);
                                    const selectedValues = columnFilters[col.name] || [];

                                    return (
                                        <th
                                            key={col.name}
                                            draggable
                                            onDragStart={(e) => handleColumnDragStart(e, idx)}
                                            onDragOver={handleColumnDragOver}
                                            onDrop={(e) => handleColumnDrop(e, idx)}
                                            className="cursor-move hover:bg-base-200 transition-colors"
                                        >
                                            <div className="flex items-center gap-1">
                                                <span
                                                    className="text-xs cursor-pointer hover:text-primary transition-colors select-none"
                                                    onClick={() => handleSort(col.name)}
                                                    title="Click to sort"
                                                >
                                                    {col.label}
                                                    {sortColumn === col.name && (
                                                        <span className="ml-1 text-primary">
                                                            {sortDirection === 'asc' ? '▲' : '▼'}
                                                        </span>
                                                    )}
                                                </span>
                                                <ColumnFilter
                                                    column={col}
                                                    uniqueValues={uniqueValues}
                                                    selectedValues={selectedValues}
                                                    onToggleValue={toggleFilterValue}
                                                    onSelectAll={selectAllValues}
                                                    onClear={clearColumnFilter}
                                                />
                                            </div>
                                        </th>
                                    );
                                })}
                                <th className="text-xs sticky right-0 bg-base-100 z-10 shadow-[-5px_0px_5px_-2px_rgba(0,0,0,0.1)]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedResults.map((doc, idx) => {
                                const statusColor = getStatusColor(doc);
                                const isSelected = selectedIds.includes(doc.Id);
                                return (
                                    <tr key={doc.Id || idx} className={isSelected ? "bg-base-200" : ""}>
                                        {selectable && (
                                            <td>
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        className="checkbox checkbox-sm checkbox-primary"
                                                        checked={isSelected}
                                                        onChange={() => handleSelectRow(doc.Id)}
                                                    />
                                                </label>
                                            </td>
                                        )}
                                        {renderCustomColumn && (
                                            <td>
                                                <div className="flex justify-center">
                                                    {renderCustomColumn(doc)}
                                                </div>
                                            </td>
                                        )}
                                        {statusConfig && (
                                            <td>
                                                <div className="flex justify-center">
                                                    <div
                                                        className={`w-4 h-4 rounded-full ${statusColor || 'bg-gray-300'}`}
                                                        title={statusConfig ? getFieldValue(doc, { name: statusConfig.field, type: 'field' }) : ''}
                                                    />
                                                </div>
                                            </td>
                                        )}
                                        {visibleCols.map(col => (
                                            <td key={col.name}>{getFieldValue(doc, col)}</td>
                                        ))}
                                        <td className={`sticky right-0 shadow-[-5px_0px_5px_-2px_rgba(0,0,0,0.1)] ${isSelected ? 'bg-base-200' : 'bg-base-100'}`}>
                                            <div className="flex gap-1">
                                                <button
                                                    className="btn btn-xs btn-primary"
                                                    onClick={() => handleViewDocument(doc.Id)}
                                                    title="View Document"
                                                >
                                                    👁️ View
                                                </button>
                                                <button
                                                    className="btn btn-xs btn-secondary"
                                                    onClick={() => handleDownloadDocument(doc.Id)}
                                                    title="Download Document"
                                                >
                                                    ⬇️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {filteredResults.length > 0 && (
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 pt-4 border-t">
                        {/* Info text */}
                        <div className="text-sm text-base-content/70">
                            Showing <span className="font-semibold text-base-content">{startIndex + 1}</span> to{' '}
                            <span className="font-semibold text-base-content">{Math.min(endIndex, filteredResults.length)}</span> of{' '}
                            <span className="font-semibold text-base-content">{filteredResults.length}</span> results
                            {totalDocs > results.length && (
                                <span className="ml-1 text-warning" title="Increase search limit to see more">
                                    (fetched {results.length} of {totalDocs} available)
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Items per page */}
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-base-content/70">Per page:</span>
                                <select
                                    className="select select-bordered select-sm w-20"
                                    value={itemsPerPage}
                                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>

                            {/* Page navigation */}
                            {totalPages > 1 && (
                                <div className="join">
                                    <button
                                        className="join-item btn btn-sm"
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        title="Previous page"
                                    >
                                        ‹
                                    </button>

                                    <button className="join-item btn btn-sm btn-disabled pointer-events-none">
                                        Page {currentPage} of {totalPages}
                                    </button>

                                    {/* Page numbers */}
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (currentPage <= 3) {
                                            pageNum = i + 1;
                                        } else if (currentPage >= totalPages - 2) {
                                            pageNum = totalPages - 4 + i;
                                        } else {
                                            pageNum = currentPage - 2 + i;
                                        }

                                        return (
                                            <button
                                                key={pageNum}
                                                className={`join-item btn btn-sm ${currentPage === pageNum ? 'btn-active' : ''}`}
                                                onClick={() => handlePageChange(pageNum)}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}

                                    <button
                                        className="join-item btn btn-sm"
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                    >
                                        ›
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResultsTable;
