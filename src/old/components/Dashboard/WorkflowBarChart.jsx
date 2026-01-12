import PropTypes from 'prop-types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

/**
 * Workflow Load Distribution Bar Chart
 * Shows active instance count per workflow
 */
const WorkflowBarChart = ({ data }) => {
    // Color scale based on load
    const getBarColor = (count) => {
        if (count > 100) return '#ef4444'; // red - high load
        if (count > 50) return '#f59e0b'; // orange - medium load  
        if (count > 20) return '#eab308'; // yellow - low-medium load
        return '#10b981'; // green - low load
    };

    // Sort data by count descending and take top 15
    const sortedData = [...data]
        .filter(item => item.activeInstanceCount > 0)
        .sort((a, b) => b.activeInstanceCount - a.activeInstanceCount)
        .slice(0, 15)
        .map(item => ({
            name: item.name.length > 25 ? item.name.substring(0, 25) + '...' : item.name,
            fullName: item.name,
            count: item.activeInstanceCount
        }));

    if (sortedData.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-base-content/50">
                <p>Nenhum workflow com instâncias ativas</p>
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={400}>
            <BarChart
                data={sortedData}
                margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
            >
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={120}
                    interval={0}
                    tick={{ fontSize: 11 }}
                />
                <YAxis
                    label={{ value: 'Instâncias Ativas', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                    content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                            return (
                                <div className="bg-base-100 p-3 border border-base-300 rounded-lg shadow-lg">
                                    <p className="font-semibold">{payload[0].payload.fullName}</p>
                                    <p className="text-primary">{payload[0].value} instâncias ativas</p>
                                </div>
                            );
                        }
                        return null;
                    }}
                />
                <Legend />
                <Bar
                    dataKey="count"
                    name="Instâncias Ativas"
                    radius={[8, 8, 0, 0]}
                >
                    {sortedData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getBarColor(entry.count)} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
};

WorkflowBarChart.propTypes = {
    data: PropTypes.arrayOf(
        PropTypes.shape({
            name: PropTypes.string.isRequired,
            activeInstanceCount: PropTypes.number.isRequired
        })
    ).isRequired
};

export default WorkflowBarChart;
