import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminWorkflowService } from '../../services/adminWorkflowService';
import { FaBoxOpen, FaTasks, FaExclamationTriangle, FaFingerprint } from 'react-icons/fa';

const WorkflowRow = ({ id, name, fcMap, onClick, style }) => {
    // Independent fetch for this row's details
    // Only fetches when the row is mounted (virtualized)
    const { data: details, isLoading, error } = useQuery({
        queryKey: ['workflow-details', id],
        queryFn: async () => {
            const detail = await adminWorkflowService.getWorkflowDetails(id);
            const tasks = await adminWorkflowService.getWorkflowTasks(id); // Fetch count

            // Get FC Name (we rely on cache or individual fetch here, 
            // but ideally we should have the FC Map global. 
            // For now, let's just use the ID or implement a smart cache look up if needed.
            // Actually, getWorkflowDetails returns FileCabinetId.
            // We can fetch FC Map once globally or just show ID for now and improve later.

            return {
                ...detail,
                activeInstanceCount: tasks.length,
                fileCabinetId: detail.FileCabinetId
            };
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    // We can also use a global FC map from context/query if we want perfect names
    // For now let's focus on the structure.

    // Resolve FC Name
    const fcName = details?.fileCabinetId ? (fcMap?.[details.fileCabinetId] || details.fileCabinetId) : null;

    return (
        <div style={style} className="p-2">
            <div
                className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-base-200"
                onClick={() => onClick && onClick({ id, name, ...details })}
            >
                <div className="card-body p-4 flex flex-row items-center justify-between">
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg truncate" title={name}>{name}</h3>
                            <div
                                className="tooltip tooltip-right before:text-[10px] before:py-1 before:px-2 before:bg-neutral/90"
                                data-tip={`IDWF=${id}`}
                            >
                                <button
                                    className="btn btn-ghost btn-xs btn-circle opacity-50 hover:opacity-100"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(id);
                                    }}
                                >
                                    <FaFingerprint />
                                </button>
                            </div>
                        </div>
                        {/* Old ID div removed */}

                        {/* File Cabinet Info */}
                        <div className="flex items-center gap-2 text-sm mt-1">
                            <FaBoxOpen className="text-primary opacity-70" />
                            {isLoading ? (
                                <span className="loading loading-dots loading-xs"></span>
                            ) : fcName ? (
                                <>
                                    <span className="badge badge-ghost badge-xs border-primary/20 bg-primary/5 text-[10px] opacity-80 truncate max-w-[200px]" title={fcName}>
                                        {fcName}
                                    </span>
                                    {details?.fileCabinetId && (
                                        <div
                                            className="tooltip tooltip-right flex items-center z-50 ml-1 before:text-[10px] before:py-1 before:px-2 before:bg-neutral/90"
                                            data-tip={`IDFC=${details.fileCabinetId}`}
                                        >
                                            <button
                                                className="btn btn-ghost btn-xs btn-circle opacity-50 hover:opacity-100"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigator.clipboard.writeText(details.fileCabinetId);
                                                }}
                                            >
                                                <FaFingerprint />
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <span className="text-xs opacity-50">Sem armário</span>
                            )}
                        </div>
                    </div>

                    {/* Stats & Status */}
                    <div className="flex flex-col items-end gap-2">
                        {isLoading ? (
                            <div className="flex flex-col gap-1 items-end">
                                <div className="skeleton w-16 h-6"></div>
                                <div className="skeleton w-24 h-4"></div>
                            </div>
                        ) : error ? (
                            <div className="text-error flex items-center gap-1 text-sm" title="Erro ao carregar detalhes">
                                <FaExclamationTriangle /> <span className="hidden sm:inline">Erro</span>
                            </div>
                        ) : (
                            <div className={`badge ${details?.activeInstanceCount > 0 ? 'badge-success text-white' : 'badge-ghost'} gap-2 p-3 min-w-[100px]`}>
                                <FaTasks />
                                <span className="font-bold">{details?.activeInstanceCount || 0}</span>
                                <span className="text-xs font-normal">tasks</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(WorkflowRow);
