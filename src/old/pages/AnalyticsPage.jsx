import { useState, useEffect } from 'react';

// import Navbar from '../components/Layout/Navbar';
// import Footer from '../components/Layout/Footer';
import AnalyticsContainer from '../components/Analytics/AnalyticsContainer';
import { docuwareService } from '../services/docuwareService';

import { FaChartPie } from 'react-icons/fa';

const AnalyticsPage = () => {
    const [cabinets, setCabinets] = useState([]);
    const [selectedCabinetId, setSelectedCabinetId] = useState('');
    const [loadingCabinets, setLoadingCabinets] = useState(true);

    // Fetch cabinets on mount
    useEffect(() => {
        const fetchCabinets = async () => {
            try {
                const fetchedCabinets = await docuwareService.getCabinets();
                const sortedCabinets = fetchedCabinets.sort((a, b) => a.Name.localeCompare(b.Name));
                setCabinets(sortedCabinets);
                // Auto-selection removed
            } catch (error) {
                console.error('Error fetching cabinets:', error);
            } finally {
                setLoadingCabinets(false);
            }
        };

        fetchCabinets();
    }, []);

    const handleCabinetChange = (selectedId) => {
        // AnalyticsFilters passes the value directly, whereas standard event might pass e.target.value
        // Checking usage in AnalyticsFilters: onChange={(e) => onCabinetChange(e.target.value)}
        // So we receive the ID string directly here if we change the signature, OR we keep receiving event if we don't change child.
        // Let's verify AnalyticsFilters again.
        // It calls: onChange={(e) => onCabinetChange(e.target.value)}
        // So the argument here is the ID string, NOT the event object.
        // Wait, look at previous code:
        // const handleCabinetChange = (e) => { const newId = e.target.value; ... }
        // BUT AnalyticsContainer passes `onCabinetChange={handleCabinetChange}`
        // And AnalyticsContainer passes it to AnalyticsFilters.
        // AnalyticsFilters calls `onCabinetChange(e.target.value)`.
        // So `AnalyticsContainer` must handle it?
        // Let's check AnalyticsPage again. It passes `handleCabinetChange` to `AnalyticsContainer`.
        // `AnalyticsContainer` props: `onCabinetChange`.
        // `AnalyticsContainer` renders `AnalyticsFilters`: `onCabinetChange={onCabinetChange}`.
        // `AnalyticsFilters`: `onChange={(e) => onCabinetChange(e.target.value)}`.
        // So `AnalyticsFilters` calls it with a STRING.
        // BUT `AnalyticsPage` expects an EVENT `e` because it does `e.target.value`.
        // This means there is currently a BUG or I misread the file `AnalyticsFilters`.
        // Let's re-read AnalyticsFilters carefully.

        // File Content of AnalyticsFilters (lines 34-35):
        // onChange={(e) => onCabinetChange(e.target.value)}

        // This is calling the prop with a STRING.

        // File Content of AnalyticsPage (lines 33-34):
        // const handleCabinetChange = (e) => {
        //    const newId = e.target.value;

        // If AnalyticsFilters calls it with a string, `e.target` will be undefined (if e is string).
        // If `e` is the string ID, `e.target` fails.
        // So currently it might be broken or I missed something.
        // Let's fix this signature to accept the ID directly which is cleaner anyway.

        const newId = selectedId;
        setSelectedCabinetId(newId);
    };

    return (
        <div className="flex flex-col h-full bg-base-200">
            <div className="flex-1 p-4 flex flex-col h-full overflow-hidden">
                <div className="flex items-center gap-3 mb-6">
                    <FaChartPie className="w-6 h-6 text-primary" />
                    <h1 className="text-3xl font-bold">Visual Analytics</h1>
                </div>

                <AnalyticsContainer
                    cabinetId={selectedCabinetId}
                    cabinets={cabinets}
                    onCabinetChange={handleCabinetChange}
                    loadingCabinets={loadingCabinets}
                />
            </div>
        </div>
    );
};

export default AnalyticsPage;
