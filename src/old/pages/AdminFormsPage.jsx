import { useState, useEffect } from 'react';
import { adminService } from '../services/adminService';
import { FaSearch, FaWpforms, FaCheckCircle, FaExternalLinkAlt, FaFileDownload } from 'react-icons/fa';
import ColumnFilter from '../components/Documents/ColumnFilter';

const AdminFormsPage = () => {
    const [forms, setForms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Column filtering and sorting
    const [columnFilters, setColumnFilters] = useState({});
    const [sortColumn, setSortColumn] = useState(null);
    const [sortDirection, setSortDirection] = useState('asc');

    const ITEMS_PER_PAGE = 100;

    // Define table columns
    const columns = [
        { name: 'name', label: 'Nome do Formulário', filterable: true, sortable: true },
        { name: 'description', label: 'Descrição', filterable: true, sortable: true },
        { name: 'destination', label: 'Destino', filterable: true, sortable: true },
        { name: 'createdAt', label: 'Criado em', filterable: false, sortable: true, width: 'w-28', padding: 'px-3' },
        { name: 'lastModified', label: 'Última Modificação', filterable: false, sortable: true, width: 'w-28', padding: 'px-3' },
        { name: 'link', label: 'Link', filterable: false, sortable: false, width: 'w-20' },
        { name: 'status', label: 'Status', filterable: true, sortable: true, width: 'w-28' },
    ];

    // Fetch Forms
    useEffect(() => {
        const loadForms = async () => {
            setLoading(true);
            try {
                const data = await adminService.getForms(page, ITEMS_PER_PAGE, search);
                setForms(data.items);
                setTotalPages(data.totalPages);
            } catch (error) {
                console.error("Failed to load forms:", error);
            } finally {
                setLoading(false);
            }
        };
        loadForms();
    }, [page, search, refreshTrigger]);

    const handleSearch = (e) => {
        setSearch(e.target.value);
        setPage(1);
    };

    // Get unique values for a column (for filtering)
    const getUniqueValues = (columnName) => {
        const values = new Set();
        forms.forEach(form => {
            let value = form[columnName];
            if (columnName === 'status') {
                value = value === 'active' ? 'Ativo' : 'Inativo';
            }
            values.add(String(value || ''));
        });
        return Array.from(values).sort();
    };

    // Column filter functions
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
        const allValues = getUniqueValues(columnName);
        setColumnFilters(prev => ({ ...prev, [columnName]: allValues }));
    };

    const clearColumnFilter = (columnName) => {
        setColumnFilters(prev => {
            const { [columnName]: _, ...rest } = prev;
            return rest;
        });
    };

    // Sorting function
    const handleSort = (columnName) => {
        if (sortColumn === columnName) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(columnName);
            setSortDirection('asc');
        }
    };

    // Apply filters and sorting
    const getFilteredAndSortedForms = () => {
        let filtered = [...forms];

        // Apply column filters
        Object.keys(columnFilters).forEach(columnName => {
            const selectedValues = columnFilters[columnName];
            if (selectedValues && selectedValues.length > 0) {
                filtered = filtered.filter(form => {
                    let value = form[columnName];
                    if (columnName === 'status') {
                        value = value === 'active' ? 'Ativo' : 'Inativo';
                    }
                    return selectedValues.includes(String(value));
                });
            }
        });

        // Apply sorting
        if (sortColumn) {
            filtered.sort((a, b) => {
                let aValue = a[sortColumn];
                let bValue = b[sortColumn];

                // Handle dates
                if (sortColumn === 'createdAt' || sortColumn === 'lastModified') {
                    aValue = new Date(aValue);
                    bValue = new Date(bValue);
                }

                let comparison = 0;
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    comparison = aValue - bValue;
                } else if (aValue instanceof Date && bValue instanceof Date) {
                    comparison = aValue - bValue;
                } else {
                    comparison = String(aValue || '').localeCompare(String(bValue || ''));
                }

                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }

        return filtered;
    };

    const filteredForms = getFilteredAndSortedForms();

    // Apply pagination
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedForms = filteredForms.slice(startIndex, endIndex);
    const totalFiltered = filteredForms.length;
    const calculatedTotalPages = Math.ceil(totalFiltered / ITEMS_PER_PAGE);

    // Reset to page 1 when filters or sorting changes
    useEffect(() => {
        setPage(1);
    }, [columnFilters, sortColumn, sortDirection]);

    // Export to CSV
    const exportToCSV = () => {
        const headers = ['Nome', 'Descrição', 'Destino', 'Criado em', 'Última Modificação', 'Link', 'Status'];
        const csvData = filteredForms.map(form => [
            form.name,
            form.description,
            form.destination,
            new Date(form.createdAt).toLocaleDateString('pt-BR'),
            new Date(form.lastModified).toLocaleDateString('pt-BR'),
            form.link,
            form.status === 'active' ? 'Ativo' : 'Inativo'
        ]);

        const csvContent = [
            headers.join(','),
            ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `formularios_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const activeFiltersCount = Object.keys(columnFilters).length;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Gestão de Formulários</h1>
                    <p className="text-sm text-gray-500 mt-1">Visualize e gerencie os formulários do sistema</p>
                </div>

                {/* Search and Export */}
                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:min-w-[320px]">
                        <input
                            type="text"
                            placeholder="Buscar por nome, descrição ou destino..."
                            className="input input-bordered w-full pl-10 bg-gray-50 border-gray-300 focus:border-primary focus:bg-white"
                            value={search}
                            onChange={handleSearch}
                        />
                        <FaSearch className="absolute left-3 top-3.5 text-gray-400" />
                    </div>
                    <button
                        onClick={exportToCSV}
                        className="btn btn-primary gap-2 shadow-md hover:shadow-lg transition-shadow"
                    >
                        <FaFileDownload />
                        CSV
                    </button>
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                    <div>
                        <p className="text-sm font-medium text-blue-700">Total de Formulários</p>
                        <p className="text-4xl font-bold text-blue-900 mt-2">{forms.length}</p>
                        <p className="text-xs text-blue-600 mt-1">Cadastrados no sistema</p>
                    </div>
                    <div className="bg-blue-200 bg-opacity-50 p-4 rounded-full">
                        <FaWpforms className="text-5xl text-blue-700" />
                    </div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                    <div>
                        <p className="text-sm font-medium text-green-700">Formulários Ativos</p>
                        <p className="text-4xl font-bold text-green-900 mt-2">{forms.filter(f => f.status === 'active').length}</p>
                        <p className="text-xs text-green-600 mt-1">Disponíveis para uso</p>
                    </div>
                    <div className="bg-green-200 bg-opacity-50 p-4 rounded-full">
                        <FaCheckCircle className="text-5xl text-green-700" />
                    </div>
                </div>
            </div>

            {/* Active Filters Indicator */}
            {activeFiltersCount > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm text-blue-800">
                        <strong>{activeFiltersCount}</strong> filtro(s) ativo(s) • Exibindo <strong>{filteredForms.length}</strong> de <strong>{forms.length}</strong> formulários
                    </span>
                    <button
                        onClick={() => setColumnFilters({})}
                        className="btn btn-ghost btn-xs text-error"
                    >
                        🗑️ Limpar Filtros
                    </button>
                </div>
            )}

            {/* Table Card */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table table-zebra w-full">
                        <thead>
                            <tr className="bg-gray-100 border-b-2 border-gray-300">
                                {columns.map((col) => (
                                    <th key={col.name} className={`font-semibold text-gray-700 py-4 px-6 ${col.width || ''}`}>
                                        <div className="flex items-center gap-2">
                                            {col.sortable ? (
                                                <span
                                                    className="cursor-pointer hover:text-primary transition-colors select-none flex items-center gap-1"
                                                    onClick={() => handleSort(col.name)}
                                                    title="Clique para ordenar"
                                                >
                                                    {col.label}
                                                    {sortColumn === col.name && (
                                                        <span className="text-primary text-sm">
                                                            {sortDirection === 'asc' ? '▲' : '▼'}
                                                        </span>
                                                    )}
                                                </span>
                                            ) : (
                                                <span>{col.label}</span>
                                            )}
                                            {col.filterable && (
                                                <ColumnFilter
                                                    column={col}
                                                    uniqueValues={getUniqueValues(col.name)}
                                                    selectedValues={columnFilters[col.name] || []}
                                                    onToggleValue={toggleFilterValue}
                                                    onSelectAll={selectAllValues}
                                                    onClear={clearColumnFilter}
                                                />
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={columns.length} className="text-center py-16">
                                        <span className="loading loading-spinner loading-lg text-primary"></span>
                                        <p className="text-gray-500 mt-2">Carregando formulários...</p>
                                    </td>
                                </tr>
                            ) : paginatedForms.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length} className="text-center py-16 text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <FaSearch className="text-4xl text-gray-300" />
                                            <p className="font-medium">Nenhum formulário encontrado</p>
                                            <p className="text-sm">Tente ajustar os filtros ou busca</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedForms.map((form) => (
                                    <tr key={form.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="font-medium text-gray-900 py-4 px-6">{form.name}</td>
                                        <td className="text-gray-600 py-4 px-6 max-w-[90px] truncate" title={form.description}>
                                            {form.description}
                                        </td>
                                        <td className="text-gray-600 py-4 px-6">
                                            <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-700 text-sm">
                                                {form.destination}
                                            </span>
                                        </td>
                                        <td className="text-gray-600 py-4 px-3 whitespace-nowrap w-28 text-center">{new Date(form.createdAt).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="text-gray-600 py-4 px-3 whitespace-nowrap w-28 text-center">{new Date(form.lastModified).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <a
                                                href={form.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-ghost btn-sm btn-circle text-primary hover:bg-primary hover:text-white tooltip transition-all"
                                                data-tip="Abrir Formulário"
                                            >
                                                <FaExternalLinkAlt className="text-lg" />
                                            </a>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${form.status === 'active'
                                                ? 'bg-green-100 text-green-800 border border-green-200'
                                                : 'bg-red-100 text-red-800 border border-red-200'
                                                }`}>
                                                {form.status === 'active' ? '✓ Ativo' : '✗ Inativo'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-sm text-gray-600">
                        Exibindo <span className="font-semibold text-gray-900">{startIndex + 1}-{Math.min(endIndex, totalFiltered)}</span> de <span className="font-semibold text-gray-900">{totalFiltered}</span> itens
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            className="btn btn-sm btn-ghost border border-gray-300"
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                        >
                            ← Anterior
                        </button>

                        <div className="flex gap-1">
                            {[...Array(Math.min(5, calculatedTotalPages))].map((_, idx) => {
                                const pageNum = idx + 1;
                                return (
                                    <button
                                        key={pageNum}
                                        className={`btn btn-sm ${page === pageNum ? 'btn-primary' : 'btn-ghost border border-gray-300'}`}
                                        onClick={() => setPage(pageNum)}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            {calculatedTotalPages > 5 && (
                                <>
                                    <span className="flex items-center px-2">...</span>
                                    <button
                                        className={`btn btn-sm ${page === calculatedTotalPages ? 'btn-primary' : 'btn-ghost border border-gray-300'}`}
                                        onClick={() => setPage(calculatedTotalPages)}
                                    >
                                        {calculatedTotalPages}
                                    </button>
                                </>
                            )}
                        </div>

                        <button
                            className="btn btn-sm btn-ghost border border-gray-300"
                            disabled={page >= calculatedTotalPages}
                            onClick={() => setPage(p => p + 1)}
                        >
                            Próximo →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminFormsPage;
