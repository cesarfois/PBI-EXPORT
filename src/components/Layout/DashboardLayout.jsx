import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const DashboardLayout = ({ children }) => {
    // Default open on large screens
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);

    return (
        <div className="min-h-screen bg-gray-100 flex">
            {/* Sidebar */}
            <Sidebar
                isCollapsed={isSidebarCollapsed}
                toggleSidebar={toggleSidebar}
            />

            {/* Main Content Wrapper */}
            <div className={`
                flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out
                ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}
            `}>
                {/* Header */}
                <Header
                    isSidebarCollapsed={isSidebarCollapsed}
                    toggleSidebar={toggleSidebar}
                />

                {/* Content Area */}
                <main className="flex-1 p-6 mt-16 overflow-x-hidden">
                    <div className="max-w-[1920px] mx-auto animate-fade-in">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
