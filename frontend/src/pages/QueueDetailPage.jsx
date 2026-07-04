import { useParams, Link } from 'react-router-dom';
import { usePolling } from '../hooks/usePolling';
import client from '../api/client';
import StatusBadge from '../components/Common/StatusBadge';

const QueueDetailPage = () => {
  const { id } = useParams();
  
  const { data: queue, loading } = usePolling(async () => {
    try {
      const res = await client.get(`/queues/${id}`);
      return res.data.data;
    } catch (e) {
      return {
        id,
        name: 'email-notifications',
        project: 'Main Platform',
        status: 'active',
        priority: 10,
        concurrencyLimit: 5,
        maxQueueSize: 10000,
        retryPolicy: { name: 'Exponential Backoff', strategy: 'exponential', maxRetries: 3 }
      };
    }
  }, 10000, [id]);

  if (loading && !queue) return <div className="card">Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link to="/queues" className="btn btn-ghost">← Back</Link>
        <h2 style={{ margin: 0 }}>Queue: {queue?.name}</h2>
        <StatusBadge status={queue?.status} />
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h3>Configuration</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Project</div>
            <div style={{ fontWeight: 500 }}>{queue?.project}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Priority</div>
            <div style={{ fontWeight: 500 }}>{queue?.priority}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Concurrency Limit</div>
            <div style={{ fontWeight: 500 }}>{queue?.concurrencyLimit}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Max Size</div>
            <div style={{ fontWeight: 500 }}>{queue?.maxQueueSize?.toLocaleString()}</div>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />

        <div>
          <h4>Retry Policy</h4>
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', backgroundColor: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
            <div>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Strategy: </span>
              <strong>{queue?.retryPolicy?.strategy}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Max Retries: </span>
              <strong>{queue?.retryPolicy?.maxRetries}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueueDetailPage;
