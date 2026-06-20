import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'

interface Props {
    callResults: any[]
}

const METRICS = ['task_completion', 'hallucination', 'persona_handling', 'response_quality', 'recovery']
const LABELS: Record<string, string> = {
    task_completion: 'Task',
    hallucination: 'Accuracy',
    persona_handling: 'Persona',
    response_quality: 'Quality',
    recovery: 'Recovery',
}

export default function MetricsRadar({ callResults }: Props) {
    const avgScores: Record<string, number> = {}
    let count = 0

    callResults.forEach((r) => {
        const scores = r.evaluation?.scores
        if (!scores) return
        count++
        METRICS.forEach((m) => {
            avgScores[m] = (avgScores[m] ?? 0) + (scores[m] ?? 0)
        })
    })

    const data = METRICS.map((m) => ({
        metric: LABELS[m],
        value: count > 0 ? Math.round((avgScores[m] ?? 0) / count * 10) : 0,
    }))

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
                Metric breakdown
            </div>
            <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={data}>
                    <PolarGrid stroke="#1E1E21" />
                    <PolarAngleAxis
                        dataKey="metric"
                        tick={{ fill: '#6B6B7B', fontSize: 11 }}
                    />
                    <Radar
                        dataKey="value"
                        stroke="#4F6EF7"
                        fill="#4F6EF7"
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    )
}