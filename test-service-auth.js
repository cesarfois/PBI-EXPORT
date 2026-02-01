import { tokenManager } from './tokenManager.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
const envPath = path.resolve(__dirname, '.env');
const result = dotenv.config({ path: envPath });
if (result.error) {
    console.error('Error loading .env:', result.error);
}
console.log('Dotenv parsed:', result.parsed);

console.log('🧪 Testing Service Account Authentication...');

const run = async () => {
    try {
        await tokenManager.init();

        console.log('Checking current env vars...');
        if (!process.env.DOCUWARE_USERNAME) {
            console.warn('⚠️ DOCUWARE_USERNAME not set in .env');
        } else {
            console.log('✅ DOCUWARE_USERNAME found');
        }

        console.log(`[Test] DOCUWARE_ORG_ID: ${process.env.DOCUWARE_ORG_ID}`);

        console.log('Attempting login...');
        const token = await tokenManager.loginWithServiceAccount();
        console.log('✅ Success! Token obtained:', token.substring(0, 10) + '...');

    } catch (error) {
        console.error('❌ Test Failed:', error.message);
        if (error.response) {
            console.error('API Response:', error.response.data);
        }
    }
};

run();
