import serverless from 'serverless-http';
import app from '../../proxy-server.js';

export const handler = serverless(app);
