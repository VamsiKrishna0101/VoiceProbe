import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/layout/TopBar'
import { launchSecurityTest } from '../services/api'

const SECURITY_PERSONAS = [
    { type: 'prompt_injector', label: 'Prompt Injector', desc: 'Use your own instruction override attempt' },
    { type: 'social_engineer', label: 'Social Engineer', desc: 'Use your own extraction or phishing attempt' },
    { type: 'policy_bypasser', label: 'Policy Bypasser', desc: 'Use your own policy bypass attempt' },
]

export default function Security() {
    const navigate = useNavigate()
    const [phone, setPhone] = useState('')
    const [context, setContext] = useState('')
    const [runs, setRuns] = useState(1)
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
            setError('Fill in phone number, context, and select at least one attacker.')
            return
        }
        const missingAttacks = selected.filter((type) => !attackPrompts[type]?.trim())
        if (missingAttacks.length > 0) {
            setError('Write the custom attack instruction for every selected attacker.')
            return
        }
        setError(null)
        setLoading(true)
        try {
            const { run_id } = await launchSecurityTest({
                target_phone_number: phone,
                target_context: context,
                persona_types: selected,
                attack_prompts: Object.fromEntries(
                    selected.map((type) => [type, attackPrompts[type].trim()])
                ),
                runs_per_persona: runs,
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
            <div className="vp-glow-orb" style={{ top: '-10%', left: '-5%', width: '600px', height: '600px', background: 'var(--vp-danger)' }} />
            <div className="vp-glow-orb" style={{ bottom: '-20%', right: '-10%', width: '800px', height: '800px', background: 'var(--vp-accent)' }} />

            <TopBar
                title="Security"
                description="Test agent robustness against adversarial attacks"
            />
            <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    {/* Left Column: Target Config */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div className="animate-in delay-1" style={{
                            background: 'var(--vp-danger-dim)',
                            border: '0.5px solid var(--vp-danger)',
                            borderRadius: 'var(--vp-radius-lg)',
                            padding: '14px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '12px',
                            color: 'var(--vp-danger)',
                        }}>
                            <i className="ti ti-shield-lock" style={{ fontSize: '16px' }} aria-hidden="true" />
                            Security testing sends adversarial calls designed to manipulate your agent. Only use on agents you own.
                        </div>

                        <div className="vp-glass animate-in delay-2" style={{ ...sectionStyle, marginBottom: 0 }}>
                            <div className="vp-label" style={sectionLabel}>Target configuration</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <div className="vp-label" style={{ marginBottom: '6px' }}>Phone number</div>
                                    <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
                                </div>
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
                                    <div className="vp-label" style={{ marginBottom: '6px' }}>Runs per attacker</div>
                                    <select style={{ ...inputStyle, width: '200px', cursor: 'pointer' }} value={runs} onChange={(e) => setRuns(Number(e.target.value))}>
                                        {[1, 2, 3].map((n) => (
                                            <option key={n} value={n}>{n} {n === 1 ? 'run' : 'runs'}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Personas */}
                    <div className="vp-glass animate-in delay-3" style={{ ...sectionStyle, marginBottom: 0 }}>
                        <div className="vp-label" style={sectionLabel}>Attack personas</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {SECURITY_PERSONAS.map((p) => {
                                const active = selected.includes(p.type)
                                return (
                                    <div key={p.type}>
                                        <button
                                            onClick={() => togglePersona(p.type)}
                                            style={{
                                                width: '100%',
                                                background: active ? 'var(--vp-danger-dim)' : 'rgba(255,255,255,0.02)',
                                                border: `0.5px solid ${active ? 'var(--vp-danger)' : 'rgba(255,255,255,0.05)'}`,
                                                borderRadius: 'var(--vp-radius)',
                                                padding: '14px 16px',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                                            }}
                                        >
                                            <i
                                                className="ti ti-bug"
                                                style={{ fontSize: '16px', color: active ? 'var(--vp-danger)' : 'var(--vp-text-muted)', flexShrink: 0 }}
                                                aria-hidden="true"
                                            />
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: 500, color: active ? 'var(--vp-danger)' : 'var(--vp-text)', marginBottom: '3px' }}>
                                                    {p.label}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--vp-text-muted)', lineHeight: 1.4 }}>
                                                    {p.desc}
                                                </div>
                                            </div>
                                        </button>
                                        {active && (
                                            <textarea
                                                style={{
                                                    ...inputStyle,
                                                    marginTop: '8px',
                                                    minHeight: '92px',
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
                        {selected.length} attackers selected · {selected.length * runs} total calls
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
                        {loading ? 'Launching...' : 'Launch Security test'}
                    </button>
                </div>
            </div>
        </>
    )
}
