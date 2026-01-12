import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { FaTimes, FaCopy, FaExclamationTriangle, FaClock, FaUsers, FaTasks, FaExternalLinkAlt, FaEye, FaFileCsv } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const WorkflowDetailsModal = ({ workflow, isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('tasks');
    const [sortBy, setSortBy] = useState('age');
    const [sortDesc, setSortDesc] = useState(true);

    // Helper to extract value from ColumnValues array
    const getColumnValue = (task, columnId) => {
        if (!task.ColumnValues) return null;
        const column = task.ColumnValues.find(col => col.Id === columnId);
        return column?.Value?.Item || null;
    };

    // Calculate task age in days
    const calculateAge = (receivedDate) => {
        const received = new Date(receivedDate);
        const now = new Date();
        const diffTime = Math.abs(now - received);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    // Get age color
    const getAgeColor = (days) => {
        if (days < 7) return 'badge-success';
        if (days < 14) return 'badge-warning';
        if (days < 30) return 'badge-orange-500';
        return 'badge-error';
    };

    // Process tasks data - extract from ColumnValues array
    const processedTasks = useMemo(() => {
        if (!workflow || !workflow.tasks || workflow.tasks.length === 0) return [];

        return workflow.tasks.map(task => {
            // Extract values from ColumnValues array
            const activityName = getColumnValue(task, 'WF_Activity') || 'N/A';
            const userName = getColumnValue(task, 'WF_Task_User_Name') || 'Não atribuído';
            const receivedDateStr = getColumnValue(task, 'WF_Received_On');

            // Parse DocuWare date format: /Date(1764590400000)/
            let receivedDate = null;
            let age = 0;

            if (receivedDateStr && typeof receivedDateStr === 'string') {
                const match = receivedDateStr.match(/\/Date\((\d+)\)\//);
                if (match) {
                    receivedDate = new Date(parseInt(match[1]));
                    age = calculateAge(receivedDate);
                }
            }

            return {
                ...task,
                ActivityName: activityName,
                AssignedTo: userName,
                ReceivedDate: receivedDate,
                age,
                formattedDate: receivedDate ? receivedDate.toLocaleDateString('pt-PT', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'N/A'
            };
        });
    }, [workflow]);

    // Sort tasks
    const sortedTasks = useMemo(() => {
        const sorted = [...processedTasks];

        sorted.sort((a, b) => {
            let aVal, bVal;

            switch (sortBy) {
                case 'age':
                    aVal = a.age;
                    bVal = b.age;
                    break;
                case 'activity':
                    aVal = a.ActivityName || '';
                    bVal = b.ActivityName || '';
                    break;
                case 'user':
                    aVal = a.AssignedTo || '';
                    bVal = b.AssignedTo || '';
                    break;
                case 'instance':
                    aVal = a.InstanceId || '';
                    bVal = b.InstanceId || '';
                    break;
                default:
                    return 0;
            }

            if (typeof aVal === 'string') {
                return sortDesc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
            }
            return sortDesc ? bVal - aVal : aVal - bVal;
        });

        return sorted;
    }, [processedTasks, sortBy, sortDesc]);

    // Statistics
    const statistics = useMemo(() => {
        if (processedTasks.length === 0) return null;

        // Group by activity
        const byActivity = processedTasks.reduce((acc, task) => {
            const activity = task.ActivityName || 'Sem Atividade';
            if (!acc[activity]) {
                acc[activity] = { count: 0, totalAge: 0 };
            }
            acc[activity].count++;
            acc[activity].totalAge += task.age;
            return acc;
        }, {});

        const activityData = Object.entries(byActivity).map(([name, data]) => ({
            name: name.length > 25 ? name.substring(0, 25) + '...' : name,
            fullName: name,
            count: data.count,
            avgAge: Math.round(data.totalAge / data.count)
        })).sort((a, b) => b.count - a.count).slice(0, 10);

        // Group by user
        const byUser = processedTasks.reduce((acc, task) => {
            const user = task.AssignedTo || 'Não Atribuído';
            acc[user] = (acc[user] || 0) + 1;
            return acc;
        }, {});

        const userData = Object.entries(byUser).map(([name, count]) => ({
            name: name.length > 20 ? name.substring(0, 20) + '...' : name,
            fullName: name,
            count
        })).sort((a, b) => b.count - a.count).slice(0, 10);

        // Age distribution
        const ageRanges = {
            '<7d': 0,
            '7-14d': 0,
            '14-30d': 0,
            '>30d': 0
        };

        processedTasks.forEach(task => {
            if (task.age < 7) ageRanges['<7d']++;
            else if (task.age < 14) ageRanges['7-14d']++;
            else if (task.age < 30) ageRanges['14-30d']++;
            else ageRanges['>30d']++;
        });

        const ageData = Object.entries(ageRanges).map(([range, count]) => ({
            range,
            count
        }));

        // Health status
        const criticalCount = processedTasks.filter(t => t.age > 30).length;
        const warningCount = processedTasks.filter(t => t.age >= 14 && t.age <= 30).length;

        let healthStatus = 'healthy';
        if (criticalCount > 0) healthStatus = 'critical';
        else if (warningCount > 0) healthStatus = 'warning';

        return {
            activityData,
            userData,
            ageData,
            healthStatus,
            avgAge: Math.round(processedTasks.reduce((sum, t) => sum + t.age, 0) / processedTasks.length),
            oldestTask: Math.max(...processedTasks.map(t => t.age)),
            criticalCount,
            warningCount
        };
    }, [processedTasks]);

    // Bottlenecks
    const bottlenecks = useMemo(() => {
        if (!statistics) return [];

        return statistics.activityData
            .filter(a => a.count >= 3 || a.avgAge > 14)
            .slice(0, 5)
            .map(a => ({
                ...a,
                severity: a.avgAge > 30 ? 'critical' : a.avgAge > 14 ? 'warning' : 'info'
            }));
    }, [statistics]);

    // Early return AFTER all hooks
    if (!isOpen || !workflow) return null;

    const handleSort = (column) => {
        if (sortBy === column) {
            setSortDesc(!sortDesc);
        } else {
            setSortBy(column);
            setSortDesc(true);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    const getHealthIcon = (status) => {
        switch (status) {
            case 'critical': return '🔴';
            case 'warning': return '🟡';
            default: return '🟢';
        }
    };

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-6xl h-[90vh] flex flex-col p-0">


                {/* Export Button */}
                <div className="absolute top-6 right-16 mr-4">
                    <button
                        onClick={async () => {
                            if (!sortedTasks || sortedTasks.length === 0) return;

                            const confirmExport = window.confirm(`Deseja exportar o histórico detalhado de ${sortedTasks.length} instâncias? Isso pode levar algum tempo.`);
                            if (!confirmExport) return;

                            try {
                                const BOM = '\uFEFF';
                                let csvContent = BOM;

                                // Dynamic Headers based on first task's columns + Fixed Headers
                                // We want InstanceID FIRST as requested
                                const fixedHeaders = ['Instance GUID', 'DocId', 'Workflow Name', 'Current Activity', 'Current User', 'Received On'];
                                const historyHeaders = ['History Activity', 'History User', 'History Date', 'History Decision', 'History Message'];

                                // Get dynamic column headers from the first task if available
                                let dynamicHeaders = [];
                                if (sortedTasks.length > 0 && sortedTasks[0].ColumnValues) {
                                    dynamicHeaders = sortedTasks[0].ColumnValues
                                        .map(c => c.FieldName)
                                        .filter(name => !['WF_Activity', 'WF_Task_User_Name', 'WF_Received_On'].includes(name));
                                }

                                const headerRow = [...fixedHeaders, ...dynamicHeaders, ...historyHeaders].join(',');
                                csvContent += headerRow + '\n';

                                // Iterate over all tasks
                                for (let i = 0; i < sortedTasks.length; i++) {
                                    const task = sortedTasks[i];

                                    // Base data for this instance
                                    const instanceId = task.InstanceId || '';
                                    const docId = task.DocId || '';
                                    const wfName = workflow.name || '';
                                    const currActivity = task.ActivityName || '';
                                    const currUser = task.AssignedTo || '';
                                    const receivedOn = task.formattedDate || '';

                                    // Get dynamic values
                                    const dynamicValues = dynamicHeaders.map(header => {
                                        const col = task.ColumnValues?.find(c => c.FieldName === header);
                                        const val = col?.Value?.Item || '';
                                        return `"${String(val).replace(/"/g, '""')}"`;
                                    });

                                    // Fetch History
                                    /* global adminWorkflowService */
                                    // Need to import service or pass it. 
                                    // Since we are in a component, we should import it at top.
                                    // Assuming it's imported as 'adminWorkflowService'
                                    const history = await import('../../services/adminWorkflowService').then(m => m.adminWorkflowService.getWorkflowInstanceHistory(workflow.id, instanceId));

                                    if (history && history.length > 0) {
                                        // create a row for each history step
                                        history.forEach(step => {
                                            const histActivity = step.ActivityName || '';
                                            const histUser = step.UserName || '';
                                            const histDate = step.TimeStamp ? new Date(step.TimeStamp).toLocaleString('pt-PT') : '';
                                            const histDecision = step.DecisionLabel || '';
                                            const histMessage = step.Message || '';

                                            const row = [
                                                instanceId,
                                                docId,
                                                `"${wfName.replace(/"/g, '""')}"`,
                                                `"${currActivity.replace(/"/g, '""')}"`,
                                                `"${currUser.replace(/"/g, '""')}"`,
                                                `"${receivedOn.replace(/"/g, '""')}"`,
                                                ...dynamicValues,
                                                `"${histActivity.replace(/"/g, '""')}"`,
                                                `"${histUser.replace(/"/g, '""')}"`,
                                                `"${histDate.replace(/"/g, '""')}"`,
                                                `"${histDecision.replace(/"/g, '""')}"`,
                                                `"${histMessage.replace(/"/g, '""')}"`
                                            ].join(',');

                                            csvContent += row + '\n';
                                        });
                                    } else {
                                        // No history or failed, just print current state
                                        const row = [
                                            instanceId,
                                            docId,
                                            `"${wfName.replace(/"/g, '""')}"`,
                                            `"${currActivity.replace(/"/g, '""')}"`,
                                            `"${currUser.replace(/"/g, '""')}"`,
                                            `"${receivedOn.replace(/"/g, '""')}"`,
                                            ...dynamicValues,
                                            'No History / Current',
                                            '',
                                            '',
                                            '',
                                            ''
                                        ].join(',');
                                        csvContent += row + '\n';
                                    }
                                }

                                // Trigger Download
                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.setAttribute('download', `${workflow.name}_History_${new Date().toISOString().slice(0, 10)}.csv`);
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);

                            } catch (err) {
                                console.error('Export failed:', err);
                                alert('Erro ao exportar histórico. Verifique o console.');
                            }
                        }}
                        className="btn btn-sm btn-outline btn-success gap-2"
                        title="Exportar Histórico Completo (CSV)"
                    >
                        <FaFileCsv /> Exportar Histórico
                    </button>
                </div>

                {/* Header */}
                <div className="sticky top-0 bg-base-100 border-b border-base-300 p-6 z-10">
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-2xl font-bold">{workflow.name}</h3>
                                {statistics && (
                                    <span className="text-3xl">{getHealthIcon(statistics.healthStatus)}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <code className="bg-base-200 px-2 py-1 rounded">{workflow.id}</code>
                                <button
                                    className="btn btn-ghost btn-xs"
                                    onClick={() => copyToClipboard(workflow.id)}
                                >
                                    <FaCopy />
                                </button>
                            </div>
                            <div className="flex gap-4 mt-3">
                                <div className="badge badge-lg badge-error gap-2">
                                    <FaTasks />
                                    {workflow.activeInstanceCount} tarefas ativas
                                </div>
                                {statistics && (
                                    <>
                                        <div className="badge badge-lg badge-info gap-2">
                                            <FaClock />
                                            Média: {statistics.avgAge}d
                                        </div>
                                        {statistics.criticalCount > 0 && (
                                            <div className="badge badge-lg badge-error gap-2">
                                                <FaExclamationTriangle />
                                                {statistics.criticalCount} críticas
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="btn btn-sm btn-circle btn-ghost"
                        >
                            <FaTimes className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="tabs tabs-boxed bg-base-200 px-6 py-2 sticky top-[140px] z-10">
                    <a
                        className={`tab ${activeTab === 'tasks' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('tasks')}
                    >
                        Tarefas Ativas ({processedTasks.length})
                    </a>
                    <a
                        className={`tab ${activeTab === 'statistics' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('statistics')}
                    >
                        Estatísticas
                    </a>
                    <a
                        className={`tab ${activeTab === 'bottlenecks' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('bottlenecks')}
                    >
                        Gargalos ({bottlenecks.length})
                    </a>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Loading State */}
                    {workflow.loadingTasks && (
                        <div className="flex flex-col items-center justify-center py-20">
                            <span className="loading loading-spinner loading-lg text-error"></span>
                            <p className="mt-4">Carregando tarefas...</p>
                        </div>
                    )}

                    {/* Error State */}
                    {workflow.error && !workflow.loadingTasks && (
                        <div className="alert alert-error">
                            <span>Erro ao carregar tarefas: {workflow.error}</span>
                        </div>
                    )}

                    {/* Active Tasks Tab */}
                    {!workflow.loadingTasks && !workflow.error && activeTab === 'tasks' && (
                        <div className="overflow-x-auto">
                            {sortedTasks.length > 0 ? (
                                <table className="table table-zebra w-full">
                                    <thead>
                                        <tr>
                                            <th>Doc ID</th>
                                            <th onClick={() => handleSort('activity')} className="cursor-pointer hover:bg-base-200">
                                                Atividade {sortBy === 'activity' && (sortDesc ? '↓' : '↑')}
                                            </th>
                                            <th onClick={() => handleSort('user')} className="cursor-pointer hover:bg-base-200">
                                                Usuário {sortBy === 'user' && (sortDesc ? '↓' : '↑')}
                                            </th>
                                            <th>Data de Recebimento</th>
                                            <th onClick={() => handleSort('age')} className="cursor-pointer hover:bg-base-200">
                                                Idade {sortBy === 'age' && (sortDesc ? '↓' : '↑')}
                                            </th>
                                            <th onClick={() => handleSort('instance')} className="cursor-pointer hover:bg-base-200">
                                                Instance ID {sortBy === 'instance' && (sortDesc ? '↓' : '↑')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedTasks.map((task, idx) => {
                                            // File Cabinet ID comes from workflow level, not task
                                            // Using workflow.fileCabinetId passed from parent
                                            const fileCabinetId = workflow.fileCabinetId;
                                            const organizationId = 'bcb91903-58eb-49c6-8572-be5e3bb9611e'; // RCS Angola Org ID

                                            // Only create link if we have both DocId and FileCabinetId
                                            const docLink = task.DocId && fileCabinetId ?
                                                `https://rcsangola.docuware.cloud/DocuWare/Platform/WebClient/${organizationId}/Integration?fc=${fileCabinetId}&did=${task.DocId}&p=V` :
                                                null;

                                            return (<tr key={idx}>
                                                <td>
                                                    {task.DocId ? (
                                                        <div className="flex items-center gap-3">
                                                            <a
                                                                href={docLink}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="btn btn-sm bg-[#4f46e5] hover:bg-[#4338ca] text-white border-none gap-2 px-3 shadow-sm hover:shadow-md transition-all rounded-md font-medium"
                                                                title="Visualizar documento"
                                                            >
                                                                <FaEye className="text-sm" /> View
                                                            </a>
                                                            <span className="font-bold text-gray-700 font-mono text-base">{task.DocId}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-base-content/50">N/A</span>
                                                    )}
                                                </td>
                                                <td className="font-medium">{task.ActivityName || 'N/A'}</td>
                                                <td>{task.AssignedTo || 'Não atribuído'}</td>
                                                <td className="text-sm">{task.formattedDate}</td>
                                                <td>
                                                    <div className={`badge ${getAgeColor(task.age)}`}>
                                                        {task.age}d
                                                    </div>
                                                </td>
                                                <td>
                                                    <code className="text-xs">{task.InstanceId}</code>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-center py-10 text-base-content/50">
                                    Nenhuma tarefa ativa neste workflow
                                </div>
                            )}
                        </div>
                    )}

                    {/* Statistics Tab */}
                    {!workflow.loadingTasks && !workflow.error && activeTab === 'statistics' && statistics && (
                        <div className="space-y-6">
                            {/* Age Distribution */}
                            <div className="card bg-base-100 shadow">
                                <div className="card-body">
                                    <h4 className="card-title text-lg">Distribuição por Idade</h4>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={statistics.ageData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="range" />
                                            <YAxis />
                                            <Tooltip />
                                            <Bar dataKey="count" fill="#f87171" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* By Activity */}
                            <div className="card bg-base-100 shadow">
                                <div className="card-body">
                                    <h4 className="card-title text-lg">Top 10 Atividades</h4>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={statistics.activityData} layout="horizontal">
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" />
                                            <YAxis dataKey="name" type="category" width={150} />
                                            <Tooltip content={({ payload }) => {
                                                if (!payload || !payload[0]) return null;
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-base-100 p-2 border border-base-300 rounded shadow">
                                                        <p className="font-bold">{data.fullName}</p>
                                                        <p>Tarefas: {data.count}</p>
                                                        <p>Média: {data.avgAge}d</p>
                                                    </div>
                                                );
                                            }} />
                                            <Bar dataKey="count" fill="#f97316" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* By User */}
                            <div className="card bg-base-100 shadow">
                                <div className="card-body">
                                    <h4 className="card-title text-lg">Top 10 Usuários</h4>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={statistics.userData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                                            <YAxis />
                                            <Tooltip content={({ payload }) => {
                                                if (!payload || !payload[0]) return null;
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-base-100 p-2 border border-base-300 rounded shadow">
                                                        <p className="font-bold">{data.fullName}</p>
                                                        <p>Tarefas: {data.count}</p>
                                                    </div>
                                                );
                                            }} />
                                            <Bar dataKey="count" fill="#3b82f6" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bottlenecks Tab */}
                    {!workflow.loadingTasks && !workflow.error && activeTab === 'bottlenecks' && (
                        <div className="space-y-4">
                            {bottlenecks.length > 0 ? (
                                bottlenecks.map((bottleneck, idx) => (
                                    <div key={idx} className={`alert ${bottleneck.severity === 'critical' ? 'alert-error' :
                                        bottleneck.severity === 'warning' ? 'alert-warning' :
                                            'alert-info'
                                        }`}>
                                        <FaExclamationTriangle />
                                        <div className="flex-1">
                                            <h4 className="font-bold">{bottleneck.fullName}</h4>
                                            <div className="text-sm">
                                                {bottleneck.count} tarefas • Média de espera: {bottleneck.avgAge} dias
                                            </div>
                                        </div>
                                        <div className="badge badge-lg">
                                            Prioridade {idx + 1}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="alert alert-success">
                                    <span>✅ Nenhum gargalo identificado - workflow funcionando normalmente!</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>

    );
};

WorkflowDetailsModal.propTypes = {
    workflow: PropTypes.object,
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired
};

export default WorkflowDetailsModal;
