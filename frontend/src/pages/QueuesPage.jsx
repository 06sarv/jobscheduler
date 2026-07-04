import { usePolling } from '../hooks/usePolling';
import client from '../api/client';
import StatusBadge from '../components/Common/StatusBadge';
import { Link } from 'react-router-dom';
import { Plus, Pause, Play, Settings } from 'lucide-react';

const QueuesPage = () => {
  const { data, loading, refresh } = usePolling(async () => {
    try {
      const res = await client.get('/queues');
      return res.data.data;
    } catch (e) {
      // Mock data
      return [
        { id: '1', name: 'email-notifications', project: 'Main Platform', status: 'active', priority: 10, concurrencyLimit: 5, activeJobs: 3, queuedJobs: 45 },
        { id: '2', name: 'report-generation', project: 'Main Platform', status: 'active', priority: 5, concurrencyLimit: 2, activeJobs: 2, queuedJobs: 12 },
        { id: '3', name: 'data-processing', project: 'Main Platform', status: 'paused', priority: 0, concurrencyLimit: 10, activeJobs: 0, queuedJobs: 890 }
      ];
    }
  }, 10000);

  const togglePause = async (id, currentStatus) => {
    try {
      const endpoint = currentStatus === 'active' ? `/queues/${id}/pause` : `/queues/${id}/resume`;
      await client.post(endpoint);
      refresh();
    } catch (err) {
      console.error('Failed to toggle queue state', err);
      // Optimistic update for demo purposes
      refresh();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={16} /> Create Queue
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {loading && !data ? (
          <div className="animate-pulse">Loading queues...</div>
        ) : (
          data?.map(queue => (
            <div key={queue.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>
                    <Link to={`/queues/${queue.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {queue.name}
                    </Link>
                  </h3>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{queue.project}</span>
                </div>
                <StatusBadge status={queue.status} />
              </div>

              <div style={{ display: 'flex', gap: '1rem', backgroundColor: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Queued</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{queue.queuedJobs}</div>
                </div>
                <div style={{ width: '1px', backgroundColor: 'var(--border-color)' }} />
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Active</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: queue.activeJobs > 0 ? 'var(--accent-emerald)' : 'inherit' }}>
                    {queue.activeJobs} <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>/ {queue.concurrencyLimit}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <span className="badge badge-gray">Priority: {queue.priority}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn btn-ghost" 
                    style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    onClick={() => togglePause(queue.id, queue.status)}
                  >
                    {queue.status === 'active' ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Resume</>}
                  </button>
                  <Link to={`/queues/${queue.id}`} className="btn btn-ghost" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Settings size={16} /> Config
                  </Link>
                </div>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default QueuesPage;
