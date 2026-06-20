import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/layout/TopBar'
import { launchABTest } from '../services/api'

const PERSONAS = [
    { type: 'angry_customer', label: 'Angry Customer' },
    { type: 'confused_user', label: 'Confused User' },
    { type: 'interrupter', label: 'Interrupter' },
    { type: 'edge_case_asker', label: 'Edge Case Asker' },
    { type: 'normal_user', label: 'Normal User' },
]

export default function ABComparison() {
    const navigate = useNavigate()
    const [phoneA, setPhoneA] = useState('')
    const [labelA, setLabelA] = useState('Agent A')
    const [phoneB, setPhoneB] = useState('')
    const [labelB, setLabelB] = useState('Agent B')
    const [context, setContext] = useState('')
    const [runs, setRuns] = useState(1)
    const [selected, setSelected] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    function togglePersona(type: string) {
        setSelected((prev) =>
            prev.includes(type) ? prev.filter((p) => p !== type) : [...prev, type]
        )
    }

    async function handleLaunch() {
        if (!phoneA || !phoneB || !context || selected.length === 0) {
            setError('Fill in both phone numbers, context, and select at least one persona.')
            return
        }
        setError(null)
        setLoading(true)
        try {
            const { run_id } = await launchABTest({
                agent_a: { label: labelA, phone: phoneA },
                agent_b: { label: labelB, phone: phoneB },
                target_context: context,
                runs_per_persona: runs,
                persona_types: selected,
            })
            navigate(`/status/${run_id}`)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    const inputStyle = {
        width: '100%',
        background: 'var(--vp-surface-2)',
        border: '0.5px solid var(--vp-border)',
        borderRadius: 'var(--vp-radius)',
        padding: '10px 12px',
        fontSize: '13px',
        color: 'var(--vp-text)',
        outline: 'none',
    }

    const sectionStyle = {
        background: 'var(--vp-surface)',
        border: '0.5px solid var(--vp-border)',
        borderRadius: 'var(--vp-radius-lg)',
        padding: '20px',
        marginBottom: '16px',
    }

    const sectionLabel = {
        fontSize: '12px',
        color: 'var(--vp-text-muted)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
        marginBottom: '16px',
    }

    return (
        <>
            {/* Glowing background orbs for depth */}
            <div className="vp-glow-orb" style={{ top: '-10%', left: '-5%', width: '600px', height: '600px', background: 'var(--vp-accent)' }} />
            <div className="vp-glow-orb" style={{ bottom: '-20%', right: '-10%', width: '800px', height: '800px', background: 'var(--vp-warning)' }} />

            <TopBar
                title="A/B Compare"
                description="Test two agent versions head to head"
                action={{ label: 'Back', icon: 'ti-arrow-left', onClick: () => navigate('/') }}
            />
            <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    {/* Left Column: Configs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div className="vp-glass animate-in delay-1" style={{ ...sectionStyle, marginBottom: 0 }}>
                            <div className="vp-label" style={sectionLabel}>Agent configuration</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{
                                        fontSize: '11px',
                                        color: 'var(--vp-accent)',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                    }}>
                                        Agent A
                                    </div>
                                    <div>
                                        <div className="vp-label" style={{ marginBottom: '6px' }}>Label</div>
                                        <input style={inputStyle} value={labelA} onChange={(e) => setLabelA(e.target.value)} placeholder="Agent A" />
                                    </div>
                                    <div>
                                        <div className="vp-label" style={{ marginBottom: '6px' }}>Phone number</div>
                                        <input style={inputStyle} value={phoneA} onChange={(e) => setPhoneA(e.target.value)} placeholder="+1 (555) 000-0000" />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{
                                        fontSize: '11px',
                                        color: 'var(--vp-warning)',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                    }}>
                                        Agent B
                                    </div>
                                    <div>
                                        <div className="vp-label" style={{ marginBottom: '6px' }}>Label</div>
                                        <input style={inputStyle} value={labelB} onChange={(e) => setLabelB(e.target.value)} placeholder="Agent B" />
                                    </div>
                                    <div>
                                        <div className="vp-label" style={{ marginBottom: '6px' }}>Phone number</div>
                                        <input style={inputStyle} value={phoneB} onChange={(e) => setPhoneB(e.target.value)} placeholder="+1 (555) 000-0000" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="vp-glass animate-in delay-2" style={{ ...sectionStyle, marginBottom: 0 }}>
                            <div className="vp-label" style={sectionLabel}>Test configuration</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                    <div className="vp-label" style={{ marginBottom: '6px' }}>Agent context</div>
                                    <textarea
                                        style={{
                                            ...inputStyle,
                                            minHeight: '100px',
                                            resize: 'vertical',
                                            lineHeight: 1.5,
                                        }}
                                        value={context}
                                        onChange={(e) => setContext(e.target.value)}
                                        placeholder="e.g. You are a customer support agent for DoorDash. The user is calling about a late order..."
                                    />
                                </div>
                                <div>
                                    <div className="vp-label" style={{ marginBottom: '6px' }}>Runs per persona</div>
                                    <select style={{ ...inputStyle, width: '200px', cursor: 'pointer' }} value={runs} onChange={(e) => setRuns(Number(e.target.value))}>
                                        {[1, 2, 3, 5].map((n) => (
                                            <option key={n} value={n}>{n} {n === 1 ? 'run' : 'runs'}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Personas */}
                    <div className="vp-glass animate-in delay-3" style={{ ...sectionStyle, marginBottom: 0 }}>
                        <div className="vp-label" style={sectionLabel}>Personas</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                            {PERSONAS.map((p) => {
                                const active = selected.includes(p.type)
                                return (
                                    <button
                                        key={p.type}
                                        onClick={() => togglePersona(p.type)}
                                        style={{
                                            background: active ? 'var(--vp-accent-dim)' : 'rgba(255,255,255,0.02)',
                                            border: `0.5px solid ${active ? 'var(--vp-accent)' : 'rgba(255,255,255,0.05)'}`,
                                            borderRadius: 'var(--vp-radius)',
                                            padding: '10px 12px',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            fontSize: '13px',
                                            fontWeight: 500,
                                            color: active ? 'var(--vp-accent)' : 'var(--vp-text)',
                                            transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                                        }}
                                    >
                                        {p.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="animate-in" style={{
                        fontSize: '12px',
                        color: 'var(--vp-danger)',
                        background: 'var(--vp-danger-dim)',
                        border: '0.5px solid var(--vp-danger)',
                        padding: '10px 14px',
                        borderRadius: 'var(--vp-radius)',
                        marginBottom: '16px',
                    }}>
                        {error}
                    </div>
                )}

                <div className="animate-in delay-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '12px', color: 'var(--vp-text-muted)' }}>
                        {selected.length} personas · {selected.length * runs * 2} total calls (both agents)
                    </div>
                    <button
                        onClick={handleLaunch}
                        disabled={loading}
                        className={loading ? '' : 'vp-btn-primary'}
                        style={{
                            background: loading ? 'rgba(255,255,255,0.05)' : undefined,
                            color: loading ? 'var(--vp-text-muted)' : '#fff',
                            border: loading ? '0.5px solid rgba(255,255,255,0.1)' : 'none',
                            borderRadius: 'var(--vp-radius)',
                            padding: '10px 24px',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {loading ? 'Launching...' : 'Launch A/B test'}
                    </button>
                </div>
            </div>
        </>
    )
}