import { useState, useEffect, useMemo } from 'react';
import { docuwareService } from '../../services/docuwareService';
import AnalyticsFilters from './AnalyticsFilters';
import AnalyticsKPIs from './AnalyticsKPIs';
import AnalyticsCharts from './AnalyticsCharts';

const AnalyticsContainer = ({ cabinetId, cabinets = [], onCabinetChange, loadingCabinets = false }) => {
    const [selectedField, setSelectedField] = useState('');
    const [filterValue, setFilterValue] = useState('');
    const [availableFields, setAvailableFields] = useState([]);
    const [fullData, setFullData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    // Fetch data when cabinetId changes
    useEffect(() => {
        const fetchData = async () => {
            if (!cabinetId) {
                setFullData([]);
                setAvailableFields([]);
                setError(null);
                return;
            }

            try {
                setLoading(true);
                setError(null);
                setProgress({ current: 0, total: 0 });

                const data = await docuwareService.getAllDocuments(cabinetId, (current, total) => {
                    setProgress({ current, total });
                });

                setFullData(data);
                if (data.length === 0) {
                    setError("No documents found in this cabinet (0 items).");
                }
            } catch (err) {
                console.error("Failed to load analytics data", err);
                setError(err.message || "Failed to load analytics data.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [cabinetId]);

    // Extract available fields from fullData
    useEffect(() => {
        if (!fullData || fullData.length === 0) {
            setAvailableFields([]);
            return;
        }

        const firstDoc = fullData[0];
        const fields = [];

        // Standard fields
        fields.push({ name: 'ContentType', label: 'Content Type' });

        // Custom fields
        if (firstDoc.Fields && Array.isArray(firstDoc.Fields)) {
            firstDoc.Fields.forEach(field => {
                if (field.FieldName === 'DWDOCID' || (!field.SystemField && field.DWFieldType !== 'Memo' && field.ItemElementName !== 'Date')) {
                    fields.push({
                        name: field.FieldName,
                        label: field.FieldName === 'DWDOCID' ? 'ID do Documento' : (field.FieldLabel || field.FieldName)
                    });
                }
            });
        }

        const uniqueFields = Array.from(new Set(fields.map(f => f.name)))
            .map(name => fields.find(f => f.name === name))
            .sort((a, b) => a.label.localeCompare(b.label));

        setAvailableFields(uniqueFields);

        // Auto-select ContentType as default
        if (!selectedField && uniqueFields.length > 0) {
            const fileTypeField = uniqueFields.find(f => f.name === 'ContentType');
            setSelectedField(fileTypeField ? fileTypeField.name : uniqueFields[0].name);
        }
    }, [fullData, selectedField]);

    // Reset filter when field changes
    useEffect(() => {
        setFilterValue('');
    }, [selectedField]);

    const getFieldValue = (doc, fieldName) => {
        if (doc[fieldName] !== undefined) return doc[fieldName];
        if (doc.Fields && Array.isArray(doc.Fields)) {
            const field = doc.Fields.find(f => f.FieldName === fieldName);
            if (field) {
                return field.Item || field.ItemElementName || 'Unknown';
            }
        }
        return 'Unknown';
    };

    const uniqueValues = useMemo(() => {
        if (!fullData || !selectedField) return [];
        const values = new Set();
        fullData.forEach(doc => {
            const val = getFieldValue(doc, selectedField);
            if (val) values.add(String(val));
        });
        return Array.from(values).sort();
    }, [fullData, selectedField]);

    const { pieChartData, barChartData, timelineData, kpis } = useMemo(() => {
        if (!fullData || fullData.length === 0) return { pieChartData: [], barChartData: [], timelineData: [], kpis: {} };

        const dataToProcess = filterValue
            ? fullData.filter(doc => String(getFieldValue(doc, selectedField)) === filterValue)
            : fullData;

        const counts = {};
        const dateCounts = {};
        let total = 0;

        dataToProcess.forEach(doc => {
            const value = getFieldValue(doc, selectedField);
            const key = value ? String(value) : 'Empty';
            counts[key] = (counts[key] || 0) + 1;
            total++;

            let dateStr = doc.DWStoreDateTime || doc.StoreDateTime;
            if (!dateStr) {
                const findKey = (obj, key) => Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
                const foundKey = findKey(doc, 'DWStoreDateTime');
                if (foundKey) dateStr = doc[foundKey];
            }

            if (!dateStr && doc.Fields) {
                const dateField = doc.Fields.find(f =>
                    (f.DBName && f.DBName.toLowerCase() === 'dwstoredatetime') ||
                    (f.FieldName && f.FieldName.toLowerCase() === 'dwstoredatetime')
                );
                if (dateField) dateStr = dateField.Item;
            }

            if (dateStr) {
                try {
                    let date;
                    if (typeof dateStr === 'string') {
                        const msDateMatch = dateStr.match(/\/Date\((\d+)\)\//);
                        if (msDateMatch) {
                            date = new Date(parseInt(msDateMatch[1], 10));
                        } else {
                            date = new Date(dateStr);
                        }
                    } else {
                        date = new Date(dateStr);
                    }

                    if (!isNaN(date.getTime())) {
                        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                        dateCounts[monthKey] = (dateCounts[monthKey] || 0) + 1;
                    }
                } catch (e) {
                    // Ignore invalid dates
                }
            }
        });

        const pieData = Object.keys(counts).map(key => ({
            name: key,
            value: counts[key],
            percent: (counts[key] / total) * 100
        })).sort((a, b) => b.value - a.value);

        const barData = pieData.slice(0, 5);

        const timeline = Object.keys(dateCounts).sort().map(key => ({
            name: key,
            count: dateCounts[key]
        }));

        const kpiData = {
            totalDocs: total,
            uniqueValues: Object.keys(counts).length,
            topCategory: pieData.length > 0 ? pieData[0].name : 'N/A'
        };

        return { pieChartData: pieData, barChartData: barData, timelineData: timeline, kpis: kpiData };

    }, [fullData, selectedField, filterValue]);

    const handleExportBreakdown = () => {
        if (!pieChartData || pieChartData.length === 0) return;
        const headers = [`Value (${selectedField})`, 'Count', 'Percentage'];
        const csvContent = [
            headers.join(','),
            ...pieChartData.map(row => {
                const value = `"${String(row.name).replace(/"/g, '""')}"`;
                const count = row.value;
                const percent = row.percent.toFixed(2);
                return `${value},${count},${percent}%`;
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `analytics_breakdown_${selectedField}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return (
            <div className="card bg-base-100 shadow-xl mb-4">
                <div className="card-body flex flex-col justify-center items-center h-[300px]">
                    <span className="loading loading-spinner loading-lg text-primary mb-4"></span>
                    <p className="text-lg font-bold text-gray-700 mb-2">Loading Analytics...</p>
                    {progress.total > 0 && (
                        <div className="w-full max-w-xs">
                            <progress className="progress progress-primary w-full h-4" value={progress.current} max={progress.total} />
                            <p className="text-center text-sm text-gray-500 mt-2">
                                {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
                                <span className="ml-1">({Math.round((progress.current / progress.total) * 100)}%)</span>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (!fullData || fullData.length === 0) {
        if (cabinetId) {
            return (
                <div className="card bg-base-100 shadow-xl mb-4">
                    <div className="card-body flex justify-center items-center h-[100px]">
                        <p className="text-gray-500">No analytics data available for this cabinet.</p>
                    </div>
                </div>
            );
        }
        // If no cabinet selected, user will pick one in Filters
    }

    return (
        <div className="flex flex-col gap-6">
            <AnalyticsFilters
                cabinets={cabinets}
                selectedCabinetId={cabinetId}
                onCabinetChange={onCabinetChange}
                availableFields={availableFields}
                selectedField={selectedField}
                onFieldChange={setSelectedField}
                filterValue={filterValue}
                onFilterChange={setFilterValue}
                uniqueValues={uniqueValues}
                loadingCabinets={loadingCabinets}
            />

            {error && <div className="alert alert-error shadow-lg">{error}</div>}

            {cabinetId && fullData.length > 0 && (
                <>
                    <AnalyticsKPIs
                        kpis={kpis}
                        selectedFieldName={availableFields.find(f => f.name === selectedField)?.label || selectedField}
                    />
                    <AnalyticsCharts
                        pieChartData={pieChartData}
                        barChartData={barChartData}
                        timelineData={timelineData}
                        selectedField={selectedField}
                        onExport={handleExportBreakdown}
                    />
                </>
            )}
        </div>
    );
};

export default AnalyticsContainer;
