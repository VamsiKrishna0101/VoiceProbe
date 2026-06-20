export default function PageShell({ children }: { children: React.ReactNode }) {
    return (
        <main style={{
            flex: 1,
            padding: '32px',
            overflowY: 'auto',
            background: 'var(--vp-bg)',
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {children}
            </div>
        </main>
    )
}