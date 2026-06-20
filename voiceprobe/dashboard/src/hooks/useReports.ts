import { useState, useEffect } from 'react'
import { fetchReports, fetchReportDetails } from '../services/api'

export function useReports() {
    const [reports, setReports] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function load() {
            try {
                const list = await fetchReports()
                const withData = await Promise.all(
                    list.map(async (r: any) => {
                        try {
                            const data = await fetchReportDetails(r.id)
                            return { ...r, data }
                        } catch {
                            return { ...r, data: null }
                        }
                    })
                )
                setReports(withData)
            } catch (e: any) {
                setError(e.message)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    return { reports, loading, error }
}