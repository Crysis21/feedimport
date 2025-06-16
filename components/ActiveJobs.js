import { useState, useEffect } from 'react';

export default function ActiveJobs({ user }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [user]);

  const loadJobs = async () => {
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/sync', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setJobs(data.activeJobs || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'status-paused';
      case 'running': return 'status-running';
      case 'completed': return 'status-completed';
      case 'failed': return 'status-failed';
      default: return 'status-paused';
    }
  };

  const getProgress = (job) => {
    if (job.itemsTotal === 0) return 0;
    return Math.round((job.itemsProcessed / job.itemsTotal) * 100);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 style={{ marginBottom: '1rem' }}>Active Sync Jobs</h2>
      
      {jobs.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No active sync jobs.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Feed ID</th>
              <th>Type</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Started</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr key={job.id}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {job.feedId.substring(0, 8)}...
                </td>
                <td style={{ textTransform: 'capitalize' }}>{job.type}</td>
                <td>
                  <span className={`status-badge ${getStatusColor(job.status)}`}>
                    {job.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '100px',
                      height: '6px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${getProgress(job)}%`,
                        height: '100%',
                        backgroundColor: '#3b82f6',
                        transition: 'width 0.3s ease'
                      }}></div>
                    </div>
                    <span style={{ fontSize: '0.875rem' }}>
                      {job.itemsProcessed}/{job.itemsTotal}
                    </span>
                  </div>
                </td>
                <td>
                  {job.startedAt 
                    ? new Date(job.startedAt.seconds * 1000).toLocaleTimeString()
                    : '-'
                  }
                </td>
                <td>
                  {job.startedAt 
                    ? `${Math.round((Date.now() - job.startedAt.seconds * 1000) / 1000)}s`
                    : '-'
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}