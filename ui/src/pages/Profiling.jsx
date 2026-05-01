import { useState } from 'react'
import PageHeader from '../components/PageHeader'

export default function Profiling() {
  const [err, setErr] = useState(false)

  return (
    <div className="space-y-6">

      <PageHeader
        title="YData Profiling Report"
        subtitle="Auto-generated EDA report from the customer feature matrix — re-run python main.py to refresh"
        icon="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"
        actions={
          <a
            href="/api/profiling"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open in new tab
          </a>
        }
      />

      {err ? (
        <div className="card-pad flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-warn/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-warn" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold text-ink">Report not found</p>
            <p className="text-sm text-muted mt-1">
              Re-run the pipeline to generate it:
            </p>
            <code className="mt-3 inline-block bg-surface2 border border-border px-4 py-2 rounded-lg text-sm font-mono text-ink2">
              python main.py
            </code>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
          <iframe
            src="/api/profiling"
            title="YData Profiling Report"
            className="w-full h-full border-0"
            onError={() => setErr(true)}
          />
        </div>
      )}

    </div>
  )
}
