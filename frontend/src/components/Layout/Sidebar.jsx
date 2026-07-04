import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LayoutDashboard, ListTree, Briefcase, Wrench, AlertOctagon, Zap, LogOut } from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/queues', label: 'Queues', icon: <ListTree size={20} /> },
    { path: '/jobs', label: 'Jobs Explorer', icon: <Briefcase size={20} /> },
    { path: '/workers', label: 'Workers', icon: <Wrench size={20} /> },
    { path: '/dead-letter', label: 'Dead Letters', icon: <AlertOctagon size={20} /> },
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

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              color: isActive ? 'white' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'var(--accent-yellow)' : 'transparent',
              textDecoration: 'none',
              fontWeight: 500,
              transition: 'all 0.2s'
            })}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div style={{
        marginTop: 'auto',
        padding: '1rem',
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{user?.fullName || 'User'}</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{user?.email || 'user@example.com'}</span>
        </div>
        <button 
          onClick={logout}
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'flex-start', padding: '0.5rem 0' }}
        >
           Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
