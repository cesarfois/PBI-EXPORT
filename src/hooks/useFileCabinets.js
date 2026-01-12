import { useQuery } from '@tanstack/react-query';
import { adminWorkflowService } from '../services/adminWorkflowService';

export const useFileCabinets = () => {
    const { data: fcMap, isLoading, error } = useQuery({
        queryKey: ['file-cabinets-map-v2'],
        queryFn: async () => {
            console.log('[useFileCabinets] Fetching File Cabinet Map...');
            return await adminWorkflowService.getFileCabinetMap();
        },
        staleTime: 1000 * 60 * 60 * 24, // 24 hours (rarely changes)
        gcTime: 1000 * 60 * 60 * 24,
    });

    return {
        fcMap: fcMap || {},
        isLoading,
        error
    };
};
