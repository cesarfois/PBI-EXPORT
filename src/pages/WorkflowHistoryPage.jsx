import React, { useState, useEffect } from 'react';
import { FaSearch, FaHistory, FaCheckCircle, FaTimesCircle, FaClock, FaUser, FaFilter, FaBan, FaExternalLinkAlt, FaRegCopy, FaList, FaFileCsv } from 'react-icons/fa';
import { workflowAnalyticsService } from '../services/workflowAnalyticsService';
import { docuwareService } from '../services/docuwareService';

const WorkflowHistoryPage = () => {
    const [docId, setDocId] = useState('');
    const [cabinets, setCabinets] = useState([]);
    const [selectedCabinet, setSelectedCabinet] = useState('');
    const [historyInstances, setHistoryInstances] = useState(null); // Changed to instances list
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searched, setSearched] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [showAutoActivities, setShowAutoActivities] = useState(false);
    const [showFieldsModal, setShowFieldsModal] = useState(false);
    const [documentFields, setDocumentFields] = useState([]);
    const [fieldsLoading, setFieldsLoading] = useState(false);

    const [orgId, setOrgId] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Cabinets
                const cabList = await docuwareService.getCabinets();

                // Sort cabinets alphabetically by name
                const sortedCabinets = [...cabList].sort((a, b) =>
                    (a.Name || '').localeCompare(b.Name || '', 'pt-BR', { sensitivity: 'base' })
                );

                setCabinets(sortedCabinets);
                if (sortedCabinets.length > 0) {
                    setSelectedCabinet(sortedCabinets[0].Id);
                }

                // Fetch Organization ID for links
                const oid = await docuwareService.getOrganization();
                if (oid) setOrgId(oid);

            } catch (err) {
                console.error("Failed to load initial data", err);
                setError("Falha ao carregar dados iniciais. Verifique sua conexão.");
            }
        };
        fetchData();
    }, []);

    const handleViewFields = async () => {
        setFieldsLoading(true);
        try {
            const docData = await docuwareService.getDocument(selectedCabinet, docId);
            setDocumentFields(docData.Fields || []);
            setShowFieldsModal(true);
        } catch (err) {
            console.error("Failed to fetch document fields", err);
            // Optional: show a small toast or error
        } finally {
            setFieldsLoading(false);
        }
    };

    // ... handleSearch ...

    // Get Base URL correctly
    const authData = JSON.parse(sessionStorage.getItem('docuware_auth') || '{}');
    const baseUrl = authData.url || '';

    // Construct Integration URL
    const docLink = orgId && baseUrl && docId && selectedCabinet
        ? `${baseUrl}/DocuWare/Platform/WebClient/${orgId}/Integration?fc=${selectedCabinet}&did=${docId}&p=V`
        : '#';


    const handleSearch = async (e) => {
        e.preventDefault();
        if (!docId.trim()) return;

        setLoading(true);
        setSearched(true);
        setHistoryInstances(null); // Reset
        setError(null);
        setActiveTab(0);

        try {
            console.log(`Searching history for DocID: ${docId} (Cabinet: ${selectedCabinet})`);

            // Fetch instances with steps
            const instances = await workflowAnalyticsService.getHistoryByDocId(docId, selectedCabinet);
            console.log('[WorkflowHistory] Instances Data:', instances);

            if (!instances || instances.length === 0) {
                setHistoryInstances([]);
            } else {
                // Sort instances alphabetically by Name, then by Version desc
                const sorted = [...instances].sort((a, b) => {
                    // Primary: Alphabetical by Name
                    const nameA = (a.Name || '').toLowerCase();
                    const nameB = (b.Name || '').toLowerCase();

                    if (nameA < nameB) return -1;
                    if (nameA > nameB) return 1;

                    // Secondary: Version descending
                    return (b.Version || 0) - (a.Version || 0);
                });
                setHistoryInstances(sorted);
            }
        } catch (err) {
            console.error('Search failed:', err);
            setError('Não foi possível obter o histórico. Verifique o DocID e tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    // Helper to determine row styling and icons
    const getStatusStyle = (decision, type) => {
        const lowerDec = (decision || '').toLowerCase();

        if (lowerDec.includes('approve') || lowerDec.includes('aprov') || lowerDec === 'confirmed')
            return { color: 'text-success', icon: <FaCheckCircle className="mr-1" /> };

        if (lowerDec.includes('reject') || lowerDec.includes('rejeita'))
            return { color: 'text-error', icon: <FaTimesCircle className="mr-1" /> };

        if (!type || type === 'WorkflowTask')
            return { color: 'text-warning', icon: <FaClock className="mr-1" /> };

        return { color: 'text-gray-500', icon: null };
    };

    const formatDate = (dateString, simple = false) => {
        if (!dateString) return '';
        let dateObj;
        // Handle "/Date(1766243737337)/" format
        if (typeof dateString === 'string' && dateString.startsWith('/Date(')) {
            const timestamp = parseInt(dateString.match(/\d+/)[0]);
            dateObj = new Date(timestamp);
        } else {
            dateObj = new Date(dateString);
        }

        // Validate date - return empty for invalid or placeholder dates
        if (isNaN(dateObj.getTime())) return '';

        const year = dateObj.getFullYear();
        // DocuWare sometimes returns placeholder dates with years like 3938, 9999, etc.
        // Also filter out dates before 1900 as they're likely invalid
        if (year > 2100 || year < 1900) return '';

        if (simple) return dateObj.toLocaleDateString('pt-BR');
        return dateObj.toLocaleString('pt-BR');
    };

    const filteredSteps = (steps) => {
        if (!steps) return [];
        return showAutoActivities
            ? steps
            : steps.filter(step => {
                const type = step.ActivityType;
                // Allow only explicit user-facing steps + start/end
                return type === 'WorkflowTask' ||
                    type === 'General Task' ||
                    type === 'StartEvent' ||
                    type === 'Start' ||
                    type === 'EndEvent' ||
                    type === 'End';
            });
    };

    const handleExportCSV = async () => {
        if (!historyInstances || historyInstances.length === 0) return;

        try {
            // Ensure we have document fields
            let fieldsToExport = documentFields;
            if (!fieldsToExport || fieldsToExport.length === 0) {
                const docData = await docuwareService.getDocument(selectedCabinet, docId);
                fieldsToExport = docData.Fields || [];
                setDocumentFields(fieldsToExport);
            }

            // 1. Prepare Headers
            // Standard columns
            const fixedHeaders = [
                'Instance GUID',
                'DOCID',
                'Instância',
                'Versão (Instância)',
                'Iniciado Em',
                'Atividade',
                'Tipo Atividade',
                'Decisão/Operação',
                'Usuário',
                'Data Decisão'
            ];

            // Dynamic field headers (INCLUDE system fields and sort)
            const dynamicFieldNames = fieldsToExport
                .map(f => f.FieldName)
                .sort();

            // Add 'Link Documento' as the last header
            const csvHeaders = [...fixedHeaders, ...dynamicFieldNames, 'Link Documento'];

            // 2. Flatten Data
            const rows = [];

            historyInstances.forEach(instance => {
                const steps = filteredSteps(instance.HistorySteps);

                if (steps.length === 0) {
                    // create a dummy step row just to show the instance existed
                    const rowData = {
                        'Instance GUID': instance.Id,
                        DOCID: docId,
                        'Instância': instance.Name,
                        'Versão (Instância)': instance.Version,
                        'Iniciado Em': formatDate(instance.StartDate || instance.StartedAt, true),
                        'Atividade': '(Sem atividades)',
                        'Tipo Atividade': '',
                        'Decisão/Operação': '',
                        'Usuário': '',
                        'Data Decisão': '',
                        'Link Documento': docLink
                    };

                    // Add dynamic fields
                    dynamicFieldNames.forEach(fieldName => {
                        const field = fieldsToExport.find(f => f.FieldName === fieldName);
                        rowData[fieldName] = field ? (field.Item || field.Value || '') : '';
                    });
                    rows.push(rowData);
                } else {
                    steps.forEach(step => {
                        const infoItem = step.Info?.Item || {};
                        let validUser = infoItem.UserName || step.User || step.UserName || '';
                        if (!validUser && infoItem.AssignedUsers && Array.isArray(infoItem.AssignedUsers)) {
                            validUser = infoItem.AssignedUsers.join(', ');
                        }
                        const validDate = infoItem.DecisionDate || step.StepDate || step.TimeStamp || '';
                        const validDecision = infoItem.DecisionName || step.DecisionLabel || '';

                        const rowData = {
                            'Instance GUID': instance.Id,
                            DOCID: docId,
                            'Instância': instance.Name,
                            'Versão (Instância)': instance.Version,
                            'Iniciado Em': formatDate(instance.StartDate || instance.StartedAt, true),
                            'Atividade': step.ActivityName || step.Name,
                            'Tipo Atividade': step.ActivityType,
                            'Decisão/Operação': validDecision,
                            'Usuário': validUser,
                            'Data Decisão': formatDate(validDate),
                            'Link Documento': docLink
                        };

                        // Add dynamic fields
                        dynamicFieldNames.forEach(fieldName => {
                            const field = fieldsToExport.find(f => f.FieldName === fieldName);
                            // Handle Dates specifically if needed
                            let val = field ? (field.Item || field.Value || '') : '';

                            // Check for DocuWare Date format or explicit Date field
                            if (typeof val === 'string' && val.includes('/Date(')) {
                                val = formatDate(val, true);
                            } else if (field && field.ItemElementName === 'Date' && field.Item) {
                                val = formatDate(field.Item, true);
                            }

                            rowData[fieldName] = val;
                        });

                        rows.push(rowData);
                    });
                }
            });

            // 3. Generate CSV String
            const escapeCsv = (val) => {
                if (val === null || val === undefined) return '';
                const str = String(val);
                if (str.includes(';') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            const headerRow = csvHeaders.map(escapeCsv).join(';');
            const dataRows = rows.map(row => {
                return csvHeaders.map(header => escapeCsv(row[header])).join(';');
            });

            const csvContent = [headerRow, ...dataRows].join('\n');

            // 4. Download
            // Add BOM for Excel compatibility
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Historico_Workflow_${docId}_${new Date().getTime()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (err) {
            console.error('Export failed:', err);
            setError('Falha ao exportar CSV. Tente novamente.');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header Area */}
            <div className="flex items-center space-x-4 mb-2">
                <div className="p-3 bg-base-200 rounded-full">
                    <FaHistory className="w-8 h-8 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-base-content">Histórico de Workflow</h1>
                    <p className="text-base-content/60 mt-1">
                        Consulte a trilha de auditoria completa de um documento pelo ID.
                    </p>
                </div>
            </div>

            {error && (
                <div className="alert alert-error shadow-lg animate-fade-in-down">
                    <div>
                        <FaTimesCircle />
                        <span>{error}</span>
                    </div>
                </div>
            )}

            {/* Search Card */}
            <div className="card bg-base-100 shadow-xl border border-base-200">
                <div className="card-body p-6">
                    <form onSubmit={handleSearch} className="flex flex-col gap-4">
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-semibold">Selecione o Armário</span>
                            </label>
                            <select
                                className="select select-bordered w-full focus:select-primary transition-colors"
                                value={selectedCabinet}
                                onChange={(e) => setSelectedCabinet(e.target.value)}
                                disabled={loading}
                            >
                                {cabinets.map(cab => (
                                    <option key={cab.Id} value={cab.Id}>{cab.Name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-semibold">ID do Documento (DocID)</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Ex: 123456"
                                className="input input-bordered w-full focus:input-primary transition-colors text-lg tracking-wide"
                                value={docId}
                                onChange={(e) => setDocId(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        <button
                            type="submit"
                            className={`btn btn-primary w-full mt-2 text-lg uppercase tracking-wide
                                ${loading ? 'loading' : ''}
                            `}
                            disabled={loading || !docId || !selectedCabinet}
                        >
                            {loading ? 'Buscando...' : <><FaSearch className="mr-2" /> Buscar Histórico</>}
                        </button>
                    </form>
                </div>
            </div>

            {/* Results Section */}
            {searched && !loading && (
                <div className="animate-fade-in-up">
                    {!historyInstances || historyInstances.length === 0 ? (
                        <div className="alert alert-warning shadow-lg">
                            <div>
                                <FaBan />
                                <span>Nenhum histórico de workflow encontrado para este documento.</span>
                            </div>
                        </div>
                    ) : (
                        <div className="card bg-base-100 shadow-xl border border-base-200">

                            {/* Document Info Header */}
                            <div className="p-4 border-b border-base-200 bg-base-50 flex justify-between items-center rounded-t-lg">
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-gray-700 uppercase tracking-wider text-sm">DOCID</span>
                                    <div className="flex items-center gap-2">
                                        <span className="badge badge-lg badge-primary font-mono font-bold">{docId}</span>
                                        <button
                                            className="btn btn-ghost btn-xs btn-circle text-gray-500 hover:text-primary tooltip tooltip-right"
                                            data-tip="Copiar ID"
                                            onClick={() => navigator.clipboard.writeText(docId)}
                                        >
                                            <FaRegCopy />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleViewFields}
                                        className={`btn btn-sm btn-outline gap-2 ${fieldsLoading ? 'loading' : ''}`}
                                        disabled={fieldsLoading}
                                    >
                                        {!fieldsLoading && <FaList />} Campos
                                    </button>

                                    <button
                                        onClick={handleExportCSV}
                                        className="btn btn-sm btn-outline gap-2"
                                        disabled={loading || !historyInstances}
                                    >
                                        <FaFileCsv /> CSV
                                    </button>

                                    <a
                                        href={docLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`btn btn-sm btn-outline btn-primary gap-2 ${docLink === '#' ? 'btn-disabled' : ''}`}
                                    >
                                        <FaExternalLinkAlt /> Ver Doc.
                                    </a>
                                </div>
                            </div>

                            <div className="flex flex-col lg:flex-row h-[650px] border-t border-base-200 bg-base-100 rounded-b-xl overflow-hidden">
                                {/* Left Sidebar - Instance List */}
                                <div className="w-full lg:w-80 border-r border-base-200 bg-base-50/50 overflow-y-auto custom-scrollbar">
                                    <div className="p-3 space-y-2">
                                        <div className="px-2 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                                            Instâncias ({historyInstances.length})
                                        </div>
                                        {historyInstances.map((instance, idx) => (
                                            <button
                                                key={instance.Id}
                                                onClick={() => setActiveTab(idx)}
                                                className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all duration-200 flex flex-col gap-1 border-l-4 group relative
                                                    ${activeTab === idx
                                                        ? 'bg-white border-primary shadow-sm ring-1 ring-base-200'
                                                        : 'border-transparent hover:bg-base-200/50 hover:border-base-300 text-gray-600'
                                                    }
                                                `}
                                            >
                                                <span className={`font-semibold truncate block w-full ${activeTab === idx ? 'text-primary' : 'group-hover:text-gray-900'}`} title={instance.Name}>
                                                    {instance.Name}
                                                </span>
                                                <span className="flex items-center justify-between mt-1">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${activeTab === idx ? 'bg-primary/10 text-primary-focus' : 'bg-base-200 text-gray-500'}`}>
                                                                v{instance.Version}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400">
                                                                {formatDate(instance.StartDate || instance.StartedAt || instance.TimeStamp, true)}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] font-mono text-gray-300 break-all leading-tight select-all">
                                                            {instance.Id}
                                                        </span>
                                                    </div>
                                                    {idx === 0 && <span className="text-[10px] uppercase font-bold text-success tracking-wider">Atual</span>}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Right Content - History Table */}
                                <div className="flex-1 flex flex-col h-full bg-white relative">
                                    {/* Table Content */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                                        {historyInstances.map((instance, idx) => (
                                            <div key={instance.Id} style={{ display: activeTab === idx ? 'block' : 'none' }} className="h-full">
                                                <table className="table table-pin-rows w-full">
                                                    <thead>
                                                        <tr className="bg-base-100 border-b border-base-200/60 shadow-sm text-gray-500 text-xs uppercase tracking-wider font-semibold">
                                                            <th className="py-4 pl-6 bg-base-100/95 backdrop-blur">Tipo</th>
                                                            <th className="py-4 bg-base-100/95 backdrop-blur">Nome</th>
                                                            <th className="py-4 bg-base-100/95 backdrop-blur">Operação</th>
                                                            <th className="py-4 bg-base-100/95 backdrop-blur">Processador</th>
                                                            <th className="py-4 bg-base-100/95 backdrop-blur">Concluída em</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="text-sm">
                                                        {filteredSteps(instance.HistorySteps).length === 0 ? (
                                                            <tr>
                                                                <td colSpan="5" className="text-center py-16 text-gray-400">
                                                                    <div className="flex flex-col items-center gap-2">
                                                                        <FaHistory className="text-3xl opacity-20" />
                                                                        <span className="italic font-medium">Nenhuma atividade registrada.</span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            filteredSteps(instance.HistorySteps).map((step, sIdx) => {
                                                                const infoItem = step.Info?.Item || {};

                                                                // EXTRACT DATA
                                                                let validUser = infoItem.UserName || step.User || step.UserName || '';
                                                                if (!validUser && infoItem.AssignedUsers && Array.isArray(infoItem.AssignedUsers)) {
                                                                    validUser = infoItem.AssignedUsers.join(', ');
                                                                }

                                                                const validDate = infoItem.DecisionDate || step.StepDate || step.TimeStamp || '';
                                                                const validDecision = infoItem.DecisionName || step.DecisionLabel || '';

                                                                const statusStyle = getStatusStyle(validDecision, step.ActivityType);
                                                                const isStart = step.ActivityType === 'StartEvent' || step.ActivityType === 'Start';
                                                                const isEnd = step.ActivityType === 'EndEvent' || step.ActivityType === 'End';

                                                                return (
                                                                    <tr key={sIdx} className={`hover:bg-base-50/50 transition-colors border-b border-base-100
                                                                        ${isStart ? 'bg-indigo-50/10' : ''} 
                                                                        ${isEnd ? 'bg-emerald-50/10' : ''}
                                                                    `}>
                                                                        <td className="pl-6 font-medium text-gray-500 py-3">
                                                                            <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs font-semibold
                                                                                ${isStart ? 'bg-blue-50 text-blue-600' :
                                                                                    isEnd ? 'bg-green-50 text-green-600' :
                                                                                        step.ActivityType === 'WorkflowTask' || step.ActivityType === 'General Task' ? 'bg-gray-100 text-gray-600' :
                                                                                            'bg-gray-50 text-gray-500'}
                                                                            `}>
                                                                                {step.ActivityType === 'WorkflowTask' ? 'Tarefa' :
                                                                                    step.ActivityType === 'StartEvent' ? 'Início' :
                                                                                        step.ActivityType === 'EndEvent' ? 'Fim' :
                                                                                            step.ActivityType === 'General Task' ? 'Tarefa' :
                                                                                                step.ActivityType === 'User assignment' ? 'Atribuição' :
                                                                                                    step.ActivityType === 'Data assignment' ? 'Dados' :
                                                                                                        step.ActivityType === 'Condition' ? 'Condição' :
                                                                                                            step.ActivityType}
                                                                            </span>
                                                                        </td>
                                                                        <td className="font-semibold text-gray-700 py-3 max-w-[200px]" title={step.ActivityName || step.Name}>
                                                                            <div className="truncate">{step.ActivityName || step.Name}</div>
                                                                        </td>
                                                                        <td className="py-3">
                                                                            {validDecision && (
                                                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${statusStyle.color.includes('success') ? 'bg-success/10 text-success' :
                                                                                    statusStyle.color.includes('error') ? 'bg-error/10 text-error' :
                                                                                        'bg-gray-100 text-gray-600'
                                                                                    }`}>
                                                                                    {statusStyle.icon}
                                                                                    <span>{validDecision}</span>
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="text-gray-600 max-w-xs py-3" title={validUser}>
                                                                            {validUser && (
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                                                                                        <FaUser className="text-[10px]" />
                                                                                    </div>
                                                                                    <span className="truncate text-xs font-medium">{validUser}</span>
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="text-gray-500 text-xs font-mono py-3 whitespace-nowrap">
                                                                            {formatDate(validDate)}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Footer / Toggle */}
                                    <div className="p-4 border-t border-base-200 bg-base-50 flex justify-end shrink-0">
                                        <label className="cursor-pointer label">
                                            <span className="label-text mr-3 font-medium text-gray-600">Exibir atividades automáticas</span>
                                            <input
                                                type="checkbox"
                                                className="toggle toggle-primary toggle-sm"
                                                checked={showAutoActivities}
                                                onChange={() => setShowAutoActivities(!showAutoActivities)}
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            )}

            {/* Fields Modal */}
            <input type="checkbox" id="fields-modal" className="modal-toggle" checked={showFieldsModal} onChange={() => setShowFieldsModal(!showFieldsModal)} />
            <div className="modal">
                <div className="modal-box w-11/12 max-w-3xl">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <FaList /> Campos do Documento {docId}
                    </h3>
                    <div className="overflow-x-auto max-h-96">
                        <table className="table table-compact w-full">
                            <thead>
                                <tr>
                                    <th>Campo</th>
                                    <th>Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {documentFields.length === 0 ? (
                                    <tr><td colSpan="2" className="text-center">Nenhum campo encontrado.</td></tr>
                                ) : (
                                    documentFields.map((field, idx) => {
                                        const val = field.Item || field.Value || '';
                                        const isDate = field.ItemElementName === 'Date' || (typeof val === 'string' && val.includes('/Date('));

                                        return (
                                            <tr key={idx} className="hover">
                                                <td className="font-semibold text-gray-600">{field.FieldName}</td>
                                                <td className="break-all">
                                                    {isDate ? formatDate(val) : val}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="modal-action">
                        <button className="btn" onClick={() => setShowFieldsModal(false)}>Fechar</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkflowHistoryPage;
