import { useState, useEffect } from 'react';
import { docuwareService } from '../services/docuwareService';
import { authService } from '../services/authService';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';
import SearchForm from '../components/Documents/SearchForm';
import axios from 'axios';
import { FaClock, FaList, FaHistory, FaTrash, FaPlay, FaPause, FaPen, FaStop, FaCheckCircle, FaPlus } from 'react-icons/fa';

const ScheduledExportsPage = () => {
    // Schedule Config State
    const [scheduleName, setScheduleName] = useState('');
    const [frequency, setFrequency] = useState('daily'); // daily, weekly, monthly, interval
    const [time, setTime] = useState('10:00');

    // Advanced Schedule State
    const [weekDays, setWeekDays] = useState([]); // Array of strings '1' (Mon) to '0' (Sun) or similar. node-cron: 0-7 (0 & 7 is Sun). Let's use 0-6.
    const [monthDay, setMonthDay] = useState(1);
    const [intervalValue, setIntervalValue] = useState(15);
    const [intervalUnit, setIntervalUnit] = useState('minutes'); // minutes, hours

    // Storage Config State
    const [storageType, setStorageType] = useState('csv'); // csv, sqlserver
    const [sqlConfig, setSqlConfig] = useState({
        server: '',
        database: '',
        user: '',
        password: '',
        table: 'DocuWareExports',
        port: '1433'
    });

    // Captured State from SearchForm
    const [selectedCabinet, setSelectedCabinet] = useState('');
    const [filters, setFilters] = useState([]);
    const [cabinets, setCabinets] = useState([]); // Store cabinets for name lookup

    // Page State
    const [schedules, setSchedules] = useState([]);
    const [logs, setLogs] = useState([]);
    const [runningExports, setRunningExports] = useState(new Set()); // Track running IDs
    const [editingId, setEditingId] = useState(null); // Track if editing
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Search Preview State
    const [previewStats, setPreviewStats] = useState({ totalCabinetDocs: 0, foundDocs: null });
    const [isSearching, setIsSearching] = useState(false);

    const getProxyBaseUrl = () => {
        const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';
        return isDev ? 'http://localhost:3001' : window.location.origin + '/.netlify/functions/api';
    };

    useEffect(() => {
        fetchCabinets();
        fetchSchedules();
        fetchLogs();

        // Refresh logs every 3 seconds for better responsiveness
        const interval = setInterval(() => {
            fetchLogs();
            fetchSchedules();
            fetchRunningExports();
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const fetchRunningExports = async () => {
        try {
            const baseUrl = getProxyBaseUrl();
            const res = await axios.get(`${baseUrl}/api/schedules/running`);
            setRunningExports(new Set(res.data || []));
        } catch (err) {
            console.error(err);
        }
    };

    const fetchCabinets = async () => {
        try {
            const result = await docuwareService.getCabinets();
            setCabinets(result || []);
        } catch (err) {
            console.error("Failed to fetch cabinets", err);
        }
    };

    const fetchSchedules = async () => {
        try {
            const baseUrl = getProxyBaseUrl();
            const res = await axios.get(`${baseUrl}/api/schedules`);
            setSchedules(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchLogs = async () => {
        try {
            const baseUrl = getProxyBaseUrl();
            const res = await axios.get(`${baseUrl}/api/schedules/logs`);
            setLogs(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleToggleEnable = async (schedule, e) => {
        e.stopPropagation();
        try {
            const baseUrl = getProxyBaseUrl();
            const updatedSchedule = { ...schedule, enabled: !schedule.enabled };
            await axios.post(`${baseUrl}/api/schedules`, updatedSchedule);
            fetchSchedules();
        } catch (err) {
            console.error('Failed to toggle enable', err);
        }
    };

    const handleForceRun = async (id) => {
        try {
            setRunningExports(prev => new Set(prev).add(id)); // Optimistic
            const baseUrl = getProxyBaseUrl();
            await axios.post(`${baseUrl}/api/schedules/${id}/run`);
            fetchRunningExports(); // Sync immediately
        } catch (err) {
            alert('Failed to start export');
            setRunningExports(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleStopExport = async (id) => {
        try {
            const baseUrl = getProxyBaseUrl();
            await axios.post(`${baseUrl}/api/schedules/${id}/stop`);
            // Optimistic update
            await axios.post(`${baseUrl}/api/schedules/${id}/stop`);
            fetchRunningExports();
        } catch (err) {
            alert('Failed to stop export');
        }
    };

    const handleEdit = (schedule) => {
        setEditingId(schedule.id);
        setScheduleName(schedule.name);
        setSelectedCabinet(schedule.cabinetId);
        // Restore Config if available
        if (schedule.scheduleConfig) {
            setFrequency(schedule.scheduleConfig.frequency || 'daily');
            setWeekDays(schedule.scheduleConfig.weekDays || []);
            setMonthDay(schedule.scheduleConfig.monthDay || 1);
            setIntervalValue(schedule.scheduleConfig.intervalValue || 15);
            setIntervalValue(schedule.scheduleConfig.intervalValue || 15);
            setIntervalUnit(schedule.scheduleConfig.intervalUnit || 'minutes');
        } else {
            // Legacy Fallback: default to daily
            setFrequency('daily');
        }

        // Restore Storage Config
        if (schedule.storageConfig) {
            setStorageType(schedule.storageConfig.type || 'csv');
            if (schedule.storageConfig.sql) {
                setSqlConfig({ ...sqlConfig, ...schedule.storageConfig.sql });
            }
        } else {
            setStorageType('csv');
            setSqlConfig({ server: '', database: '', user: '', password: '', table: 'DocuWareExports', port: '1433' });
        }

        // Parse time from cron "MM HH * * *" (only relevant for non-interval or hourly interval starting at 0)
        // If it's interval minutes, time might be irrelevant or ignored.
        const parts = schedule.cronExpression.split(' ');
        if (parts.length >= 2 && !parts[0].startsWith('*')) {
            setTime(`${parts[1].padStart(2, '0')}:${parts[0].padStart(2, '0')}`);
        } else {
            setTime('10:00');
        }
        setFilters(schedule.filters || []);
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setWeekDays([]);
        setMonthDay(1);
        setIntervalValue(15);
        setIntervalUnit('minutes');
        setStorageType('csv');
        setSqlConfig({ server: '', database: '', user: '', password: '', table: 'DocuWareExports', port: '1433' });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setScheduleName('');
        setSelectedCabinet('');
        setTime('10:00');
        setFilters([]);
    };

    const handleSaveSchedule = async () => {
        if (!selectedCabinet || !scheduleName || !time) {
            setError('Please fill in all required fields (Name, Cabinet, Time)');
            return;
        }

        try {
            setLoading(true);
            const authData = authService.getCurrentUser();
            if (!authData || !authData.refreshToken) {
                setError('You must be logged in to create a schedule.');
                return;
            }

            // Generate Cron Expression
            const [hour, minute] = time.split(':');
            let cronExpression = '';

            if (frequency === 'daily') {
                cronExpression = `${minute} ${hour} * * *`;
            } else if (frequency === 'weekly') {
                if (weekDays.length === 0) {
                    setError('Please select at least one day of the week.');
                    setLoading(false);
                    return;
                }
                const daysStr = weekDays.join(',');
                cronExpression = `${minute} ${hour} * * ${daysStr}`;
            } else if (frequency === 'monthly') {
                cronExpression = `${minute} ${hour} ${monthDay} * *`;
            } else if (frequency === 'interval') {
                if (intervalValue < 1) {
                    setError('Interval must be at least 1.');
                    setLoading(false);
                    return;
                }
                if (intervalUnit === 'minutes') {
                    cronExpression = `*/${intervalValue} * * * *`;
                } else {
                    // Every X hours at minute 0
                    cronExpression = `0 */${intervalValue} * * *`;
                }
            }

            // Filter out empty filters
            const validFilters = filters.filter(f => f.fieldName && f.value);

            // Find Cabinet Name
            const selectedCabObj = cabinets.find(c => c.Id === selectedCabinet);
            const cabinetName = selectedCabObj ? selectedCabObj.Name : selectedCabinet;

            const schedulePayload = {
                id: editingId || crypto.randomUUID(),
                name: scheduleName,
                cabinetId: selectedCabinet,
                cabinetName: cabinetName, // Save for folder naming
                filters: validFilters,
                cronExpression: cronExpression,
                scheduleConfig: {
                    frequency,
                    weekDays,
                    monthDay,
                    intervalValue,
                    intervalUnit
                },
                storageConfig: {
                    type: storageType,
                    sql: storageType === 'sqlserver' ? sqlConfig : null
                },
                auth: {
                    refreshToken: authData.refreshToken,
                    url: authData.url,
                    tokenEndpoint: authData.tokenEndpoint
                },
                enabled: true,
                createdAt: new Date().toISOString()
            };

            const baseUrl = getProxyBaseUrl();
            await axios.post(`${baseUrl}/api/schedules`, schedulePayload);

            setSuccess(editingId ? 'Schedule updated successfully!' : 'Schedule saved successfully!');
            fetchSchedules();
            handleCancelEdit(); // Reset form
        } catch (err) {
            setError('Failed to save schedule: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSchedule = async (id) => {
        if (!window.confirm('Are you sure you want to delete this schedule?')) return;
        try {
            const baseUrl = getProxyBaseUrl();
            await axios.delete(`${baseUrl}/api/schedules/${id}`);
            fetchSchedules();
            if (editingId === id) handleCancelEdit();
        } catch (err) {
            alert('Failed to delete');
        }
    };

    const getCabinetName = (id) => {
        const cab = cabinets.find(c => c.Id === id);
        return cab ? cab.Name : id;
    };

    const getDocumentTypeDisplay = (scheduleFilters) => {
        if (!scheduleFilters || scheduleFilters.length === 0) return 'Todos';
        // Try to find a field named like "Type" or "Tipo" (e.g. DOCUMENT_TYPE, TIPO_DOCUMENTO)
        const typeFilter = scheduleFilters.find(f =>
            f.fieldName && (f.fieldName.toLowerCase().includes('tipo') ||
                f.fieldName.toLowerCase().includes('type') ||
                f.fieldName.toLowerCase().includes('cat'))
        );
        // If found, return its value. If not, return the first filter's value (User said there's always one)
        return typeFilter ? typeFilter.value : scheduleFilters[0].value;
    };

    const getFrequencyLabel = (sch) => {
        if (sch.scheduleConfig) {
            const { frequency, weekDays, monthDay, intervalValue, intervalUnit } = sch.scheduleConfig;
            if (frequency === 'daily') return `Daily at ${sch.cronExpression.split(' ')[1]}:${sch.cronExpression.split(' ')[0]}`;
            if (frequency === 'weekly') {
                const dayMap = { '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat', '0': 'Sun' };
                const days = (weekDays || []).map(d => dayMap[d]).join(', ');
                return `Weekly on ${days} at ${sch.cronExpression.split(' ')[1]}:${sch.cronExpression.split(' ')[0]}`;
            }
            if (frequency === 'monthly') return `Monthly on day ${monthDay} at ${sch.cronExpression.split(' ')[1]}:${sch.cronExpression.split(' ')[0]}`;
            if (frequency === 'interval') return `Every ${intervalValue} ${intervalUnit}`;
        }
        // Fallback for legacy
        if (sch.cronExpression.startsWith('*/') || sch.cronExpression.startsWith('0 */')) return 'Interval';
        return `Daily at ${sch.cronExpression.split(' ')[1]}:${sch.cronExpression.split(' ')[0]}`;
    };

    return (
        <div className="p-6 max-w-[95%] mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center space-x-4 mb-4">
                <div className="p-4 bg-gradient-to-br from-primary to-primary-focus rounded-2xl shadow-lg text-white">
                    <FaClock className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-base-content bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                        Scheduled Exports
                    </h1>
                    <p className="text-base-content/60 mt-1 font-medium">
                        Automate your data pipeline with recurring exports.
                    </p>
                </div>
            </div>

            {/* Global Search Preview Alert */}
            {previewStats.foundDocs !== null && (
                <div className="alert alert-info shadow-lg mb-4 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FaCheckCircle />
                        <span>Filter Preview: Found <strong>{previewStats.foundDocs}</strong> matching documents in cabinet.</span>
                    </div>
                    <button className="btn btn-xs btn-ghost text-xs" onClick={() => setPreviewStats(prev => ({ ...prev, foundDocs: null }))}>Dismiss</button>
                </div>
            )}

            {error && <ErrorMessage message={error} />}
            {success && <div className="alert alert-success mb-4 text-xs py-2">{success}</div>}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Left Column: Config Form */}
                <div className="xl:col-span-2 space-y-6">

                    {/* 1. Search Criteria (Reused Component) */}
                    <div className={`card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-300 border-l-4 border-primary ${editingId ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                        <div className="card-body p-6">
                            <div className="flex justify-between items-center mb-4 border-b border-base-200 pb-2">
                                <h2 className="card-title text-xl flex items-center gap-3">
                                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-content text-sm font-bold">1</span>
                                    Define Export Data
                                </h2>
                                {editingId && <span className="badge badge-warning gap-1 animate-pulse font-bold uppercase text-xs">Editing Mode</span>}
                            </div>

                            <SearchForm
                                showMainAction={true}
                                initialCabinet={selectedCabinet} // Pass initial values if supported, else SearchForm needs update
                                // NOTE: SearchForm might not support 'initialCabinet' prop yet. We might need to check.
                                // It supports onCabinetChange. Re-viewing SearchForm to ensure we can set values programmatically?
                                // Actually, SearchForm manages its own state usually. We might need to force it or pass props.
                                // For now, let's assume validFilters flows down if we add value props to SearchForm or we rely on user re-selecting.
                                // WAIT: SearchForm is complex. If it doesn't take 'value' props, we can't easily populate it.
                                // Simple fix: Just populate the summary state in parent, but SearchForm visual state might be out of sync.
                                // Checking SearchForm... it likely doesn't verify props.
                                // Let's try passing `selectedCabinet` as a key to force re-render if needed? No, better to add `initialValues` support to SearchForm later if needed.
                                // For now, `selectedCabinet` is state here. `SearchForm` calls `onCabinetChange`.
                                // If I want to PRE-SELECT, SearchForm needs to accept it.

                                onCabinetChange={async (id) => {
                                    setSelectedCabinet(id);
                                    // Fetch cabinet total count for display
                                    if (id) {
                                        try {
                                            const count = await docuwareService.getCabinetCount(id);
                                            setPreviewStats(prev => ({ ...prev, totalCabinetDocs: count, foundDocs: null }));
                                        } catch (e) {
                                            console.error(e);
                                        }
                                    } else {
                                        setPreviewStats(prev => ({ ...prev, totalCabinetDocs: 0, foundDocs: null }));
                                    }
                                }}
                                onFilterChange={(newFilters) => setFilters(newFilters)}
                                onLog={(msg) => console.log(msg)}
                                totalCount={previewStats.totalCabinetDocs}
                                onSearch={async (cabId, filters, _, limit) => {
                                    try {
                                        setIsSearching(true);
                                        // console.log('Preview Search:', cabId, filters);
                                        const res = await docuwareService.searchDocuments(cabId, filters, limit);
                                        setPreviewStats(prev => ({ ...prev, foundDocs: res.items.length }));
                                        setSuccess(`Search Preview: Found ${res.items.length} documents.`);
                                        setTimeout(() => setSuccess(''), 5000);
                                    } catch (err) {
                                        setError('Search Preview Failed: ' + err.message);
                                    } finally {
                                        setIsSearching(false);
                                    }
                                }}
                            />
                            {/* Hint for Edit Mode if SearchForm doesn't auto-fill */}
                            {editingId && (
                                <div className="alert alert-warning text-xs mt-2 py-2">
                                    Note: Please re-select Filters if modifying them. Cabinet: {getCabinetName(selectedCabinet)}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 2. Schedule Config */}
                    <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-300 border-l-4 border-secondary">
                        <div className="card-body p-6">
                            <h2 className="card-title text-xl flex items-center gap-3 mb-6 border-b border-base-200 pb-2">
                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-secondary-content text-sm font-bold">2</span>
                                Schedule Settings
                            </h2>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="form-control">
                                    <label className="label"><span className="label-text font-bold">Schedule Name</span></label>
                                    <input
                                        type="text"
                                        className="input input-bordered w-full"
                                        placeholder="e.g. Sales Reports Daily"
                                        value={scheduleName}
                                        onChange={e => setScheduleName(e.target.value)}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="form-control">
                                        <label className="label"><span className="label-text font-bold">Frequency</span></label>
                                        <select className="select select-bordered w-full" value={frequency} onChange={e => setFrequency(e.target.value)}>
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                            <option value="interval">Interval (Recurring)</option>
                                        </select>
                                    </div>

                                    {/* Time Picker (Hidden for Intervals) */}
                                    {frequency !== 'interval' && (
                                        <div className="form-control">
                                            <label className="label"><span className="label-text font-bold">Run At (Time)</span></label>
                                            <input
                                                type="time"
                                                className="input input-bordered w-full"
                                                value={time}
                                                onChange={e => setTime(e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Dynamic Controls based on Frequency */}
                                <div className="mt-4 p-4 bg-base-200 rounded-lg">
                                    {frequency === 'daily' && (
                                        <div className="text-sm opacity-70">Runs every day at the specified time.</div>
                                    )}

                                    {frequency === 'weekly' && (
                                        <div className="form-control">
                                            <label className="label"><span className="label-text font-bold">Days of Week</span></label>
                                            <div className="flex flex-wrap gap-2">
                                                {[
                                                    { id: '1', label: 'Mon' },
                                                    { id: '2', label: 'Tue' },
                                                    { id: '3', label: 'Wed' },
                                                    { id: '4', label: 'Thu' },
                                                    { id: '5', label: 'Fri' },
                                                    { id: '6', label: 'Sat' },
                                                    { id: '0', label: 'Sun' },
                                                ].map(day => (
                                                    <label key={day.id} className="cursor-pointer label border rounded px-3 py-1 bg-base-100 hover:bg-base-200">
                                                        <input
                                                            type="checkbox"
                                                            className="checkbox checkbox-xs checkbox-primary mr-2"
                                                            checked={weekDays.includes(day.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) setWeekDays([...weekDays, day.id]);
                                                                else setWeekDays(weekDays.filter(d => d !== day.id));
                                                            }}
                                                        />
                                                        <span className="label-text">{day.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {frequency === 'monthly' && (
                                        <div className="form-control w-32">
                                            <label className="label"><span className="label-text font-bold">Day of Month</span></label>
                                            <select className="select select-bordered" value={monthDay} onChange={e => setMonthDay(parseInt(e.target.value))}>
                                                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                    <option key={d} value={d}>{d}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {frequency === 'interval' && (
                                        <div className="flex gap-4 items-end">
                                            <div className="form-control w-24">
                                                <label className="label"><span className="label-text font-bold">Every</span></label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    className="input input-bordered"
                                                    value={intervalValue}
                                                    onChange={e => setIntervalValue(parseInt(e.target.value) || 1)}
                                                />
                                            </div>
                                            <div className="form-control w-32">
                                                <select className="select select-bordered" value={intervalUnit} onChange={e => setIntervalUnit(e.target.value)}>
                                                    <option value="minutes">Minutes</option>
                                                    <option value="hours">Hours</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* 3. Storage Config */}
                    <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-300 border-l-4 border-accent">
                        <div className="card-body p-6">
                            <h2 className="card-title text-xl flex items-center gap-3 mb-6 border-b border-base-200 pb-2">
                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-accent text-accent-content text-sm font-bold">3</span>
                                Storage Destination
                            </h2>

                            <div className="form-control">
                                <label className="label"><span className="label-text font-bold">Destination Type</span></label>
                                <select
                                    className="select select-bordered w-full"
                                    value={storageType}
                                    onChange={e => setStorageType(e.target.value)}
                                >
                                    <option value="csv">Local CSV (Folder)</option>
                                    <option value="sqlserver">SQL Server (Data Warehouse)</option>
                                </select>
                            </div>

                            {storageType === 'sqlserver' && (
                                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="form-control">
                                            <label className="label"><span className="label-text">Server Host / IP</span></label>
                                            <input
                                                type="text"
                                                className="input input-bordered input-sm"
                                                placeholder="e.g. 192.168.1.100"
                                                value={sqlConfig.server}
                                                onChange={e => setSqlConfig({ ...sqlConfig, server: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-control">
                                            <label className="label"><span className="label-text">Port</span></label>
                                            <input
                                                type="text"
                                                className="input input-bordered input-sm"
                                                placeholder="1433"
                                                value={sqlConfig.port}
                                                onChange={e => setSqlConfig({ ...sqlConfig, port: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-control">
                                            <label className="label"><span className="label-text">Database Name</span></label>
                                            <input
                                                type="text"
                                                className="input input-bordered input-sm"
                                                placeholder="DW_DocuWare"
                                                value={sqlConfig.database}
                                                onChange={e => setSqlConfig({ ...sqlConfig, database: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-control">
                                            <label className="label"><span className="label-text">Table Name</span></label>
                                            <input
                                                type="text"
                                                className="input input-bordered input-sm"
                                                placeholder="TargetTable"
                                                value={sqlConfig.table}
                                                onChange={e => setSqlConfig({ ...sqlConfig, table: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-control">
                                            <label className="label"><span className="label-text">Username</span></label>
                                            <input
                                                type="text"
                                                className="input input-bordered input-sm"
                                                placeholder="sa"
                                                value={sqlConfig.user}
                                                onChange={e => setSqlConfig({ ...sqlConfig, user: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-control">
                                            <label className="label"><span className="label-text">Password</span></label>
                                            <input
                                                type="password"
                                                className="input input-bordered input-sm"
                                                placeholder="******"
                                                value={sqlConfig.password}
                                                onChange={e => setSqlConfig({ ...sqlConfig, password: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-2 text-xs text-orange-600">
                                        * Ensure the backend server has network access to this SQL instance.
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 flex gap-2">
                        {/* Save Button */}
                        <div className="sticky bottom-6 z-20 flex justify-end">
                            <button
                                className={`btn btn-primary btn-lg gap-3 shadow-lg hover:scale-[1.02] active:scale-95 transition-transform rounded-xl ${!selectedCabinet || !scheduleName ? 'btn-disabled opacity-50' : ''}`}
                                onClick={handleSaveSchedule}
                            >
                                {editingId ? <><FaCheckCircle size={20} /> Update Schedule</> : <><FaPlus size={20} /> Create Automation</>}
                            </button>
                        </div>
                        {editingId && (
                            <button
                                className="btn btn-ghost"
                                onClick={handleCancelEdit}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Column: Active Schedules & Logs */}
                <div className="xl:col-span-1 space-y-6">
                    {/* Active Schedules */}
                    <div className="card bg-base-100 shadow-md">
                        <div className="card-body p-4">
                            <h2 className="card-title text-sm mb-4 text-gray-500 uppercase font-bold flex items-center gap-2">
                                <FaList /> Active Schedules
                            </h2>
                            <div className="overflow-y-auto max-h-[300px]">
                                {schedules.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400 text-sm">No active schedules</div>
                                ) : (
                                    <div className="space-y-3">
                                        {schedules.map((sch, index) => (
                                            <div key={sch.id} className={`border rounded-lg p-3 hover:shadow-sm transition-shadow ${editingId === sch.id ? 'bg-primary/10 border-primary' : (sch.enabled !== false ? 'bg-base-50' : 'bg-gray-100 opacity-75')}`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="badge badge-sm badge-ghost font-mono">#{index + 1}</span>
                                                        <input
                                                            type="checkbox"
                                                            className="checkbox checkbox-xs checkbox-primary"
                                                            checked={sch.enabled}
                                                            onChange={(e) => handleToggleEnable(sch, e)}
                                                            title="Enable/Disable Schedule"
                                                        />
                                                        <h3 className={`font-bold text-sm ${!sch.enabled && 'opacity-50'}`}>{sch.name}</h3>
                                                        {runningExports.has(sch.id) && <span className="loading loading-spinner loading-xs text-primary"></span>}
                                                    </div>
                                                    <div className="flex gap-1">
                                                        {runningExports.has(sch.id) ? (
                                                            <button className="btn btn-xs btn-error btn-outline" onClick={() => handleStopExport(sch.id)} title="Stop Export"><FaStop /></button>
                                                        ) : (
                                                            <button className="btn btn-xs btn-success btn-outline" onClick={() => handleForceRun(sch.id)} title="Run Now"><FaPlay /></button>
                                                        )}
                                                        <button className="btn btn-xs btn-ghost text-primary" onClick={() => handleEdit(sch)} title="Edit"><FaPen /></button>
                                                        <button className="btn btn-xs btn-error btn-outline" onClick={() => handleDeleteSchedule(sch.id)} title="Delete"><FaTrash /></button>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-gray-500 space-y-1">
                                                    <div className="flex items-center gap-1"><span className="font-semibold">Schedule:</span> {getFrequencyLabel(sch)}</div>
                                                    <div><span className="font-semibold">Cabinet:</span> {getCabinetName(sch.cabinetId)}</div>
                                                    <div><span className="font-semibold">Tipo Documento:</span> {getDocumentTypeDisplay(sch.filters)}</div>
                                                    <div><span className="font-semibold">Storage:</span> {sch.storageConfig?.type === 'sqlserver' ? 'SQL Server' : 'Local CSV'}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Execution Log */}
                    <div className="card bg-base-100 shadow-xl border-l-4 border-neutral">
                        <div className="card-body p-4">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="card-title text-sm text-gray-500 uppercase font-bold flex items-center gap-2">
                                    <FaHistory /> Execution Log
                                </h2>
                                <button className="btn btn-xs btn-ghost" onClick={fetchLogs}>Refresh</button>
                            </div>

                            <div className="overflow-y-auto max-h-[400px] space-y-2">
                                {logs.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400 text-sm">No valid logs found</div>
                                ) : (
                                    logs.map(log => (
                                        <div key={log.id} className={`p-2 rounded border-l-4 text-xs ${log.status === 'SUCCESS' ? 'border-success bg-green-50' : log.status === 'ERROR' ? 'border-error bg-red-50' : 'border-warning bg-yellow-50'}`}>
                                            <div className="flex justify-between font-bold mb-1">
                                                <span>{log.scheduleName}</span>
                                                <span className="opacity-70">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                            </div>
                                            <div className="opacity-90 break-words">{log.message}</div>
                                            <div className="text-[10px] opacity-50 text-right mt-1">
                                                {new Date(log.timestamp).toLocaleDateString()}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-blue-50 text-blue-800 text-xs rounded-lg border border-blue-100 flex items-center gap-2">
                        <FaClock />
                        <span><strong>Note:</strong> The Scheduler requires the Proxy Server window to be running. Exports will be saved to <code>/exports</code> locally.</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScheduledExportsPage;
