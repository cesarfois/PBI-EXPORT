import React from 'react';
import { Virtuoso } from 'react-virtuoso';
import WorkflowRow from './WorkflowRow';

const VirtualWorkflowList = ({ workflows, fcMap, onRowClick }) => {
    return (
        <Virtuoso
            style={{ height: '70vh' }} // Explicit viewport-based height
            totalCount={workflows.length}
            itemContent={(index) => {
                const workflow = workflows[index];
                return (
                    <WorkflowRow
                        key={workflow.id}
                        id={workflow.id}
                        name={workflow.name}
                        fcMap={fcMap}
                        onClick={onRowClick}
                    />
                );
            }}
            components={{
                // Optional: Customize footer or empty state
                EmptyPlaceholder: () => (
                    <div className="text-center p-10 opacity-50">
                        Nenhum workflow encontrado.
                    </div>
                )
            }}
        />
    );
};

export default VirtualWorkflowList;
