import { useState } from 'react';
// import Navbar from '../components/Layout/Navbar';
// import Footer from '../components/Layout/Footer';
import SearchForm from '../components/Documents/SearchForm';
import ResultsTable from '../components/Documents/ResultsTable';
import LogConsole from '../components/Documents/LogConsole';
import { docuwareService } from '../services/docuwareService';
import { FaSearch } from 'react-icons/fa';

const DashboardPage = () => {
    const [results, setResults] = useState([]);
    const [totalDocs, setTotalDocs] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [logs, setLogs] = useState([]);
    const [cabinetId, setCabinetId] = useState('');
    const [selectedDocuments, setSelectedDocuments] = useState([]);

    const addLog = (message) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
    };

    const handleCabinetSelect = async (selectedCabinetId) => {
        try {
            setCabinetId(selectedCabinetId);
            setResults([]); // Clear previous results
            setTotalDocs(0);

            if (selectedCabinetId) {
                addLog(`Cabinet selected: ${selectedCabinetId}. Fetching total count...`);
                const count = await docuwareService.getCabinetCount(selectedCabinetId);
                setTotalCount(count);
                addLog(`Total documents in cabinet: ${count}`);
            } else {
                setTotalCount(0);
            }
        } catch (error) {
            console.error('Error fetching cabinet count:', error);
            addLog(`❌ Error fetching total count: ${error.message}`);
        }
    };

    const handleSearch = async (selectedCabinetId, filters, fields, resultLimit = 1000) => {
        try {
            // Note: cabinetId state might arguably be set here too, or relying on handleCabinetSelect
            if (selectedCabinetId !== cabinetId) {
                setCabinetId(selectedCabinetId);
            }
            addLog(`Searching cabinet ${selectedCabinetId} with ${filters.length} filter(s) (limit: ${resultLimit === 999999 ? 'All' : resultLimit})...`);

            if (filters.length > 0) {
                filters.forEach(f => {
                    addLog(`  - ${f.fieldName} = "${f.value}"`);
                });
            }

            const response = await docuwareService.searchDocuments(selectedCabinetId, filters, resultLimit);
            setResults(response.items);
            setTotalDocs(response.total);
            setSelectedDocuments([]); // Clear selection on new search
            addLog(`✅ Found ${response.items.length} documents (Total available: ${response.total})`);
        } catch (error) {
            addLog(`❌ Search failed: ${error.message}`);
            console.error('Search error:', error);
        }
    };

    const handleBulkDownload = async () => {
        if (selectedDocuments.length === 0) {
            alert('Please select at least one document to download');
            return;
        }

        try {
            addLog(`Starting bulk download of ${selectedDocuments.length} documents...`);

            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < selectedDocuments.length; i++) {
                const docId = selectedDocuments[i];
                try {
                    addLog(`Downloading ${i + 1}/${selectedDocuments.length}: Document ${docId}...`);
                    const blob = await docuwareService.downloadDocument(cabinetId, docId);
                    zip.file(`document_${docId}.pdf`, blob);
                    successCount++;
                } catch (error) {
                    addLog(`❌ Failed to download document ${docId}: ${error.message}`);
                    failCount++;
                }
            }

            if (successCount > 0) {
                addLog('Creating ZIP file...');
                const zipBlob = await zip.generateAsync({ type: 'blob' });

                // Trigger download
                const url = window.URL.createObjectURL(zipBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `documents_${new Date().toISOString().slice(0, 10)}.zip`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                addLog(`✅ Bulk download complete! ${successCount} succeeded, ${failCount} failed`);
            } else {
                addLog(`❌ All downloads failed`);
            }
        } catch (error) {
            addLog(`❌ Bulk download error: ${error.message}`);
            console.error('Bulk download error:', error);
        }
    };

    return (
        <div className="flex flex-col h-full bg-base-200">
            <div className="flex-1 p-4 flex flex-col h-full overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <FaSearch className="w-6 h-6 text-primary" />
                        <h1 className="text-3xl font-bold">Pesquisa de Documentos</h1>
                    </div>
                    <div className="w-full md:w-1/2 lg:w-2/5 self-end h-14">
                        <LogConsole logs={logs} />
                    </div>
                </div>

                <div className="flex flex-col gap-4 mb-4">
                    <SearchForm
                        onSearch={handleSearch}
                        onLog={addLog}
                        totalCount={totalCount}
                        onCabinetChange={handleCabinetSelect}
                    />
                </div>

                <ResultsTable results={results} totalDocs={totalDocs} cabinetId={cabinetId} />
            </div>
        </div>
    );
};

export default DashboardPage;
