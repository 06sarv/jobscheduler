import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { usePolling } from '../hooks/usePolling';
import client from '../api/client';
import StatusBadge from '../components/Common/StatusBadge';
import { RefreshCw, Sparkles } from 'lucide-react';

const JobDetailPage = () => {
  const { id } = useParams();
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  
  const { data: job, loading } = usePolling(async () => {
    try {
      const res = await client.get(`/jobs/${id}`);
      return res.data.data;
    } catch (e) {
      return {
        id,
        type: 'email.send',
        queueName: 'email-notifications',
        status: 'failed',
        priority: 5,
        retryCount: 2,
        maxRetries: 3,
        payload: { to: 'user@example.com', templateId: 'welcome', data: { name: 'Alice' } },
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        startedAt: new Date(Date.now() - 3590000).toISOString(),
        completedAt: new Date(Date.now() - 3585000).toISOString(),
        error: 'SMTP Connection Timeout'
      };
    }
  }, 10000, [id]);

  useEffect(() => {
    if (job && (job.status === 'failed' || job.status === 'dead') && !aiSummary && !aiLoading) {
      setAiLoading(true);
      client.get(`/jobs/${id}/ai-summary`)
        .then(res => {
          setAiSummary(res.data.data.summary);
        })
        .catch(err => {
          console.error('Failed to get AI summary', err);
          setAiSummary('Failed to generate AI summary.');
        })
        .finally(() => {
          setAiLoading(false);
        });
    }
  }, [job?.status, id]);

  if (loading && !job) return <div className="card">Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/jobs" className="btn btn-ghost">← Back</Link>
          <h2 style={{ margin: 0, fontFamily: 'monospace' }}>Job: {job?.id?.substring(0, 8)}...</h2>
          <StatusBadge status={job?.status} />
        </div>
        <div>
          <button className="btn btn-primary" onClick={() => client.post(`/jobs/${id}/retry`).catch(console.error)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={16} /> Retry Job
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Left Col */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3>Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div><div className="text-secondary" style={{ fontSize: '0.875rem' }}>Type</div><div>{job?.type}</div></div>
            <div><div className="text-secondary" style={{ fontSize: '0.875rem' }}>Queue</div><div>{job?.queueName}</div></div>
            <div><div className="text-secondary" style={{ fontSize: '0.875rem' }}>Priority</div><div>{job?.priority}</div></div>
            <div><div className="text-secondary" style={{ fontSize: '0.875rem' }}>Retries</div><div>{job?.retryCount} / {job?.maxRetries}</div></div>
            <div><div className="text-secondary" style={{ fontSize: '0.875rem' }}>Created At</div><div>{new Date(job?.createdAt).toLocaleString()}</div></div>
          </div>
          
          {job?.error && (
            <div style={{ marginTop: '1rem' }}>
              <div className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Last Error</div>
              <div style={{ backgroundColor: 'rgba(244, 63, 94, 0.1)', color: 'var(--accent-rose)', padding: '1rem', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace', marginBottom: '1rem' }}>
                {job.error}
              </div>
            </div>
          )}

          {(job?.status === 'failed' || job?.status === 'dead') && (
            <div style={{ 
              backgroundColor: 'rgba(139, 92, 246, 0.1)', 
              border: '1px solid rgba(139, 92, 246, 0.3)', 
              borderRadius: 'var(--radius-md)', 
              padding: '1.25rem',
              marginTop: '0.5rem' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--accent-purple)' }}>
                <Sparkles size={18} />
                <h4 style={{ margin: 0, fontSize: '1rem' }}>AI Failure Analysis</h4>
              </div>
              <div style={{ color: 'var(--text-primary)', lineHeight: 1.5, fontSize: '0.9rem' }}>
                {aiLoading ? (
                  <div className="animate-pulse" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ width: '16px', height: '16px', border: '2px solid var(--accent-purple)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    Analyzing failure...
                  </div>
                ) : (
                  aiSummary
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Col */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3>Payload</h3>
          <pre style={{ 
            backgroundColor: 'rgba(0,0,0,0.3)', 
            padding: '1rem', 
            borderRadius: 'var(--radius-sm)',
            overflowX: 'auto',
            color: 'var(--accent-emerald)',
            fontFamily: 'monospace'
          }}>
            {JSON.stringify(job?.payload, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default JobDetailPage;
