import { useLocation, useNavigate } from 'react-router-dom'
import logo from '../../assets/voiceprobe_logo.png'

const navItems = [
    {
        section: 'Testing',
        items: [
            { label: 'Overview', icon: 'ti-layout-dashboard', path: '/' },
            { label: 'New Test', icon: 'ti-player-play', path: '/new-test' },
            { label: 'A/B Compare', icon: 'ti-test-pipe', path: '/ab-compare' },
            { label: 'Security', icon: 'ti-shield-lock', path: '/security' },
        ],
    },
    {
        section: 'Reports',
        items: [
            { label: 'All Reports', icon: 'ti-file-analytics', path: '/all-reports' },
            { label: 'Regression', icon: 'ti-git-compare', path: '/regression' },
        ],
    },
]

export default function Sidebar() {
    const location = useLocation()
    const navigate = useNavigate()

    return (
        <aside style={{
            width: '200px',
            background: 'var(--vp-surface)',
            borderRight: '0.5px solid var(--vp-border)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
        }}>
            <div style={{
                padding: '20px 16px 16px',
                borderBottom: '0.5px solid var(--vp-border)',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '18px',
                    fontWeight: 700,
                    color: 'var(--vp-text)',
                    letterSpacing: '-0.5px',
                    marginBottom: '6px',
                }}>
                    <img src={logo} alt="VoiceProbe" style={{ height: '36px', width: 'auto', dropShadow: '0 0 10px rgba(0,0,0,0.5)' }} />
                    <div>Voice<span style={{ color: 'var(--vp-accent)' }}>Probe</span></div>
                </div>
                <div style={{
                    fontSize: '11px',
                    color: 'var(--vp-text-muted)',
                    marginTop: '3px',
                }}>
                    v1.0.0 · open source
                </div>
            </div>

            <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
                {navItems.map((group) => (
                    <div key={group.section} style={{ marginBottom: '20px' }}>
                        <div style={{
                            fontSize: '10px',
                            color: 'var(--vp-text-subtle)',
                            letterSpacing: '0.8px',
                            textTransform: 'uppercase',
                            padding: '0 8px',
                            marginBottom: '4px',
                        }}>
                            {group.section}
                        </div>
                        {group.items.map((item) => {
                            const active = location.pathname === item.path
                            return (
                                <button
                                    key={item.path}
                                    onClick={() => navigate(item.path)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        width: '100%',
                                        padding: '7px 8px',
                                        borderRadius: 'var(--vp-radius)',
                                        border: 'none',
                                        background: active ? 'var(--vp-accent-dim)' : 'transparent',
                                        color: active ? 'var(--vp-accent)' : 'var(--vp-text-muted)',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        marginBottom: '1px',
                                        transition: 'background 0.1s, color 0.1s',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!active) {
                                            e.currentTarget.style.background = 'var(--vp-surface-2)'
                                            e.currentTarget.style.color = 'var(--vp-text)'
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!active) {
                                            e.currentTarget.style.background = 'transparent'
                                            e.currentTarget.style.color = 'var(--vp-text-muted)'
                                        }
                                    }}
                                >
                                    <i className={`ti ${item.icon}`} style={{ fontSize: '15px' }} aria-hidden="true" />
                                    {item.label}
                                </button>
                            )
                        })}
                    </div>
                ))}
            </nav>

            <div style={{
                padding: '8px',
                borderTop: '0.5px solid var(--vp-border)',
            }}>
                <button
                    onClick={() => navigate('/settings')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '7px 8px',
                        borderRadius: 'var(--vp-radius)',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--vp-text-muted)',
                        fontSize: '13px',
                        cursor: 'pointer',
                    }}
                >
                    <i className="ti ti-settings" style={{ fontSize: '15px' }} aria-hidden="true" />
                    Settings
                </button>
            </div>
        </aside>
    )
}