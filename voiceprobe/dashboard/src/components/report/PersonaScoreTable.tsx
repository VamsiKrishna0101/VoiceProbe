interface Props {
    callResults: any[]
}

function scoreColor(score: number) {
    if (score >= 70) return 'var(--vp-success)'
    if (score >= 45) return 'var(--vp-warning)'
    return 'var(--vp-danger)'
}

export default function PersonaScoreTable({ callResults }: Props) {
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
                Per persona results
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        {['Persona', 'Run', 'Score', 'Task', 'Accuracy', 'Persona Handling', 'Quality', 'Recovery', 'Avg Latency'].map((h) => (
                            <th key={h} style={{
                                fontSize: '11px',
                                color: 'var(--vp-text-muted)',
                                textAlign: 'left',
                                padding: '10px 14px',
                                borderBottom: '0.5px solid var(--vp-border)',
                                letterSpacing: '0.3px',
                                textTransform: 'uppercase',
                                fontWeight: 500,
                            }}>
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {callResults.map((r: any, i: number) => {
                        const scores = r.evaluation?.scores ?? {}
                        const score = r.evaluation?.overall_score ?? null
                        const latency = r.evaluation?.latency?.avg_latency_ms ?? null

                        return (
                            <tr key={i}>
                                <td style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--vp-border)', fontSize: '13px', color: 'var(--vp-text)', fontWeight: 500 }}>
                                    {r.persona_name}
                                </td>
                                <td style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--vp-border)', fontSize: '12px', color: 'var(--vp-text-muted)', fontFamily: 'var(--vp-mono)' }}>
                                    #{r.run_number}
                                </td>
                                <td style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--vp-border)' }}>
                                    <span style={{ fontFamily: 'var(--vp-mono)', fontSize: '13px', fontWeight: 600, color: score != null ? scoreColor(score) : 'var(--vp-text-muted)' }}>
                                        {score ?? '—'}/100
                                    </span>
                                </td>
                                {['task_completion', 'hallucination', 'persona_handling', 'response_quality', 'recovery'].map((m) => (
                                    <td key={m} style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--vp-border)' }}>
                                        <span style={{ fontFamily: 'var(--vp-mono)', fontSize: '12px', color: scoreColor((scores[m] ?? 0) * 10) }}>
                                            {scores[m] ?? '—'}/10
                                        </span>
                                    </td>
                                ))}
                                <td style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--vp-border)', fontFamily: 'var(--vp-mono)', fontSize: '12px', color: 'var(--vp-text-muted)' }}>
                                    {latency != null ? `${Math.round(latency)}ms` : '—'}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}