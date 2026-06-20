interface Props {
    fixes: string[]
}

export default function RecommendedFixes({ fixes }: Props) {
    if (!fixes.length) return null

    return (
        <div style={{
            background: 'var(--vp-surface)',
            border: '0.5px solid var(--vp-border)',
            borderRadius: 'var(--vp-radius-lg)',
            padding: '20px',
        }}>
            <div style={{
                fontSize: '12px',
                color: 'var(--vp-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '16px',
            }}>
                Recommended fixes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {fixes.map((fix: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: 'var(--vp-accent-dim)',
                            color: 'var(--vp-accent)',
                            fontSize: '11px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontFamily: 'var(--vp-mono)',
                            marginTop: '1px',
                        }}>
                            {i + 1}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--vp-text)', lineHeight: 1.6 }}>
                            {fix}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}