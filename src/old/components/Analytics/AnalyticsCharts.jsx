import React from 'react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

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

const AnalyticsCharts = ({ pieChartData, barChartData, timelineData, selectedField, onExport }) => {

    const renderLegend = (props) => {
        const { payload } = props;
        const sortedPayload = [...payload].sort((a, b) => {
            const itemA = pieChartData.find(d => d.name === a.value);
            const itemB = pieChartData.find(d => d.name === b.value);
            const valA = itemA ? itemA.value : 0;
            const valB = itemB ? itemB.value : 0;
            return valB - valA;
        });

        return (
            <ul className="flex flex-col gap-1 max-h-48 overflow-y-auto w-48 text-xs p-2">
                {sortedPayload.map((entry, index) => {
                    const dataItem = pieChartData.find(d => d.name === entry.value);
                    const percent = dataItem ? dataItem.percent.toFixed(1) : 0;
                    return (
                        <li key={`item-${index}`} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="flex-1 truncate" title={entry.value}>{entry.value}</span>
                            <span className="font-bold opacity-70">{percent}%</span>
                        </li>
                    )
                })}
            </ul>
        );
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Charts Row 1: Pie + Top 5 Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <div className="card bg-base-100 shadow-xl">
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
                </div>

                {/* Top 5 Bar Chart */}
                <div className="card bg-base-100 shadow-xl">
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
                </div>
            </div>

            {/* Charts Row 2: Timeline */}
            <div className="card bg-base-100 shadow-xl">
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
            </div>

            {/* Detailed Table */}
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="card-title text-sm">Detailed Breakdown</h3>
                        <button
                            className="btn btn-sm btn-ghost gap-2"
                            onClick={onExport}
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
            </div>
        </div>
    );
};

export default AnalyticsCharts;
