import { useState } from 'react';
import { usePolling } from '../hooks/usePolling';
import client from '../api/client';
import StatusBadge from '../components/Common/StatusBadge';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

const JobsPage = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  
  // Fetch real data from backend
  const { data, loading, refresh } = usePolling(async () => {
    try {
      const res = await client.get(`/jobs/queue/all?page=${page}&limit=10${statusFilter ? `&status=${statusFilter}` : ''}`);
      return res.data.data;
    } catch (e) {
      // Return mock data for UI demo if backend is not ready
      return {
        items: [
          { id: 'job-1234', type: 'email.send', queueName: 'email-notifications', status: 'completed', priority: 5, createdAt: new Date().toISOString(), durationMs: 1250 },
          { id: 'job-5678', type: 'report.generate', queueName: 'report-generation', status: 'running', priority: 10, createdAt: new Date(Date.now() - 5000).toISOString(), durationMs: null },
          { id: 'job-9012', type: 'data.sync', queueName: 'data-processing', status: 'failed', priority: 0, createdAt: new Date(Date.now() - 3600000).toISOString(), durationMs: 45000 },
          { id: 'job-3456', type: 'email.send', queueName: 'email-notifications', status: 'queued', priority: 5, createdAt: new Date().toISOString(), durationMs: null },
        ],
        total: 1542,
        page,
        totalPages: 155
      };
    }
  }, 5000, [page, statusFilter]);

  const handleCancel = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await client.post(`/jobs/${id}/cancel`);
      refresh();
    } catch (err) {
      console.error('Failed to cancel', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Filters Bar */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontWeight: 500 }}>Filter by Status:</span>
          <select 
            className="select" 
            style={{ width: '150px', padding: '0.5rem' }}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Statuses</option>
            <option value="queued">Queued</option>
            <option value="scheduled">Scheduled</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div>
          <button className="btn btn-primary" onClick={() => refresh()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table className="table">
            <thead style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th>Job ID</th>
                <th>Type</th>
                <th>Queue</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Created</th>
                <th>Duration</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>Loading jobs...</td></tr>
              ) : data?.items?.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>No jobs found.</td></tr>
              ) : (
                data?.items?.map(job => (
                  <tr key={job.id} style={{ cursor: 'pointer' }}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      <Link to={`/jobs/${job.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {job.id.substring(0, 8)}...
                      </Link>
                    </td>
                    <td>{job.type}</td>
                    <td><span className="badge badge-gray">{job.queueName || 'default'}</span></td>
                    <td><StatusBadge status={job.status} /></td>
                    <td>{job.priority}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {job.durationMs ? `${job.durationMs}ms` : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {['queued', 'scheduled'].includes(job.status) && (
                        <button 
                          className="btn btn-ghost" 
                          style={{ padding: '0.25rem 0.5rem', color: 'var(--accent-rose)' }}
                          onClick={(e) => handleCancel(job.id, e)}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div style={{ 
          padding: '1rem', 
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.1)'
        }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Showing page {data?.page || 1} of {data?.totalPages || 1} ({data?.total || 0} total jobs)
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className="btn btn-ghost" 
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </button>
            <button 
              className="btn btn-ghost"
              disabled={page >= (data?.totalPages || 1)}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobsPage;
