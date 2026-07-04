import { usePolling } from '../hooks/usePolling';
import client from '../api/client';
import { Link } from 'react-router-dom';
import { AlertOctagon, RefreshCw } from 'lucide-react';

const DeadLetterPage = () => {
  const { data: deadJobs, loading } = usePolling(async () => {
    try {
      const res = await client.get('/dlq');
      return res.data.data;
    } catch (e) {
      return [
        { id: 'dlq-1', originalJobId: 'job-123', queueName: 'email-notifications', failureReason: 'SMTP Connection Timeout', movedAt: new Date(Date.now() - 3600000).toISOString() },
        { id: 'dlq-2', originalJobId: 'job-456', queueName: 'data-processing', failureReason: 'Invalid payload schema', movedAt: new Date(Date.now() - 86400000).toISOString() }
      ];
    }
  }, 10000);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <AlertOctagon size={32} color="var(--accent-rose)" />
        <h2 style={{ margin: 0 }}>Dead Letter Queue</h2>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table className="table">
            <thead style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th>Original Job ID</th>
                <th>Queue</th>
                <th>Failure Reason</th>
                <th>Moved At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !deadJobs ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>Loading DLQ...</td></tr>
              ) : deadJobs?.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>DLQ is empty. All good!</td></tr>
              ) : (
                deadJobs?.map(job => (
                  <tr key={job.id}>
                    <td style={{ fontFamily: 'monospace' }}>
                      <Link to={`/jobs/${job.originalJobId}`} style={{ color: 'inherit' }}>
                        {job.originalJobId.substring(0, 8)}...
                      </Link>
                    </td>
                    <td><span className="badge badge-gray">{job.queueName}</span></td>
                    <td style={{ color: 'var(--accent-rose)' }}>{job.failureReason}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{new Date(job.movedAt).toLocaleString()}</td>
                    <td style={{ textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <RefreshCw size={14} /> Replay
                      </button>
                      <button className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', color: 'var(--accent-rose)' }}>Discard</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DeadLetterPage;
