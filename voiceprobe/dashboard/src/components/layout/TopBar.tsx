import { useLocation } from 'react-router-dom'

interface TopBarProps {
    title?: string;
    description?: string;
    action?: {
        label: string;
        icon: string;
        onClick: () => void;
    };
}

export default function TopBar({ title, description, action }: TopBarProps) {
    const location = useLocation()
    
    const getTitle = () => {
        if (title) return title;
        if (location.pathname === '/') return 'Overview'
        const path = location.pathname.substring(1)
        return path.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    }

    return (
        <header style={{
            height: '60px',
            background: 'var(--vp-bg)',
            borderBottom: '0.5px solid var(--vp-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 10,
        }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <h1 style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: 'var(--vp-text)',
                    margin: 0
                }}>
                    {getTitle()}
                </h1>
                {description && (
                    <span style={{
                        fontSize: '12px',
                        color: 'var(--vp-text-muted)',
                    }}>
                        {description}
                    </span>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                    style={{
                        background: 'transparent',
                        color: 'var(--vp-text-muted)',
                        border: '0.5px solid var(--vp-border)',
                        borderRadius: 'var(--vp-radius)',
                        padding: '5px 8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                    }}
                >
                    <i className="ti ti-bell" style={{ fontSize: '13px' }} aria-hidden="true" />
                </button>

                {action && (
                    <button
                        onClick={action.onClick}
                        style={{
                            background: 'var(--vp-accent)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 'var(--vp-radius)',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        {action.icon && (
                            <i className={`ti ${action.icon}`} style={{ fontSize: '13px' }} aria-hidden="true" />
                        )}
                        {action.label}
                    </button>
                )}
            </div>
        </header>
    )
}