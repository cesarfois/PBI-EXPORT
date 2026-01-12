import api from './api';

/**
 * @file docuwareService.js
 * @description Core service layer for interacting with the DocuWare Platform API.
 * Handles authentication context, file cabinet operations, search queries, and document manipulation.
 * 
 * @module services/docuwareService
 */

export const docuwareService = {
    /**
     * @function getCabinets
     * @description Retrieves all File Cabinets accessible to the current user.
     * Maps to DocuWare resource: /FileCabinets
     * 
     * @returns {Promise<Array>} List of File Cabinet objects.
     */
    getCabinets: async () => {
        const response = await api.get('/FileCabinets');
        return response.data.FileCabinet || [];
    },

    /**
     * @function getCabinetFields
     * @description Fetches the schema/fields definition for a specific File Cabinet.
     * Uses a fallback strategy: tries root metadata first, then the dedicated /Fields endpoint.
     * 
     * @param {string} cabinetId - The UUID of the File Cabinet.
     * @returns {Promise<Array>} List of Field definitions (DBName, DisplayName, etc.).
     * @throws {Error} If cabinetId is missing.
     */
    getCabinetFields: async (cabinetId) => {
        if (!cabinetId) throw new Error("Cabinet ID is required");
        try {
            // Strategy 1: Check if fields are embedded in the cabinet root resource
            const response = await api.get(`/FileCabinets/${cabinetId}`);
            if (response.data && response.data.Fields) {
                return response.data.Fields;
            }

            // Strategy 2: Fallback to /Fields endpoint if not embedded
            console.warn(`Fields not found in cabinet root for ${cabinetId}, trying /Fields...`);
            try {
                const fieldRes = await api.get(`/FileCabinets/${cabinetId}/Fields`);
                if (fieldRes.data && fieldRes.data.Fields) {
                    return fieldRes.data.Fields;
                }
            } catch (fallbackErr) {
                console.warn("Fallback to /Fields failed:", fallbackErr);
            }

            return [];
        } catch (error) {
            console.error("Error in getCabinetFields:", error);
            throw error;
        }
    },

    /**
     * @function getCabinetCount
     * @description Gets the total number of documents in a cabinet.
     * Uses query param count=0 to avoid fetching actual items, optimizing performance.
     * 
     * @param {string} cabinetId - The UUID of the File Cabinet.
     * @returns {Promise<number>} Total document count.
     */
    getCabinetCount: async (cabinetId) => {
        try {
            const response = await api.get(`/FileCabinets/${cabinetId}/Documents`, {
                params: {
                    count: 0,
                    calculateTotalCount: true
                }
            });

            // Handle DocuWare response variations (sometimes Count is an object)
            if (typeof response.data.Count === 'object' && response.data.Count !== null) {
                return response.data.Count.Value || 0;
            }
            return response.data.Count || 0;
        } catch (error) {
            console.error('Error getting cabinet count:', error);
            return 0;
        }
    },

    /**
     * @function getDialogs
     * @description Retrieves all search and store dialogs for a cabinet.
     * Necessary to find the 'Search' dialog ID required for queries.
     * 
     * @param {string} cabinetId 
     * @returns {Promise<Array>} List of dialogs.
     */
    getDialogs: async (cabinetId) => {
        const response = await api.get(`/FileCabinets/${cabinetId}/Dialogs`);
        return response.data.Dialog || [];
    },

    /**
     * @function getOrganization
     * @description Retrieves the Organization info (specifically GUID).
     * Maps to DocuWare resource: /Organizations
     * 
     * @returns {Promise<string>} The Organization GUID.
     */
    getOrganization: async () => {
        try {
            const response = await api.get('/Organizations');
            const orgs = response.data.Organization;
            if (orgs && orgs.length > 0) {
                return orgs[0].Id; // Return first organization GUID
            }
            return null;
        } catch (error) {
            console.error('Error fetching Organization:', error);
            return null;
        }
    },

    /**
     * @function getDocument
     * @description Retrieves a specific document's metadata (fields).
     * 
     * @param {string} cabinetId 
     * @param {string} docId 
     * @returns {Promise<Object>} Document object with Fields.
     */
    getDocument: async (cabinetId, docId) => {
        const response = await api.get(`/FileCabinets/${cabinetId}/Documents/${docId}`);
        return response.data;
    },

    /**
     * @function searchDocuments
     * @description Executes a specific query against the File Cabinet.
     * 
     * @param {string} cabinetId - Target Cabinet.
     * @param {Array<{fieldName: string, value: string}>} filters - Array of filter objects.
     * @param {number} [resultLimit=1000] - Max items to return.
     * @returns {Promise<{items: Array, total: number}>} Search results and total hits.
     */
    searchDocuments: async (cabinetId, filters = [], resultLimit = 1000) => {
        // Case 1: No filters - List all documents (limited by resultLimit)
        if (filters.length === 0) {
            const response = await api.get(`/FileCabinets/${cabinetId}/Documents`, {
                params: {
                    count: resultLimit,
                    calculateTotalCount: true
                }
            });

            const total = (typeof response.data.Count === 'object' && response.data.Count !== null)
                ? (response.data.Count.Value || 0)
                : (response.data.Count || 0);

            return {
                items: response.data.Items || [],
                total: total
            };
        }

        // Case 2: With Filters - Requires Search Dialog ID
        const dialogs = await docuwareService.getDialogs(cabinetId);
        const searchDialog = dialogs.find(d => d.Type === 'Search') || dialogs[0];

        if (!searchDialog) {
            throw new Error('No search dialog found for this cabinet');
        }

        // Construct standard DocuWare Query Object
        const conditions = filters.map(filter => ({
            DBName: filter.fieldName,
            Value: Array.isArray(filter.value) ? filter.value : [filter.value]
        }));

        const queryBody = {
            Condition: conditions,
            Operation: 'And', // Force strict AND logic
            CalculateTotalCount: true
        };

        // POST to /Query/DialogExpression is the standard way to search
        const response = await api.post(
            `/FileCabinets/${cabinetId}/Query/DialogExpression`,
            queryBody,
            {
                params: {
                    dialogId: searchDialog.Id,
                    count: resultLimit
                }
            }
        );

        const getCount = (data) => {
            if (typeof data.Count === 'object' && data.Count !== null) {
                return data.Count.Value || 0;
            }
            return data.Count || 0;
        };

        return {
            items: response.data.Items || [],
            total: getCount(response.data)
        };
    },

    /**
     * @function getSelectList
     * @description Retrieves unique values for a specific field (Select List).
     * Useful for populating autocomplete or dropdown filters.
     * 
     * @param {string} cabinetId 
     * @param {string} fieldName - DBName of the field.
     * @returns {Promise<Array<string>>} List of unique values.
     */
    getSelectList: async (cabinetId, fieldName) => {
        try {
            const dialogs = await docuwareService.getDialogs(cabinetId);
            const searchDialog = dialogs.find(d => d.Type === 'Search') || dialogs[0];

            if (!searchDialog) return [];

            const response = await api.post(
                `/FileCabinets/${cabinetId}/Query/SelectListExpression`,
                {
                    DialogId: searchDialog.Id,
                    FieldName: fieldName,
                    ExcludeExternalData: false
                },
                {
                    params: { dialogId: searchDialog.Id }
                }
            );

            return response.data.Value || [];
        } catch (error) {
            console.error("Failed to get select list:", error);
            return [];
        }
    },

    /**
     * @function getAllDocuments
     * @description Optimized Parallel Fetching for Analytics.
     * Breaking down a large valid dataset into parallel batches to speed up retrieval.
     * 
     * @param {string} cabinetId 
     * @param {function} onProgress - Callback(loaded, total)
     * @returns {Promise<Array>} Complete list of documents.
     */
    getAllDocuments: async (cabinetId, onProgress) => {
        try {
            console.log(`[Service] Starting optimized fetch for cabinet: ${cabinetId}`);

            // Step 1: Get total count first
            const totalCount = await docuwareService.getCabinetCount(cabinetId);
            console.log(`[Service] Total documents to fetch: ${totalCount}`);

            if (totalCount === 0) return [];

            if (onProgress) {
                onProgress(0, totalCount);
            }

            // Configuration for batching
            const CHUNK_SIZE = 2000; // Max items per request
            const BATCH_SIZE = 5; // Parallel requests
            const TIMEOUT_MS = 120000;
            let allItems = [];
            let totalLoaded = 0;
            const starts = [];

            // Step 2: Calculate all start positions
            for (let start = 0; start < totalCount; start += CHUNK_SIZE) {
                starts.push(start);
            }

            console.log(`[Service] Plan: ${starts.length} requests in batches of ${BATCH_SIZE}`);

            // Step 3: Process in batches
            for (let i = 0; i < starts.length; i += BATCH_SIZE) {
                const currentBatchStarts = starts.slice(i, i + BATCH_SIZE);
                console.log(`[Service] Fetching batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(starts.length / BATCH_SIZE)} (Items ${currentBatchStarts[0]} - ${currentBatchStarts[currentBatchStarts.length - 1] + CHUNK_SIZE})...`);

                const batchPromises = currentBatchStarts.map(start =>
                    api.get(`/FileCabinets/${cabinetId}/Documents`, {
                        params: {
                            count: CHUNK_SIZE,
                            calculateTotalCount: false,
                            start: start
                        },
                        timeout: TIMEOUT_MS
                    }).then(response => {
                        const items = response.data.Items || [];
                        totalLoaded += items.length;
                        if (onProgress) onProgress(totalLoaded, totalCount);
                        return items;
                    })
                        .catch(err => {
                            console.error(`[Service] Failed to fetch chunk starting at ${start}`, err);
                            return [];
                        })
                );

                const batchResults = await Promise.all(batchPromises);

                batchResults.forEach(items => {
                    allItems = [...allItems, ...items];
                });
            }

            console.log(`[Service] Fetch complete. Total loaded: ${allItems.length}`);
            return allItems;
        } catch (error) {
            console.error('Error fetching all items for analytics:', error);
            throw error;
        }
    },

    /**
     * @function getDocumentViewUrl
     * @description Generates a direct link to the DocuWare Viewer with SSO support.
     * Uses Login Token for automatic authentication if available.
     * 
     * @param {string} cabinetId 
     * @param {string} documentId 
     * @returns {string} URL to open document in new tab (with SSO if token available).
     */
    getDocumentViewUrl: (cabinetId, documentId) => {
        // Get the base URL and login token from session storage
        const authData = sessionStorage.getItem('docuware_auth');
        let baseUrl = 'https://rcsangola.docuware.cloud'; // Default fallback
        let orgId = 'bcb91903-58eb-49c6-8572-be5e3bb9611e'; // Default org ID
        let loginToken = null;

        if (authData) {
            try {
                const parsed = JSON.parse(authData);
                baseUrl = parsed.url;
                if (parsed.organizationId) {
                    orgId = parsed.organizationId;
                }
                if (parsed.loginToken) {
                    loginToken = parsed.loginToken;
                }
            } catch (e) {
                console.error('Error parsing auth data:', e);
            }
        }

        // Build the Integration URL for viewing the document
        const viewUrl = `${baseUrl}/DocuWare/Platform/WebClient/${orgId}/Integration?fc=${cabinetId}&did=${documentId}&p=V`;

        // If we have a Login Token, use TokenLogOn for SSO
        if (loginToken) {
            const encodedReturnUrl = encodeURIComponent(viewUrl);
            return `${baseUrl}/DocuWare/Platform/Account/TokenLogOn?Token=${encodeURIComponent(loginToken)}&ReturnUrl=${encodedReturnUrl}`;
        }

        // Fallback: return direct URL (user may need to login)
        return viewUrl;
    },

    /**
     * @function downloadDocument
     * @description Downloads the binary content of a document.
     * 
     * @param {string} cabinetId 
     * @param {string} documentId 
     * @returns {Promise<Blob>} The file blob (usually PDF).
     */
    downloadDocument: async (cabinetId, documentId) => {
        const response = await api.get(
            `/FileCabinets/${cabinetId}/Documents/${documentId}/FileDownload`,
            {
                params: {
                    targetFileType: 'pdf', // Convert to PDF on the fly if needed
                    keepAnnotations: true // Preserve stamps and notes
                },
                responseType: 'blob',
                timeout: 120000
            }
        );
        return response.data;
    },

    /**
     * @function uploadReplacement
     * @description Replaces a document's content with a new file.
     * CRITICAL: DocuWare does not support "simple replace". 
     * We must (1) Append new section, (2) Delete old sections.
     * 
     * @param {string} cabinetId 
     * @param {string} documentId 
     * @param {Blob} fileBlob - The compressed/modified file.
     * @returns {Promise<Object>} Updated document metadata.
     */
    uploadReplacement: async (cabinetId, documentId, fileBlob) => {
        console.log(`[uploadReplacement] Starting overwrite for doc ${documentId} in cabinet ${cabinetId}`);

        try {
            // Step 1: Fetch the current document state to identify ALL existing sections
            const docResponse = await api.get(`/FileCabinets/${cabinetId}/Documents/${documentId}`);
            const originalDoc = docResponse.data;
            const originalSections = originalDoc.Sections || [];

            console.log(`[uploadReplacement] Found ${originalSections.length} existing sections to replace.`);

            // Step 2: Append the NEW file as a fresh section
            // We use POST to /Sections to append.
            const appendUrl = `/FileCabinets/${cabinetId}/Sections?docId=${documentId}`;
            console.log(`[uploadReplacement] Appending new file via: ${appendUrl}`);

            await api.post(
                appendUrl,
                fileBlob,
                {
                    headers: {
                        'Content-Type': fileBlob.type || 'application/pdf',
                        'Content-Disposition': `inline; filename="${fileBlob.name || 'reduced_document.pdf'}"`
                    },
                    timeout: 120000
                }
            );
            console.log('[uploadReplacement] New file appended successfully.');

            // Step 3: Delete ALL original sections
            // We must be careful not to delete the new section we just added.
            // Since we captured 'originalSections' BEFORE the append, we are safe to delete exactly those IDs.
            if (originalSections.length > 0) {
                console.log('[uploadReplacement] Deleting old sections...');

                for (const section of originalSections) {
                    const deleteUrl = `/FileCabinets/${cabinetId}/Sections/${section.Id}`;
                    console.log(`[uploadReplacement] Deleting old section: ${section.Id}`);

                    try {
                        await api.delete(deleteUrl);
                    } catch (delErr) {
                        console.error(`[uploadReplacement] Failed to delete section ${section.Id}`, delErr);
                        // Continue even if one fails
                    }
                }
                console.log('[uploadReplacement] All old sections deleted.');
            } else {
                console.log('[uploadReplacement] No old sections found (strange for a replacement, but proceeding).');
            }

            // Step 4: Return final state
            const finalDocResponse = await api.get(`/FileCabinets/${cabinetId}/Documents/${documentId}`);
            return finalDocResponse.data;

        } catch (error) {
            console.error('[uploadReplacement] Critical Error during overwrite:', error);
            throw error;
        }
    },

    /**
     * @function updateDocumentFields
     * @description Updates specific index fields (metadata) for a document.
     * 
     * @param {string} cabinetId 
     * @param {string} documentId 
     * @param {string} fieldName - DBName of the field.
     * @param {string} value - New value to set.
     * @returns {Promise<Object>} Response data.
     */
    updateDocumentFields: async (cabinetId, documentId, fieldName, value) => {
        console.log(`[updateDocumentFields] Updating ${fieldName} = ${value} for doc ${documentId}`);

        // Construct standard DocuWare field structure
        const body = {
            Field: [
                {
                    FieldName: fieldName,
                    Item: value,
                    ItemElementName: 'String' // Assuming string type for now, can be dynamic
                }
            ]
        };

        const response = await api.put(
            `/FileCabinets/${cabinetId}/Documents/${documentId}/Fields`,
            body
        );
        return response.data;
    },
    /**
     * @function getDocumentHistory
     * @description Retrieves the audit trail/history of a specific document.
     * Uses HATEOAS: First fetches the document to verify existence and get the correct 'history' link.
     * 
     * @param {string} cabinetId - The UUID of the File Cabinet.
     * @param {string} docId - The Document ID.
     * @returns {Promise<Array>} List of history entries.
     */
    getDocumentHistory: async (cabinetId, docId) => {
        try {
            console.log(`[DocuWare] Fetching document ${docId} to find history link...`);

            // 1. Fetch Document first to validate ID and get Links
            // Note: We use 'section' param to avoid downloading file content, just metadata
            const docResponse = await api.get(`/FileCabinets/${cabinetId}/Documents/${docId}`);

            if (!docResponse.data) {
                throw new Error("Documento não encontrado.");
            }

            // 2. Find 'history' link relation
            const links = docResponse.data.Links || [];
            console.log('[DocuWare] Available Links:', links.map(l => l.Rel).join(', '));

            let historyLink = links.find(l => l.Rel && l.Rel.toLowerCase() === 'history');
            let requestUrl;

            if (historyLink) {
                requestUrl = historyLink.Href;

                // Handle platform prefix if present in the absolute URL
                if (requestUrl.includes('/DocuWare/Platform')) {
                    const platformIndex = requestUrl.indexOf('/DocuWare/Platform');
                    if (platformIndex !== -1) {
                        requestUrl = requestUrl.substring(platformIndex + '/DocuWare/Platform'.length);
                    }
                }
            } else {
                console.warn(`[DocuWare] 'history' link missing. Trying standard fallback pattern...`);
                // Fallback: Append /History to the document URL. 
                // We use the ID directly from params to ensure we build a valid path.
                const fallbackUrl = `/FileCabinets/${cabinetId}/Documents/${docId}/History`;
                console.log(`[DocuWare] Using fallback URL: ${fallbackUrl}`);
                requestUrl = fallbackUrl;
            }

            console.log(`[DocuWare] Fetching history from: ${requestUrl}`);
            const historyResponse = await api.get(requestUrl);
            return historyResponse.data.History || [];

        } catch (error) {
            console.error(`Error fetching history for doc ${docId}:`, error);
            // Handle 404 gracefully (empty history)
            if (error.response && error.response.status === 404) {
                console.warn("[DocuWare] History endpoint returned 404. Returning empty list.");
                return [];
            }
            if (error.response && error.response.status === 403) {
                throw new Error("Acesso negado ao histórico do documento.");
            }
            throw new Error("Erro ao buscar histórico. Verifique permissões ou conexão.");
        }
    }
};

