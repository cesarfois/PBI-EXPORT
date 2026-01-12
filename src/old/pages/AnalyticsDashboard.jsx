import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';
import { docuwareService } from '../services/docuwareService';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

const AnalyticsDashboard = ({ cabinetId, cabinets = [], onCabinetChange, loadingCabinets = false }) => {
    const [selectedField, setSelectedField] = useState('');
    const [filterValue, setFilterValue] = useState(''); // New state for secondary filter
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
                // Allow DWDOCID specifically, or non-system fields
                if (field.FieldName === 'DWDOCID' || (!field.SystemField && field.DWFieldType !== 'Memo' && field.ItemElementName !== 'Date')) {
                    fields.push({
                        name: field.FieldName,
                        label: field.FieldName === 'DWDOCID' ? 'ID do Documento' : (field.FieldLabel || field.FieldName)
                    });
                }
            });
        }

        // Remove duplicates if any
        const uniqueFields = Array.from(new Set(fields.map(f => f.name)))
            .map(name => fields.find(f => f.name === name))
            .sort((a, b) => a.label.localeCompare(b.label));

        setAvailableFields(uniqueFields);

        // Auto-select ContentType as default, otherwise first field
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
        // Check standard first
        if (doc[fieldName] !== undefined) return doc[fieldName];

        // Check custom fields
        if (doc.Fields && Array.isArray(doc.Fields)) {
            const field = doc.Fields.find(f => f.FieldName === fieldName);
            if (field) {
                return field.Item || field.ItemElementName || 'Unknown';
            }
        }
        return 'Unknown';
    };

    // Get unique values for the current field for the dropdown
    const uniqueValues = useMemo(() => {
        if (!fullData || !selectedField) return [];
        const values = new Set();
        fullData.forEach(doc => {
            const val = getFieldValue(doc, selectedField);
            if (val) values.add(String(val));
        });
        return Array.from(values).sort();
    }, [fullData, selectedField]);

    // Process data for charts
    const { pieChartData, barChartData, timelineData, kpis } = useMemo(() => {
        if (!fullData || fullData.length === 0) return { pieChartData: [], barChartData: [], timelineData: [], kpis: {} };

        // Apply Filter if selected
        const dataToProcess = filterValue
            ? fullData.filter(doc => String(getFieldValue(doc, selectedField)) === filterValue)
            : fullData;

        const counts = {};
        const dateCounts = {};
        let total = 0;

        dataToProcess.forEach(doc => {
            // Group by selected field
            const value = getFieldValue(doc, selectedField);
            const key = value ? String(value) : 'Empty';
            counts[key] = (counts[key] || 0) + 1;
            total++;

            // Group by Date (DWStoreDateTime)
            // Try standard system field or look in fields
            // Group by Date (DWStoreDateTime)
            // Try standard system field or look in fields case-insensitive
            let dateStr = doc.DWStoreDateTime || doc.StoreDateTime;

            // Helper for case-insensitive lookup
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
                    // Handle ASP.NET format
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
                        // Format: YYYY-MM
                        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                        dateCounts[monthKey] = (dateCounts[monthKey] || 0) + 1;
                    }
                } catch (e) {
                    // Ignore invalid dates
                }
            }
        });

        // Pie/Bar Data
        const pieData = Object.keys(counts).map(key => ({
            name: key,
            value: counts[key],
            percent: (counts[key] / total) * 100
        })).sort((a, b) => b.value - a.value);

        // Top 5 for Bar Chart
        const barData = pieData.slice(0, 5);

        // Timeline Data
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

    if (loading) {
        return (
            <div className="card bg-base-100 shadow-xl mb-4">
                <div className="card-body flex flex-col justify-center items-center h-[300px]">
                    <span className="loading loading-spinner loading-lg text-primary mb-4"></span>
                    <p className="text-lg font-bold text-gray-700 mb-2">Loading Analytics...</p>

                    {progress.total > 0 && (
                        <div className="w-full max-w-xs">
                            <progress
                                className="progress progress-primary w-full h-4"
                                value={progress.current}
                                max={progress.total}
                            />
                            <p className="text-center text-sm text-gray-500 mt-2">
                                {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
                                <span className="ml-1">
                                    ({Math.round((progress.current / progress.total) * 100)}%)
                                </span>
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
        return null;
    }

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            // Handle different chart types
            const value = payload[0].value;
            const name = data.name || label;

            return (
                <div className="bg-base-100 p-2 border border-base-300 shadow-xl rounded text-sm z-50">
                    <p className="font-bold mb-1">{name}</p>
                    <p>Count: <span className="font-mono">{value}</span></p>
                    {data.percent && <p>Percent: <span className="font-mono">{data.percent.toFixed(1)}%</span></p>}
                </div>
            );
        }
        return null;
    };

    // Custom Legend to show percentages
    const renderLegend = (props) => {
        const { payload } = props;
        // Sort payload by value descending
        const sortedPayload = [...payload].sort((a, b) => {
            const itemA = pieChartData.find(d => d.name === a.value);
            const itemB = pieChartData.find(d => d.name === b.value);
            const valA = itemA ? itemA.value : 0;
            const valB = itemB ? itemB.value : 0;
            return valB - valA;
        });

        return (
            <ul className="flex flex-col gap-1 max-h-48 overflow-y-auto w-48 text-xs p-2">
                {
                    sortedPayload.map((entry, index) => {
                        const dataItem = pieChartData.find(d => d.name === entry.value);
                        const percent = dataItem ? dataItem.percent.toFixed(1) : 0;
                        return (
                            <li key={`item-${index}`} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="flex-1 truncate" title={entry.value}>{entry.value}</span>
                                <span className="font-bold opacity-70">{percent}%</span>
                            </li>
                        )
                    })
                }
            </ul>
        );
    };

    const handleExportBreakdown = () => {
        if (!pieChartData || pieChartData.length === 0) return;

        // Headers
        const headers = [`Value (${selectedField})`, 'Count', 'Percentage'];

        // Rows
        const csvContent = [
            headers.join(','),
            ...pieChartData.map(row => {
                const value = `"${String(row.name).replace(/"/g, '""')}"`;
                const count = row.value;
                const percent = row.percent.toFixed(2);
                return `${value},${count},${percent}%`;
            })
        ].join('\n');

        // Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `analytics_breakdown_${selectedField}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Control Bar */}
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-end">

                        {/* Cabinet Selector (Left) */}
                        <div className="form-control w-full max-w-xs">
                            <label className="label">
                                <span className="label-text font-bold">Select Cabinet</span>
                            </label>
                            {loadingCabinets ? (
                                <div className="flex items-center gap-2">
                                    <span className="loading loading-spinner loading-xs"></span>
                                    <span className="text-sm text-gray-500">Loading cabinets...</span>
                                </div>
                            ) : (
                                <select
                                    className="select select-bordered w-full"
                                    value={cabinetId}
                                    onChange={onCabinetChange}
                                >
                                    <option value="">Selecione o armário</option>
                                    {cabinets.map((cabinet) => (
                                        <option key={cabinet.Id} value={cabinet.Id}>
                                            {cabinet.Name}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Filters (Right) */}
                        <div className="flex gap-4">
                            <div className="form-control w-full max-w-xs">
                                <label className="label">
                                    <span className="label-text">Group By Field</span>
                                </label>
                                <select
                                    className="select select-bordered select-sm"
                                    value={selectedField}
                                    onChange={(e) => setSelectedField(e.target.value)}
                                    disabled={!cabinetId}
                                >
                                    {availableFields.map(field => (
                                        <option key={field.name} value={field.name}>{field.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-control w-full max-w-xs">
                                <label className="label">
                                    <span className="label-text">Filter Value (Optional)</span>
                                </label>
                                <select
                                    className="select select-bordered select-sm"
                                    value={filterValue}
                                    onChange={(e) => setFilterValue(e.target.value)}
                                    disabled={!selectedField || !cabinetId}
                                >
                                    <option value="">All Values</option>
                                    {uniqueValues.map(val => (
                                        <option key={val} value={val}>{val}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="stats shadow">
                    <div className="stat">
                        <div className="stat-title">Total Documents</div>
                        <div className="stat-value text-primary">{kpis.totalDocs?.toLocaleString()}</div>
                        <div className="stat-desc">in selected cabinet</div>
                    </div>
                </div>

                <div className="stats shadow">
                    <div className="stat">
                        <div className="stat-title">Unique Values</div>
                        <div className="stat-value text-secondary">{kpis.uniqueValues?.toLocaleString()}</div>
                        <div className="stat-desc">for field "{availableFields.find(f => f.name === selectedField)?.label || selectedField}"</div>
                    </div>
                </div>

                <div className="stats shadow">
                    <div className="stat">
                        <div className="stat-title">Top Category</div>
                        <div className="stat-value text-accent text-2xl truncate" title={kpis.topCategory}>{kpis.topCategory}</div>
                        <div className="stat-desc">Most frequent value</div>
                    </div>
                </div>
            </div >

            {/* Charts Row 1: Pie + Top 5 Bar */}
            < div className="grid grid-cols-1 lg:grid-cols-2 gap-6" >
                {/* Pie Chart */}
                < div className="card bg-base-100 shadow-xl" >
                    <div className="card-body">
                        <h3 className="card-title text-sm mb-4">Distribution by {selectedField}</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieChartData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {pieChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Legend layout="vertical" verticalAlign="middle" align="right" content={renderLegend} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div >

                {/* Top 5 Bar Chart */}
                < div className="card bg-base-100 shadow-xl" >
                    <div className="card-body">
                        <h3 className="card-title text-sm mb-4">Top 5 {selectedField}</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    layout="vertical"
                                    data={barChartData}
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" />
                                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Bar dataKey="value" fill="#82ca9d" radius={[0, 4, 4, 0]}>
                                        {barChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div >
            </div >

            {/* Charts Row 2: Timeline */}
            < div className="card bg-base-100 shadow-xl" >
                <div className="card-body">
                    <h3 className="card-title text-sm mb-4">Document Registration Over Time</h3>
                    <div className="flex flex-col gap-6">
                        {/* Chart */}
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={timelineData}
                                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="name"
                                        angle={-45}
                                        textAnchor="end"
                                        height={70}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis />
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="count" stroke="#8884d8" fill="#8884d8" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Monthly Stats Table */}
                        <div className="collapse collapse-arrow bg-base-200">
                            <input type="checkbox" />
                            <div className="collapse-title text-sm font-medium">
                                Show Monthly Statistics Table
                            </div>
                            <div className="collapse-content">
                                <div className="overflow-x-auto max-h-[300px]">
                                    <table className="table table-sm table-pin-rows">
                                        <thead>
                                            <tr>
                                                <th>Month</th>
                                                <th>Documents Added</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...timelineData].reverse().map((row, index) => (
                                                <tr key={index} className="hover">
                                                    <td className="font-mono">{row.name}</td>
                                                    <td className="font-bold text-primary">{row.count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div >

            {/* Detailed Table */}
            < div className="card bg-base-100 shadow-xl" >
                <div className="card-body">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="card-title text-sm">Detailed Breakdown</h3>
                        <button
                            className="btn btn-sm btn-ghost gap-2"
                            onClick={handleExportBreakdown}
                            disabled={!pieChartData || pieChartData.length === 0}
                        >
                            📥 Export CSV
                        </button>
                    </div>
                    <div className="overflow-x-auto max-h-[400px]">
                        <table className="table table-pin-rows">
                            <thead>
                                <tr>
                                    <th>Value ({selectedField})</th>
                                    <th>Count</th>
                                    <th>Percentage</th>
                                    <th>Preview</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pieChartData.map((row, index) => (
                                    <tr key={index} className="hover">
                                        <td className="font-bold">{row.name}</td>
                                        <td>{row.value.toLocaleString()}</td>
                                        <td>{row.percent.toFixed(2)}%</td>
                                        <td>
                                            <progress className="progress progress-primary w-20" value={row.percent} max="100"></progress>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div >
        </div >
    );
};

export default AnalyticsDashboard;
