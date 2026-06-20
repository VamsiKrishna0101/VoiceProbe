import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

interface Props {
    turns: any[]
}

export default function LatencyChart({ turns }: Props) {
    const data = turns.map((t, i) => ({
        turn: i + 1,
        latency: Math.round(t.latency_ms),
        speaker: t.speaker,
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
                Latency per turn (ms)
            </div>
            <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data}>
                    <CartesianGrid stroke="#1E1E21" strokeDasharray="3 3" />
                    <XAxis
                        dataKey="turn"
                        tick={{ fill: '#6B6B7B', fontSize: 11 }}
                        label={{ value: 'Turn', position: 'insideBottom', offset: -2, fill: '#6B6B7B', fontSize: 11 }}
                    />
                    <YAxis
                        tick={{ fill: '#6B6B7B', fontSize: 11 }}
                        tickFormatter={(v) => `${(v / 1000).toFixed(1)}s`}
                    />
                    <Tooltip
                        contentStyle={{
                            background: '#111113',
                            border: '0.5px solid #1E1E21',
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: '#F0F0F3',
                        }}
                        formatter={(v: any) => [`${(v / 1000).toFixed(2)}s`, 'Latency']}
                    />
                    <ReferenceLine y={3000} stroke="#E5484D" strokeDasharray="4 4" strokeWidth={1} label={{ value: 'P95 target', fill: '#E5484D', fontSize: 10 }} />
                    <Line
                        type="monotone"
                        dataKey="latency"
                        stroke="#4F6EF7"
                        strokeWidth={1.5}
                        dot={{ fill: '#4F6EF7', r: 3 }}
                        activeDot={{ r: 4 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}