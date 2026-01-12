import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';

const CallbackPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { reloadUser } = useAuth(); // Get reloadUser
    const [status, setStatus] = useState('Processando login...');
    const [error, setError] = useState(null);
    const processedRef = useRef(false); // Ref to prevent double execution in StrictMode

    useEffect(() => {
        const processCallback = async () => {
            if (processedRef.current) {
                console.log('⚠️ Callback already processed. Skipping.');
                return;
            }

            console.log('🔵 Processing Callback...');
            const code = searchParams.get('code');

            if (!code) {
                console.error('❌ No code found in URL params');
                setError('Nenhum código de autorização encontrado na URL.');
                return;
            }

            processedRef.current = true; // Mark as processed immediately to prevent double-fire

            try {
                setStatus('Trocando código por token...');
                console.log('🔄 Exchanging code for token...');
                const authData = await authService.exchangeCodeForToken(code);
                console.log('✅ Token exchanged successfully:', authData);

                // CRITICAL: Update AuthContext state before navigating
                console.log('🔄 Reloading user context...');
                reloadUser();

                // VERIFICATION STEP
                const verifyUser = sessionStorage.getItem('docuware_auth');
                if (!verifyUser) {
                    throw new Error('CRITICAL: Session storage failed to persist token!');
                }
                console.log('💾 Storage Verification: OK', JSON.parse(verifyUser));

                setStatus('Login realizado com sucesso! Redirecionando...');
                console.log('🚀 Redirecting to dashboard...');

                // FORCE RESYNC: Use hard redirect instead of SPA navigation
                // FORCE RESYNC: Use hard redirect instead of SPA navigation
                // This forces the App to re-mount and AuthContext to read fresh from sessionStorage
                setTimeout(() => {
                    window.location.href = '/export-data';
                }, 500);

            } catch (err) {
                console.error('❌ Callback Error:', err);
                setError(err.message || 'Falha ao processar login.');
                processedRef.current = false; // Allow retry on error if needed? Maybe better to force user to retry login manually.
            }
        };

        processCallback();
    }, [searchParams, navigate, reloadUser]);

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f4f7f9',
            fontFamily: 'Inter, sans-serif'
        }}>
            <div style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                textAlign: 'center',
                maxWidth: '400px'
            }}>
                <h2 style={{ color: '#333', marginBottom: '1rem' }}>Autenticação DocuWare</h2>

                {error ? (
                    <div style={{ color: '#dc3545', marginBottom: '1rem' }}>
                        <p>❌ {error}</p>
                        <button
                            onClick={() => navigate('/')}
                            style={{
                                marginTop: '1rem',
                                padding: '0.5rem 1rem',
                                background: '#002a42',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Voltar ao Login
                        </button>
                    </div>
                ) : (
                    <div>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            border: '4px solid #f3f3f3',
                            borderTop: '4px solid #3498db',
                            borderRadius: '50%',
                            margin: '0 auto 1rem',
                            animation: 'spin 1s linear infinite'
                        }}></div>
                        <p style={{ color: '#666' }}>{status}</p>
                        <style>{`
                            @keyframes spin {
                                0% { transform: rotate(0deg); }
                                100% { transform: rotate(360deg); }
                            }
                        `}</style>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CallbackPage;
