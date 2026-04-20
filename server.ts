import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Plaid setup
  const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID?.trim();
  const PLAID_SECRET = process.env.PLAID_SECRET?.trim();
  const PLAID_ENV = (process.env.PLAID_ENV || 'sandbox').trim().toLowerCase();
  const PLAID_PRODUCTS = (process.env.PLAID_PRODUCTS || 'transactions')
    .split(',')
    .map(p => p.trim().toLowerCase())
    .map(p => p === 'transcations' ? 'transactions' : p) as Products[];
  const PLAID_COUNTRY_CODES = (process.env.PLAID_COUNTRY_CODES || 'US').split(',').map(c => c.trim()) as CountryCode[];

  console.log('--- Plaid Config Diagnostic ---');
  console.log('Environment:', PLAID_ENV);
  console.log('Client ID length:', PLAID_CLIENT_ID?.length || 0);
  console.log('Secret length:', PLAID_SECRET?.length || 0);
  if (PLAID_CLIENT_ID) console.log('CID Preview:', `${PLAID_CLIENT_ID.slice(0, 5)}...${PLAID_CLIENT_ID.slice(-5)}`);
  if (PLAID_SECRET) console.log('Secret Preview:', `${PLAID_SECRET.slice(0, 5)}...${PLAID_SECRET.slice(-5)}`);
  
  if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
    console.warn('CRITICAL: Plaid credentials missing from environment variables.');
  }
  console.log('-------------------------------');

  const configuration = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV as keyof typeof PlaidEnvironments],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
        'PLAID-SECRET': PLAID_SECRET,
      },
    },
  });

  const client = new PlaidApi(configuration);

  // Validate credentials on startup
  try {
    console.log('Self-test: Validating Plaid credentials...');
    await client.linkTokenCreate({
      user: { client_user_id: 'startup-check' },
      client_name: 'Ledge App',
      products: PLAID_PRODUCTS,
      country_codes: PLAID_COUNTRY_CODES,
      language: 'en',
    });
    console.log('✅ Plaid validation SUCCESSFUL. Credentials are valid.');
  } catch (error: any) {
    console.error('❌ Plaid validation FAILED during startup!');
    console.error('Check your PLAID_CLIENT_ID and PLAID_SECRET in the Secrets panel.');
    if (error.response?.data) {
      console.error('Plaid Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error Message:', error.message);
    }
  }

  // In-memory store for demo purposes (In a real app, use a database)
  let ACCESS_TOKEN: string | null = null;
  let ITEM_ID: string | null = null;

  // Create link token
  app.post('/api/create_link_token', async (req, res) => {
    try {
      if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
        return res.status(400).json({ 
          error: 'Plaid credentials not configured',
          detail: `CID length: ${PLAID_CLIENT_ID?.length || 0}, Secret length: ${PLAID_SECRET?.length || 0}`
        });
      }

      const configs: any = {
        user: { client_user_id: 'user-id' },
        client_name: 'Plaid Personal Finance',
        products: PLAID_PRODUCTS,
        country_codes: PLAID_COUNTRY_CODES,
        language: 'en',
      };

      const response = await client.linkTokenCreate(configs);
      res.json(response.data);
    } catch (error: any) {
      console.error('Error creating link token:', error.response?.data || error.message);
      res.status(500).json({ 
        error: error.response?.data || error.message,
        diagnostic: {
          env: PLAID_ENV,
          cid_len: PLAID_CLIENT_ID?.length,
          secret_len: PLAID_SECRET?.length,
          cid_p: PLAID_CLIENT_ID ? `${PLAID_CLIENT_ID.slice(0, 5)}...${PLAID_CLIENT_ID.slice(-5)}` : 'none',
          sec_p: PLAID_SECRET ? `${PLAID_SECRET.slice(0, 5)}...${PLAID_SECRET.slice(-5)}` : 'none'
        }
      });
    }
  });

  // Exchange public token
  app.post('/api/exchange_public_token', async (req, res) => {
    try {
      const { public_token } = req.body;
      const response = await client.itemPublicTokenExchange({
        public_token,
      });
      ACCESS_TOKEN = response.data.access_token;
      ITEM_ID = response.data.item_id;
      res.json({ status: 'success' });
    } catch (error: any) {
      console.error('Error exchanging public token:', error.response?.data || error.message);
      res.status(500).json({ error: error.response?.data || error.message });
    }
  });

  // Get balance
  app.get('/api/accounts', async (req, res) => {
    try {
      if (!ACCESS_TOKEN) return res.status(401).json({ error: 'Not connected' });
      const response = await client.accountsBalanceGet({
        access_token: ACCESS_TOKEN,
      });
      res.json(response.data);
    } catch (error: any) {
      console.error('Error getting balance:', error.response?.data || error.message);
      res.status(500).json({ error: error.response?.data || error.message });
    }
  });

  // Get transactions
  app.get('/api/transactions', async (req, res) => {
    try {
      if (!ACCESS_TOKEN) return res.status(401).json({ error: 'Not connected' });
      
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);

      const response = await client.transactionsGet({
        access_token: ACCESS_TOKEN,
        start_date: thirtyDaysAgo.toISOString().split('T')[0],
        end_date: now.toISOString().split('T')[0],
      });
      res.json(response.data);
    } catch (error: any) {
      console.error('Error getting transactions:', error.response?.data || error.message);
      res.status(500).json({ error: error.response?.data || error.message });
    }
  });

  // Reset connection (for demo)
  app.post('/api/reset', (req, res) => {
    ACCESS_TOKEN = null;
    ITEM_ID = null;
    res.json({ status: 'success' });
  });

  // Check connection status
  app.get('/api/status', (req, res) => {
    res.json({ connected: !!ACCESS_TOKEN });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
