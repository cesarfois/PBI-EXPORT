import { useState, useEffect } from 'react';

const StatusConfig = ({ fields, onConfigChange, customTrigger, initialField, initialRules, isInline }) => {
    const [selectedField, setSelectedField] = useState(initialField || '');
    const [statusRules, setStatusRules] = useState(initialRules || [
        { value: '', color: 'green', label: '🟢 Green' },
        { value: '', color: 'yellow', label: '🟡 Yellow' },
        { value: '', color: 'red', label: '🔴 Red' }
    ]);

    // Auto-save changes if inline
    useEffect(() => {
        if (isInline && onConfigChange) {
            const validRules = statusRules.filter(r => r.value.trim() !== '');
            if (!selectedField) {
                onConfigChange(null);
            } else {
                onConfigChange({
                    field: selectedField,
                    rules: statusRules
                });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedField, statusRules]);

    const colorOptions = [
        { value: 'green', label: '🟢 Green', class: 'bg-green-500' },
        { value: 'yellow', label: '🟡 Yellow', class: 'bg-yellow-500' },
        { value: 'red', label: '🔴 Red', class: 'bg-red-500' },
        { value: 'blue', label: '🔵 Blue', class: 'bg-blue-500' },
        { value: 'gray', label: '⚪ Gray', class: 'bg-gray-500' }
    ];

    const handleAddRule = () => {
        setStatusRules([...statusRules, { value: '', color: 'gray', label: '⚪ Gray' }]);
    };

    const handleRemoveRule = (index) => {
        setStatusRules(statusRules.filter((_, i) => i !== index));
    };

    const handleRuleChange = (index, field, value) => {
        const newRules = [...statusRules];
        newRules[index][field] = value;
        if (field === 'color') {
            const colorOption = colorOptions.find(c => c.value === value);
            newRules[index].label = colorOption.label;
        }
        setStatusRules(newRules);
    };

    const handleApply = () => {
        if (!selectedField) {
            alert('Please select a field');
            return;
        }
        const validRules = statusRules.filter(r => r.value.trim() !== '');
        if (validRules.length === 0) {
            alert('Please add at least one status rule');
            return;
        }
        onConfigChange({ field: selectedField, rules: validRules });
        document.getElementById('status_modal').close();
    };

    const handleClear = () => {
        onConfigChange(null);
        setSelectedField('');
        setStatusRules([
            { value: '', color: 'green', label: '🟢 Green' },
            { value: '', color: 'yellow', label: '🟡 Yellow' },
            { value: '', color: 'red', label: '🔴 Red' }
        ]);
        if (!isInline) document.getElementById('status_modal').close();
    };

    const openModal = () => {
        document.getElementById('status_modal').showModal();
    };

    const renderFormContent = () => (
        <>
            {/* Field Selection */}
            <div className="form-control mb-4">
                <label className="label">
                    <span className="label-text font-bold text-gray-700">Campo Base</span>
                    <span className="label-text-alt text-gray-500">Qual campo define o status?</span>
                </label>
                <select
                    className="select select-bordered w-full"
                    value={selectedField}
                    onChange={(e) => setSelectedField(e.target.value)}
                >
                    <option value="">Selecione um campo...</option>
                    {fields.map((field) => (
                        <option key={field.name} value={field.name}>
                            {field.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Status Rules */}
            <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                    <label className="label pl-0">
                        <span className="label-text font-bold text-gray-700">Regras de Cor</span>
                    </label>
                </div>

                <div className="space-y-2">
                    {statusRules.map((rule, index) => (
                        <div key={index} className="flex gap-2 items-center bg-base-50 p-2 rounded-lg border border-base-200">
                            {/* Color Indicator/Selector */}
                            <div className="dropdown dropdown-hover">
                                <div tabIndex={0} role="button" className={`btn btn-sm btn-circle ${colorOptions.find(c => c.value === rule.color)?.class || 'bg-gray-300'} border-none`}>
                                </div>
                                <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-32">
                                    {colorOptions.map((color) => (
                                        <li key={color.value}>
                                            <a onClick={() => handleRuleChange(index, 'color', color.value)} className="flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full ${color.class}`}></div>
                                                {color.label.split(' ')[1]}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <span className="text-gray-400 font-bold">=</span>

                            <input
                                type="text"
                                className="input input-sm input-bordered flex-1"
                                placeholder="Valor (ex: Aprovado)"
                                value={rule.value}
                                onChange={(e) => handleRuleChange(index, 'value', e.target.value)}
                            />

                            {statusRules.length > 1 && (
                                <button
                                    className="btn btn-xs btn-ghost text-gray-400 hover:text-error"
                                    onClick={() => handleRemoveRule(index)}
                                    title="Remover regra"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                <button className="btn btn-sm btn-ghost w-full mt-2 gap-2 text-primary dashed-border border-primary/30" onClick={handleAddRule}>
                    + Adicionar Regra
                </button>
            </div>
        </>
    );

    if (isInline) {
        return (
            <div className="w-full">
                {renderFormContent()}
            </div>
        );
    }

    return (
        <>
            {customTrigger ? (
                customTrigger(openModal)
            ) : (
                <button className="btn btn-sm btn-outline" onClick={openModal}>
                    🚦 Status Indicator
                </button>
            )}

            <dialog id="status_modal" className="modal">
                <div className="modal-box w-11/12 max-w-md">
                    <h3 className="font-bold text-lg mb-4">Configurar Status</h3>
                    {renderFormContent()}
                    {/* Action Buttons */}
                    <div className="modal-action">
                        <button
                            className="btn btn-sm btn-ghost"
                            onClick={handleClear}
                        >
                            Limpar
                        </button>
                        <button
                            className="btn btn-sm"
                            onClick={() => document.getElementById('status_modal').close()}
                        >
                            Cancelar
                        </button>
                        <button
                            className="btn btn-sm btn-primary"
                            onClick={handleApply}
                        >
                            Aplicar
                        </button>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>
        </>
    );
};

export default StatusConfig;
