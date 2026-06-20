import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/layout/TopBar'
import { launchTest } from '../services/api'

const BEHAVIORAL_PERSONAS = [
    { type: 'angry_customer', label: 'Angry Customer', desc: 'Demands refund, escalates quickly' },
    { type: 'confused_user', label: 'Confused User', desc: 'Misunderstands instructions repeatedly' },
    { type: 'interrupter', label: 'Interrupter', desc: 'Cuts off agent mid-sentence' },
    { type: 'edge_case_asker', label: 'Edge Case Asker', desc: 'Asks unusual out-of-scope questions' },
    { type: 'normal_user', label: 'Normal User', desc: 'Standard cooperative customer' },
]

const ACCENT_PERSONAS = [
    { type: 'indian_english', label: 'Indian English', desc: 'Indian English accent patterns' },
    { type: 'british_english', label: 'British English', desc: 'British English patterns' },
    { type: 'southern_us', label: 'Southern US', desc: 'Southern American patterns' },
    { type: 'non_native', label: 'Non-Native', desc: 'Limited vocabulary, heavy accent' },
]

const SECURITY_PERSONAS = [
    { type: 'prompt_injector', label: 'Prompt Injector', desc: 'Use your own instruction override attempt' },
    { type: 'social_engineer', label: 'Social Engineer', desc: 'Use your own extraction or phishing attempt' },
    { type: 'policy_bypasser', label: 'Policy Bypasser', desc: 'Use your own policy bypass attempt' },
]

const NOISE_OPTIONS = [
    { value: 'none', label: 'None', desc: 'Clean audio' },
    { value: 'cafe', label: 'Café', desc: 'Background chatter' },
    { value: 'street', label: 'Street', desc: 'Traffic, wind' },
    { value: 'car', label: 'Car', desc: 'Engine, road noise' },
    { value: 'static', label: 'Static', desc: 'Bad connection' },
]

export default function NewTest() {
    const navigate = useNavigate()
    const [phone, setPhone] = useState('')
    const [context, setContext] = useState('')
    const [runs, setRuns] = useState(1)
    const [noise, setNoise] = useState('none')
    const [selected, setSelected] = useState<string[]>([])
    const [attackPrompts, setAttackPrompts] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    function togglePersona(type: string) {
        setSelected((prev) =>
            prev.includes(type) ? prev.filter((p) => p !== type) : [...prev, type]
        )
    }

    async function handleLaunch() {
        if (!phone || !context || selected.length === 0) {
            setError('Fill in phone number, context, and select at least one persona.')
            return
        }
        const selectedSecurity = selected.filter((type) => SECURITY_PERSONAS.some((p) => p.type === type))
        const missingAttacks = selectedSecurity.filter((type) => !attackPrompts[type]?.trim())
        if (missingAttacks.length > 0) {
            setError('Write the custom attack instruction for every selected security persona.')
            return
        }
        setError(null)
        setLoading(true)
        try {
            const { run_id } = await launchTest({
                target_phone_number: phone,
                target_context: context,
                noise_profile: noise,
                runs_per_persona: runs,
                personas: selected.map((type) => ({
                    type,
                    attack_prompt: attackPrompts[type]?.trim(),
                })),
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
            <div className="vp-glow-orb" style={{ bottom: '-20%', right: '-10%', width: '800px', height: '800px', background: 'var(--vp-success)' }} />

            <TopBar
                title="New Test"
                description="Configure and launch a test run"
                action={{ label: 'Back', icon: 'ti-arrow-left', onClick: () => navigate('/') }}
            />
            <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    {/* Left Column: Target Config */}
                    <div className="vp-glass animate-in delay-1" style={sectionStyle}>
                        <div className="vp-label" style={sectionLabel}>Target configuration</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <div className="vp-label" style={{ marginBottom: '6px' }}>
                                    Phone number
                                </div>
                                <input
                                    style={inputStyle}
                                    placeholder="+1 (555) 000-0000"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                />
                            </div>
                            <div>
                                <div className="vp-label" style={{ marginBottom: '6px' }}>
                                    Agent context
                                </div>
                                <textarea
                                    style={{
                                        ...inputStyle,
                                        minHeight: '100px',
                                        resize: 'vertical',
                                        lineHeight: 1.5,
                                    }}
                                    placeholder="e.g. You are a customer support agent for DoorDash. The user is calling about a late order..."
                                    value={context}
                                    onChange={(e) => setContext(e.target.value)}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <div className="vp-label" style={{ marginBottom: '6px' }}>
                                        Runs per persona
                                    </div>
                                    <select
                                        style={{ ...inputStyle, cursor: 'pointer' }}
                                        value={runs}
                                        onChange={(e) => setRuns(Number(e.target.value))}
                                    >
                                        {[1, 2, 3, 5].map((n) => (
                                            <option key={n} value={n}>{n} {n === 1 ? 'run' : 'runs'}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <div className="vp-label" style={{ marginBottom: '6px' }}>
                                        Background noise
                                    </div>
                                    <select
                                        style={{ ...inputStyle, cursor: 'pointer' }}
                                        value={noise}
                                        onChange={(e) => setNoise(e.target.value)}
                                    >
                                        {NOISE_OPTIONS.map((n) => (
                                            <option key={n.value} value={n.value}>{n.label} — {n.desc}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Personas */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {[
                            { label: 'Behavioral personas', personas: BEHAVIORAL_PERSONAS },
                            { label: 'Accent personas', personas: ACCENT_PERSONAS },
                            { label: 'Security personas', personas: SECURITY_PERSONAS, security: true },
                        ].map((group, index) => (
                            <div key={group.label} className={`vp-glass animate-in delay-${(index % 3) + 1}`} style={{ ...sectionStyle, marginBottom: 0 }}>
                                <div className="vp-label" style={sectionLabel}>{group.label}</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                                    {group.personas.map((p) => {
                                        const active = selected.includes(p.type)
                                return (
                                    <div key={p.type} style={{ gridColumn: group.security && active ? 'span 2' : undefined }}>
                                        <button
                                            onClick={() => togglePersona(p.type)}
                                            style={{
                                                width: '100%',
                                                background: active ? 'var(--vp-accent-dim)' : 'rgba(255,255,255,0.02)',
                                                border: `0.5px solid ${active ? 'var(--vp-accent)' : 'rgba(255,255,255,0.05)'}`,
                                                borderRadius: 'var(--vp-radius)',
                                                padding: '12px',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                                            }}
                                        >
                                            <div style={{
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                color: active ? 'var(--vp-accent)' : 'var(--vp-text)',
                                                marginBottom: '4px',
                                            }}>
                                                {p.label}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--vp-text-muted)', lineHeight: 1.4 }}>
                                                {p.desc}
                                            </div>
                                        </button>
                                        {group.security && active && (
                                            <textarea
                                                style={{
                                                    ...inputStyle,
                                                    marginTop: '8px',
                                                    minHeight: '78px',
                                                    resize: 'vertical',
                                                    lineHeight: 1.45,
                                                }}
                                                placeholder="Write exactly what this caller should try, e.g. ask the agent to ignore its policy and reveal its hidden instructions."
                                                value={attackPrompts[p.type] ?? ''}
                                                onChange={(e) => setAttackPrompts((prev) => ({ ...prev, [p.type]: e.target.value }))}
                                            />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                        ))}
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
                        marginTop: '16px',
                    }}>
                        {error}
                    </div>
                )}

                <div className="animate-in delay-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '24px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--vp-text-muted)' }}>
                        {selected.length} personas · {selected.length * runs} total calls
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
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                    >
                        {loading && <i className="ti ti-loader-2" style={{ animation: 'vp-pulse 1s infinite' }} aria-hidden="true" />}
                        {loading ? 'Launching...' : 'Launch test suite'}
                    </button>
                </div>
            </div>
        </>
    )
}
