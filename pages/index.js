export default function Home() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Feed Import Dashboard</h1>
      <p>Simple version without Firebase</p>
      <div style={{ marginTop: '2rem' }}>
        <h2>This is working!</h2>
        <p>Deployment successful at {new Date().toISOString()}</p>
      </div>
    </div>
  );
}