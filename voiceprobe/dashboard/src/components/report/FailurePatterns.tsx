interface Props {
    patterns: any[]
}

const severityConfig: Record<string, { color: string; bg: string }> = {
    critical: { color: 'var(--vp-danger)', bg: 'var(--vp-danger-dim)' },
    high: { color: 'var(--vp-warning)', bg: 'var(--vp-warning-dim)' },
    medium: { color: 'var(--vp-accent)', bg: 'var(--vp-accent-dim)' },
    low: { color: 'var(--vp-success)', bg: 'var(--vp-success-dim)' },
}

export default function FailurePatterns({ patterns }: Props) {
    if (!patterns.length) return null

    return (
        <div style={{
            background: 'var(--vp-surface)',
            border: '0.5px solid var(--vp-border)',
            borderRadius: 'var(--vp-radius-lg)',
            overflow: 'hidden',
        }}>
            <div style={{
                padding: '16px 20px',
                borderBottom: '0.5px solid var(--vp-border)',
                fontSize: '12px',
                color: 'var(--vp-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
            }}>
                Failure patterns
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {patterns.map((p: any, i: number) => {
                    const s = severityConfig[p.severity] ?? severityConfig.medium
                    return (
                        <div key={i} style={{
                            borderLeft: `2px solid ${s.color}`,
                            paddingLeft: '14px',
                            paddingTop: '2px',
                            paddingBottom: '2px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                <span style={{
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    padding: '2px 7px',
                                    borderRadius: '4px',
                                    background: s.bg,
                                    color: s.color,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.3px',
                                }}>
                                    {p.severity}
                                </span>
                                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--vp-text)' }}>
                                    {p.pattern}
                                </span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--vp-text-muted)', lineHeight: 1.5, marginBottom: '6px' }}>
                                {p.description}
                            </div>
                            {p.example_quote && (
                                <div style={{
                                    fontSize: '12px',
                                    color: 'var(--vp-text-muted)',
                                    fontStyle: 'italic',
                                    fontFamily: 'var(--vp-mono)',
                                    background: 'var(--vp-surface-2)',
                                    padding: '6px 10px',
                                    borderRadius: '4px',
                                    marginTop: '4px',
                                }}>
                                    "{p.example_quote}"
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}