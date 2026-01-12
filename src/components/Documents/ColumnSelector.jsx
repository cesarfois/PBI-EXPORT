import { useState } from 'react';

const ColumnSelector = ({ allColumns, visibleColumns, onToggleColumn, onToggleAll, customTrigger }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const openModal = () => {
        document.getElementById('column_selector_modal').showModal();
    };

    const closeModal = () => {
        document.getElementById('column_selector_modal').close();
        setSearchTerm('');
    };

    const handleShowAll = () => {
        onToggleAll(true);
    };

    const handleHideAll = () => {
        onToggleAll(false);
    };

    // Filter columns based on search term
    const filteredColumns = allColumns.filter(col =>
        col.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const visibleCount = Object.values(visibleColumns).filter(v => v).length;

    return (
        <>
            {customTrigger ? (
                customTrigger(openModal)
            ) : (
                <button className="btn btn-sm btn-outline" onClick={openModal}>
                    ⚙️ Columns ({visibleCount}/{allColumns.length})
                </button>
            )}

            <dialog id="column_selector_modal" className="modal">
                <div className="modal-box w-11/12 max-w-md">
                    <h3 className="font-bold text-lg mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                        </svg>
                        Column Visibility
                    </h3>

                    {/* Search input */}
                    <div className="form-control mb-3">
                        <input
                            type="text"
                            placeholder="Search columns..."
                            className="input input-bordered input-sm w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 mb-3">
                        <button
                            className="btn btn-sm btn-outline flex-1"
                            onClick={handleShowAll}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Show All
                        </button>
                        <button
                            className="btn btn-sm btn-outline flex-1"
                            onClick={handleHideAll}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                            Hide All
                        </button>
                    </div>

                    {/* Columns list */}
                    <div className="border rounded-lg p-2 max-h-80 overflow-y-auto bg-base-200/30">
                        {filteredColumns.length === 0 ? (
                            <p className="text-center text-base-content/50 py-4">No columns found</p>
                        ) : (
                            <div className="space-y-1">
                                {filteredColumns.map(col => (
                                    <label
                                        key={col.name}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-sm checkbox-primary"
                                            checked={visibleColumns[col.name] || false}
                                            onChange={() => onToggleColumn(col.name)}
                                        />
                                        <span className="text-sm flex-1">{col.label}</span>
                                        {col.type === 'standard' && (
                                            <span className="badge badge-xs badge-ghost">System</span>
                                        )}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Summary */}
                    <div className="alert alert-info mt-3 py-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span className="text-sm">{visibleCount} of {allColumns.length} columns visible</span>
                    </div>

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

export default ColumnSelector;
