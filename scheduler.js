import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { tokenManager } from './tokenManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEDULES_FILE = path.join(__dirname, 'schedules.json');
const HISTORY_FILE = path.join(__dirname, 'history.json');
const EXPORTS_DIR = path.join(__dirname, 'exports');

// Ensure exports directory exists
try {
    await fs.mkdir(EXPORTS_DIR, { recursive: true });
} catch (e) {
    console.error('Failed to create exports dir:', e);
}

const initHistory = async () => {
    try {
        await fs.access(HISTORY_FILE);
    } catch {
        await fs.writeFile(HISTORY_FILE, '[]');
    }
};
initHistory();

const tasks = new Map();
const runningTasks = new Map(); // Tracks active executions: scheduleId -> { abort: boolean }

export const scheduler = {
    init: async () => {
        try {
            const data = await fs.readFile(SCHEDULES_FILE, 'utf-8');
            const schedules = JSON.parse(data);
            console.log(`[Scheduler] Loaded ${schedules.length} schedules.`);
            schedules.forEach(schedule => {
                if (schedule.enabled) scheduler.startTask(schedule);
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.writeFile(SCHEDULES_FILE, '[]');
            } else {
                console.error('[Scheduler] Error loading schedules:', error);
            }
        }
    },

    getAll: async () => {
        try {
            const data = await fs.readFile(SCHEDULES_FILE, 'utf-8');
            return JSON.parse(data);
        } catch {
            return [];
        }
    },

    getHistory: async () => {
        try {
            const data = await fs.readFile(HISTORY_FILE, 'utf-8');
            return JSON.parse(data).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 50);
        } catch {
            return [];
        }
    },

    log: async (scheduleId, scheduleName, status, message) => {
        const entry = {
            id: crypto.randomUUID(),
            scheduleId,
            scheduleName,
            status,
            message,
            timestamp: new Date().toISOString()
        };
        try {
            const data = await fs.readFile(HISTORY_FILE, 'utf-8');
            const history = JSON.parse(data);
            history.push(entry);
            if (history.length > 500) history.shift();
            await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
        } catch (err) {
            console.error('[Scheduler] Failed to write log:', err);
        }
    },

    save: async (schedule) => {
        const schedules = await scheduler.getAll();
        const index = schedules.findIndex(s => s.id === schedule.id);
        if (index >= 0) {
            schedules[index] = schedule;
            scheduler.stopTask(schedule.id);
        } else {
            schedules.push(schedule);
        }
        await fs.writeFile(SCHEDULES_FILE, JSON.stringify(schedules, null, 2));
        if (schedule.enabled) scheduler.startTask(schedule);
        return schedule;
    },

    // updateSchedule function removed (not needed)

    delete: async (id) => {
        let schedules = await scheduler.getAll();
        schedules = schedules.filter(s => s.id !== id);
        await fs.writeFile(SCHEDULES_FILE, JSON.stringify(schedules, null, 2));
        scheduler.stopTask(id);
    },

    startTask: (schedule) => {
        if (!cron.validate(schedule.cronExpression)) {
            console.error(`[Scheduler] Invalid cron expression for ${schedule.name}`);
            return;
        }
        console.log(`[Scheduler] Starting task: ${schedule.name} (${schedule.cronExpression})`);

        const task = cron.schedule(schedule.cronExpression, async () => {
            console.log(`[Scheduler] ⏰ Triggering export for: ${schedule.name}`);
            await scheduler.log(schedule.id, schedule.name, 'RUNNING', 'Iniciando exportação...');
            try {
                const result = await executeExport(schedule);
                await scheduler.log(schedule.id, schedule.name, 'SUCCESS', `Sucesso. ${result.docCount} docs com ${result.lineCount} linhas.`);
                console.log(`[Scheduler] ✅ Export completed: ${schedule.name}`);
            } catch (error) {
                await scheduler.log(schedule.id, schedule.name, 'ERROR', `Falha: ${error.message}`);
                console.error(`[Scheduler] ❌ Export failed for ${schedule.name}:`, error.message);
            }
        });
        tasks.set(schedule.id, task);
    },

    stopTask: (id) => {
        if (tasks.has(id)) {
            tasks.get(id).stop();
            tasks.delete(id);
            console.log(`[Scheduler] Stopped task: ${id}`);
        }
        // Also ensure running export is aborted if any
        scheduler.abortExport(id);
    },

    forceRun: async (scheduleId) => {
        const schedules = await scheduler.getAll();
        const schedule = schedules.find(s => s.id === scheduleId);
        if (!schedule) throw new Error('Schedule not found');

        console.log(`[Scheduler] Force running: ${schedule.name}`);
        // Run async without awaiting to not block response
        (async () => {
            console.log(`[Scheduler] ⏰ Manual trigger for: ${schedule.name}`);
            await scheduler.log(schedule.id, schedule.name, 'RUNNING', 'Iniciando exportação manual...');
            try {
                const result = await executeExport(schedule);
                await scheduler.log(schedule.id, schedule.name, 'SUCCESS', `Sucesso. ${result.docCount} docs com ${result.lineCount} linhas.`);
                console.log(`[Scheduler] ✅ Manual Export completed: ${schedule.name}`);
            } catch (error) {
                if (error.message === 'ABORTED') {
                    await scheduler.log(schedule.id, schedule.name, 'ERROR', `Cancelado pelo usuário.`);
                    console.log(`[Scheduler] 🛑 Export aborted: ${schedule.name}`);
                } else {
                    await scheduler.log(schedule.id, schedule.name, 'ERROR', `Falha: ${error.message}`);
                    console.error(`[Scheduler] ❌ Export failed for ${schedule.name}:`, error.message);
                }
            }
        })();
        return { status: 'started' };
    },

    abortExport: (scheduleId) => {
        if (runningTasks.has(scheduleId)) {
            console.log(`[Scheduler] Aborting export for ${scheduleId}`);
            const state = runningTasks.get(scheduleId);
            state.abort = true;
            return true;
        }
        return false;
    },

    getRunningFiles: () => {
        return Array.from(runningTasks.keys());
    }
};

// --- CORE EXPORT LOGIC ---

async function executeExport(schedule) {
    // Register execution start
    const runState = { abort: false };
    runningTasks.set(schedule.id, runState);

    try {
        const { auth, cabinetId, filters, name } = schedule;

        if (!auth || !auth.refreshToken) throw new Error("Missing auth credentials (refresh token)");


        // 1. Get Access Token from Central Manager
        // Note: We ignore schedule.auth for token generation, but use it for URL/Cabinet info if needed.
        // actually we can just pass null, as searchDocuWare fetches fresh token now.
        const token = null; // await tokenManager.getAccessToken();

        // 2. Search Documents
        const documents = await searchDocuWare(token, auth.url, cabinetId, filters);

        if (!documents || documents.length === 0) {
            console.log(`[Scheduler] No documents found for ${name}.`);
            return 0;
        }

        console.log(`[Scheduler] Found ${documents.length} docs. Fetching history for each...`);

        // 3. Fetch History for EACH document and Flatten
        // Replicating logic from ExportDataPage.jsx and workflowAnalyticsService.js
        const allRows = [];
        const dynamicFields = new Set();

        // Process in batches to avoid overwhelming the server
        const BATCH_SIZE = 5;

        for (let i = 0; i < documents.length; i += BATCH_SIZE) {
            if (runState.abort) throw new Error('ABORTED');
            const batch = documents.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (doc) => {
                const docId = doc.Id;
                // Capture Doc Fields
                const docFields = {};
                if (doc.Fields) {
                    doc.Fields.forEach(f => {
                        const val = f.Item || f.Int || f.Decimal || f.Date || f.DateTime || '';
                        docFields[f.FieldName] = val;
                        dynamicFields.add(f.FieldName);
                    });
                }

                try {
                    // Fetch History
                    const history = await getDocumentHistory(token, auth.url, cabinetId, docId);
                    const instances = processHistoryIntoInstances(history);

                    if (instances.length === 0) {
                        return [{
                            'Instance GUID': '',
                            'DOCID': docId,
                            'Instância': 'Sem Histórico',
                            'Versão': '',
                            'Iniciado Em': '',
                            'Atividade': '',
                            'Tipo Atividade': '',
                            'Decisão': '',
                            'Usuário': '',
                            'Data Decisão': '',
                            'Link Documento': getDocumentViewUrl(auth.url, auth.organizationId, cabinetId, docId),
                            ...docFields
                        }];
                    }

                    const docRows = [];
                    instances.sort((a, b) => (b.Version || 0) - (a.Version || 0));

                    instances.forEach(instance => {
                        const steps = instance.HistorySteps || [];
                        if (steps.length === 0) {
                            docRows.push({
                                'Instance GUID': instance.Id,
                                'DOCID': docId,
                                'Instância': instance.Name,
                                'Versão': instance.Version,
                                'Iniciado Em': formatDate(instance.StartDate),
                                'Atividade': '(Sem passos)',
                                'Link Documento': getDocumentViewUrl(auth.url, auth.organizationId, cabinetId, docId),
                                ...docFields
                            });
                        } else {
                            steps.forEach(step => {
                                // Extract User
                                const infoItem = step.Info?.Item || {};
                                let validUser = infoItem.UserName || step.User || step.UserName || '';
                                if (!validUser && infoItem.AssignedUsers && Array.isArray(infoItem.AssignedUsers)) {
                                    validUser = infoItem.AssignedUsers.join(', ');
                                }

                                const validDate = infoItem.DecisionDate || step.StepDate || step.TimeStamp || '';
                                const validDecision = infoItem.DecisionName || step.DecisionLabel || '';

                                docRows.push({
                                    'Instance GUID': instance.Id,
                                    'DOCID': docId,
                                    'Instância': instance.Name,
                                    'Versão': instance.Version,
                                    'Iniciado Em': formatDate(instance.StartDate),
                                    'Atividade': step.ActivityName || step.Name,
                                    'Tipo Atividade': step.ActivityType,
                                    'Decisão': validDecision,
                                    'Usuário': validUser,
                                    'Data Decisão': formatDate(validDate),
                                    'Link Documento': getDocumentViewUrl(auth.url, auth.organizationId, cabinetId, docId),
                                    ...docFields
                                });
                            });
                        }
                    });
                    return docRows;

                } catch (err) {
                    console.error(`[Scheduler] Error fetching history for ${docId}:`, err.message);
                    return [{
                        'DOCID': docId,
                        'Instância': 'ERRO AO BUSCAR HISTÓRICO',
                        ...docFields
                    }];
                }
            });

            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(res => {
                if (res) allRows.push(...res);
            });
        }

        // 4. Generate CSV
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        // --- Naming Logic ---
        // 1. Index
        const schedules = await scheduler.getAll(); // Reload to get fresh list
        const scheduleIndex = schedules.findIndex(s => s.id === schedule.id) + 1; // 1-based index

        // Helper to sanitize strings (handle accents)
        const sanitize = (str) => {
            return str
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9]/g, '_')
                .replace(/_+/g, '_') // collapse multiple underscores
                .toLowerCase();
        };

        // 2. Schedule Name
        const safeScheduleName = sanitize(name);

        // 3. Cabinet Name (Saved in schedule by frontend, or fallback to ID)
        const cabinetName = schedule.cabinetName || schedule.cabinetId || 'unknown_cabinet';
        const safeCabinetName = sanitize(cabinetName);

        // 4. Document Type
        let docType = 'all_docs';
        if (filters && filters.length > 0) {
            // Try to find a type-like filter
            const typeFilter = filters.find(f =>
                f.fieldName && (f.fieldName.toLowerCase().includes('type') ||
                    f.fieldName.toLowerCase().includes('tipo') ||
                    f.fieldName.toLowerCase().includes('cat'))
            );
            if (typeFilter) docType = typeFilter.value;
            else docType = filters[0].value; // Fallback to first filter value
        }
        const safeDocType = sanitize(docType);

        // Construct Folder Name: {Index}_{ScheduleName}_{CabinetName}_{DocumentType}
        const folderName = `${scheduleIndex}_${safeScheduleName}_${safeCabinetName}_${safeDocType}`;
        const scheduleDir = path.join(EXPORTS_DIR, folderName);

        try {
            await fs.mkdir(scheduleDir, { recursive: true });
        } catch (e) {
            console.error('Failed to create schedule dir:', e);
        }

        // Construct Filename: {folderName}_{timestamp}.csv
        const filename = `${folderName}_${timestamp}.csv`;
        const filePath = path.join(scheduleDir, filename);

        // Sort Dynamic Headers
        const sortedDynamic = Array.from(dynamicFields).sort();
        const fixedHeaders = [
            'Instance GUID', 'DOCID', 'Instância', 'Versão', 'Iniciado Em',
            'Atividade', 'Tipo Atividade', 'Decisão', 'Usuário', 'Data Decisão', 'Link Documento'
        ];
        const allHeaders = [...fixedHeaders, ...sortedDynamic];

        const escapeCsv = (val) => {
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (str.includes(';') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const headerRow = allHeaders.map(escapeCsv).join(';');
        const csvRows = allRows.map(row => {
            return allHeaders.map(header => {
                let val = row[header];
                if (val && typeof val === 'string' && val.includes('/Date(')) val = formatDate(val);
                return escapeCsv(val);
            }).join(';');
        });

        const csvContent = '\ufeff' + [headerRow, ...csvRows].join('\n'); // Add BOM
        await fs.writeFile(filePath, csvContent, 'utf-8');

        console.log(`[Scheduler] CSV saved: ${filePath} (${csvRows.length} rows)`);
        return { lineCount: csvRows.length, docCount: documents.length };
    } finally {
        console.log(`[Scheduler] 🧹 Cleanup: Removing task ${schedule.id} from running state.`);
        runningTasks.delete(schedule.id); // Cleanup
        console.log(`[Scheduler] Current running tasks: ${Array.from(runningTasks.keys()).length}`);
    }
}

// --- HELPER FUNCTIONS ---

/**
 * Execute an async operation with smart retry logic for 401 errors.
 * If a 401 occurs, it attempts to refresh the token and retry the operation.
 */
async function executeWithRetry(operationName, operationFn) {
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        try {
            return await operationFn();
        } catch (error) {
            attempt++;

            // Check for 401 Unauthorized
            const isAuthError = error.response && error.response.status === 401;

            if (isAuthError) {
                console.warn(`[Scheduler] ⚠️ 401 Unauthorized during '${operationName}'. Refreshing token (Attempt ${attempt}/${MAX_RETRIES})...`);
                try {
                    // Force a token refresh
                    await tokenManager.refreshAccessToken();
                    console.log(`[Scheduler] 🔄 Token refreshed. Retrying '${operationName}'...`);
                    continue; // Retry loop immediately
                } catch (refreshError) {
                    console.error(`[Scheduler] ❌ Failed to refresh token during retry: ${refreshError.message}`);
                    throw refreshError; // If refresh fails, we can't continue
                }
            }

            // If it's not a 401, or if we ran out of retries
            if (attempt >= MAX_RETRIES) {
                console.error(`[Scheduler] ❌ '${operationName}' failed after ${MAX_RETRIES} attempts.`);
                throw error;
            }

            // Optional: wait a bit before retrying non-auth errors?
            // For now, only retrying auth errors immediately. 
            // If we want to retry 500s, we could add logic here.
            throw error;
        }
    }
}

// Token refresh is now handled by tokenManager
// async function refreshAccessToken(auth) { ... }

async function searchDocuWare(token, baseUrl, cabinetId, filters) {
    return executeWithRetry('Search DocuWare', async () => {
        // We ALWAYS get the latest token from manager before making the call, 
        // ensuring retries use the new token.
        const currentToken = await tokenManager.getAccessToken();

        try {
            const dialogsRes = await axios.get(`${baseUrl}/DocuWare/Platform/FileCabinets/${cabinetId}/Dialogs`, {
                headers: { Authorization: `Bearer ${currentToken}` }
            });
            const searchDialog = dialogsRes.data.Dialog.find(d => d.Type === 'Search') || dialogsRes.data.Dialog[0];
            if (!searchDialog) throw new Error("No search dialog found");

            const conditions = filters.map(filter => ({
                DBName: filter.fieldName,
                Value: Array.isArray(filter.value) ? filter.value : [filter.value]
            }));

            const query = {
                Condition: conditions,
                Operation: 'And'
            };

            const searchRes = await axios.post(
                `${baseUrl}/DocuWare/Platform/FileCabinets/${cabinetId}/Query/DialogExpression?dialogId=${searchDialog.Id}&count=1000`,
                query,
                { headers: { Authorization: `Bearer ${currentToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } }
            );
            return searchRes.data.Items || [];
        } catch (err) {
            if (err.response) {
                // If it's NOT a 401, we log here. 401s are handled by retry wrapper.
                if (err.response.status !== 401) {
                    console.error('[Scheduler] Search Failed:', JSON.stringify(err.response.data));
                }
                throw err; // Propagate to retry wrapper
            }
            throw err;
        }
    });
}

/**
 * REPLACEMENT: Mimic workflowAnalyticsService.getHistoryByDocId
 * Fetches Workflow Instances explicitly, then their steps.
 */
async function getDocumentHistory(token, baseUrl, cabinetId, docId) {
    return executeWithRetry(`Get History ${docId}`, async () => {
        const currentToken = await tokenManager.getAccessToken(); // Retry safe

        try {
            // 1. Fetch Workflow Instances for this Document
            // Endpoint: /DocuWare/Platform/Workflow/Instances/DocumentHistory?fileCabinetId=...&documentId=...
            const historyUrl = `${baseUrl}/DocuWare/Platform/Workflow/Instances/DocumentHistory`;

            const response = await axios.get(historyUrl, {
                headers: { Authorization: `Bearer ${currentToken}` },
                params: {
                    fileCabinetId: cabinetId,
                    documentId: docId
                }
            });

            // The response contains "InstanceHistory" (Array)
            const instances = response.data.InstanceHistory || response.data || [];

            if (!Array.isArray(instances) || instances.length === 0) {
                return [];
            }

            // 2. For each instance, fetch the Detailed History (Steps)
            const instancesWithSteps = await Promise.all(instances.map(async (inst) => {
                try {
                    // Construct Steps URL
                    // If 'Links' has 'self', use it. Otherwise construct.
                    // Usually: .../Workflows/{wid}/Instances/{id}/History

                    let stepsUrl = null;
                    const selfLink = (inst.Links || []).find(l => l.Rel === 'self' || l.rel === 'self');

                    if (selfLink && selfLink.Href) {
                        // Check if full URL or relative
                        if (selfLink.Href.startsWith('http')) {
                            stepsUrl = selfLink.Href;
                        } else {
                            // Careful with double slash or missing base
                            stepsUrl = `${baseUrl}${selfLink.Href.startsWith('/') ? '' : '/'}${selfLink.Href}`;
                        }
                    } else {
                        // Fallback construction
                        stepsUrl = `${baseUrl}/DocuWare/Platform/Workflow/Workflows/${inst.WorkflowId}/Instances/${inst.Id}/History`;
                    }

                    const stepsRes = await axios.get(stepsUrl, {
                        headers: { Authorization: `Bearer ${currentToken}` }
                    });

                    return {
                        ...inst,
                        HistorySteps: stepsRes.data.HistorySteps || stepsRes.data || []
                    };

                } catch (stepErr) {
                    console.warn(`[Scheduler] Failed steps fetch for inst ${inst.Id}: ${stepErr.message}`);
                    return { ...inst, HistorySteps: [] };
                }
            }));

            return instancesWithSteps;

        } catch (err) {
            // If 404, just means no workflow history usually
            if (err.response && err.response.status === 404) return [];
            // If 401, rethrow to trigger retry
            if (err.response && err.response.status === 401) throw err;

            console.error(`[Scheduler] Workflow History Error for ${docId}:`, err.message);
            throw err;
        }
    });
}

// Helper to structure request history (Pass-through since we now return structure from getDocumentHistory)
function processHistoryIntoInstances(historyList) {
    // The previous version tried to group a flat list.
    // The NEW getDocumentHistory returns exactly the structure we want:
    // [ { ...Instance, HistorySteps: [...] }, ... ]

    // So we just mapping fields to ensure capitalization matches what the main loop expects
    return historyList.map(inst => ({
        Id: inst.Id,
        Name: inst.WorkflowName || inst.Name || 'Workflow',
        Version: inst.WorkflowVersion || inst.Version || 1,
        StartDate: inst.StartedAt || inst.TimeStamp,
        HistorySteps: inst.HistorySteps || []
    }));
}

function formatDate(dateString) {
    if (!dateString) return '';
    if (typeof dateString === 'string' && dateString.startsWith('/Date(')) {
        const timestamp = parseInt(dateString.match(/\d+/)[0]);
        return new Date(timestamp).toLocaleString('pt-BR');
    }
    const d = new Date(dateString);
    if (!isNaN(d.getTime())) return d.toLocaleString('pt-BR');
    return '';
}

function getDocumentViewUrl(baseUrl, orgId, cabinetId, docId) {
    // Basic view URL construction
    // We don't have a login token here for SSO easily without re-authenticating as user.
    // So we return the direct link.
    // Use fallback orgId if not saved?
    const validOrgId = orgId || 'bcb91903-58eb-49c6-8572-be5e3bb9611e'; // Default
    return `${baseUrl}/DocuWare/Platform/WebClient/${validOrgId}/Integration?fc=${cabinetId}&did=${docId}&p=V`;
}
