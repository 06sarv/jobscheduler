import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LayoutDashboard, ListTree, Briefcase, Wrench, AlertOctagon, Zap, LogOut, Activity, Building, Folder } from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();

  const coreItems = [
    { path: '/dashboard', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { path: '/queues', label: 'Queues', icon: <ListTree size={20} /> },
    { path: '/jobs', label: 'Jobs', icon: <Briefcase size={20} /> },
    { path: '/workers', label: 'Workers', icon: <Wrench size={20} /> },
  ];

  const observabilityItems = [
    { path: '/metrics', label: 'Metrics', icon: <Activity size={20} /> },
    { path: '/dead-letter', label: 'Dead Letter Queue', icon: <AlertOctagon size={20} /> },
  ];

  const managementItems = [
    { path: '/organizations', label: 'Organizations', icon: <Building size={20} /> },
    { path: '/projects', label: 'Projects', icon: <Folder size={20} /> },
  ];

  return (
    <aside style={{
      width: '260px',
      backgroundColor: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.5rem 1rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem', padding: '0 0.5rem' }}>
        <Zap size={24} color="var(--accent-yellow)" />
        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>JobScheduler</h1>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
        
        {/* Core Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {coreItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.6rem 1rem',
                borderRadius: 'var(--radius-md)',
                color: isActive ? 'white' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--accent-yellow)' : 'transparent',
                textDecoration: 'none',
                fontWeight: 500,
                fontSize: '0.875rem',
                transition: 'all 0.2s'
              })}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Observability */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase', paddingLeft: '1rem', margin: 0 }}>
            Observability
          </h3>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {observabilityItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.6rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  color: isActive ? 'white' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'var(--accent-yellow)' : 'transparent',
                  textDecoration: 'none',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  transition: 'all 0.2s'
                })}
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Management */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase', paddingLeft: '1rem', margin: 0 }}>
            Management
          </h3>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {managementItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.6rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  color: isActive ? 'white' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'var(--accent-yellow)' : 'transparent',
                  textDecoration: 'none',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  transition: 'all 0.2s'
                })}
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <div 
        onClick={logout}
        title="Logout"
        style={{
          marginTop: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem',
          backgroundColor: 'rgba(0,0,0,0.2)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          border: '1px solid var(--border-color)',
          transition: 'background-color 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.3)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.2)'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-yellow)',
            color: 'var(--bg-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '0.875rem'
          }}>
            {user?.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'US'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{user?.fullName || 'User'}</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{user?.email || 'user@example.com'}</span>
          </div>
        </div>
        <LogOut size={16} color="var(--text-secondary)" />
      </div>
    </aside>
  );
};

export default Sidebar;
