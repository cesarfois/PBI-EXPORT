import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// Create a client
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            cacheTime: 1000 * 60 * 60 * 24, // 24 hours
            refetchOnWindowFocus: false, // Prevent aggressive refetching
        },
    },
});

// Create a persister (saves to localStorage)
export const persister = createSyncStoragePersister({
    storage: window.localStorage,
});
