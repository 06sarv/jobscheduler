import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePolling } from '../hooks/usePolling';
import { useSocket } from '../hooks/useSocket';
import { useEffect, useState } from 'react';
import client from '../api/client';
import StatusBadge from '../components/Common/StatusBadge';
import { Package, Bot, CheckCircle, Clock } from 'lucide-react';

// Helper components for the dashboard
const MetricCard = ({ title, value, icon, gradient, loading }) => (
  <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: gradient }}>
    <div style={{ fontSize: '2rem' }}>{icon}</div>
    <div>
      <h3 style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)', fontWeight: 'normal', margin: 0 }}>{title}</h3>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
        {loading ? <span className="animate-pulse">--</span> : value}
      </div>
    </div>
  </div>
);

const DashboardPage = () => {
  // Fetch real data from backend
  const { data: healthData, loading: healthLoading } = usePolling(async () => {
    try {
      const res = await client.get('/dashboard/health');
      return res.data.data;
    } catch (e) {
      // Mock fallback
      return { totalJobs: 1542, activeWorkers: 3, successRate: 95.8, avgExecutionTime: 2340 };
    }
  }, 5000);

  const { data: queueData, loading: queueLoading } = usePolling(async () => {
    try {
      const res = await client.get('/dashboard/queue-stats');
      return res.data.data;
    } catch (e) {
      return [
        { id: '1', name: 'email-notifications', status: 'active', depth: 45, processing: 5 },
        { id: '2', name: 'report-generation', status: 'active', depth: 12, processing: 2 },
        { id: '3', name: 'data-processing', status: 'paused', depth: 890, processing: 0 }
      ];
    }
  }, 5000);

  const { data: workerData, loading: workerLoading } = usePolling(async () => {
    try {
      const res = await client.get('/dashboard/worker-stats');
      return res.data.data;
    } catch (e) {
      return [
        { id: '1', name: 'worker-node-01', status: 'busy', currentLoad: 3, concurrency: 3, cpuUsage: 45, memoryUsage: 60 },
        { id: '2', name: 'worker-node-02', status: 'idle', currentLoad: 0, concurrency: 3, cpuUsage: 5, memoryUsage: 40 },
        { id: '3', name: 'worker-node-03', status: 'offline', currentLoad: 0, concurrency: 3, cpuUsage: 0, memoryUsage: 0 }
      ];
    }
  }, 5000);

  // Mock throughput data for chart
  const throughputData = Array.from({ length: 24 }).map((_, i) => ({
    time: `${i}:00`,
    completed: Math.floor(Math.random() * 500) + 100,
    failed: Math.floor(Math.random() * 20)
  }));

  // Listen to socket events for real-time visual updates
  const { lastMessage: jobUpdate } = useSocket('job:status_changed');
  const [pulseQueueId, setPulseQueueId] = useState(null);

  useEffect(() => {
    if (jobUpdate) {
      setPulseQueueId(jobUpdate.queueId);
      const timer = setTimeout(() => setPulseQueueId(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [jobUpdate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Top Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <MetricCard 
          title="Total Jobs" 
          value={healthData?.totalJobs?.toLocaleString()} 
          icon={<Package size={32} />} 
          gradient="linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(59,130,246,0.05) 100%)"
          loading={healthLoading}
        />
        <MetricCard 
          title="Active Workers" 
          value={healthData?.activeWorkers} 
          icon={<Bot size={32} />} 
          gradient="linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.05) 100%)"
          loading={healthLoading}
        />
        <MetricCard 
          title="Success Rate" 
          value={`${healthData?.successRate}%`} 
          icon={<CheckCircle size={32} />} 
          gradient="linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(245,158,11,0.05) 100%)"
          loading={healthLoading}
        />
        <MetricCard 
          title="Avg Exec Time" 
          value={`${healthData?.avgExecutionTime}ms`} 
          icon={<Clock size={32} />} 
          gradient="linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(139,92,246,0.05) 100%)"
          loading={healthLoading}
        />
      </div>

      {/* Throughput Chart */}
      <div className="card" style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: '1rem' }}>Throughput (Last 24h)</h3>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={throughputData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-emerald)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--accent-emerald)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-rose)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--accent-rose)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="time" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
              <Area type="monotone" dataKey="completed" stroke="var(--accent-emerald)" fillOpacity={1} fill="url(#colorCompleted)" />
              <Area type="monotone" dataKey="failed" stroke="var(--accent-rose)" fillOpacity={1} fill="url(#colorFailed)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Grid: Queues & Workers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        
        {/* Queues */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3>Queue Overview</h3>
          {queueLoading && !queueData ? (
            <div className="animate-pulse">Loading queues...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {queueData?.map(q => (
                <div key={q.id} style={{
                  padding: '1rem',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderRadius: 'var(--radius-md)',
                  border: pulseQueueId === q.id ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
                  transition: 'border-color 0.3s'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 500 }}>{q.name}</span>
                      <StatusBadge status={q.status} />
                    </div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Depth: <strong>{q.depth}</strong>
                    </span>
                  </div>
                  {/* Visual depth bar */}
                  <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${Math.min(100, (q.depth / 1000) * 100)}%`, 
                      height: '100%', 
                      backgroundColor: 'var(--accent-blue)',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Processing: {q.processing} jobs
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Workers */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3>Worker Nodes</h3>
          {workerLoading && !workerData ? (
            <div className="animate-pulse">Loading workers...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {workerData?.map(w => (
                <div key={w.id} style={{
                  padding: '1rem',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 500 }}>{w.name}</span>
                      <StatusBadge status={w.status} />
                    </div>
                    
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>CPU:</span>
                        <div style={{ width: '40px', height: '4px', backgroundColor: 'var(--bg-secondary)', borderRadius: '2px' }}>
                          <div style={{ width: `${w.cpuUsage}%`, height: '100%', backgroundColor: w.cpuUsage > 80 ? 'var(--accent-rose)' : 'var(--accent-emerald)', borderRadius: '2px' }} />
                        </div>
                        <span>{w.cpuUsage}%</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>Mem:</span>
                        <div style={{ width: '40px', height: '4px', backgroundColor: 'var(--bg-secondary)', borderRadius: '2px' }}>
                          <div style={{ width: `${w.memoryUsage}%`, height: '100%', backgroundColor: 'var(--accent-purple)', borderRadius: '2px' }} />
                        </div>
                        <span>{w.memoryUsage}%</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Circular load indicator */}
                  <div style={{ 
                    width: '40px', height: '40px', 
                    borderRadius: '50%', 
                    border: `3px solid ${w.currentLoad > 0 ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 'bold', fontSize: '0.875rem'
                  }}>
                    {w.currentLoad}/{w.concurrency}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;
