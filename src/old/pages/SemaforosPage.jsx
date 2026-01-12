import { useState, useEffect } from 'react';
import { FaTrafficLight } from 'react-icons/fa';

import TrafficLightConfigForm from '../components/Semaforos/TrafficLightConfigForm';
import ResultsTable from '../components/Documents/ResultsTable';
import StatusConfig from '../components/Semaforos/StatusConfig';
import { useAuth } from '../context/AuthContext';
import { controlService } from '../services/controlService';
import { docuwareService } from '../services/docuwareService';

// --- Sub-Component: Control Creator ---
const ControlCreator = ({ onCancel, onSave, user, initialData }) => {
    const [step, setStep] = useState(1);
    const [columnSearch, setColumnSearch] = useState('');
    const [showColumnSelector, setShowColumnSelector] = useState(false);
    const [availableFields, setAvailableFields] = useState([]);
    const [loadingFields, setLoadingFields] = useState(false);
    const [config, setConfig] = useState(initialData || {
        cabinetId: '',
        cabinetName: '',
        filters: [],
        name: '',
        visibleColumns: [], // New: Store selected columns
        statusLabels: {
            approved: 'Aprovado',
            pending: 'Pendente',
            rejected: 'Reprovado'
        },
        statusField: null,
        statusRules: []
    });

    useEffect(() => {
        if (initialData) {
            // Pre-load fields for Step 2 if editing
            handleSearch(initialData.cabinetId, initialData.filters, []);
        }
    }, []);

    const handleCabinetChange = (cabinetId, cabinetName) => {
        setConfig({ ...config, cabinetId, cabinetName });
    };

    const [previewCount, setPreviewCount] = useState(0);

    const handlePreviewCount = async (cabinetId, filterList) => {
        try {
            // Check if we have valid filters first
            if (!cabinetId || filterList.length === 0) return;

            const response = await docuwareService.searchDocuments(cabinetId, filterList);
            // Just update the count for UI feedback
            setPreviewCount(response.total);
        } catch (error) {
            console.error("Preview count failed", error);
        }
    };

    const handleSearch = async (cabinetId, filters, availableFieldsFromSearch) => {
        setLoadingFields(true);
        setConfig(prev => ({ ...prev, cabinetId, filters }));

        try {
            // Use fields passed from SearchForm if available, otherwise fetch
            let fields = availableFieldsFromSearch;

            if (!fields || fields.length === 0) {
                console.log("No fields passed from SearchForm, fetching...", cabinetId);
                fields = await docuwareService.getCabinetFields(cabinetId);
            }

            console.log("Processing fields for column selector:", fields?.length);

            // Filter valid fields and sort
            const validFields = Array.isArray(fields) ? fields.filter(f => f && (f.FieldName || f.FieldLabel || f.DBFieldName || f.DisplayName)) : [];

            // Sort
            // Normalize fields FIRST to ensure consistent properties for sorting
            const normalized = validFields.map(f => {
                const dbName = f.DBFieldName || f.FieldName || '';
                const isSystem = f.SystemField || f.Scope === 'System' || dbName.toUpperCase().startsWith('DW');

                return {
                    ...f,
                    FieldName: f.FieldName || f.DBFieldName,
                    FieldLabel: (f.FieldLabel || f.DisplayName || f.FieldName || f.DBFieldName) + (isSystem ? ' (S)' : ''),
                    DBFieldName: dbName,
                    isSystem: isSystem
                };
            });

            // Sort: Non-System fields first, then alphabetical
            const sorted = normalized.sort((a, b) => {
                // If one is system and other is not, prioritize non-system
                if (a.isSystem && !b.isSystem) return 1;
                if (!a.isSystem && b.isSystem) return -1;

                const nameA = a.FieldLabel.toString();
                const nameB = b.FieldLabel.toString();
                return nameA.localeCompare(nameB);
            });

            setAvailableFields(sorted);

            // Pre-select fields based on filters and enforce order
            const primaryFilter = filters[0]?.fieldName;
            const statusField = config.statusField; // Current status field

            let currentCols = [...config.visibleColumns];

            // If no columns selected yet, start with just the filters
            if (currentCols.length === 0) {
                const filterFieldNames = filters.map(f => f.fieldName).filter(Boolean);
                // Get valid fields only
                currentCols = filterFieldNames.filter(name => normalized.some(f => f.FieldName === name));
            }

            // Re-order: Primary Filter -> Status Field -> Others
            let newOrder = [];
            if (primaryFilter) newOrder.push(primaryFilter);
            if (statusField && statusField !== primaryFilter) newOrder.push(statusField);

            const others = currentCols.filter(c => c !== primaryFilter && c !== statusField);
            const finalOrder = [...new Set([...newOrder, ...others])];

            setConfig(prev => ({ ...prev, visibleColumns: finalOrder }));

            setStep(2);
        } catch (error) {
            console.error("Error fetching fields", error);
            alert("Erro ao processar colunas do armário.");
        } finally {
            setLoadingFields(false);
        }
    };

    const toggleColumn = (fieldName) => {
        const current = new Set(config.visibleColumns);
        if (current.has(fieldName)) {
            current.delete(fieldName);
        } else {
            current.add(fieldName);
        }
        setConfig({ ...config, visibleColumns: Array.from(current) });
    };

    const selectAllColumns = () => {
        const all = availableFields.map(f => f.FieldName);
        setConfig({ ...config, visibleColumns: all });
    };

    const clearAllColumns = () => {
        setConfig({ ...config, visibleColumns: [] });
    };

    const handleSave = () => {
        if (!config.name) return alert("Por favor, dê um nome ao controle.");
        onSave(config);
    };

    const handleDragStart = (e, index) => {
        e.dataTransfer.setData("text/plain", index);
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Necessary to allow dropping
    };

    const handleDrop = (e, targetIndex) => {
        e.preventDefault();
        const sourceIndex = parseInt(e.dataTransfer.getData("text/plain"));
        if (sourceIndex === targetIndex) return;

        const newColumns = [...config.visibleColumns];
        const [movedColumn] = newColumns.splice(sourceIndex, 1);
        newColumns.splice(targetIndex, 0, movedColumn);

        setConfig({ ...config, visibleColumns: newColumns });
    };

    return (
        <div className="card bg-base-100 shadow-xl border border-base-200 max-w-5xl mx-auto">
            <div className="card-body p-6">
                {step === 2 && (
                    <h2 className="card-title text-2xl mb-2">
                        Passo 2: Seleção de Colunas e Status
                    </h2>
                )}

                {step === 1 && (
                    <>
                        <div className="bg-base-50 rounded-lg p-2 border border-base-200">
                            <TrafficLightConfigForm
                                onSearch={handleSearch}
                                onPreview={handlePreviewCount}
                                onLog={() => { }}
                                totalCount={previewCount}
                                onCabinetChange={handleCabinetChange}
                                initialCabinetId={config.cabinetId}
                            />
                        </div>
                        <div className="mt-2 text-right">
                            <button onClick={onCancel} className="btn btn-sm btn-ghost">Cancelar</button>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <div className="flex flex-col h-full">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">

                            {/* Left Panel: Settings & Columns */}
                            <div className="lg:col-span-5 space-y-6">
                                {/* Basic Info Card */}
                                <div className="card bg-base-100 border border-base-200 shadow-sm">
                                    <div className="card-body p-5">
                                        <h3 className="card-title text-sm uppercase text-gray-400 font-bold tracking-wider mb-2">Configurações Gerais</h3>

                                        <div className="form-control w-full">
                                            <label className="label pt-0">
                                                <span className="label-text font-semibold text-base">Nome do Controle <span className="text-error">*</span></span>
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: Contratos > 100k"
                                                className="input input-bordered w-full bg-base-50 focus:bg-white transition-colors"
                                                value={config.name}
                                                onChange={e => setConfig({ ...config, name: e.target.value })}
                                            />
                                            <label className="label">
                                                <span className="label-text-alt text-gray-500">Identifique este controle no dashboard.</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Column Selection Summary Card */}
                                <div className="card bg-base-100 border border-base-200 shadow-sm">
                                    <div className="card-body p-5">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="card-title text-sm uppercase text-gray-400 font-bold tracking-wider">Colunas Visíveis</h3>
                                            <div className="badge badge-ghost">{config.visibleColumns.length} de {availableFields.length}</div>
                                        </div>

                                        <p className="text-sm text-gray-500 mb-4">
                                            Arraste para reordenar a prioridade das colunas.
                                        </p>

                                        {/* Selected Columns Tags Preview (Sortable) */}
                                        <div className="flex flex-wrap gap-2 mb-4 bg-base-50 p-2 rounded-lg border border-dashed border-base-300 min-h-[50px]">
                                            {config.visibleColumns.length === 0 && <span className="text-xs text-gray-400 italic w-full text-center py-2">Nenhuma selecionada (padrão aplicável)</span>}
                                            {config.visibleColumns.map((col, index) => (
                                                <div
                                                    key={col}
                                                    className="badge badge-primary gap-1 pl-2 pr-1 py-3 cursor-grab active:cursor-grabbing hover:bg-primary-focus transition-all"
                                                    draggable={true}
                                                    onDragStart={(e) => handleDragStart(e, index)}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleDrop(e, index)}
                                                >
                                                    <span className="font-semibold">{availableFields.find(f => f.FieldName === col)?.FieldLabel || col}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            className="btn btn-outline btn-block"
                                            onClick={() => setShowColumnSelector(true)}
                                        >
                                            Gerenciar Colunas
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Right Panel: Status Visual (Inline) */}
                            <div className="lg:col-span-7">
                                <div className="card bg-base-100 border border-base-200 shadow-sm h-full">
                                    <div className="card-body p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                    <span className="text-xl">🚦</span>
                                                </div>
                                                <div>
                                                    <h3 className="card-title text-lg font-bold">Status Visual (Semáforo)</h3>
                                                    <p className="text-xs text-gray-500">Configure as regras de cores para destaque automático.</p>
                                                </div>
                                            </div>
                                            {config.statusField && <div className="badge badge-success gap-1">Ativo</div>}
                                        </div>

                                        <div className="divider my-0"></div>

                                        <StatusConfig
                                            isInline={true}
                                            fields={availableFields.map(f => ({ name: f.FieldName, label: f.FieldLabel || f.FieldName }))}
                                            initialField={config.statusField}
                                            initialRules={config.statusRules}
                                            onConfigChange={(newConfig) => {
                                                if (newConfig) {
                                                    setConfig(prev => {
                                                        const statusField = newConfig.field;

                                                        console.log("StatusConfig change:", newConfig);
                                                        console.log("Current Filters:", prev.filters);

                                                        // 1. Identify Primary Filter (First filter from Step 1)
                                                        const primaryFilter = prev.filters && prev.filters[0] ? prev.filters[0].fieldName : null;
                                                        console.log("Primary Filter detected:", primaryFilter);

                                                        // 2. Build new Visible Columns list
                                                        let currentCols = [...(prev.visibleColumns || [])];

                                                        // Ensure we don't have duplicates and re-order
                                                        let others = currentCols.filter(c => c !== statusField && c !== primaryFilter);

                                                        // Construct: [PrimaryFilter, StatusField, ...Others]
                                                        let newVisible = [];
                                                        if (primaryFilter && !newVisible.includes(primaryFilter)) newVisible.push(primaryFilter);
                                                        if (statusField && !newVisible.includes(statusField)) newVisible.push(statusField);

                                                        // Add others unique
                                                        newVisible = [...new Set([...newVisible, ...others])];

                                                        console.log("New Visible Columns:", newVisible);

                                                        return {
                                                            ...prev,
                                                            statusField: newConfig.field,
                                                            statusRules: newConfig.rules,
                                                            visibleColumns: newVisible
                                                        };
                                                    });
                                                } else {
                                                    setConfig(prev => ({ ...prev, statusField: null, statusRules: [] }));
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal for Column Selection */}
                        <dialog className={`modal ${showColumnSelector ? 'modal-open' : ''}`}>
                            <div className="modal-box w-11/12 max-w-5xl h-[80vh] flex flex-col">
                                <h3 className="font-bold text-lg mb-4">Selecionar Colunas</h3>

                                <div className="flex justify-between items-center gap-4 mb-4">
                                    <input
                                        type="text"
                                        placeholder="🔍 Buscar colunas..."
                                        className="input input-bordered w-full"
                                        value={columnSearch}
                                        onChange={(e) => setColumnSearch(e.target.value)}
                                    />
                                    <div className="join bg-base-100 border border-base-300 rounded-btn">
                                        <button className="join-item btn btn-ghost" onClick={selectAllColumns}>Marcar Todas</button>
                                        <button className="join-item btn btn-ghost" onClick={clearAllColumns}>Desmarcar</button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto border border-base-200 rounded-lg bg-base-50 p-4">
                                    {loadingFields ? (
                                        <div className="flex justify-center items-center h-full">
                                            <span className="loading loading-spinner text-primary loading-lg"></span>
                                        </div>
                                    ) : availableFields.length === 0 ? (
                                        <div className="text-center text-gray-400 py-20">
                                            <p>Nenhuma coluna encontrada.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {availableFields
                                                .filter(f => (f.FieldLabel || f.FieldName || '').toLowerCase().includes(columnSearch.toLowerCase()))
                                                .map(field => {
                                                    const isSelected = config.visibleColumns.includes(field.FieldName);
                                                    return (
                                                        <label
                                                            key={field.FieldName}
                                                            className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border ${isSelected ? 'bg-primary/5 border-primary shadow-sm' : 'bg-white border-base-200 hover:border-primary/30'}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                className="checkbox checkbox-sm checkbox-primary mt-0.5"
                                                                checked={isSelected}
                                                                onChange={() => toggleColumn(field.FieldName)}
                                                            />
                                                            <div className="flex flex-col overflow-hidden">
                                                                <span className={`text-sm font-medium leading-tight ${isSelected ? 'text-primary' : 'text-base-content'}`} title={field.FieldLabel || field.FieldName}>
                                                                    {field.FieldLabel || field.FieldName}
                                                                </span>
                                                            </div>
                                                        </label>
                                                    );
                                                })
                                            }
                                        </div>
                                    )}
                                </div>

                                <div className="modal-action mt-6">
                                    <div className="flex items-center gap-4 mr-auto text-sm text-gray-500">
                                        <span>{config.visibleColumns.length} selecionadas</span>
                                    </div>
                                    <button className="btn" onClick={() => setShowColumnSelector(false)}>Fechar</button>
                                    <button className="btn btn-primary px-8" onClick={() => setShowColumnSelector(false)}>Concluir</button>
                                </div>
                            </div>
                            <form method="dialog" className="modal-backdrop">
                                <button onClick={() => setShowColumnSelector(false)}>close</button>
                            </form>
                        </dialog>

                        {/* Footer Action Bar */}
                        <div className="bg-base-100 p-4 rounded-xl border border-base-200 shadow-lg flex justify-between items-center sticky bottom-0 z-10">
                            <button onClick={() => setStep(1)} className="btn btn-ghost gap-2">
                                ← Voltar
                            </button>
                            <div className="flex items-center gap-4">
                                <div className="text-right hidden sm:block">
                                    <div className="text-xs text-gray-400">Pronto para salvar?</div>
                                    <div className="text-sm font-bold">{config.visibleColumns.length} colunas selecionadas</div>
                                </div>
                                <button
                                    onClick={handleSave}
                                    className="btn btn-primary px-8"
                                    disabled={!config.name}
                                >
                                    Salvar Controle
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Sub-Component: Control Viewer ---
const ControlViewer = ({ control, onBack }) => {
    const [results, setResults] = useState([]);
    const [totalDocs, setTotalDocs] = useState(0);
    const [loading, setLoading] = useState(false);
    const [statuses, setStatuses] = useState({});

    useEffect(() => {
        loadData();
        loadStatuses();
    }, [control]);

    const loadStatuses = () => {
        const saved = controlService.getControlStatuses(control.id);
        setStatuses(saved);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const response = await docuwareService.searchDocuments(control.cabinetId, control.filters);
            setResults(response.items);
            setTotalDocs(response.total);
        } catch (error) {
            console.error("Failed to load control data", error);
            alert("Erro ao carregar dados do DocuWare.");
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = (docId, newStatus) => {
        const updated = controlService.setItemStatus(control.id, docId, newStatus);
        setStatuses({ ...updated });
    };

    const getDocId = (doc) => {
        const idField = doc.Fields.find(f => f.FieldName === 'DWDOCID');
        return idField ? idField.Item : 'unknown';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <button onClick={onBack} className="btn btn-sm btn-ghost mb-2">← Voltar</button>
                    <h1 className="text-3xl font-bold">{control.name}</h1>
                    <p className="text-gray-500 text-sm">
                        Armário: {control.cabinetId} • {control.filters.length} filtros
                    </p>
                </div>
                <button onClick={loadData} className="btn btn-ghost btn-sm">↻ Atualizar</button>
            </div>

            {loading ? (
                <div className="text-center py-10"><span className="loading loading-spinner loading-lg"></span></div>
            ) : (
                <ResultsTable
                    results={results}
                    totalDocs={totalDocs}
                    cabinetId={control.cabinetId}
                    initialVisibleColumns={control.visibleColumns}
                    getCustomStatusValue={(doc) => {
                        if (control.statusField) {
                            const field = doc.Fields.find(f => f.FieldName === control.statusField);
                            return field ? field.Item : '';
                        }
                        // Fallback logic for manual status if necessary, though sorting on manual status would need 'statuses' map access.
                        // For now, let's assume automatic status is the primary use case for sorting.
                        // If we need to sort by manual status, we'd need to pass 'statuses' into the extractor scope.
                        return '';
                    }}
                    renderCustomColumn={(doc) => {
                        // Logic for "Automatic" status based on field value
                        if (control.statusField) {
                            const field = doc.Fields.find(f => f.FieldName === control.statusField);
                            const value = field ? field.Item : '';

                            // Find matching rule
                            const rule = (control.statusRules || []).find(r =>
                                String(r.value).toLowerCase() === String(value).toLowerCase()
                            );

                            if (rule) {
                                const colorMap = {
                                    green: 'bg-success',
                                    yellow: 'bg-warning',
                                    red: 'bg-error',
                                    blue: 'bg-info',
                                    grey: 'bg-gray-300'
                                };
                                return (
                                    <div className="flex justify-center">
                                        <div className={`badge ${colorMap[rule.color] || 'bg-ghost'} gap-2 text-white border-none shadow-sm p-3`}>
                                            {value}
                                        </div>
                                    </div>
                                );
                            }

                            // If no rule matches, show raw value or dash
                            return <div className="text-center text-xs opacity-50">{value || '-'}</div>;
                        }

                        // Fallback to "Manual" status (old behavior) if no statusField configured
                        // (Preserving backward compatibility if needed, or we can assume new controls use new logic)
                        const id = getDocId(doc);
                        const currentStatus = statuses[id];
                        return (
                            <div className="join join-vertical sm:join-horizontal shadow-sm">
                                <button
                                    className={`join-item btn btn-xs ${currentStatus === 'approved' ? 'btn-success' : 'btn-ghost opacity-40 hover:opacity-100'}`}
                                    onClick={() => handleStatusChange(id, currentStatus === 'approved' ? null : 'approved')}
                                >🟢</button>
                                <button
                                    className={`join-item btn btn-xs ${currentStatus === 'pending' ? 'btn-warning' : 'btn-ghost opacity-40 hover:opacity-100'}`}
                                    onClick={() => handleStatusChange(id, currentStatus === 'pending' ? null : 'pending')}
                                >🟡</button>
                                <button
                                    className={`join-item btn btn-xs ${currentStatus === 'rejected' ? 'btn-error' : 'btn-ghost opacity-40 hover:opacity-100'}`}
                                    onClick={() => handleStatusChange(id, currentStatus === 'rejected' ? null : 'rejected')}
                                >🔴</button>
                            </div>
                        );
                    }}
                />
            )}
        </div>
    );
};

// --- Main Page Component ---
const SemaforosPage = () => {
    const { user } = useAuth();
    const [mode, setMode] = useState('list');
    const [controls, setControls] = useState([]);
    const [activeControl, setActiveControl] = useState(null);
    const [cabinets, setCabinets] = useState({});

    useEffect(() => {
        if (user) {
            const loadedControls = controlService.getControls(user.username);
            setControls(loadedControls);

            // Resolve cabinet names for legacy controls
            docuwareService.getCabinets()
                .then(cabs => {
                    const cabMap = {};
                    cabs.forEach(c => cabMap[c.Id] = c.Name);
                    setCabinets(cabMap);
                })
                .catch(err => console.error("Failed to load cabinets for name resolution", err));
        }
    }, [user, mode]);

    const handleCreate = (newControlConfig) => {
        // Ensure cabinet name is saved if not present (using our map)
        if (!newControlConfig.cabinetName && cabinets[newControlConfig.cabinetId]) {
            newControlConfig.cabinetName = cabinets[newControlConfig.cabinetId];
        }
        controlService.saveControl(user.username, newControlConfig);
        setMode('list');
    };

    const handleEdit = (control) => {
        setActiveControl(control);
        setMode('edit');
    };

    const handleDelete = (id) => {
        if (window.confirm("Tem certeza? Isso excluirá o controle e todos os status salvos.")) {
            controlService.deleteControl(user.username, id);
            setControls(prev => prev.filter(c => c.id !== id));
        }
    };

    const openControl = (control) => {
        setActiveControl(control);
        setMode('view');
    };

    if (mode === 'create' || mode === 'edit') {
        return (
            <div className="flex flex-col h-full bg-base-200">
                <main className="flex-1 container mx-auto p-4 overflow-y-auto">
                    <ControlCreator
                        user={user}
                        initialData={mode === 'edit' ? activeControl : null}
                        onCancel={() => setMode('list')}
                        onSave={handleCreate}
                    />
                </main>
            </div>
        );
    }

    if (mode === 'view' && activeControl) {
        return (
            <div className="flex flex-col h-full bg-base-200">
                <main className="flex-1 container mx-auto p-4 overflow-y-auto">
                    <ControlViewer control={activeControl} onBack={() => setMode('list')} />
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-base-200">
            <main className="flex-1 container mx-auto p-4 overflow-y-auto">
                <div className="flex justify-between items-center mb-6 px-1">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <FaTrafficLight className="w-6 h-6 text-primary" />
                            <h1 className="text-2xl font-bold text-gray-800">Controle Documental</h1>
                        </div>
                        <p className="text-sm text-gray-500">Gerencie seus controles e status</p>
                    </div>
                    <button onClick={() => setMode('create')} className="btn btn-info text-white border-none bg-[#00bfff] hover:bg-[#00ace6] shadow-sm">
                        + Novo Controle
                    </button>
                </div>

                <div className="bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] rounded-xl p-6 min-h-[calc(100vh-12rem)] border border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {controls.map(control => (
                            <div key={control.id} className="card bg-base-100 shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                <div className="card-body p-6">
                                    <h2 className="card-title justify-between text-base">
                                        {control.name}
                                        <div className="badge badge-secondary badge-outline text-[10px] items-center h-5">
                                            {control.filters?.length || 0} filtros
                                        </div>
                                    </h2>
                                    <p className="text-xs text-gray-400 mt-1">Armário: {control.cabinetName || cabinets[control.cabinetId] || control.cabinetId}</p>
                                    <p className="text-xs text-gray-400">Criado em: {new Date(control.createdAt).toLocaleDateString()}</p>

                                    <div className="card-actions justify-end mt-4 pt-4 border-t border-gray-50">
                                        <button onClick={() => handleEdit(control)} className="btn btn-xs btn-ghost text-gray-400 hover:text-gray-600">Editar</button>
                                        <button onClick={() => handleDelete(control.id)} className="btn btn-xs btn-ghost text-error/70 hover:text-error">Excluir</button>
                                        <button onClick={() => openControl(control)} className="btn btn-sm text-white bg-[#00bfff] hover:bg-[#00ace6] border-none shadow-sm rounded-lg px-4 ml-2">Abrir</button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {controls.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                                <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                                    <FaTrafficLight className="w-8 h-8 text-gray-300" />
                                </div>
                                <p className="text-lg font-medium text-gray-600 mb-1">Nenhum controle criado</p>
                                <p className="text-sm text-gray-400 mb-6">Crie seu primeiro controle para começar.</p>
                                <button onClick={() => setMode('create')} className="btn btn-outline btn-sm">Criar Agora</button>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SemaforosPage;
