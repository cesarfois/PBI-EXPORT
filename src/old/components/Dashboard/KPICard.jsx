import PropTypes from 'prop-types';

/**
 * KPI Card Component - Displays a key metric with icon
 */
const KPICard = ({ title, value, subtitle, icon: Icon, colorClass = 'text-primary' }) => {
    return (
        <div className="stats shadow bg-base-100">
            <div className="stat">
                {Icon && (
                    <div className={`stat-figure ${colorClass}`}>
                        <Icon className="w-8 h-8" />
                    </div>
                )}
                <div className="stat-title">{title}</div>
                <div className={`stat-value ${colorClass}`}>
                    {value}
                </div>
                {subtitle && (
                    <div className="stat-desc">{subtitle}</div>
                )}
            </div>
        </div>
    );
};

KPICard.propTypes = {
    title: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    subtitle: PropTypes.string,
    icon: PropTypes.elementType,
    colorClass: PropTypes.string
};

export default KPICard;
