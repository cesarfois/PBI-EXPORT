import axios from 'axios';

const generateId = () => Math.random().toString(36).substr(2, 9);

/**
 * Parse WCF/ASP.NET date format: /Date(1763708967955)/
 * @param {string} wcfDate - Date string in WCF format
 * @returns {string} ISO date string
 */
const parseWcfDate = (wcfDate) => {
    if (!wcfDate) return new Date().toISOString();

    // Extract timestamp from /Date(1763708967955)/
    const match = wcfDate.match(/\/Date\((\d+)\)\//);
    if (match) {
        const timestamp = parseInt(match[1], 10);
        return new Date(timestamp).toISOString();
    }

    // If already a valid date string, return as is
    return wcfDate;
};

// Mock Data - Simulating real forms from the environment (Fallback)
let MOCK_FORMS = [
    { id: generateId(), name: 'Formulário de Admissão', status: 'active', creator: 'system', createdAt: '2023-01-15T10:00:00Z', totalSubmissions: 145, link: 'https://forms.docuware.cloud/example1' },
    { id: generateId(), name: 'Solicitação de Férias', status: 'active', creator: 'rh.admin', createdAt: '2023-02-20T14:30:00Z', totalSubmissions: 32, link: 'https://forms.docuware.cloud/example2' },
];

const adminApi = axios.create({
    baseURL: '/DocuWare',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json; charset=UTF-8'
    }
});

export const adminService = {
    /**
     * @function getForms
     * @description Fetches form configuration from DocuWare Settings API.
     * Requires 'docuware.settings' scope.
     */
    getForms: async (page = 1, limit = 10, search = '') => {
        try {
            console.log('📡 Fetching Forms from DocuWare API...');

            const payload = {
                session: null,
                query: {
                    __type: "FormConfigQuery:http://dev.docuware.com/settings/forms",
                    Right: 1
                }
            };

            // Retrieve target origin from session or use default
            const authDataStr = sessionStorage.getItem('docuware_auth');
            const authData = authDataStr ? JSON.parse(authDataStr) : {};
            const targetOrigin = authData.url || 'https://rcsangola.docuware.cloud';

            // Get user token for authentication
            const token = authData.token;

            const response = await adminApi.post('/Settings/SettingsService.svc/jwt/GetFormHeaders', payload, {
                headers: {
                    'x-target-url': targetOrigin,
                    'Authorization': token ? `Bearer ${token}` : undefined
                }
            });

            console.log('✅ Forms API Response:', response.data);

            // The API returns an array directly, not wrapped in Items
            let rawItems = [];
            if (Array.isArray(response.data)) {
                // Response is a direct array
                rawItems = response.data;
            } else if (response.data.Items) {
                // Response has Items property (old structure)
                rawItems = response.data.Items;
            }

            console.log(`📋 Found ${rawItems.length} forms from API`);

            // Map Response
            const mappedItems = rawItems.map(item => ({
                id: item.Guid,
                guid: item.Guid,
                formId: item.ID,
                name: item.Name,
                description: item.Description || '-',
                destination: (() => { const match = item.Destination?.match(/\(([^)]+)\)/); return match ? match[1] : (item.Destination || '-'); })(),
                status: item.Active ? 'active' : 'inactive',
                isPublic: item.Public,
                version: item.Version || '1.0',
                createdAt: parseWcfDate(item.Created),
                lastModified: parseWcfDate(item.LastModified),
                sanitizedName: item.SanitizedName,
                link: (() => {
                    const charMap = { 'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'é': 'e', 'ê': 'e', 'í': 'i', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ú': 'u', 'ü': 'u', 'ç': 'c' };
                    const slug = item.Name.toLowerCase().split('').map(c => charMap[c] || c).join('').replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-').replace(/^-+|-+$/g, '');
                    return `https://rcsangola.docuware.cloud/docuware/formsweb/${slug}`;
                })(),
                totalSubmissions: 0 // Endpoint doesn't provide this yet
            }));

            // Client-side filtering if search is active
            let filtered = mappedItems;
            if (search) {
                const lowerSearch = search.toLowerCase();
                filtered = filtered.filter(f =>
                    f.name.toLowerCase().includes(lowerSearch) ||
                    f.description.toLowerCase().includes(lowerSearch) ||
                    f.destination.toLowerCase().includes(lowerSearch)
                );
            }

            const total = rawItems.length; // Use actual array length

            return {
                items: filtered,
                total,
                page,
                totalPages: Math.ceil(total / limit)
            };

        } catch (error) {
            console.error('❌ Failed to fetch forms (Real API):', error);

            // Fallback to Mock if API fails (for demo purposes if Auth is still fighting us)
            // Uncomment next line to enable fallback
            // return { items: MOCK_FORMS, total: MOCK_FORMS.length, page: 1, totalPages: 1 };

            throw error; // Throw so UI shows error state
        }
    },

    toggleFormStatus: async (id) => {
        console.warn('Toggle API not implemented yet.');
        return true;
    },

    deleteForm: async (id) => {
        console.warn('Delete API not implemented yet.');
        return true;
    }
};
