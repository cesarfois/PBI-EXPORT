import { useState, useEffect } from 'react';

// import Navbar from '../components/Layout/Navbar';
// import Footer from '../components/Layout/Footer';
import { workflowService } from '../services/workflowService';
import { FaSitemap, FaSync, FaTasks, FaInfoCircle } from 'react-icons/fa';

const WorkflowAnalyticsPage = () => {
    const [workflows, setWorkflows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchWorkflows = async () => {
        try {
            setError(null);
            setLoading(true);
            console.log('[WorkflowAnalyticsPage] Fetching workflows...');

            const data = await workflowService.getMyWorkflowsWithCounts();
            setWorkflows(data);

            console.log(`[WorkflowAnalyticsPage] ✅ Loaded ${data.length} workflows`);
        } catch (err) {
            console.error('[WorkflowAnalyticsPage] ❌ Error loading workflows:', err);
            setError(err.message || 'Erro ao carregar workflows. Verifique a configuração da API Key.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchWorkflows();
    };

    const getTotalInstances = () => {
        return workflows.reduce((sum, wf) => sum + wf.activeInstanceCount, 0);
    };

    return (
        <div className="flex flex-col h-full bg-base-200">
            <div className="flex-1 p-4 flex flex-col h-full overflow-hidden">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <FaSitemap className="w-6 h-6 text-primary" />
                        <h1 className="text-3xl font-bold">Meus Fluxos</h1>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={loading || refreshing}
                        className={`btn btn-primary btn-sm gap-2 ${refreshing ? 'loading' : ''}`}
                    >
                        {!refreshing && <FaSync />}
                        Atualizar
                    </button>
                </div>

                {/* Info Banner */}
                <div className="alert alert-info mb-6">
                    <FaInfoCircle className="w-5 h-5" />
                    <div>
                        <h3 className="font-bold">Meus Fluxos</h3>
                        <div className="text-sm">
                            Visualização dos workflows ativos de acordo com suas permissões de acesso.
                        </div>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <span className="loading loading-spinner loading-lg text-primary"></span>
                        <p className="mt-4 text-lg">Carregando workflows...</p>
                    </div>
                )}

                {/* Error State */}
                {error && !loading && (
                    <div className="alert alert-error shadow-lg">
                        <div>
                            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <h3 className="font-bold">Erro ao carregar workflows</h3>
                                <div className="text-sm">{error}</div>
                                <div className="text-xs mt-2 opacity-75">
                                    💡 Dica: Verifique se a API Key tem permissão para acessar workflows. Abra o Console (F12) para mais detalhes.
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Summary Card */}
                {!loading && !error && workflows.length > 0 && (
                    <div className="stats shadow mb-6 w-full">
                        <div className="stat">
                            <div className="stat-figure text-primary">
                                <FaSitemap className="w-8 h-8" />
                            </div>
                            <div className="stat-title">Total de Workflows</div>
                            <div className="stat-value text-primary">{workflows.length}</div>
                            <div className="stat-desc">Workflows ativos no sistema</div>
                        </div>

                        <div className="stat">
                            <div className="stat-figure text-secondary">
                                <FaTasks className="w-8 h-8" />
                            </div>
                            <div className="stat-title">Instâncias Ativas</div>
                            <div className="stat-value text-secondary">{getTotalInstances()}</div>
                            <div className="stat-desc">Total de tarefas em andamento</div>
                        </div>
                    </div>
                )}

                {/* Workflows Grid */}
                {!loading && !error && workflows.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {workflows.map((workflow) => (
                            <div key={workflow.id} className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                                <div className="card-body">
                                    <h2 className="card-title text-lg">
                                        <FaSitemap className="text-primary" />
                                        <span className="truncate">{workflow.name}</span>
                                    </h2>

                                    {workflow.description && (
                                        <p className="text-sm text-base-content/70 line-clamp-2 mb-2">
                                            {workflow.description}
                                        </p>
                                    )}

                                    <div className="divider my-2"></div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-base-content/60">
                                            Instâncias Ativas:
                                        </span>
                                        <div className={`badge ${workflow.activeInstanceCount > 0 ? 'badge-primary' : 'badge-ghost'} badge-lg`}>
                                            {workflow.activeInstanceCount}
                                        </div>
                                    </div>

                                    {workflow.activeInstanceCount > 0 && (
                                        <div className="mt-2">
                                            <progress
                                                className="progress progress-primary w-full"
                                                value={workflow.activeInstanceCount}
                                                max={getTotalInstances()}
                                            ></progress>
                                            <p className="text-xs text-center mt-1 text-base-content/50">
                                                {((workflow.activeInstanceCount / getTotalInstances()) * 100).toFixed(1)}% do total
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && workflows.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <FaSitemap className="w-20 h-20 text-base-content/20 mb-4" />
                        <h2 className="text-2xl font-bold text-base-content/60 mb-2">
                            Nenhum Workflow Encontrado
                        </h2>
                        <p className="text-base-content/50">
                            Não há workflows ativos no sistema no momento.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkflowAnalyticsPage;
