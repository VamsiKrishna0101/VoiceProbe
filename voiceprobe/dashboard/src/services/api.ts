import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const fetchReports = async () => {
    const response = await api.get('/reports');
    return response.data;
};

export const fetchReportDetails = async (reportId: string) => {
    const response = await api.get(`/reports/${reportId}`);
    return response.data;
};

export const launchTest = async (config: any) => {
    const response = await api.post('/tests/run', config);
    return response.data; // { run_id: string, status: string }
};

export const launchABTest = async (config: any) => {
    const response = await api.post('/tests/ab', config);
    return response.data;
};

export const launchSecurityTest = async (config: any) => {
    const response = await api.post('/tests/security', config);
    return response.data;
};

export const pollTestStatus = async (runId: string) => {
    const response = await api.get(`/tests/status/${runId}`);
    return response.data; // { status: "running" | "completed" | "failed", type: string, result?: any }
};

export const getTestEventsWebSocketUrl = (runId: string) => {
    return `ws://localhost:8000/api/tests/ws/${runId}`;
};

export default api;
