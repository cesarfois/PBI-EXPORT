import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { createProxyMiddleware } from 'http-proxy-middleware';

// Initialize Express App
const app = express();
const PORT = 3001;

// Discovery route moved to after CORS setup (see below)


/**
 * @file proxy-server.js
 * @description Dynamic Proxy Server for DocuWare Integration.
 * Acts as a middleware to bypass CORS restrictions when consuming the DocuWare REST API
 * from a browser-based client. This server forwards requests to the target URL specified
 * in the 'x-target-url' header.
 * 
 * @author RCSVision Engineer
 * @version 2.0.0
 */

// Initialize Express App (Moved to top)
// const app = express();
// const PORT = 3001;

import dotenv from 'dotenv';
dotenv.config();

import { scheduler } from './scheduler.js';
import { tokenManager } from './tokenManager.js';

// Initialize Services
tokenManager.init();
scheduler.init();


// ----------------------------------------------------------------------------
// 1. Global Middleware Configuration
// ----------------------------------------------------------------------------

/**
 * Configure Cross-Origin Resource Sharing (CORS).
 * Allows the frontend (running on different ports like 5173) to communicate with this proxy.
 * 
 * @type {cors.CorsOptions}
 */
app.use(cors({
    origin: true, // Dynamically reflects the request origin (Postman, localhost:5173, etc.)
    credentials: true, // Allow cookies/auth headers
    allowedHeaders: ['Content-Type', 'Authorization', 'x-target-url'] // Explicitly allow our custom routing header
}));

// app.use(express.json()); // MOVED: Only use for /api to avoid breaking proxy streams
app.use('/api', express.json()); // Enable JSON body parsing ONLY for local API endpoints

/**
 * Pre-flight Request Handler (OPTIONS).
 * Browsers send an OPTIONS request before the actual POST/PUT/GET to check permissions.
 * We intercept this immediately to return 200 OK, preventing CORS blocking.
 */
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// ----------------------------------------------------------------------------
// 2. Discovery Route
// ----------------------------------------------------------------------------

/**
 * Route: /discovery
 * Clean Server-to-Server Discovery Endpoint to bypass DocuWare WAF.
 * Makes a direct request to DocuWare without browser headers.
 */
app.get('/discovery', async (req, res) => {
    const targetUrl = req.query.target;
    if (!targetUrl) {
        return res.status(400).json({ error: 'Missing target query parameter' });
    }

    try {
        console.log(`[Proxy] 🕵️‍♂️ Performing Server-Side Discovery for: ${targetUrl}`);

        // Construct the full URL for IdentityServiceInfo
        // targetUrl e.g. https://rcsangola.docuware.cloud
        const infoUrl = `${targetUrl}/DocuWare/Platform/Home/IdentityServiceInfo`;

        const response = await axios.get(infoUrl, {
            headers: {
                'Accept': 'application/json'
                // No Origin, No Referer, No Cookies -> Clean Request
            }
        });

        console.log(`[Proxy] ✅ Discovery Success!`);
        res.json(response.data);
    } catch (error) {
        console.error(`[Proxy] ❌ Discovery Failed: ${error.message}`);
        res.status(500).json({ error: 'Discovery Failed', details: error.message });
    }
});

// ----------------------------------------------------------------------------
// 3. Proxy Logic Implementation
// ----------------------------------------------------------------------------

/**
 * Configuration for the http-proxy-middleware.
 * Defines how requests are routed, transformed, and logged.
 * 
 * @type {import('http-proxy-middleware').Options}
 */
const proxyOptions = {
    /**
     * @function router
     * @description Dynamic Routing Logic.
     * Instead of a static target, we read the 'x-target-url' header from the incoming request.
     * This allows the frontend to talk to ANY DocuWare organization dynamically.
     * 
     * @param {express.Request} req - Incoming Express request object
     * @returns {string} The target URL to proxy to
     * @throws {Error} If x-target-url is missing
     */
    router: (req) => {
        // Extract target from custom header
        const targetUrl = req.headers['x-target-url'];
        const timestamp = new Date().toISOString();

        // Logging for audit and debugging
        console.log(`[${timestamp}] [Proxy] Incoming request: ${req.method} ${req.url}`);
        // console.log(`[${timestamp}] [Proxy] Headers:`, JSON.stringify(req.headers, null, 2)); // Valid verbose log

        if (!targetUrl) {
            console.error(`[${timestamp}] [Proxy] ❌ Missing X-Target-URL header on ${req.method} ${req.url}`);
            // Critical Error: Without a target, we cannot proxy.
            throw new Error('Missing X-Target-URL header');
        }

        console.log(`[${timestamp}] [Proxy] ✅ Routing to: ${targetUrl}`);
        return targetUrl;
    },

    changeOrigin: true, // Changes the origin of the host header to the target URL
    secure: false, // Don't verify SSL certificates (DocuWare Cloud might need this if using self-signed locally, but usually false for proxying)
    timeout: 300000,
    proxyTimeout: 300000,
    /**
     * @function onProxyReq
     * @description Request Interceptor.
     * Cleans up the request before sending it to the final destination.
     */
    onProxyReq: (proxyReq, req, res) => {
        const target = req.headers['x-target-url'];
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [Proxy] 📤 Forwarding ${req.method} ${req.originalUrl} -> ${target}`);

        if (target) {
            // Rewrite Origin and Referer to match the target to satisfy WCF/CORS checks
            proxyReq.setHeader('Origin', target);
            proxyReq.setHeader('Referer', target + '/');
        }

        // Cleanliness: Remove browser-specific metadata that might trigger WAFs when Origin is rewritten
        proxyReq.removeHeader('x-target-url');
        proxyReq.removeHeader('cookie');
        proxyReq.removeHeader('sec-fetch-dest');
        proxyReq.removeHeader('sec-fetch-mode');
        proxyReq.removeHeader('sec-fetch-site');
        proxyReq.removeHeader('sec-fetch-user');

        // Optional: Remove Sec-Ch-Ua if strict UA filtering is suspected, but usually browser UAs are fine.
    },

    /**
     * @function onProxyRes
     * @description Response Interceptor.
     * Logs the status code received from the upstream server.
     */
    onProxyRes: (proxyRes, req, res) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [Proxy] 📥 Response ${proxyRes.statusCode} for ${req.method} ${req.url}`);
    },

    /**
     * @function onError
     * @description Global Error Handler for the Proxy.
     * Catches network errors (e.g., DNS failure, Connection Refused) and sends a JSON response.
     */
    onError: (err, req, res) => {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] [Proxy] ❌ Error:`, err.message);
        res.status(500).json({ error: 'Proxy Error', details: err.message });
    }
};

// ----------------------------------------------------------------------------
// 3. Route Configurations
// ----------------------------------------------------------------------------

/**
 * Route: /DocuWare/*
 * Main entry point for DocuWare Platform API calls.
 * Uses pathRewrite to ensure the /DocuWare prefix is preserved if needed,
 * though strict routing usually handles this.
 */
app.use('/DocuWare', createProxyMiddleware({
    ...proxyOptions,
    pathRewrite: {
        '^/': '/DocuWare/' // Ensures standard DocuWare behavior since Express strips the mount path
    }
}));

/**
 * Route: /docuware-proxy/*
 * Alternate entry point, often used for Identity Service or special auth flows.
 * Uses the exact same proxy options.
 */
app.use('/docuware-proxy', createProxyMiddleware(proxyOptions));

// ----------------------------------------------------------------------------
// 3.1 Auth API Routes (Centralized Token Management)
// ----------------------------------------------------------------------------

/**
 * Save valid session from Frontend Login
 */
app.post('/api/auth/session', async (req, res) => {
    try {
        const tokens = req.body;
        if (!tokens || !tokens.refreshToken) {
            return res.status(400).json({ error: 'Invalid token data' });
        }
        await tokenManager.setTokens(tokens);
        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Auth Session Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

/**
 * Get valid Access Token (Refresh if needed)
 */
app.get('/api/auth/token', async (req, res) => {
    try {
        // Try getting current, if 401/error, try refresh
        try {
            const token = await tokenManager.getAccessToken();
            // Verify if it's likely expired? 
            // For now, just return it. The frontend interceptor will handle 401 by calling /refresh if we had a separate endpoint.
            // But here "getAccessToken" just returns what we have.
            // Let's add a `?refresh=true` flag to force refresh
            if (req.query.refresh === 'true') {
                const newToken = await tokenManager.refreshAccessToken();
                return res.json({ token: newToken });
            }
            res.json({ token });
        } catch (e) {
            // Check if we need to refresh?
            // If getAccessToken failed, it means no session.
            res.status(401).json({ error: 'No session' });
        }
    } catch (error) {
        console.error('Auth Token Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ----------------------------------------------------------------------------
// 3.2 Scheduler API Routes
// ----------------------------------------------------------------------------

app.get('/api/schedules/logs', async (req, res) => {
    const logs = await scheduler.getHistory();
    res.json(logs);
});

app.get('/api/schedules', async (req, res) => {
    const schedules = await scheduler.getAll();
    res.json(schedules);
});

app.post('/api/schedules', async (req, res) => {
    try {
        const schedule = req.body;
        if (!schedule.id || !schedule.cronExpression) {
            return res.status(400).json({ error: 'Invalid schedule data' });
        }
        const saved = await scheduler.save(schedule);
        res.json(saved);
        console.log(`[API] Saved schedule: ${saved.name}`);
    } catch (error) {
        console.error('Error saving schedule:', error);
        res.status(500).json({ error: 'Failed to save schedule' });
    }
});

app.delete('/api/schedules/:id', async (req, res) => {
    try {
        await scheduler.delete(req.params.id);
        res.sendStatus(204);
        console.log(`[API] Deleted schedule: ${req.params.id}`);
    } catch (error) {
        console.error('Error deleting schedule:', error);
        res.status(500).json({ error: 'Failed to delete schedule' });
    }
});

app.post('/api/schedules/:id/run', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await scheduler.forceRun(id);
        res.json(result);
    } catch (error) {
        console.error('Error running schedule:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/schedules/running', (req, res) => {
    const running = scheduler.getRunningFiles();
    res.json(running);
});

app.post('/api/schedules/:id/stop', async (req, res) => {
    try {
        const { id } = req.params;
        scheduler.abortExport(id);
        res.json({ status: 'aborted' });
    } catch (error) {
        console.error('Error stopping schedule:', error);
        res.status(500).json({ error: error.message });
    }
});

// ----------------------------------------------------------------------------
// 4. Server Start (Conditional)
// ----------------------------------------------------------------------------

// Only start the server if running directly (e.g., node proxy-server.js)
// If imported by Netlify Functions, we just export the app.
import { fileURLToPath } from 'url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`===============================================`);
        console.log(`   Dynamic Proxy Server Running`);
        console.log(`   Port: ${PORT}`);
        console.log(`   Mode: Development / Audit`);
        console.log(`===============================================`);
    });
    server.setTimeout(300000); // 5 minutes timeout to handle slow DocuWare responses
}

// Export app for Serverless usage (Netlify)
export default app;
