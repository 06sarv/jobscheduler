import { useContext } from 'react';
import { SocketContext } from '../../context/SocketContext';
import { useLocation } from 'react-router-dom';

const Header = () => {
  const { isConnected } = useContext(SocketContext) || { isConnected: false };
  const location = useLocation();
  
  // Create a nice title from the path
  const pathParts = location.pathname.split('/').filter(Boolean);
  const pageTitle = pathParts.length > 0 
    ? pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1).replace('-', ' ')
    : 'Dashboard';

  return (
    <header style={{
      height: '70px',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 2rem',
      backgroundColor: 'rgba(10, 15, 28, 0.8)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 10
    }}>
      <h2 style={{ fontSize: '1.25rem', margin: 0 }}>{pageTitle}</h2>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isConnected ? 'var(--accent-emerald)' : 'var(--text-muted)',
          boxShadow: isConnected ? '0 0 8px var(--accent-emerald)' : 'none'
        }} className={isConnected ? 'animate-pulse' : ''} />
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {isConnected ? 'Live' : 'Disconnected'}
        </span>
      </div>
    </header>
  );
};

export default Header;
