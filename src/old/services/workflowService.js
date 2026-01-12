import axios from 'axios';

/**
 * Workflow Service - Administrative Access using Power Automate API Key
 * 
 * This service provides unrestricted access to DocuWare workflows for
 * administrative monitoring purposes (Phase 1). It uses a dedicated API Key
 * instead of the logged-in user's token to provide a global view.
 */

// Create a dedicated axios instance for workflow API with Power Automate API Key
const workflowApi = axios.create({
    baseURL: '/DocuWare/Platform/Workflow',  // Full path including Workflow
    timeout: 30000,
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }
});

// Add request interceptor to include auth token from session storage (same as api.js)
workflowApi.interceptors.request.use(
    (config) => {
        const authData = sessionStorage.getItem('docuware_auth');
        let targetUrl = null;

        console.log('[WorkflowService] Request config:', {
            url: config.url,
            method: config.method,
            hasAuthData: !!authData
        });

        if (authData) {
            try {
                const parsed = JSON.parse(authData);
                if (parsed.token) {
                    config.headers.Authorization = `Bearer ${parsed.token}`;
                    console.log('[WorkflowService] Using user token from session');
                }
                if (parsed.url) {
                    targetUrl = parsed.url;
                }
            } catch (error) {
                console.error('[WorkflowService] Error parsing auth data:', error);
            }
        } else {
            console.warn('[WorkflowService] No user logged in - workflow requests will fail');
        }

        // Allow overriding target URL via config (useful for login/discovery)
        if (config.headers['x-target-url']) {
            targetUrl = config.headers['x-target-url'];
        }

        // Apply header if we have a target
        if (targetUrl) {
            config.headers['x-target-url'] = targetUrl;
        }

        console.log('[WorkflowService] Request headers:', {
            Authorization: config.headers.Authorization ? 'Bearer [USER_TOKEN]' : 'missing',
            'x-target-url': config.headers['x-target-url']
        });

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add response interceptor for error handling
workflowApi.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            console.error('❌ Workflow API authentication failed - API Key may be invalid or expired');
        }
        return Promise.reject(error);
    }
);


export const workflowService = {
    /**
     * Get all workflows with administrative access
     * @returns {Promise<Array>} Array of workflow objects
     */
    getWorkflows: async () => {
        try {
            console.log('[WorkflowService] Fetching all workflows...');

            // Try the primary endpoint first
            try {
                const response = await workflowApi.get('/Workflows');  // baseURL already has /Workflow
                console.log('[WorkflowService] Primary endpoint response:', response.status);

                const workflows = response.data.Workflow || [];
                console.log(`[WorkflowService] Found ${workflows.length} workflows`);
                return workflows;
            } catch (error) {
                console.warn('[WorkflowService] Primary endpoint failed, trying alternatives...', error.message);

                // Fallback logic here if needed, or rethrow
                throw error;
            }
        } catch (error) {
            console.error('[WorkflowService] Error fetching workflows:', error);
            return [];
        }
    },

    /**
     * Get Workflow History for a specific Document ID
     * Uses the Workflow History endpoint to retrieve audit trail
     * @param {string} docId - The Document ID
     * @returns {Promise<Array>} List of workflow history events
     */
    getWorkflowHistory: async (docId) => {
        try {
            console.log(`[WorkflowService] Fetching workflow history for DocID: ${docId}`);

            // Strategy: Search for all workflow instances for this DocID using /Instances endpoint
            // The API baseURL is /DocuWare/Platform/Workflow
            // We search for instances linked to this document

            const response = await workflowApi.get(`/Instances?docId=${docId}`);
            const instances = response.data.WorkflowInstance || [];

            if (instances.length === 0) {
                console.log(`[WorkflowService] No active instances found for ${docId}.`);

                // If no ACTIVE instances, we might want to check if the user has completed tasks
                // But the API for "Completed instances" is not standard /Instances.
                // For now, return empty.
                return [];
            }

            // Fetch history for each found instance
            // Each instance has an ID. We can get its history via /Instances/{id}/History

            const historyPromises = instances.map(instance =>
                workflowApi.get(`/Instances/${instance.Id}/History`)
            );

            const histories = await Promise.all(historyPromises);

            // Flatten and sort by timestamp (newest first)
            const allEvents = histories.flatMap(h => h.data.History || []);
            return allEvents.sort((a, b) => new Date(b.TimeStamp) - new Date(a.TimeStamp));

        } catch (error) {
            console.warn(`[WorkflowService] Failed to get workflow history: ${error.message}`);
            // If the standard endpoint fails, throw.
            throw error;
        }
    },


    /**
     * Get active tasks/instances for a specific workflow
     * @param {string} workflowId - The workflow ID
     * @returns {Promise<Array>} Array of task objects
     */
    /**
     * Helper to fetch all pages of a collection using robust Link following
     * Extracts relative path by searching for resource keywords.
     */
    getAllPages: async (url, config = {}) => {
        let allItems = [];
        let nextLink = url;
        let pageCount = 0;

        // Ensure config.params exists
        if (!config.params) config.params = {};
        config.params.Count = 1000; // Prefer large pages if possible

        try {
            while (nextLink) {
                pageCount++;
                console.log(`[WorkflowService] Fetching page ${pageCount}: ${nextLink}`);

                let requestUrl = nextLink;

                // Handle absolute URLs or full paths in 'nextLink'
                // We need to convert them to be relative to our partial baseURL (/DocuWare/Platform/Workflow)
                // OR relative to the root if we were using a root client. 
                // But we are using 'workflowApi' which has baseURL set.

                if (nextLink.toLowerCase().startsWith('http') || nextLink.startsWith('/')) {
                    // Strategy: Find the known resource segment and extract from there
                    const keywords = ['/Workflows', '/ControllerWorkflows'];
                    let relativePath = null;

                    for (const kw of keywords) {
                        // Case insensitive search
                        const idx = nextLink.toLowerCase().indexOf(kw.toLowerCase());
                        if (idx !== -1) {
                            // Extract from the keyword, retaining case and query params
                            relativePath = nextLink.substring(idx);
                            break;
                        }
                    }

                    if (relativePath) {
                        requestUrl = relativePath;
                        console.log(`[WorkflowService] Extracted relative path: ${requestUrl}`);
                    } else {
                        console.warn('[WorkflowService] Could not find resource keyword in next link, using as is (risky):', nextLink);
                        // If we can't match, maybe we should try to strip the common base path manually?
                        // But the keyword search is safest. 
                    }
                }

                // Make the request
                const response = await workflowApi.get(requestUrl, config);

                // Collect items
                const tasks = response.data.Task || [];
                allItems = [...allItems, ...tasks];
                console.log(`[WorkflowService] Page ${pageCount} returned ${tasks.length} items. Total so far: ${allItems.length}`);

                // Determine next link
                const links = response.data.Link || response.data.Links;
                if (links && Array.isArray(links)) {
                    const nextLinkObj = links.find(l => l.Rel && l.Rel.toLowerCase() === 'next');
                    if (nextLinkObj) {
                        nextLink = nextLinkObj.Href;
                        // IMPORTANT: Clear Loop params for subsequent requests 
                        // because the 'next' link usually contains the params (Start/Count) already embedded.
                        config.params = {};
                    } else {
                        nextLink = null;
                    }
                } else {
                    nextLink = null;
                }

                // Safety break
                if (pageCount > 200) {
                    console.warn('[WorkflowService] Reached max page limit (200), stopping.');
                    break;
                }
            }
            return allItems;
        } catch (error) {
            console.error('[WorkflowService] Error in pagination:', error);
            if (allItems.length > 0) {
                console.warn('[WorkflowService] Pagination failed but retrieved partial results:', allItems.length);
                return allItems;
            }
            throw error;
        }
    },

    /**
     * Get active tasks/instances for a specific workflow
     * @param {string} workflowId - The workflow ID
     * @returns {Promise<Array>} Array of task objects
     */
    /**
     * Get active tasks/instances for a specific workflow
     * @param {string} workflowId - The workflow ID
     * @param {string} viewType - 'user' (My Tasks) or 'admin' (Controller/All Tasks). Default: 'admin' logic (auto-detect)
     * @returns {Promise<Array>} Array of task objects
     */
    getWorkflowTasks: async (workflowId, viewType = 'auto') => {
        try {
            console.log(`[WorkflowService] Fetching tasks for workflow ${workflowId} (Mode: ${viewType})...`);

            const tryController = async () => {
                const tasks = await workflowService.getAllPages(`/ControllerWorkflows/${workflowId}/Tasks`);
                console.log(`[WorkflowService] Found ${tasks.length} tasks via controller endpoint`);
                return tasks;
            };

            const tryUser = async () => {
                const tasks = await workflowService.getAllPages(`/Workflows/${workflowId}/Tasks`);
                console.log(`[WorkflowService] Found ${tasks.length} active tasks (User view)`);
                return tasks;
            };

            if (viewType === 'user') {
                // STRICT MODE: Only check user tasks
                return await tryUser();
            }

            if (viewType === 'admin') {
                // PREFER Controller, fallback to user (or fail if strict admin required, but fallback is safer generally)
                try {
                    return await tryController();
                } catch (e) {
                    console.warn(`[WorkflowService] Controller fetch failed in admin mode, falling back to user view.`);
                    return await tryUser();
                }
            }

            // AUTO MODE (Original logic): Try Controller, then User
            try {
                return await tryController();
            } catch (controllerError) {
                console.warn(`[WorkflowService] Controller endpoint failed, trying user endpoint...`);
                try {
                    return await tryUser();
                } catch (userTasksError) {
                    console.warn(`[WorkflowService] Both endpoints failed for workflow ${workflowId}`);
                    return [];
                }
            }

        } catch (error) {
            console.error(`[WorkflowService] Error fetching tasks for workflow ${workflowId}:`, error);
            return [];
        }
    },

    /**
     * Get all workflows with their active instance counts
     * @returns {Promise<Array>} Array of workflow objects with counts
     */
    /**
     * Get workflows specifically for the logged-in user (My Workflows)
     * Queries /DocuWare/Platform/Workflow/Workflows
     * @returns {Promise<Array>} Array of workflow objects with counts
     */
    getMyWorkflowsWithCounts: async () => {
        try {
            console.log('[WorkflowService] Fetching MY workflows (User Context)...');

            // 1. Get User Workflows (where user has tasks)
            // Note: This endpoint (/Workflows) returns workflows where the user has active tasks
            const response = await workflowApi.get('/Workflows');
            const workflows = response.data.Workflow || [];

            if (workflows.length === 0) {
                console.log('[WorkflowService] No user workflows found');
                return [];
            }

            console.log(`[WorkflowService] Found ${workflows.length} user workflows. Fetching details...`);

            // 2. Fetch task counts for these specific workflows
            const workflowsWithCounts = await Promise.all(
                workflows.map(async (workflow) => {
                    try {
                        // FORCE 'user' viewType to ensure we don't accidentally fetch controller tasks
                        // if the user happens to have admin rights.
                        const tasks = await workflowService.getWorkflowTasks(workflow.Id, 'user');

                        return {
                            id: workflow.Id,
                            name: workflow.Name || workflow.Id,
                            description: workflow.Description || 'Fluxo de trabalho atribuído a você',
                            activeInstanceCount: tasks.length
                        };
                    } catch (error) {
                        console.error(`[WorkflowService] Failed to get details for ${workflow.Id}:`, error);
                        return {
                            id: workflow.Id,
                            name: workflow.Name || workflow.Id,
                            description: '',
                            activeInstanceCount: 0
                        };
                    }
                })
            );

            return workflowsWithCounts;
        } catch (error) {
            console.error('[WorkflowService] Error fetching user workflows:', error);
            throw error;
        }
    },

    getWorkflowsWithCounts: async () => {
        try {
            console.log('[WorkflowService] Fetching workflows with instance counts...');

            // Step 1: Get all workflows
            const workflows = await workflowService.getWorkflows();

            if (workflows.length === 0) {
                console.log('[WorkflowService] No workflows found');
                return [];
            }

            // Step 2: Fetch task counts for all workflows in parallel
            console.log(`[WorkflowService] Fetching task counts for ${workflows.length} workflows...`);
            const workflowsWithCounts = await Promise.all(
                workflows.map(async (workflow) => {
                    try {
                        // Default behavior (or explicit 'admin')
                        const tasks = await workflowService.getWorkflowTasks(workflow.Id, 'admin');
                        return {
                            id: workflow.Id,
                            name: workflow.Name || workflow.Id,
                            description: workflow.Description || '',
                            activeInstanceCount: tasks.length
                        };
                    } catch (error) {
                        console.error(`[WorkflowService] Failed to get count for workflow ${workflow.Id}:`, error);
                        // Return workflow with count 0 on error
                        return {
                            id: workflow.Id,
                            name: workflow.Name || workflow.Id,
                            description: workflow.Description || '',
                            activeInstanceCount: 0
                        };
                    }
                })
            );
            // ... (rest of function)

            console.log('[WorkflowService] ✅ Successfully fetched all workflow counts');
            return workflowsWithCounts;
        } catch (error) {
            console.error('[WorkflowService] Error fetching workflows with counts:', error);
            throw error;
        }
    }
};
