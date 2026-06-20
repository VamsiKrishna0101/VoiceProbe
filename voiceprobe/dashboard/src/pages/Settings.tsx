import { useState } from 'react'
import TopBar from '../components/layout/TopBar'

interface SettingRow {
    label: string
    description: string
    value: string
    key: string
    secret?: boolean
}

const SETTINGS: SettingRow[] = [
    { label: 'Twilio Account SID', description: 'Your Twilio account identifier', value: 'AC•••••••••••••••••••••••••••••••', key: 'TWILIO_ACCOUNT_SID', secret: true },
    { label: 'Twilio Auth Token', description: 'Twilio authentication token', value: '•••••••••••••••••••••••••••••••••', key: 'TWILIO_AUTH_TOKEN', secret: true },
    { label: 'Twilio Phone Number', description: 'Outbound caller ID used for all test calls', value: '+1 (415) 000-0000', key: 'TWILIO_PHONE_NUMBER' },
    { label: 'OpenAI API Key', description: 'Used for LLM persona generation and evaluation', value: 'sk-•••••••••••••••••••••••••••••••', key: 'OPENAI_API_KEY', secret: true },
    { label: 'LLM Model', description: 'Model used for persona generation and evaluation judging', value: 'gpt-4o-mini', key: 'LLM_MODEL' },
    { label: 'Redis URL', description: 'ARQ job queue connection string', value: 'redis://localhost:6379', key: 'REDIS_URL' },
    { label: 'Ngrok URL', description: 'Public webhook endpoint for Twilio callbacks', value: 'https://••••••••.ngrok.io', key: 'NGROK_URL', secret: true },
    { label: 'Recordings Directory', description: 'Local path where test reports are saved', value: './recordings', key: 'RECORDINGS_DIR' },
]

const EVAL_SETTINGS = [
    { label: 'P95 Latency Target', description: 'Turns exceeding this threshold are flagged in reports', value: '3000', unit: 'ms', key: 'LATENCY_P95_MS' },
    { label: 'Min Reliability Score', description: 'Score below this value triggers a critical failure alert', value: '65', unit: '/100', key: 'MIN_RELIABILITY_SCORE' },
    { label: 'Evaluation Temperature', description: 'LLM temperature used during response scoring', value: '0.1', unit: '', key: 'EVAL_TEMPERATURE' },
]

export default function Settings() {
    const [copied, setCopied] = useState<string | null>(null)

    function copyKey(key: string) {
        navigator.clipboard.writeText(key)
        setCopied(key)
        setTimeout(() => setCopied(null), 1500)
    }

    const sectionStyle = {
        background: 'var(--vp-surface)',
        border: '0.5px solid var(--vp-border)',
        borderRadius: 'var(--vp-radius-lg)',
        overflow: 'hidden',
        marginBottom: '20px',
    } as const

    const rowStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '0.5px solid var(--vp-border)',
        gap: '24px',
    } as const

    return (
        <>
            <TopBar title="Settings" description="Environment configuration" />
            <div style={{ padding: '24px', maxWidth: '720px' }}>

                <div style={{
                    background: 'var(--vp-accent-dim)',
                    border: '0.5px solid var(--vp-accent)',
                    borderRadius: 'var(--vp-radius-lg)',
                    padding: '14px 16px',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '12px',
                    color: 'var(--vp-text-secondary)',
                }}>
                    <i className="ti ti-info-circle" style={{ fontSize: '15px', color: 'var(--vp-accent)', flexShrink: 0 }} aria-hidden="true" />
                    These values are read from your <span style={{ fontFamily: 'var(--vp-mono)', color: 'var(--vp-text)', fontSize: '11px', margin: '0 2px' }}>.env</span> file. Restart the backend server after making changes.
                </div>

                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--vp-text)', marginBottom: '10px' }}>
                    Credentials
                </div>
                <div style={sectionStyle}>
                    {SETTINGS.map((s, i) => (
                        <div key={s.key} style={{ ...rowStyle, borderBottom: i === SETTINGS.length - 1 ? 'none' : '0.5px solid var(--vp-border)' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', color: 'var(--vp-text)', fontWeight: 500, marginBottom: '2px' }}>
                                    {s.label}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--vp-text-muted)' }}>
                                    {s.description}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                <code style={{
                                    fontSize: '11px',
                                    fontFamily: 'var(--vp-mono)',
                                    color: 'var(--vp-text-secondary)',
                                    background: 'var(--vp-surface-2)',
                                    padding: '3px 8px',
                                    borderRadius: 'var(--vp-radius-sm)',
                                    border: '0.5px solid var(--vp-border)',
                                    maxWidth: '240px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {s.value}
                                </code>
                                <button
                                    onClick={() => copyKey(s.key)}
                                    title="Copy env key name"
                                    style={{
                                        background: 'transparent',
                                        border: '0.5px solid var(--vp-border)',
                                        borderRadius: 'var(--vp-radius-sm)',
                                        padding: '4px 6px',
                                        cursor: 'pointer',
                                        color: copied === s.key ? 'var(--vp-success)' : 'var(--vp-text-muted)',
                                        fontSize: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                    }}
                                >
                                    <i className={`ti ${copied === s.key ? 'ti-check' : 'ti-copy'}`} aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--vp-text)', marginBottom: '10px' }}>
                    Evaluation thresholds
                </div>
                <div style={sectionStyle}>
                    {EVAL_SETTINGS.map((s, i) => (
                        <div key={s.key} style={{ ...rowStyle, borderBottom: i === EVAL_SETTINGS.length - 1 ? 'none' : '0.5px solid var(--vp-border)' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '13px', color: 'var(--vp-text)', fontWeight: 500, marginBottom: '2px' }}>
                                    {s.label}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--vp-text-muted)' }}>
                                    {s.description}
                                </div>
                            </div>
                            <code style={{
                                fontFamily: 'var(--vp-mono)',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: 'var(--vp-accent)',
                                background: 'var(--vp-accent-dim)',
                                padding: '4px 10px',
                                borderRadius: 'var(--vp-radius-sm)',
                                flexShrink: 0,
                            }}>
                                {s.value}{s.unit}
                            </code>
                        </div>
                    ))}
                </div>

                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--vp-text)', marginBottom: '10px' }}>
                    About
                </div>
                <div style={sectionStyle}>
                    {[
                        { label: 'Version', value: 'v1.0.0' },
                        { label: 'Backend', value: 'FastAPI + ARQ + Redis' },
                        { label: 'License', value: 'MIT Open Source' },
                    ].map((row, i) => (
                        <div key={row.label} style={{ ...rowStyle, borderBottom: i === 2 ? 'none' : '0.5px solid var(--vp-border)' }}>
                            <span style={{ fontSize: '13px', color: 'var(--vp-text-muted)' }}>{row.label}</span>
                            <span style={{ fontSize: '13px', color: 'var(--vp-text)', fontFamily: 'var(--vp-mono)' }}>{row.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </>
    )
}
