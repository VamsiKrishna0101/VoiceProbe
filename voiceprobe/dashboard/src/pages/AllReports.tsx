import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/layout/TopBar'
import { useReports } from '../hooks/useReports'

function scoreColor(score: number) {
    if (score >= 70) return 'var(--vp-success)'
    if (score >= 45) return 'var(--vp-warning)'
    return 'var(--vp-danger)'
}

function formatDate(timestamp: number) {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    })
}

function getOverallScore(report: any): number | null {
    return report?.failure_analysis?.overall_reliability_score ?? null
}

export default function AllReports() {
    const navigate = useNavigate()
    const { reports, loading, error } = useReports()
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState<string>('all')

    const filtered = useMemo(() => {
        return reports.filter(r => {
            if (typeFilter !== 'all' && r.type !== typeFilter) return false
            if (search) {
                const s = search.toLowerCase()
                const target = (r.data?.target_context || r.id).toLowerCase()
                if (!target.includes(s) && !r.id.toLowerCase().includes(s)) return false
            }
            return true
        })
    }, [reports, search, typeFilter])

    return (
        <>
            {/* Glowing background orbs for depth */}
            <div className="vp-glow-orb" style={{ top: '-10%', left: '-5%', width: '600px', height: '600px', background: 'var(--vp-accent)' }} />
            <div className="vp-glow-orb" style={{ bottom: '-20%', right: '-10%', width: '800px', height: '800px', background: 'var(--vp-success)' }} />

            <TopBar title="All Reports" description={`${filtered.length} total runs`} />
            <div style={{ padding: '24px', position: 'relative', zIndex: 1 }}>
                
                <div className="animate-in delay-1" style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ position: 'relative', width: '320px' }}>
                        <i className="ti ti-search" style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--vp-text-muted)', fontSize: '14px' }} aria-hidden="true" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search runs by ID or context..."
                            style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.02)',
                                border: '0.5px solid rgba(255,255,255,0.05)',
                                borderRadius: 'var(--vp-radius)',
                                padding: '8px 12px 8px 34px',
                                fontSize: '13px',
                                color: 'var(--vp-text)',
                                outline: 'none',
                                transition: 'all 0.2s',
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                                e.currentTarget.style.border = '0.5px solid var(--vp-border)'
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                                e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.05)'
                            }}
                        />
                    </div>
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '0.5px solid rgba(255,255,255,0.05)',
                            borderRadius: 'var(--vp-radius)',
                            padding: '8px 12px',
                            fontSize: '13px',
                            color: 'var(--vp-text)',
                            cursor: 'pointer',
                            outline: 'none',
                        }}
                    >
                        <option value="all" style={{ background: 'var(--vp-bg)' }}>All Types</option>
                        <option value="standard" style={{ background: 'var(--vp-bg)' }}>Standard</option>
                        <option value="ab_compare" style={{ background: 'var(--vp-bg)' }}>A/B Compare</option>
                        <option value="security" style={{ background: 'var(--vp-bg)' }}>Security</option>
                    </select>
                </div>

                <div className="vp-glass animate-in delay-2" style={{
                    borderRadius: 'var(--vp-radius-lg)',
                    overflow: 'hidden',
                }}>
                    {loading && (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--vp-text-muted)', fontSize: '13px' }}>
                            Loading reports database...
                        </div>
                    )}
                    {!loading && filtered.length === 0 && (
                        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--vp-text-muted)', fontSize: '13px' }}>
                            No reports match your filters.
                        </div>
                    )}
                    {!loading && !error && filtered.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {['Target', 'Type', 'Run ID', 'Score', 'Status', 'Date'].map((h) => (
                                        <th key={h} className="vp-label" style={{
                                            textAlign: 'left',
                                            padding: '12px 16px',
                                            borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                                            background: 'rgba(0,0,0,0.2)',
                                        }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((r) => {
                                    const score = getOverallScore(r.data)
                                    const context = r.data?.target_context ?? 'Unknown Agent'

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
                                                padding: '12px 16px',
                                                borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                                                fontSize: '13px',
                                                color: 'var(--vp-text)',
                                                fontWeight: 500,
                                            }}>
                                                {context}
                                            </td>
                                            <td style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                                                <span style={{
                                                    fontSize: '11px', fontWeight: 500, padding: '3px 8px', borderRadius: 'var(--vp-radius-sm)',
                                                    background: r.type === 'security' ? 'var(--vp-danger-dim)' : r.type === 'ab_compare' ? 'var(--vp-accent-dim)' : 'rgba(255,255,255,0.05)',
                                                    color: r.type === 'security' ? 'var(--vp-danger)' : r.type === 'ab_compare' ? 'var(--vp-accent)' : 'var(--vp-text-muted)',
                                                }}>
                                                    {r.type === 'ab_compare' ? 'A/B' : r.type === 'security' ? 'Security' : 'Standard'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.05)', fontSize: '12px', fontFamily: 'var(--vp-mono)', color: 'var(--vp-text-muted)' }}>
                                                {r.id.split('-')[0]}...
                                            </td>
                                            <td style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                                                <span className="vp-metric" style={{ fontSize: '13px', color: score != null ? scoreColor(score) : 'var(--vp-text-muted)' }}>
                                                    {score != null ? `${score}/100` : '—'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                                                <span style={{ fontSize: '11px', fontWeight: 500, padding: '3px 8px', borderRadius: 'var(--vp-radius-sm)', background: 'var(--vp-success-dim)', color: 'var(--vp-success)' }}>
                                                    Complete
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.05)', fontSize: '12px', color: 'var(--vp-text-muted)', fontFamily: 'var(--vp-mono)' }}>
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
