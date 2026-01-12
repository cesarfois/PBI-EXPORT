import axios from 'axios';

const api = axios.create({
    // Use relative path - Vite proxy will forward /DocuWare/* to the DocuWare server
    baseURL: '/DocuWare/Platform',
    timeout: 30000,
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }
});

// Add request interceptor to include auth token from session storage
api.interceptors.request.use(
    (config) => {
        const authData = sessionStorage.getItem('docuware_auth');
        let targetUrl = null;

        if (authData) {
            try {
                const parsed = JSON.parse(authData);
                if (parsed.token) {
                    config.headers.Authorization = `Bearer ${parsed.token}`;
                }
                if (parsed.url) {
                    targetUrl = parsed.url;
                }
            } catch (error) {
                console.error('Error parsing auth data:', error);
            }
        }

        // Allow overriding target URL via config (useful for login/discovery)
        if (config.headers['x-target-url']) {
            targetUrl = config.headers['x-target-url'];
        }

        // Apply header if we have a target
        if (targetUrl) {
            config.headers['x-target-url'] = targetUrl;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add response interceptor to handle 401 errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            console.error('Authentication failed - token may have expired');
            // Optionally redirect to login
            // window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

export default api;
