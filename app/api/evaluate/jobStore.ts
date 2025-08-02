// app/api/evaluate/jobStore.ts

const jobStore = new Map<string, { status: string; payload?: any; result?: any }>();

export function getJobStore() {
    return jobStore;
}