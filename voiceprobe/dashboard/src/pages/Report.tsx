import { useParams, useNavigate } from 'react-router-dom'
import TopBar from '../components/layout/TopBar'
import { useReport } from '../hooks/useReport'
import ScoreHero from '../components/report/ScoreHero'
import MetricsRadar from '../components/report/MetricsRadar'
import LatencyChart from '../components/report/LatencyChart'
import PersonaScoreTable from '../components/report/PersonaScoreTable'
import FailurePatterns from '../components/report/FailurePatterns'
import TranscriptViewer from '../components/report/TranscriptViewer'
import RecommendedFixes from '../components/report/RecommendedFixes'

export default function Report() {
    const { runId } = useParams()
    const navigate = useNavigate()
    const { report, loading, error } = useReport(runId)

    if (loading) return (
        <>
            <TopBar title="Report" action={{ label: 'Back', icon: 'ti-arrow-left', onClick: () => navigate('/') }} />
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--vp-text-muted)', fontSize: '13px' }}>
                Loading report...
            </div>
        </>
    )

    if (error || !report) return (
        <>
            <TopBar title="Report" action={{ label: 'Back', icon: 'ti-arrow-left', onClick: () => navigate('/') }} />
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--vp-danger)', fontSize: '13px' }}>
                Failed to load report.
            </div>
        </>
    )

    const score = report.failure_analysis?.overall_reliability_score ?? null
    const callResults = report.call_results ?? []
    const allLatencyTurns = callResults.flatMap((r: any) => r.evaluation?.latency?.turns ?? [])
    const allTranscripts = callResults.map((r: any) => ({
        personaName: r.persona_name,
        personaType: r.persona_type,
        runNumber: r.run_number,
        transcript: r.transcript ?? [],
        audioPath: r.audio_path ?? null,
        evaluation: r.evaluation ?? null,
    }))

    return (
        <>
            <TopBar
                title={report.target_context ?? 'Report'}
                description={`${callResults.length} calls`}
                action={{ label: 'Back', icon: 'ti-arrow-left', onClick: () => navigate('/') }}
            />
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                <ScoreHero
                    score={score}
                    summary={report.failure_analysis?.most_critical_failure ?? null}
                    totalCalls={callResults.length}
                    context={report.target_context}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <MetricsRadar callResults={callResults} />
                    <LatencyChart turns={allLatencyTurns} />
                </div>

                <PersonaScoreTable callResults={callResults} />

                <FailurePatterns patterns={report.failure_analysis?.patterns ?? []} />

                <RecommendedFixes fixes={report.failure_analysis?.recommended_fixes ?? []} />

                {allTranscripts.map((t: any, i: number) => (
                    <TranscriptViewer key={i} {...t} />
                ))}

            </div>
        </>
    )
}