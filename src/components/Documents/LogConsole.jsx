import { useEffect, useRef } from 'react';

const LogConsole = ({ logs, className = "" }) => {
    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    return (
        <div className={`bg-black text-green-400 font-mono rounded-lg p-4 h-full overflow-y-auto text-[10px] py-2 leading-tight ${className}`}>
            {logs.map((log, index) => (
                <div key={index} className="whitespace-pre-wrap">
                    <span className="opacity-50 mr-2">&gt;</span>
                    {log}
                </div>
            ))}
            <div ref={endRef} />
        </div>
    );
};

export default LogConsole;
