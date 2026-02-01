import { tokenManager } from './tokenManager.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
dotenv.config();

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
