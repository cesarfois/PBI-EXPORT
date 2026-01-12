import { useState } from 'react';

const ColumnFilter = ({ column, uniqueValues, selectedValues, onToggleValue, onSelectAll, onClear }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const handleToggle = (value) => {
        onToggleValue(column.name, value);
    };

    const handleSelectAll = () => {
        onSelectAll(column.name);
    };

    const handleClear = () => {
        onClear(column.name);
        setSearchTerm('');
    };

    const openModal = () => {
        document.getElementById(`filter_modal_${column.name}`).showModal();
    };

    const closeModal = () => {
        document.getElementById(`filter_modal_${column.name}`).close();
        setSearchTerm('');
    };

    const hasFilter = selectedValues && selectedValues.length > 0;

    // Filter values based on search term
    const filteredValues = uniqueValues.filter(value =>
        value.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <>
            <button
                className={`btn btn-xs btn-ghost ${hasFilter ? 'text-primary font-bold' : 'text-base-content/50'} hover:text-primary`}
                onClick={openModal}
                title="Filter column"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
            </button>

            <dialog id={`filter_modal_${column.name}`} className="modal">
                <div className="modal-box w-11/12 max-w-md">
                    <h3 className="font-bold text-lg mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        Filter: {column.label}
                    </h3>

                    {/* Search input */}
                    <div className="form-control mb-3">
                        <input
                            type="text"
                            placeholder="Search values..."
                            className="input input-bordered input-sm w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 mb-3">
                        <button
                            className="btn btn-sm btn-outline flex-1"
                            onClick={handleSelectAll}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Select All
                        </button>
                        <button
                            className="btn btn-sm btn-outline flex-1"
                            onClick={handleClear}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Clear
                        </button>
                    </div>

                    {/* Values list */}
                    <div className="border rounded-lg p-2 max-h-80 overflow-y-auto bg-base-200/30">
                        {filteredValues.length === 0 ? (
                            <p className="text-center text-base-content/50 py-4">No values found</p>
                        ) : (
                            <div className="space-y-1">
                                {filteredValues.map(value => (
                                    <label
                                        key={value}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-sm checkbox-primary"
                                            checked={selectedValues.includes(value)}
                                            onChange={() => handleToggle(value)}
                                        />
                                        <span className="text-sm flex-1">{value}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Summary */}
                    {hasFilter && (
                        <div className="alert alert-info mt-3 py-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <span className="text-sm">{selectedValues.length} value(s) selected</span>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="modal-action">
                        <button
                            className="btn btn-sm btn-ghost"
                            onClick={closeModal}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-sm btn-primary"
                            onClick={closeModal}
                        >
                            Done
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

export default ColumnFilter;
