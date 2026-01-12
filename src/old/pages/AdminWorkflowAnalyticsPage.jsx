import { useState, useMemo } from 'react';
// import Navbar from '../components/Layout/Navbar';
// import Footer from '../components/Layout/Footer';
import { useOptimizedWorkflows } from '../hooks/useOptimizedWorkflows';
import { useFileCabinets } from '../hooks/useFileCabinets';
import VirtualWorkflowList from '../components/Workflow/VirtualWorkflowList';
import WorkflowDetailsModal from '../components/Workflow/WorkflowDetailsModal';
import { adminWorkflowService } from '../services/adminWorkflowService';
import { FaShieldAlt, FaSync, FaSearch, FaSitemap, FaTasks, FaFileCsv } from 'react-icons/fa';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

const AdminWorkflowAnalyticsPage = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const scopeKey = user?.url || '';

    // 1. Optimized Hook: Fetches only the lightweight index (ID + Name)
    // Cached for 24h, loads instantly on return
    const { workflows, isLoading, error, refetch } = useOptimizedWorkflows(scopeKey);

    // 2. Global FC Map (for names)
    const { fcMap } = useFileCabinets();

    // 3. Optional: Global Stats (Background Sync)
    // This fetches counts for ALL workflows to populate the "Totals" card
    const { data: stats, isFetching: isStatsLoading, refetch: refetchStats } = useQuery({
        queryKey: ['workflow-global-stats', scopeKey], // Scope by user URL
        queryFn: async () => {
            setLoadingProgress(0);
            const allWithCounts = await adminWorkflowService.getWorkflowsWithCounts(null, (current, total) => {
                const pct = Math.round((current / total) * 100);
                setLoadingProgress(pct);
            });

            // Restore transformation logic
            const totalInstances = allWithCounts.reduce((sum, wf) => sum + wf.activeInstanceCount, 0);
            const countsMap = allWithCounts.reduce((acc, wf) => {
                acc[wf.id] = wf.activeInstanceCount;
                return acc;
            }, {});

            return { totalInstances, countsMap };
        },
        staleTime: 1000 * 60 * 15, // 15 min cache
        placeholderData: { totalInstances: 0, countsMap: {} }
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [showOnlyActive, setShowOnlyActive] = useState(true);
    const [selectedWorkflow, setSelectedWorkflow] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);

    // 2. Local Filtering
    const filteredWorkflows = useMemo(() => {
        if (!workflows) return [];

        let filtered = workflows;

        // Filter by Active Only (needs background stats)
        if (showOnlyActive && stats?.countsMap) {
            filtered = filtered.filter(w => (stats.countsMap[w.id] || 0) > 0);
        }

        // Search Filter
        if (searchTerm) {
            filtered = filtered.filter(w =>
                w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                w.id.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        return filtered;
    }, [workflows, searchTerm, showOnlyActive, stats]);

    // Handle Row Click (Lazy Load Tasks)
    const handleWorkflowClick = async (rowSummary) => {
        // rowSummary contains { id, name, activeInstanceCount, fileCabinetId, ... } passed from WorkflowRow

        // Initialize modal with available info
        setSelectedWorkflow({
            ...rowSummary,
            tasks: [],
            loadingTasks: true
        });
        setShowDetailsModal(true);

        try {
            console.log(`[Admin] Loading tasks for ${rowSummary.id}...`);
            // Fetch active tasks for the modal list
            const tasks = await adminWorkflowService.getWorkflowTasks(rowSummary.id);

            // Should we ensure we have the FileCabinetId? 
            // WorkflowRow passes it if loaded. If not, we might want to fetch details here.
            let fcId = rowSummary.fileCabinetId;
            if (!fcId) {
                const details = await adminWorkflowService.getWorkflowDetails(rowSummary.id);
                fcId = details.FileCabinetId;
            }

            setSelectedWorkflow(prev => ({
                ...prev,
                fileCabinetId: fcId,
                tasks: tasks,
                loadingTasks: false
            }));
        } catch (err) {
            console.error('Error loading tasks:', err);
            setSelectedWorkflow(prev => ({
                ...prev,
                loadingTasks: false,
                error: 'Falha ao carregar tarefas.'
            }));
        }
    };

    const handleCloseModal = () => {
        setShowDetailsModal(false);
        setSelectedWorkflow(null);
    };

    const handleRefresh = () => {
        // Invalidate specific queries to ensure hard refresh
        queryClient.invalidateQueries({ queryKey: ['workflows-index-v2', scopeKey] });
        queryClient.invalidateQueries({ queryKey: ['workflow-global-stats', scopeKey] });

        // Trigger refetch
        refetch();
        refetchStats();
    };

    return (
        <div className="flex flex-col h-full bg-base-200">
            <div className="flex-1 p-4 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4 flex-none relative">
                    {/* Real Progress Bar */}


                    <div className="flex items-center gap-3">
                        <FaShieldAlt className="w-6 h-6 text-error" />
                        <h1 className="text-2xl font-bold">Monitoramento de Workflows (Otimizado)</h1>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        {/* Active Only Toggle */}
                        <div className="form-control">
                            <label className="label cursor-pointer gap-2">
                                <span className="label-text font-semibold text-xs uppercase tracking-wide">Apenas Ativos</span>
                                <input
                                    type="checkbox"
                                    className="toggle toggle-primary toggle-sm"
                                    checked={showOnlyActive}
                                    onChange={(e) => setShowOnlyActive(e.target.checked)}
                                />
                            </label>
                        </div>

                        <div className="relative w-full md:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FaSearch className="text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar workflow..."
                                className="input input-bordered pl-10 w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <button
                            onClick={handleRefresh}
                            className={`btn btn-square btn-ghost ${isLoading || isStatsLoading ? 'loading' : ''}`}
                            title="Recarregar índice e estatísticas"
                        >
                            {!(isLoading || isStatsLoading) && <FaSync />}
                        </button>
                    </div>
                </div>

                {/* Global Loading Alert */}
                {(isLoading || isStatsLoading) && (
                    <div className="alert alert-info shadow-lg mb-4 rounded-box animate-in fade-in zoom-in duration-300">
                        <FaSync className="animate-spin w-6 h-6" />
                        <div>
                            <h3 className="font-bold">Carregando dados</h3>
                            <div className="text-xs">Sincronizando índice e contabilizando tarefas... {loadingProgress}%</div>
                        </div>
                    </div>
                )}



                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 flex-none">
                    <div className="stat bg-base-100 shadow rounded-box border border-base-200">
                        <div className="stat-figure text-primary">
                            <FaSitemap className="w-8 h-8 opacity-50" />
                        </div>
                        <div className="stat-title">Workflows Listados</div>
                        <div className="stat-value text-primary">{filteredWorkflows.length}</div>
                        <div className="stat-desc">De um total de {workflows?.length || 0} indexados</div>
                    </div>

                    <div className="stat bg-base-100 shadow rounded-box border border-base-200">
                        <div className="stat-figure text-secondary">
                            <FaTasks className="w-8 h-8 opacity-50" />
                        </div>
                        <div className="stat-title">Instâncias Ativas</div>
                        <div className="stat-value text-secondary">
                            {stats?.totalInstances > 0 ? (
                                stats.totalInstances.toLocaleString()
                            ) : (
                                <span className="loading loading-dots loading-md"></span>
                            )}
                        </div>
                        <div className="stat-desc">Total de tarefas pendentes</div>
                    </div>
                </div>

                {/* Main Content Area (Virtualized List) */}
                <div className="flex-1 bg-base-100 rounded-box shadow-lg border border-base-200 overflow-hidden flex flex-col" style={{ minHeight: '500px' }}>
                    {/* Status Bar */}
                    <div className="bg-base-200 px-4 py-2 flex items-center justify-end flex-none">
                        <button
                            className="btn btn-outline btn-primary btn-sm gap-2"
                            onClick={() => {
                                if (!filteredWorkflows?.length) return;
                                const headers = ['Nome do Workflow', 'Tarefas', 'Armário', 'Workflow ID', 'Armário ID'];
                                const rows = filteredWorkflows.map(wf => {
                                    const count = stats?.countsMap?.[wf.id] || 0;
                                    const fcName = fcMap?.[wf.fileCabinetId] || 'Desconhecido';
                                    const safeName = `"${(wf.name || '').replace(/"/g, '""')}"`;
                                    const safeFC = `"${(fcName || '').replace(/"/g, '""')}"`;
                                    return [safeName, count, safeFC, wf.id, wf.fileCabinetId].join(',');
                                });
                                const csvContent = [headers.join(','), ...rows].join('\n');
                                // Add BOM for Excel to recognize UTF-8
                                const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.setAttribute('download', `workflows_${new Date().toISOString().slice(0, 10)}.csv`);
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                            title="Exportar dados para CSV"
                            disabled={!filteredWorkflows?.length}
                        >
                            <FaFileCsv /> Export CSV
                        </button>
                    </div>

                    {/* Virtual List */}
                    <div className="flex-1 min-h-0">
                        {isLoading && workflows.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center">
                                <span className="loading loading-spinner loading-lg text-primary"></span>
                                <p className="mt-4 text-opacity-70">Carregando índice mestre...</p>
                            </div>
                        ) : error ? (
                            <div className="p-8 text-center text-error">
                                <h3 className="font-bold">Erro ao carregar índice</h3>
                                <p>{error.message}</p>
                                <button onClick={() => refetch()} className="btn btn-sm btn-outline btn-error mt-4">Tentar novamente</button>
                            </div>
                        ) : (
                            <VirtualWorkflowList
                                workflows={filteredWorkflows}
                                fcMap={fcMap}
                                onRowClick={handleWorkflowClick}
                            />
                        )}
                    </div>
                </div>

                {/* Modal */}
                {selectedWorkflow && (
                    <WorkflowDetailsModal
                        workflow={selectedWorkflow}
                        isOpen={showDetailsModal}
                        onClose={handleCloseModal}
                    />
                )}
            </div>
        </div>
    );
};

export default AdminWorkflowAnalyticsPage;
