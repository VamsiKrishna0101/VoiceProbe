import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TopBar from '../components/layout/TopBar'
import { getTestEventsWebSocketUrl, pollTestStatus } from '../services/api'

type LiveEvent = {
    type: string
    timestamp?: string
    status?: string
    speaker?: 'agent' | 'persona'
    text?: string
    persona_name?: string
    job_id?: string
    call_sid?: string
    stream_sid?: string
    score?: number
    error?: string
    message?: string
}

const STEPS = [
    { key: 'queued', label: 'Queued' },
    { key: 'running', label: 'Running calls' },
    { key: 'evaluating', label: 'Evaluating' },
    { key: 'completed', label: 'Done' },
]

function stepIndex(status: string) {
    if (status === 'completed') return 3
    if (status === 'evaluating') return 2
    if (status === 'running') return 1
    return 0
}

function timeLabel(value?: string) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const styles = `
@keyframes vp-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.45; }
}
`

export default function TestStatus() {
    const { runId } = useParams()
    const navigate = useNavigate()
    const [status, setStatus] = useState<any>(null)
    const [elapsed, setElapsed] = useState(0)
    const [events, setEvents] = useState<LiveEvent[]>([])
    const [socketState, setSocketState] = useState<'connecting' | 'live' | 'closed'>('connecting')
    const transcriptRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const timer = setInterval(() => setElapsed(e => e + 1), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        if (!runId) return
        pollTestStatus(runId).then(setStatus).catch(() => {})
        const interval = setInterval(async () => {
            try {
                const s = await pollTestStatus(runId)
                setStatus(s)
                if (s.status === 'completed' || s.status === 'failed') clearInterval(interval)
            } catch {}
        }, 3000)
        return () => clearInterval(interval)
    }, [runId])

    useEffect(() => {
        if (!runId) return
        const ws = new WebSocket(getTestEventsWebSocketUrl(runId))
        setSocketState('connecting')

        ws.onopen = () => setSocketState('live')
        ws.onclose = () => setSocketState('closed')
        ws.onerror = () => setSocketState('closed')
        ws.onmessage = event => {
            try {
                const parsed = JSON.parse(event.data)
                setEvents(prev => [...prev, parsed].slice(-250))
                if (parsed.type === 'run_status') {
                    setStatus((current: any) => ({
                        ...(current ?? {}),
                        status: parsed.status,
                        type: parsed.test_type ?? current?.type,
                        error: parsed.error ?? current?.error,
                    }))
                }
            } catch {}
        }

        return () => ws.close()
    }, [runId])

    useEffect(() => {
        transcriptRef.current?.scrollTo({
            top: transcriptRef.current.scrollHeight,
            behavior: 'smooth',
        })
    }, [events])

    const transcriptEvents = useMemo(
        () => events.filter(event => event.type === 'transcript' && event.text),
        [events],
    )
    const systemEvents = useMemo(
        () => events.filter(event => event.type !== 'transcript').slice(-12).reverse(),
        [events],
    )

    const current = status?.status ?? 'queued'
    const isDone = current === 'completed'
    const isFailed = current === 'failed'
    const currentStep = stepIndex(current)
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0')
    const secs = String(elapsed % 60).padStart(2, '0')

    return (
        <>
            <style>{styles}</style>
            <TopBar
                title={isDone ? 'Test complete' : isFailed ? 'Test failed' : 'Live test'}
                action={{ label: 'Overview', icon: 'ti-layout-dashboard', onClick: () => navigate('/') }}
            />
            <main style={{ padding: '28px 24px 56px', maxWidth: '1180px', margin: '0 auto' }}>
                <section style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: '20px',
                    alignItems: 'start',
                    marginBottom: '20px',
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <span className="status-dot" style={{
                                background: socketState === 'live' ? 'var(--vp-success)' : 'var(--vp-warning)',
                                animation: isDone || isFailed ? 'none' : undefined,
                            }} />
                            <span style={{ color: 'var(--vp-text)', fontWeight: 600 }}>
                                {isFailed ? 'Run failed' : isDone ? 'All calls complete' : 'Streaming live call activity'}
                            </span>
                        </div>
                        <div style={{ color: 'var(--vp-text-muted)', fontSize: '12px' }}>
                            {socketState === 'live' ? 'WebSocket connected' : socketState === 'connecting' ? 'Connecting WebSocket' : 'WebSocket closed'} · {mins}:{secs} elapsed
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        style={{
                            background: 'var(--vp-surface-2)',
                            border: '0.5px solid var(--vp-border)',
                            color: 'var(--vp-text)',
                            borderRadius: 'var(--vp-radius)',
                            padding: '9px 14px',
                            fontSize: '12px',
                            cursor: 'pointer',
                        }}
                    >
                        Overview
                    </button>
                </section>

                <section style={{
                    background: 'var(--vp-surface)',
                    border: `0.5px solid ${isFailed ? 'var(--vp-danger)' : isDone ? 'var(--vp-success)' : 'var(--vp-border)'}`,
                    borderRadius: 'var(--vp-radius-lg)',
                    padding: '18px',
                    marginBottom: '20px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '18px' }}>
                        <div>
                            <div className="vp-label" style={{ marginBottom: '6px' }}>Run progress</div>
                            <div style={{ color: 'var(--vp-text)', fontSize: '16px', fontWeight: 600 }}>{current}</div>
                        </div>
                        <div style={{ fontFamily: 'var(--vp-mono)', color: 'var(--vp-text-muted)', fontSize: '11px' }}>{runId}</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
                        {STEPS.map((step, i) => {
                            const done = i < currentStep || isDone
                            const active = i === currentStep && !isFailed && !isDone
                            return (
                                <div key={step.key} style={{
                                    border: `0.5px solid ${done ? 'var(--vp-success)' : active ? 'var(--vp-accent)' : 'var(--vp-border)'}`,
                                    background: done ? 'var(--vp-success-dim)' : active ? 'var(--vp-accent-dim)' : 'var(--vp-surface-2)',
                                    borderRadius: 'var(--vp-radius)',
                                    padding: '10px 12px',
                                    minHeight: '58px',
                                }}>
                                    <div style={{ color: done ? 'var(--vp-success)' : active ? 'var(--vp-accent)' : 'var(--vp-text-muted)', fontSize: '11px', marginBottom: '4px' }}>
                                        {done ? 'Complete' : active ? 'Active' : 'Waiting'}
                                    </div>
                                    <div style={{ color: 'var(--vp-text)', fontSize: '13px', fontWeight: 600 }}>{step.label}</div>
                                </div>
                            )
                        })}
                    </div>
                </section>

                <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 0.8fr)', gap: '20px' }}>
                    <div style={{
                        background: 'var(--vp-surface)',
                        border: '0.5px solid var(--vp-border)',
                        borderRadius: 'var(--vp-radius-lg)',
                        minHeight: '520px',
                        display: 'flex',
                        flexDirection: 'column',
                    }}>
                        <div style={{ padding: '16px 18px', borderBottom: '0.5px solid var(--vp-border)', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                            <div>
                                <div className="vp-label" style={{ marginBottom: '6px' }}>Live transcript</div>
                                <div style={{ color: 'var(--vp-text-muted)', fontSize: '12px' }}>Persona and agent turns appear here during the call.</div>
                            </div>
                            <div style={{ color: 'var(--vp-text-muted)', fontSize: '12px' }}>{transcriptEvents.length} turns</div>
                        </div>

                        <div ref={transcriptRef} style={{ padding: '18px', overflowY: 'auto', flex: 1, maxHeight: '620px' }}>
                            {transcriptEvents.length === 0 ? (
                                <div style={{
                                    border: '0.5px dashed var(--vp-border-hover)',
                                    borderRadius: 'var(--vp-radius)',
                                    padding: '28px',
                                    color: 'var(--vp-text-muted)',
                                    textAlign: 'center',
                                    fontSize: '13px',
                                }}>
                                    Waiting for the call audio stream to produce transcript turns.
                                </div>
                            ) : transcriptEvents.map((event, index) => {
                                const isAgent = event.speaker === 'agent'
                                return (
                                    <div key={`${event.timestamp}-${index}`} style={{
                                        display: 'flex',
                                        justifyContent: isAgent ? 'flex-end' : 'flex-start',
                                        marginBottom: '14px',
                                    }}>
                                        <div style={{
                                            maxWidth: '76%',
                                            background: isAgent ? 'var(--vp-accent-dim)' : 'var(--vp-surface-2)',
                                            border: `0.5px solid ${isAgent ? 'var(--vp-accent)' : 'var(--vp-border)'}`,
                                            borderRadius: 'var(--vp-radius)',
                                            padding: '11px 12px',
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', marginBottom: '6px' }}>
                                                <span style={{ color: isAgent ? 'var(--vp-accent-hover)' : 'var(--vp-success)', fontSize: '11px', fontWeight: 700 }}>
                                                    {isAgent ? 'Agent' : event.persona_name ?? 'Persona'}
                                                </span>
                                                <span style={{ color: 'var(--vp-text-muted)', fontSize: '10px', fontFamily: 'var(--vp-mono)' }}>{timeLabel(event.timestamp)}</span>
                                            </div>
                                            <div style={{ color: 'var(--vp-text)', fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{event.text}</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <aside style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{
                            background: 'var(--vp-surface)',
                            border: '0.5px solid var(--vp-border)',
                            borderRadius: 'var(--vp-radius-lg)',
                            padding: '16px',
                        }}>
                            <div className="vp-label" style={{ marginBottom: '12px' }}>Run details</div>
                            <div style={{ display: 'grid', gap: '10px', fontSize: '12px' }}>
                                <Detail label="Type" value={status?.type ?? '-'} />
                                <Detail label="Status" value={current} tone={isFailed ? 'danger' : isDone ? 'success' : 'accent'} />
                                <Detail label="Socket" value={socketState} tone={socketState === 'live' ? 'success' : 'warning'} />
                                {status?.error && <Detail label="Error" value={status.error} tone="danger" />}
                            </div>
                        </div>

                        <div style={{
                            background: 'var(--vp-surface)',
                            border: '0.5px solid var(--vp-border)',
                            borderRadius: 'var(--vp-radius-lg)',
                            padding: '16px',
                            minHeight: '300px',
                        }}>
                            <div className="vp-label" style={{ marginBottom: '12px' }}>Live events</div>
                            <div style={{ display: 'grid', gap: '9px' }}>
                                {systemEvents.length === 0 ? (
                                    <div style={{ color: 'var(--vp-text-muted)', fontSize: '12px' }}>No events yet.</div>
                                ) : systemEvents.map((event, index) => (
                                    <div key={`${event.timestamp}-${index}`} style={{
                                        borderLeft: '2px solid var(--vp-border-hover)',
                                        paddingLeft: '10px',
                                    }}>
                                        <div style={{ color: 'var(--vp-text)', fontSize: '12px', fontWeight: 600 }}>{event.type}</div>
                                        <div style={{ color: 'var(--vp-text-muted)', fontSize: '11px' }}>
                                            {event.persona_name ? `${event.persona_name} · ` : ''}
                                            {event.status ?? event.message ?? (event.score !== undefined ? `Score ${event.score}/100` : timeLabel(event.timestamp))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </aside>
                </section>
            </main>
        </>
    )
}

function Detail({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' | 'warning' | 'accent' }) {
    const color =
        tone === 'success' ? 'var(--vp-success)' :
        tone === 'danger' ? 'var(--vp-danger)' :
        tone === 'warning' ? 'var(--vp-warning)' :
        tone === 'accent' ? 'var(--vp-accent)' :
        'var(--vp-text)'

    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ color: 'var(--vp-text-muted)' }}>{label}</span>
            <span style={{ color, textAlign: 'right', overflowWrap: 'anywhere' }}>{value}</span>
        </div>
    )
}
