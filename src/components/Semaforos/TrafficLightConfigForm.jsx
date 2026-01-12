import { useState, useEffect } from 'react';
import { docuwareService } from '../../services/docuwareService';
import { FaTrafficLight, FaArrowRight } from 'react-icons/fa';
import ErrorMessage from '../Common/ErrorMessage';
import LoadingSpinner from '../Common/LoadingSpinner';

const TrafficLightConfigForm = ({ onSearch, onPreview, onLog, totalCount = 0, onCabinetChange, initialCabinetId }) => {
    const [cabinets, setCabinets] = useState([]);
    const [selectedCabinet, setSelectedCabinet] = useState(initialCabinetId || '');
    const [fields, setFields] = useState([]);
    const [allFields, setAllFields] = useState([]);
    const [suggestions, setSuggestions] = useState({});
    const [filters, setFilters] = useState([{ fieldName: '', value: '' }]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchCabinets();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedCabinet) {
            fetchFields();
            if (onCabinetChange) {
                const cabinet = cabinets.find(c => c.Id === selectedCabinet);
                if (cabinet) onCabinetChange(selectedCabinet, cabinet.Name);
            }
        }
    }, [selectedCabinet]);

    const fetchCabinets = async () => {
        try {
            setLoading(true);
            const data = await docuwareService.getCabinets();
            const sortedData = data.sort((a, b) => a.Name.localeCompare(b.Name));
            setCabinets(sortedData);

            // If we have an initial ID and it's valid, set it (unless already set)
            if (initialCabinetId && sortedData.some(c => c.Id === initialCabinetId)) {
                setSelectedCabinet(initialCabinetId);
            } else {
                // Fallback to localStorage if no prop
                const storedId = localStorage.getItem('selectedCabinetId');
                if (storedId && sortedData.some(c => c.Id === storedId)) {
                    setSelectedCabinet(storedId);
                }
            }
        } catch (err) {
            console.error('Cabinet fetch error:', err);
            if (err.message.includes('401') || (err.response && err.response.status === 401)) {
                setError('Sessão expirada. Por favor, faça logout e entre novamente no sistema.');
            } else {
                setError('Failed to load cabinets: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchFields = async () => {
        try {
            setLoading(true);
            const data = await docuwareService.getCabinetFields(selectedCabinet);
            setAllFields(data || []);

            const userFields = (data || [])
                .filter(f => !f.SystemField && f.DWFieldType !== 'Memo')
                .sort((a, b) => (a.DisplayName || a.FieldName).localeCompare(b.DisplayName || b.FieldName));
            setFields(userFields);

            // Smart Default Filter
            const preferredMatch = ['tipo de documento', 'tipo documento'];
            const defaultField = userFields.find(f => {
                const label = (f.DisplayName || f.FieldName).toLowerCase();
                return preferredMatch.some(p => label === p || label.includes(p));
            });

            if (defaultField) {
                setFilters(prev => {
                    if (prev.length === 1 && !prev[0].fieldName) {
                        return [{ fieldName: defaultField.DBFieldName, value: '' }];
                    }
                    return prev;
                });
            }
        } catch (err) {
            setError('Failed to load fields: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (index, field, value) => {
        const newFilters = [...filters];
        newFilters[index][field] = value;
        setFilters(newFilters);
    };

    const handleAddFilter = () => {
        setFilters([...filters, { fieldName: '', value: '' }]);
    };

    const handleRemoveFilter = (index) => {
        setFilters(filters.filter((_, i) => i !== index));
    };

    // Execute Preview (Count Only)
    const triggerPreview = () => {
        if (!selectedCabinet) return;
        const validFilters = filters.filter(f => f.fieldName && f.value);
        if (onPreview) {
            onPreview(selectedCabinet, validFilters);
        }
    };

    // Execute Submit (Next Step)
    const triggerSubmit = () => {
        if (!selectedCabinet) return;
        const validFilters = filters.filter(f => f.fieldName && f.value);
        onSearch(selectedCabinet, validFilters, allFields);
    };

    // Auto-search effect (Debounced) - Only triggers PREVIEW
    useEffect(() => {
        if (!selectedCabinet) return;

        const timer = setTimeout(() => {
            const validFilters = filters.filter(f => f.fieldName && f.value);
            // Trigger preview to update count
            if (validFilters.length > 0 || (filters.length === 1 && !filters[0].fieldName)) {
                triggerPreview();
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [filters, selectedCabinet]);


    if (loading && cabinets.length === 0) return <LoadingSpinner />;

    return (
        <div className="card bg-base-100 shadow-xl border border-base-200">
            <div className="card-body p-6">

                {/* Header */}
                <div className="flex items-start gap-4 mb-6 border-b pb-4 border-base-200">
                    <div className="p-3 bg-base-200 rounded-lg text-primary">
                        <FaTrafficLight size={24} />
                    </div>
                    <div>
                        <h2 className="card-title text-lg font-bold">Passo 1: Fonte de Dados do Semáforo</h2>
                        <p className="text-sm text-base-content/70">Defina quais documentos devem acionar este alerta visual.</p>
                    </div>
                </div>

                {error && <ErrorMessage message={error} />}

                {/* Main "Sentence" Form */}
                <div className="space-y-6">

                    {/* 1. Cabinet */}
                    <div className="form-control">
                        <label className="label justify-start gap-2 cursor-pointer pb-1">
                            <span className="badge badge-primary badge-sm">1</span>
                            <span className="font-semibold text-sm">Selecione a Origem</span>
                        </label>
                        <div className="flex items-center gap-3 pl-2">
                            <div className="text-sm text-base-content/70 w-32 shrink-0">Onde monitorar?</div>
                            <select
                                className="select select-bordered select-md flex-1 max-w-lg"
                                value={selectedCabinet}
                                onChange={(e) => {
                                    const newValue = e.target.value;
                                    setSelectedCabinet(newValue);
                                    if (newValue) localStorage.setItem('selectedCabinetId', newValue);
                                    else localStorage.removeItem('selectedCabinetId');

                                    if (onCabinetChange) {
                                        const cabinet = cabinets.find(c => c.Id === newValue);
                                        if (cabinet) onCabinetChange(newValue, cabinet.Name);
                                    }
                                }}
                            >
                                <option value="">Escolha o armário...</option>
                                {cabinets.map((cab) => (
                                    <option key={cab.Id} value={cab.Id}>{cab.Name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 2. Rule (Filters) */}
                    {selectedCabinet && fields.length > 0 && (
                        <div className="form-control animate-in fade-in slide-in-from-top-4 duration-500">
                            <label className="label justify-start gap-2 cursor-pointer pb-1 mt-2">
                                <span className="badge badge-primary badge-sm">2</span>
                                <span className="font-semibold text-sm">Regra de Monitoramento</span>
                            </label>

                            <div className="pl-2 space-y-3">
                                <div className="text-sm italic text-base-content/60">"Considerar apenas documentos onde..."</div>

                                {filters.map((filter, index) => (
                                    <div key={index} className="flex flex-wrap items-center gap-2 bg-base-100 p-2 rounded-md border border-base-200 hover:border-primary/50 transition-colors shadow-sm">

                                        {/* Field Selector */}
                                        <select
                                            className="select select-bordered select-sm focus:select-primary"
                                            value={filter.fieldName}
                                            onChange={async (e) => {
                                                const fieldName = e.target.value;
                                                handleFilterChange(index, 'fieldName', fieldName);
                                                handleFilterChange(index, 'value', '');

                                                if (fieldName && selectedCabinet) {
                                                    try {
                                                        const values = await docuwareService.getSelectList(selectedCabinet, fieldName);
                                                        const sortedValues = values.sort((a, b) =>
                                                            String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
                                                        );
                                                        setSuggestions(prev => ({ ...prev, [index]: sortedValues }));
                                                    } catch (err) { console.error(err); }
                                                }
                                            }}
                                        >
                                            <option value="">Qual a condição? (Campo)</option>
                                            {fields.map((field) => (
                                                <option key={field.DBFieldName} value={field.DBFieldName}>
                                                    {field.DisplayName || field.DBFieldName}
                                                </option>
                                            ))}
                                        </select>

                                        <span className="text-xs font-bold text-base-content/50 px-1">É IGUAL A</span>

                                        {/* Value Input */}
                                        <div className="relative flex-1 min-w-[200px]">
                                            <input
                                                type="text"
                                                list={`suggestions-${index}`}
                                                className="input input-bordered input-sm w-full focus:input-primary"
                                                placeholder="Valor..."
                                                value={filter.value}
                                                onFocus={async () => {
                                                    if (filter.fieldName && (!suggestions[index] || suggestions[index].length === 0)) {
                                                        const values = await docuwareService.getSelectList(selectedCabinet, filter.fieldName);
                                                        const sortedValues = values.sort((a, b) =>
                                                            String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
                                                        );
                                                        setSuggestions(prev => ({ ...prev, [index]: sortedValues }));
                                                    }
                                                }}
                                                onChange={(e) => handleFilterChange(index, 'value', e.target.value)}
                                            />
                                            <datalist id={`suggestions-${index}`}>
                                                {suggestions[index]?.map((val, i) => <option key={i} value={val} />)}
                                            </datalist>
                                        </div>

                                        {filters.length > 1 && (
                                            <button className="btn btn-ghost btn-xs text-error" onClick={() => handleRemoveFilter(index)}>✕</button>
                                        )}
                                    </div>
                                ))}

                                <button onClick={handleAddFilter} className="btn btn-xs btn-ghost text-primary gap-1 normal-case font-normal">
                                    + Adicionar condição E...
                                </button>

                                {/* Dynamic Preview Result */}
                                <div className={`alert ${totalCount > 0 ? 'alert-success bg-success/10 border-success/20' : 'alert-warning bg-warning/10 border-warning/20'} py-2 flex justify-between items-center mt-4`}>
                                    <div className="flex gap-2 items-center">
                                        {totalCount > 0 ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-success shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-warning shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        )}
                                        <div>
                                            <div className="font-bold text-sm">Resultado da regra:</div>
                                            <div className="text-xs">
                                                {totalCount > 0
                                                    ? `${totalCount} documentos encontrados para esta regra.`
                                                    : `Atenção: Nenhum documento encontrado com essa regra.`}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="modal-action justify-end mt-8 pt-4 border-t border-base-200">
                    <button
                        className="btn btn-primary gap-2"
                        disabled={!selectedCabinet || filters.every(f => !f.value)}
                        onClick={triggerSubmit}
                    >
                        Próximo Passo <FaArrowRight />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TrafficLightConfigForm;
