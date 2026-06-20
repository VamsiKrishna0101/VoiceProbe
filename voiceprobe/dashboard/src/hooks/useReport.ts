import { useState, useEffect } from 'react'
import { fetchReportDetails } from '../services/api'

export function useReport(reportId?: string) {
    const [report, setReport] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!reportId) {
            setLoading(false)
            return
        }

        async function load() {
            try {
                const data = await fetchReportDetails(reportId!)
                setReport(data)
            } catch (e: any) {
                setError(e.message)
            } finally {
                setLoading(false)
            }
        }
        
        load()
    }, [reportId])

    return { report, loading, error }
}
