import { FaBars, FaSignOutAlt, FaUserCircle } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';

const SessionTimer = () => {
    const [timeLeft, setTimeLeft] = useState(3600); // 1 hour in seconds

    useEffect(() => {
        const calculateTimeLeft = () => {
            const startTime = localStorage.getItem('docuware_session_start');
            if (!startTime) return 0;

            const elapsedSeconds = Math.floor((Date.now() - parseInt(startTime, 10)) / 1000);
            const remaining = 3600 - elapsedSeconds;
            return remaining > 0 ? remaining : 0;
        };

        // Initial set
        setTimeLeft(calculateTimeLeft());

        const interval = setInterval(() => {
            const remaining = calculateTimeLeft();
            setTimeLeft(remaining);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Color warning: Red if < 5 mins, Orange if < 15 mins
    let colorClass = "bg-green-100 text-green-800 border-green-200";
    if (timeLeft < 300) colorClass = "bg-red-100 text-red-800 border-red-200 animate-pulse";
    else if (timeLeft < 900) colorClass = "bg-yellow-100 text-yellow-800 border-yellow-200";

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium font-mono hidden md:flex ${colorClass}`} title="Tempo de Sessão Restante">
            <span>🕒</span>
            <span>{formatTime(timeLeft)}</span>
        </div>
    );
};

const Header = ({ isSidebarCollapsed, toggleSidebar }) => {
    const { user, logout } = useAuth();

    return (
        <header className={`
            fixed top-0 right-0 z-20 bg-white shadow-sm border-b border-gray-100 h-16
            transition-all duration-300 ease-in-out flex items-center justify-between px-6
            ${isSidebarCollapsed ? 'left-20' : 'left-64'}
        `}>
            {/* Left: Title/Brand Only */}
            <div className="flex items-center gap-4 pl-4">
                {/* Brand Logo (Image) */}
                <div className="flex items-center">
                    <img
                        src="/logo-rcs-vision.png"
                        alt="RCS Vision"
                        className="h-12 w-auto object-contain"
                    />
                </div>
            </div>

            {/* Right: User User & Actions */}
            <div className="flex items-center gap-4">
                {/* Session Timer */}
                <SessionTimer />

                <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-gray-50 border border-gray-200">
                    <FaUserCircle className="text-gray-400 text-xl" />
                    <div className="flex flex-col text-right hidden sm:flex">
                        <span className="text-sm font-medium text-gray-700 leading-none">
                            {user?.username || 'Usuário'}
                        </span>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                            {user?.role || 'Admin'}
                        </span>
                    </div>
                </div>

                <button
                    onClick={logout}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Sair do Sistema"
                >
                    <FaSignOutAlt />
                    <span className="hidden sm:inline">Sair</span>
                </button>
            </div>
        </header>
    );
};

export default Header;
