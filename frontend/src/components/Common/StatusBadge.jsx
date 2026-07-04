const StatusBadge = ({ status }) => {
  const normalizedStatus = status?.toLowerCase() || 'unknown';
  
  const configMap = {
    queued: { colorClass: 'badge-gray', dotClass: 'dot-gray' },
    scheduled: { colorClass: 'badge-blue', dotClass: 'dot-blue' },
    claimed: { colorClass: 'badge-purple', dotClass: 'dot-purple' },
    running: { colorClass: 'badge-amber', dotClass: 'dot-amber' },
    completed: { colorClass: 'badge-emerald', dotClass: 'dot-emerald' },
    failed: { colorClass: 'badge-rose', dotClass: 'dot-rose' },
    dead: { colorClass: 'badge-rose', dotClass: 'dot-rose' }, // re-use rose for dead
    active: { colorClass: 'badge-emerald', dotClass: 'dot-emerald' },
    paused: { colorClass: 'badge-amber', dotClass: 'dot-amber' },
    idle: { colorClass: 'badge-gray', dotClass: 'dot-gray' },
    busy: { colorClass: 'badge-amber', dotClass: 'dot-amber' },
    offline: { colorClass: 'badge-rose', dotClass: 'dot-rose' },
  };

  const config = configMap[normalizedStatus] || configMap.queued;

  return (
    <span className={`badge ${config.colorClass}`}>
      <span className={`status-dot ${config.dotClass}`} />
      {normalizedStatus}
    </span>
  );
};

export default StatusBadge;
