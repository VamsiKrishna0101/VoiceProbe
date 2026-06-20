interface Props {
    score: number | null
    summary: string | null
    totalCalls: number
    context: string
}

function getGrade(score: number) {
    if (score >= 90) return { grade: 'A', color: 'var(--vp-success)' }
    if (score >= 75) return { grade: 'B', color: 'var(--vp-success)' }
    if (score >= 60) return { grade: 'C', color: 'var(--vp-warning)' }
    if (score >= 40) return { grade: 'D', color: 'var(--vp-warning)' }
    return { grade: 'F', color: 'var(--vp-danger)' }
}

export default function ScoreHero({ score, summary, totalCalls, context }: Props) {
    const { grade, color } = score != null ? getGrade(score) : { grade: '—', color: 'var(--vp-text-muted)' }

    return (
        <div style={{
            background: 'var(--vp-surface)',
            border: '0.5px solid var(--vp-border)',
            borderRadius: 'var(--vp-radius-lg)',
            padding: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '32px',
        }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{
                    fontSize: '64px',
                    fontWeight: 700,
                    fontFamily: 'var(--vp-mono)',
                    color,
                    lineHeight: 1,
                    letterSpacing: '-2px',
                }}>
                    {score ?? '—'}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--vp-text-muted)', marginTop: '4px' }}>
                    out of 100
                </div>
            </div>

            <div style={{
                width: '0.5px',
                height: '64px',
                background: 'var(--vp-border)',
                flexShrink: 0,
            }} />

            <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{
                    fontSize: '48px',
                    fontWeight: 700,
                    fontFamily: 'var(--vp-mono)',
                    color,
                    lineHeight: 1,
                }}>
                    {grade}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--vp-text-muted)', marginTop: '4px' }}>
                    grade
                </div>
            </div>

            <div style={{
                width: '0.5px',
                height: '64px',
                background: 'var(--vp-border)',
                flexShrink: 0,
            }} />

            <div style={{ flex: 1 }}>
                <div style={{
                    fontSize: '11px',
                    color: 'var(--vp-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '8px',
                }}>
                    Most critical failure
                </div>
                <div style={{
                    fontSize: '14px',
                    color: 'var(--vp-text)',
                    lineHeight: 1.5,
                    fontWeight: 500,
                }}>
                    {summary ?? 'No critical failures detected'}
                </div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '16px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--vp-text-muted)' }}>
                        <span style={{ fontFamily: 'var(--vp-mono)', color: 'var(--vp-text)', fontWeight: 600 }}>
                            {totalCalls}
                        </span> calls made
                    </div>
                </div>
            </div>
        </div>
    )
}