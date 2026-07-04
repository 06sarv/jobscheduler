import { usePolling } from '../hooks/usePolling';
import client from '../api/client';
import StatusBadge from '../components/Common/StatusBadge';
import { Plus } from 'lucide-react';

const WorkersPage = () => {
  const { data: workers, loading } = usePolling(async () => {
    try {
      const res = await client.get('/workers');
      return res.data.data;
    } catch (e) {
      return [
        { id: 'w-1', name: 'worker-node-01', status: 'busy', hostname: 'host-1', pid: 1024, concurrency: 3, currentLoad: 3, cpuUsage: 45, memoryUsage: 60, startedAt: new Date(Date.now() - 86400000).toISOString() },
        { id: 'w-2', name: 'worker-node-02', status: 'idle', hostname: 'host-2', pid: 2048, concurrency: 3, currentLoad: 0, cpuUsage: 5, memoryUsage: 40, startedAt: new Date(Date.now() - 172800000).toISOString() }
      ];
    }
  }, 10000);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Worker Nodes</h2>
        <button 
          className="btn btn-primary" 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          onClick={() => alert('Workers are registered automatically when they connect to the platform. Please start a worker instance using the JobScheduler Node.js SDK.')}
        >
          <Plus size={16} /> Register Worker
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table className="table">
            <thead style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Host / PID</th>
                <th>Load</th>
                <th>CPU / Mem</th>
                <th>Uptime</th>
              </tr>
            </thead>
            <tbody>
              {loading && !workers ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Loading workers...</td></tr>
              ) : (
                workers?.map(worker => (
                  <tr key={worker.id}>
                    <td style={{ fontWeight: 500 }}>{worker.name}</td>
                    <td><StatusBadge status={worker.status} /></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{worker.hostname} : {worker.pid}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{worker.currentLoad} / {worker.concurrency}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)' }}>CPU: {worker.cpuUsage}% | Mem: {worker.memoryUsage}%</span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {Math.floor((Date.now() - new Date(worker.startedAt).getTime()) / 3600000)}h
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

export default WorkersPage;
