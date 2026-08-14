import express from 'express';

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(express.json());

// Health check — used by deployment platforms and uptime monitors.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route — confirms the server is up.
app.get('/', (_req, res) => {
  res.json({ message: 'Essential Service Marketplace API' });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});