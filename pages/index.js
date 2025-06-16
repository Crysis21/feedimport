import { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import FeedsList from '../components/FeedsList';
import AddFeedForm from '../components/AddFeedForm';
import ActiveJobs from '../components/ActiveJobs';
import Dashboard from '../components/Dashboard';

export default function Home({ user, loading }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in with Google:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container" style={{ paddingTop: '4rem' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
          <h1 style={{ marginBottom: '1rem' }}>Feed Import Manager</h1>
          <p style={{ marginBottom: '2rem', color: '#6b7280' }}>
            Sign in to manage your product feeds and synchronization
          </p>
          <button onClick={signInWithGoogle} className="btn btn-primary">
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Feed Import Manager</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span>Welcome, {user.displayName}</span>
            <button onClick={handleSignOut} className="btn btn-secondary">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <nav style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #e5e7eb' }}>
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'feeds', label: 'Feeds' },
            { id: 'jobs', label: 'Active Jobs' },
            { id: 'add-feed', label: 'Add Feed' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.75rem 1rem',
                border: 'none',
                background: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                color: activeTab === tab.id ? '#3b82f6' : '#6b7280',
                fontWeight: activeTab === tab.id ? '600' : '400',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main>
        {activeTab === 'dashboard' && <Dashboard user={user} />}
        {activeTab === 'feeds' && <FeedsList user={user} />}
        {activeTab === 'jobs' && <ActiveJobs user={user} />}
        {activeTab === 'add-feed' && <AddFeedForm user={user} onFeedAdded={() => setActiveTab('feeds')} />}
      </main>
    </div>
  );
}