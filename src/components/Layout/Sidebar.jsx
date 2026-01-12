import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    FaChevronLeft,
    FaChevronRight,
    FaChevronDown,
    FaHistory,
    FaFileCsv
} from 'react-icons/fa';

const STORAGE_KEY = 'sidebar_expanded_sections';

const Sidebar = ({ isCollapsed, toggleSidebar }) => {
    const location = useLocation();

    // Load expanded state from localStorage
    const [expandedSections, setExpandedSections] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : { pbi: true };
        } catch {
            return { pbi: true };
        }
    });

    // Save to localStorage when state changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedSections));
    }, [expandedSections]);

    const toggleSection = (sectionKey) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionKey]: !prev[sectionKey]
        }));
    };

    // Simplified navigation - only Power BI Export items
    const navGroups = [
        {
            title: 'Power BI Export',
            key: 'pbi',
            items: [
                { path: '/export-data', label: 'Export Data PBI', icon: <FaFileCsv /> },
                { path: '/workflow-history', label: 'Histórico Workflow ID', icon: <FaHistory /> },
            ]
        }
    ];

    return (
        <aside
            className={`
                fixed left-0 top-0 h-full z-30 transition-all duration-300 ease-in-out
                flex flex-col shadow-xl
                ${isCollapsed ? 'w-20' : 'w-[230px]'}
            `}
        >
            {/* Sidebar Header with Responsive Icon */}
            <div className={`
                flex items-center justify-center flex-none
                bg-[#0a1e3f] border-b border-white/10
                transition-all duration-300
                ${isCollapsed ? 'h-16' : 'h-24'}
            `}>
                <img
                    src="/sidebar-icon.png"
                    alt="Menu Icon"
                    className={`
                        transition-all duration-300 object-contain
                        ${isCollapsed ? 'w-8 h-8' : 'w-20 h-20'}
                    `}
                />
            </div>

            {/* Navigation with Collapsible Groups */}
            <nav className="flex-1 px-3 py-4 overflow-y-auto bg-[#0a1e3f] text-white">
                {navGroups.map((group, groupIndex) => {
                    const isExpanded = expandedSections[group.key];

                    return (
                        <div key={group.key} className={groupIndex > 0 ? 'mt-3' : ''}>
                            {/* Group Header - Clickable to expand/collapse */}
                            {!isCollapsed ? (
                                <button
                                    onClick={() => toggleSection(group.key)}
                                    className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors rounded-lg hover:bg-white/5"
                                >
                                    <span>{group.title}</span>
                                    <FaChevronDown
                                        className={`text-[10px] transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
                                    />
                                </button>
                            ) : (
                                // Divider for collapsed state
                                groupIndex > 0 && <div className="mx-3 my-2 border-t border-white/10" />
                            )}

                            {/* Group Items - Animated collapse */}
                            <div
                                className={`
                                    space-y-1 overflow-hidden transition-all duration-200 ease-in-out
                                    ${!isCollapsed && !isExpanded ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'}
                                `}
                            >
                                {group.items.map((item) => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        title={isCollapsed ? item.label : ''}
                                        className={({ isActive }) => `
                                            flex items-center gap-3 px-3 py-2 mx-1 rounded-lg transition-all duration-200 group relative
                                            ${isActive
                                                ? 'bg-white/10 text-white'
                                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                            }
                                        `}
                                    >
                                        {({ isActive }) => (
                                            <>
                                                <span className="text-[20px] transition-colors">
                                                    {item.icon}
                                                </span>

                                                <span className={`text-[14px] font-normal whitespace-nowrap transition-all duration-300 origin-left
                                                    ${isCollapsed ? 'w-0 opacity-0 scale-0' : 'w-auto opacity-100 scale-100'}
                                                `}>
                                                    {item.label}
                                                </span>

                                                {/* Active Indicator Bar */}
                                                <div className={`
                                                    absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-cyan-400 transition-all duration-300
                                                    ${isActive ? 'opacity-100' : 'opacity-0'}
                                                `} />
                                            </>
                                        )}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* Footer / Toggle */}
            <div className="p-4 border-t border-white/10 bg-[#0a1e3f]">
                <button
                    onClick={toggleSidebar}
                    className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                >
                    {isCollapsed ? <FaChevronRight /> : <div className="flex items-center gap-3 px-1"><FaChevronLeft /> <span>Recolher</span></div>}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;

