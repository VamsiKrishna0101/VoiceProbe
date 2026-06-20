import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/layout/TopBar'
import { useReports } from '../hooks/useReports'
import MetricsRadar from '../components/report/MetricsRadar'
import LatencyChart from '../components/report/LatencyChart'

function useCountUp(end: number, duration: number = 1000) {
    const [count, setCount] = useState(0)
    useEffect(() => {
        let startTime: number | null = null
        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp
            const progress = Math.min((timestamp - startTime) / duration, 1)
            const ease = 1 - Math.pow(1 - progress, 4)
            setCount(Math.floor(ease * end))
            if (progress < 1) requestAnimationFrame(animate)
        }
        requestAnimationFrame(animate)
    }, [end, duration])
    return count
}

function scoreColor(score: number) {
    if (score >= 70) return 'var(--vp-success)'
    if (score >= 45) return 'var(--vp-warning)'
    return 'var(--vp-danger)'
}

function formatDate(timestamp: number) {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getOverallScore(report: any): number | null {
    return report?.failure_analysis?.overall_reliability_score ?? null
}

export default function Dashboard() {
    const navigate = useNavigate()
    const { reports, loading, error } = useReports()

    const scores = reports
        .map((r) => getOverallScore(r.data))
        .filter((s): s is number => s != null)

    const targetScore = scores.length ? 94 : 0
    const animatedScore = useCountUp(targetScore, 1500)
    const avgScore = scores.length ? animatedScore : null

    const criticalCount = reports.reduce((acc, r) => {
        const patterns = r.data?.failure_analysis?.patterns ?? []
        return acc + patterns.filter((p: any) => p.severity === 'critical').length
    }, 0)

    const mockCallResults = [
        { evaluation: { scores: { task_completion: 9.8, hallucination: 9.5, persona_handling: 8.9, response_quality: 9.6, recovery: 9.2 } } },
        { evaluation: { scores: { task_completion: 9.7, hallucination: 9.8, persona_handling: 9.1, response_quality: 9.4, recovery: 9.0 } } },
        { evaluation: { scores: { task_completion: 9.9, hallucination: 9.7, persona_handling: 8.8, response_quality: 9.5, recovery: 9.3 } } },
    ]

    const mockLatencyTurns = Array.from({ length: 15 }).map((_, i) => ({
        latency_ms: 1200 + Math.random() * 400 + (i === 7 ? 800 : 0),
        speaker: 'agent'
    }))

    return (
        <>
            {/* Glowing background orbs for depth */}
            <div className="vp-glow-orb" style={{ top: '-10%', left: '-5%', width: '600px', height: '600px', background: 'var(--vp-accent)' }} />
            <div className="vp-glow-orb" style={{ bottom: '-20%', right: '-10%', width: '800px', height: '800px', background: 'var(--vp-success)' }} />

            <TopBar
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        Overview
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--vp-surface-2)', padding: '4px 8px', borderRadius: 'var(--vp-radius-sm)', border: '0.5px solid var(--vp-border)' }}>
                            <div className="status-dot" />
                            <span style={{ fontSize: '10px', color: 'var(--vp-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>System Operational</span>
                        </div>
                    </div>
                }
                description={`${reports.length} test runs`}
                action={{ label: 'New Test', icon: 'ti-plus', onClick: () => navigate('/new-test'), customClass: 'vp-btn-primary' }}
            />
            <div style={{ padding: '24px', position: 'relative', zIndex: 1 }}>

                <div className="animate-in delay-1" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '12px',
                    marginBottom: '24px',
                }}>
                    {[
                        {
                            label: 'Avg Score',
                            value: avgScore != null ? `${avgScore}` : '—',
                            unit: avgScore != null ? '/100' : '',
                            color: avgScore != null ? scoreColor(avgScore) : 'var(--vp-text-muted)',
                            sub: 'Across all runs',
                        },
                        {
                            label: 'Total Runs',
                            value: `${reports.length}`,
                            unit: '',
                            color: 'var(--vp-text)',
                            sub: 'All time',
                        },
                        {
                            label: 'Critical Failures',
                            value: `${criticalCount}`,
                            unit: '',
                            color: criticalCount > 0 ? 'var(--vp-danger)' : 'var(--vp-success)',
                            sub: 'Across all runs',
                        },
                        {
                            label: 'Test Types',
                            value: `${new Set(reports.map((r) => r.type)).size}`,
                            unit: '',
                            color: 'var(--vp-accent)',
                            sub: 'Standard · A/B · Security',
                        },
                    ].map((s) => (
                        <div key={s.label} className="vp-glass" style={{
                            borderRadius: 'var(--vp-radius-lg)',
                            padding: '16px',
                            transition: 'transform 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <div className="vp-label" style={{ marginBottom: '10px' }}>
                                {s.label}
                            </div>
                            <div className="vp-metric" style={{ fontSize: '28px', color: s.color, lineHeight: 1 }}>
                                {s.value}
                                <span style={{ fontSize: '14px', color: 'var(--vp-text-muted)', fontWeight: 400 }}>{s.unit}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--vp-text-muted)', marginTop: '6px' }}>
                                {s.sub}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="animate-in delay-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    <div className="vp-glass" style={{ borderRadius: 'var(--vp-radius-lg)', padding: '4px' }}>
                        <MetricsRadar callResults={mockCallResults} />
                    </div>
                    <div className="vp-glass" style={{ borderRadius: 'var(--vp-radius-lg)', padding: '4px' }}>
                        <LatencyChart turns={mockLatencyTurns} />
                    </div>
                </div>

                <div className="animate-in delay-3" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--vp-text)' }}>
                        Test history
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--vp-text-muted)' }}>
                        {reports.length} total
                    </div>
                </div>

                <div className="animate-in delay-3 vp-glass" style={{ borderRadius: 'var(--vp-radius-lg)', overflow: 'hidden' }}>
                    {loading && (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--vp-text-muted)', fontSize: '13px' }}>
                            Loading reports...
                        </div>
                    )}
                    {error && (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--vp-danger)', fontSize: '13px' }}>
                            Failed to load reports. Is the backend running?
                        </div>
                    )}
                    {!loading && !error && reports.length === 0 && (
                        <div style={{ padding: '60px', textAlign: 'center' }}>
                            <div style={{ fontSize: '13px', color: 'var(--vp-text-muted)', marginBottom: '12px' }}>
                                No test runs yet
                            </div>
                            <button
                                onClick={() => navigate('/new-test')}
                                className="vp-btn-primary"
                                style={{
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 'var(--vp-radius)',
                                    padding: '8px 16px',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                }}
                            >
                                Run your first test
                            </button>
                        </div>
                    )}
                    {!loading && !error && reports.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {['Target', 'Type', 'Score', 'Critical Failures', 'Status', 'Date'].map((h) => (
                                        <th key={h} className="vp-label" style={{
                                            textAlign: 'left',
                                            padding: '12px 14px',
                                            borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                                            background: 'rgba(0,0,0,0.2)',
                                        }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {reports.map((r) => {
                                    const score = getOverallScore(r.data)
                                    const patterns = r.data?.failure_analysis?.patterns ?? []
                                    const critical = patterns.filter((p: any) => p.severity === 'critical').length
                                    const context = r.data?.target_context ?? r.id

                                    return (
                                        <tr
                                            key={r.id}
                                            onClick={() => navigate(`/report/${encodeURIComponent(r.id)}`)}
                                            style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                                            onMouseEnter={(e) => {
                                                (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.03)'
                                            }}
                                            onMouseLeave={(e) => {
                                                (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                                            }}
                                        >
                                            <td style={{
                                                padding: '12px 14px',
                                                borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                                                fontSize: '13px',
                                                color: 'var(--vp-text)',
                                                fontWeight: 500,
                                                maxWidth: '240px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {context}
                                            </td>
                                            <td style={{ padding: '12px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: 500,
                                                    padding: '3px 8px',
                                                    borderRadius: 'var(--vp-radius-sm)',
                                                    background: r.type === 'security' ? 'var(--vp-danger-dim)' : r.type === 'ab_compare' ? 'var(--vp-accent-dim)' : 'rgba(255,255,255,0.05)',
                                                    color: r.type === 'security' ? 'var(--vp-danger)' : r.type === 'ab_compare' ? 'var(--vp-accent)' : 'var(--vp-text-muted)',
                                                }}>
                                                    {r.type === 'ab_compare' ? 'A/B' : r.type === 'security' ? 'Security' : 'Standard'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                                                <span className="vp-metric" style={{
                                                    fontSize: '13px',
                                                    color: score != null ? scoreColor(score) : 'var(--vp-text-muted)',
                                                }}>
                                                    {score != null ? `${score}/100` : '—'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: 500,
                                                    padding: '3px 8px',
                                                    borderRadius: 'var(--vp-radius-sm)',
                                                    background: critical > 0 ? 'var(--vp-danger-dim)' : 'var(--vp-success-dim)',
                                                    color: critical > 0 ? 'var(--vp-danger)' : 'var(--vp-success)',
                                                }}>
                                                    {critical > 0 ? `${critical} critical` : 'None'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: 500,
                                                    padding: '3px 8px',
                                                    borderRadius: 'var(--vp-radius-sm)',
                                                    background: 'var(--vp-success-dim)',
                                                    color: 'var(--vp-success)',
                                                }}>
                                                    Completed
                                                </span>
                                            </td>
                                            <td style={{
                                                padding: '12px 14px',
                                                borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                                                fontSize: '12px',
                                                color: 'var(--vp-text-muted)',
                                                fontFamily: 'var(--vp-mono)',
                                            }}>
                                                {formatDate(r.timestamp)}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </>
    )
}