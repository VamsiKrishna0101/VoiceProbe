import TopBar from '../components/layout/TopBar'
import { useNavigate } from 'react-router-dom'

export default function Regression() {
    const navigate = useNavigate()
    
    return (
        <>
            {/* Glowing background orbs for depth */}
            <div className="vp-glow-orb" style={{ top: '-10%', left: '-5%', width: '600px', height: '600px', background: 'var(--vp-accent)' }} />
            <div className="vp-glow-orb" style={{ bottom: '-20%', right: '-10%', width: '800px', height: '800px', background: 'var(--vp-success)' }} />

            <TopBar title="Regression Suites" description="Continuous Integration Testing" />
            <div className="animate-in delay-1" style={{ padding: '40px 24px', maxWidth: '600px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    border: '1px solid rgba(255,255,255,0.05)',
                }}>
                    <i className="ti ti-git-compare" style={{ fontSize: '28px', color: 'var(--vp-text-muted)' }} aria-hidden="true" />
                </div>
                
                <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--vp-text)', marginBottom: '12px', letterSpacing: '-0.02em' }}>
                    Automated Regression Testing
                </div>
                
                <div style={{ fontSize: '14px', color: 'var(--vp-text-muted)', lineHeight: 1.6, marginBottom: '32px' }}>
                    Configure VoiceProbe to run automatically on every pull request or deployment. 
                    Ensure your agent never regresses on core tasks or security policies when you push new system prompts or backend updates.
                </div>

                <div className="vp-glass animate-in delay-2" style={{
                    borderRadius: 'var(--vp-radius-lg)',
                    padding: '24px',
                    textAlign: 'left',
                    marginBottom: '32px',
                }}>
                    <div className="vp-label" style={{ marginBottom: '16px' }}>Upcoming capabilities</div>
                    <ul style={{
                        listStyle: 'none',
                        margin: 0,
                        padding: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                    }}>
                        {[
                            { icon: 'ti-brand-github', title: 'GitHub Actions Integration', desc: 'Block merges if reliability score drops below 80/100' },
                            { icon: 'ti-webhook', title: 'Webhook Triggers', desc: 'Trigger massive test suites automatically via API' },
                            { icon: 'ti-chart-arrows', title: 'Historical Diffing', desc: 'See exactly which conversational turns regressed between v1 and v2' }
                        ].map(feature => (
                            <li key={feature.title} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <i className={`ti ${feature.icon}`} style={{ color: 'var(--vp-accent)', fontSize: '18px', marginTop: '2px' }} aria-hidden="true" />
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--vp-text)', marginBottom: '2px' }}>{feature.title}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--vp-text-muted)' }}>{feature.desc}</div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                <button
                    onClick={() => navigate('/new-test')}
                    className="vp-btn-primary animate-in delay-3"
                    style={{
                        color: '#fff',
                        border: 'none',
                        borderRadius: 'var(--vp-radius)',
                        padding: '10px 24px',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                    }}
                >
                    Run manual test suite
                </button>
            </div>
        </>
    )
}
