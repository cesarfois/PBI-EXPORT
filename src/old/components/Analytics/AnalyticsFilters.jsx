import React from 'react';

const AnalyticsFilters = ({
    cabinets,
    selectedCabinetId,
    onCabinetChange,
    availableFields,
    selectedField,
    onFieldChange,
    filterValue,
    onFilterChange,
    uniqueValues,
    loadingCabinets
}) => {
    return (
        <div className="card bg-base-100 shadow-xl">
            <div className="card-body p-4">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-end">

                    {/* Cabinet Selector (Left) */}
                    <div className="form-control w-full max-w-xs">
                        <label className="label py-1">
                            <span className="label-text font-bold">Select Cabinet</span>
                        </label>
                        {loadingCabinets ? (
                            <div className="flex items-center gap-2 h-12">
                                <span className="loading loading-spinner loading-xs"></span>
                                <span className="text-sm text-gray-500">Loading cabinets...</span>
                            </div>
                        ) : (
                            <select
                                className="select select-bordered w-full"
                                value={selectedCabinetId}
                                onChange={(e) => onCabinetChange(e.target.value)}
                            >
                                <option value="">Selecione o armário</option>
                                {cabinets.map((cabinet) => (
                                    <option key={cabinet.Id} value={cabinet.Id}>
                                        {cabinet.Name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Filters (Right) */}
                    <div className="flex gap-4 w-full md:w-auto">
                        <div className="form-control w-full md:w-48">
                            <label className="label py-1">
                                <span className="label-text">Group By Field</span>
                            </label>
                            <select
                                className="select select-bordered select-sm w-full"
                                value={selectedField}
                                onChange={(e) => onFieldChange(e.target.value)}
                                disabled={!selectedCabinetId}
                            >
                                {availableFields.map(field => (
                                    <option key={field.name} value={field.name}>{field.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-control w-full md:w-48">
                            <label className="label py-1">
                                <span className="label-text">Filter Value (Optional)</span>
                            </label>
                            <select
                                className="select select-bordered select-sm w-full"
                                value={filterValue}
                                onChange={(e) => onFilterChange(e.target.value)}
                                disabled={!selectedField || !selectedCabinetId}
                            >
                                <option value="">All Values</option>
                                {uniqueValues.map(val => (
                                    <option key={val} value={val}>{val}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsFilters;
