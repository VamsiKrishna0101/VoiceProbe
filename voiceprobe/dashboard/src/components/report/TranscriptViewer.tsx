import { useState } from 'react'

interface Props {
    personaName: string
    personaType: string
    runNumber: number
    transcript: any[]
    audioPath: string | null
    evaluation: any
}

export default function TranscriptViewer({ personaName, runNumber, transcript, evaluation }: Props) {
    const [open, setOpen] = useState(false)

    return (
        <div style={{
            background: 'var(--vp-surface)',
            border: '0.5px solid var(--vp-border)',
            borderRadius: 'var(--vp-radius-lg)',
            overflow: 'hidden',
        }}>
            <button
                onClick={() => setOpen(!open)}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    borderBottom: open ? '0.5px solid var(--vp-border)' : 'none',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--vp-text)' }}>
                        {personaName} — Run #{runNumber}
                    </span>
                    {evaluation?.overall_score != null && (
                        <span style={{
                            fontFamily: 'var(--vp-mono)',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: evaluation.overall_score >= 70 ? 'var(--vp-success)' : evaluation.overall_score >= 45 ? 'var(--vp-warning)' : 'var(--vp-danger)',
                        }}>
                            {evaluation.overall_score}/100
                        </span>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--vp-text-muted)' }}>
                        {transcript.length} turns
                    </span>
                </div>
                <i
                    className={`ti ${open ? 'ti-chevron-up' : 'ti-chevron-down'}`}
                    style={{ fontSize: '14px', color: 'var(--vp-text-muted)' }}
                    aria-hidden="true"
                />
            </button>

            {open && (
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                    {evaluation?.summary && (
                        <div style={{
                            fontSize: '12px',
                            color: 'var(--vp-text-muted)',
                            background: 'var(--vp-surface-2)',
                            padding: '10px 14px',
                            borderRadius: 'var(--vp-radius)',
                            marginBottom: '8px',
                            lineHeight: 1.5,
                        }}>
                            {evaluation.summary}
                        </div>
                    )}
                    {transcript.map((turn: any, i: number) => (
                        <div key={i} style={{
                            display: 'flex',
                            flexDirection: turn.speaker === 'agent' ? 'row-reverse' : 'row',
                            gap: '10px',
                            alignItems: 'flex-start',
                        }}>
                            <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: turn.speaker === 'agent' ? 'var(--vp-surface-2)' : 'var(--vp-accent-dim)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                fontWeight: 600,
                                color: turn.speaker === 'agent' ? 'var(--vp-text-muted)' : 'var(--vp-accent)',
                                flexShrink: 0,
                            }}>
                                {turn.speaker === 'agent' ? 'AG' : 'VP'}
                            </div>
                            <div style={{
                                maxWidth: '70%',
                                background: turn.speaker === 'agent' ? 'var(--vp-surface-2)' : 'var(--vp-accent-dim)',
                                borderRadius: 'var(--vp-radius)',
                                padding: '8px 12px',
                            }}>
                                <div style={{ fontSize: '10px', color: 'var(--vp-text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                    {turn.speaker === 'agent' ? 'Voice Agent' : 'VoiceProbe Persona'}
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--vp-text)', lineHeight: 1.5 }}>
                                    {turn.text}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--vp-text-subtle)', marginTop: '4px', fontFamily: 'var(--vp-mono)' }}>
                                    {new Date(turn.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}