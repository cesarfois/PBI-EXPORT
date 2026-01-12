import React from 'react';

const AnalyticsKPIs = ({ kpis, selectedFieldName }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stats shadow bg-base-100">
                <div className="stat">
                    <div className="stat-title">Total Documents</div>
                    <div className="stat-value text-primary">{kpis.totalDocs?.toLocaleString()}</div>
                    <div className="stat-desc">in selected cabinet</div>
                </div>
            </div>

            <div className="stats shadow bg-base-100">
                <div className="stat">
                    <div className="stat-title">Unique Values</div>
                    <div className="stat-value text-secondary">{kpis.uniqueValues?.toLocaleString()}</div>
                    <div className="stat-desc">for field "{selectedFieldName}"</div>
                </div>
            </div>

            <div className="stats shadow bg-base-100">
                <div className="stat">
                    <div className="stat-title">Top Category</div>
                    <div className="stat-value text-accent text-2xl truncate" title={kpis.topCategory}>
                        {kpis.topCategory}
                    </div>
                    <div className="stat-desc">Most frequent value</div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsKPIs;
