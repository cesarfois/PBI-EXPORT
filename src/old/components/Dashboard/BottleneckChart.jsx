import PropTypes from 'prop-types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { FaExclamationTriangle, FaClock } from 'react-icons/fa';

/**
 * Bottleneck Analysis Chart
 * Shows top 5 activities with most stuck tasks
 */
const BottleneckChart = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-base-content/50">
                <p>Nenhum gargalo identificado</p>
            </div>
        );
    }

    // Color based on SLA status
    const getBarColor = (item) => {
        if (item.avgWaitHours > 48) return '#ef4444'; // red - critical
        if (item.avgWaitHours > 24) return '#f59e0b'; // orange - warning
        return '#eab308'; // yellow - attention
    };

    const chartData = data.map(item => ({
        ...item,
        displayName: item.activityName.length > 30
            ? item.activityName.substring(0, 30) + '...'
            : item.activityName
    }));

    return (
        <div className="space-y-4">
            {/* Header with legend */}
            <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-error rounded"></div>
                    <span>\u003e 48h (Crítico)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-warning rounded"></div>
                    <span>\u003e 24h (Atenção)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                    <span>\u003c 24h (Normal)</span>
                </div>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={300}>
                <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 150, bottom: 10 }}
                >
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis
                        type="number"
                        label={{ value: 'Tarefas Pendentes', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis
                        type="category"
                        dataKey="displayName"
                        width={140}
                        tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                    <div className="bg-base-100 p-3 border border-base-300 rounded-lg shadow-lg">
                                        <p className="font-semibold mb-2">{data.activityName}</p>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex items-center gap-2">
                                                <FaExclamationTriangle className="text-warning" />
                                                <span>{data.count} tarefas pendentes</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <FaClock className="text-info" />
                                                <span>Espera média: {Math.round(data.avgWaitHours)}h</span>
                                            </div>
                                            <p className="text-xs opacity-70 mt-1">{data.workflows.join(', ')}</p>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar
                        dataKey="count"
                        radius={[0, 8, 8, 0]}
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getBarColor(entry)} />
                        ))}
                        <LabelList
                            dataKey="count"
                            position="right"
                            style={{ fontSize: '12px', fontWeight: 'bold' }}
                        />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

BottleneckChart.propTypes = {
    data: PropTypes.arrayOf(
        PropTypes.shape({
            activityName: PropTypes.string.isRequired,
            count: PropTypes.number.isRequired,
            avgWaitHours: PropTypes.number.isRequired,
            workflows: PropTypes.arrayOf(PropTypes.string)
        })
    )
};

export default BottleneckChart;
