import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { usePlaidLink } from 'react-plaid-link';
import { 
  LayoutDashboard, 
  ArrowRightLeft, 
  CreditCard, 
  TrendingUp, 
  AlertCircle,
  Plus,
  RefreshCw,
  Power,
  ChevronRight,
  DollarSign,
  Settings,
  PieChart,
  LogOut,
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { cn } from './lib/utils';

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <div 
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200",
      active 
        ? "bg-zinc-800 text-white shadow-sm" 
        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
    )}
  >
    <Icon className={cn("w-5 h-5", active ? "text-emerald-500" : "opacity-70")} />
    <span className="font-medium">{label}</span>
  </div>
);

const StatCard = ({ title, value, change, trend = 'up' }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="card-dark p-6 rounded-2xl flex flex-col justify-between"
  >
    <div>
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-1">{title}</p>
      <h3 className="text-3xl font-light stat-value text-white">{value}</h3>
    </div>
    <div className="mt-4 flex items-center gap-2">
      <span className={cn(
        "text-xs font-semibold px-2 py-0.5 rounded-full",
        trend === 'up' ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"
      )}>
        {change}
      </span>
      <span className="text-[10px] text-zinc-500 font-medium">vs last month</span>
    </div>
  </motion.div>
);

const TransactionRow = ({ transaction }: any) => {
  const isNegative = transaction.amount > 0;
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="group hover:bg-zinc-800/30 transition-colors border-b border-zinc-800/50 last:border-0"
    >
      <div className="flex items-center justify-between p-4 px-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-zinc-800/50 rounded-xl flex items-center justify-center border border-zinc-700/50">
            <DollarSign className="w-5 h-5 text-zinc-400" />
          </div>
          <div>
            <p className="font-semibold text-zinc-100 line-clamp-1">{transaction.name}</p>
            <p className="text-xs text-zinc-500">{format(new Date(transaction.date), 'MMM dd, yyyy')} • {transaction.account_id.slice(-4)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn(
            "font-bold text-base stat-value",
            isNegative ? "text-zinc-200" : "text-emerald-500"
          )}>
            {isNegative ? '-' : '+'}${Math.abs(transaction.amount).toFixed(2)}
          </p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mt-0.5">{transaction.category?.[0] || 'General'}</p>
        </div>
      </div>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('Dashboard');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get('/api/status');
      setConnected(res.data.connected);
      if (res.data.connected) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createLinkToken = useCallback(async () => {
    try {
      const res = await axios.post('/api/create_link_token');
      setLinkToken(res.data.link_token);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to initialize Plaid');
    }
  }, []);

  const onPlaidSuccess = useCallback(async (public_token: string) => {
    try {
      setLoading(true);
      await axios.post('/api/exchange_public_token', { public_token });
      setConnected(true);
      await fetchData();
    } catch (err) {
      setError('Failed to connect bank account');
    } finally {
      setLoading(false);
    }
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken!,
    onSuccess: onPlaidSuccess,
  });

  const fetchData = async () => {
    try {
      setError(null);
      const [accRes, transRes] = await Promise.all([
        axios.get('/api/accounts'),
        axios.get('/api/transactions')
      ]);
      setAccounts(accRes.data.accounts);
      setTransactions(transRes.data.transactions);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch financial data');
    }
  };

  const handleReset = async () => {
    try {
      await axios.post('/api/reset');
      setConnected(false);
      setAccounts([]);
      setTransactions([]);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatus();
    createLinkToken();
  }, [fetchStatus, createLinkToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw className="w-10 h-10 text-emerald-500" />
        </motion.div>
      </div>
    );
  }

  const totalBalance = accounts.reduce((acc, curr) => acc + (curr.balances.current || 0), 0);

  const renderDashboard = () => (
    <div className="space-y-10">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Net Liquidity" 
          value={`$${totalBalance.toLocaleString()}`} 
          change="+4.2%" 
          trend="up"
        />
        <StatCard 
          title="Monthly Spending" 
          value="$3,421.00" 
          change="-12.5%" 
          trend="down"
        />
        <StatCard 
          title="Savings Rate" 
          value="24.8%" 
          change="+1.5%" 
          trend="up"
        />
      </div>

      {/* Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Transactions List */}
        <div className="lg:col-span-3 card-dark rounded-3xl overflow-hidden flex flex-col min-h-0 shadow-xl shadow-black/20">
          <div className="px-6 py-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/10">
            <h3 className="font-bold text-zinc-100 uppercase text-xs tracking-widest">Recent Activity</h3>
            <button 
              onClick={() => setActiveTab('Transactions')}
              className="text-xs font-bold text-emerald-500 uppercase tracking-widest hover:text-emerald-400 transition-colors"
            >
              View All
            </button>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[500px]">
            {transactions.length > 0 ? (
              <div className="flex flex-col">
                {transactions.slice(0, 8).map((t) => (
                  <TransactionRow key={t.transaction_id} transaction={t} />
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-zinc-500 font-medium">No transactions found</div>
            )}
          </div>
        </div>

        {/* Categorization Sidebar */}
        <div className="lg:col-span-2 space-y-8">
          <section className="card-dark p-8 rounded-3xl">
            <h3 className="font-bold text-zinc-100 mb-8 uppercase text-xs tracking-widest">Spend Analytics</h3>
            <div className="space-y-8">
              {[
                { label: 'Housing', percent: 45, color: 'bg-emerald-500' },
                { label: 'Food & Dining', percent: 28, color: 'bg-zinc-100' },
                { label: 'Entertainment', percent: 12, color: 'bg-emerald-700' },
                { label: 'Other', percent: 15, color: 'bg-zinc-700' }
              ].map(cat => (
                <div key={cat.label}>
                  <div className="flex justify-between items-end text-sm mb-3">
                    <span className="font-medium text-zinc-400">{cat.label}</span>
                    <span className="font-bold text-zinc-100">{cat.percent}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      whileInView={{ width: `${cat.percent}%` }}
                      className={cn("h-full rounded-full shadow-[0_0_10px_rgba(16,185,129,0.2)]", cat.color)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="card-dark p-6 rounded-3xl bg-emerald-500/5 border-emerald-500/10">
            <div className="flex items-center gap-3 mb-3 text-emerald-500">
              <TrendingUp className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-widest">Smart Insight</span>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed font-medium">
              You saved <span className="text-white font-bold">$124</span> on subscriptions this month. Great progress!
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTransactionsView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-white tracking-tight">All Transactions</h2>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Search activity..." 
            className="card-dark px-4 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>
      <div className="card-dark rounded-3xl overflow-hidden shadow-2xl shadow-black/40">
        <div className="overflow-x-auto">
          {transactions.length > 0 ? (
            <div className="flex flex-col">
              {transactions.map((t) => (
                <TransactionRow key={t.transaction_id} transaction={t} />
              ))}
            </div>
          ) : (
            <div className="p-20 text-center text-zinc-500 font-medium">No transactions available to display.</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderAccountsView = () => (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-white tracking-tight">Linked Institutions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((account) => (
          <motion.div 
            key={account.account_id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-dark p-6 rounded-3xl hover:border-zinc-600 transition-colors group cursor-default"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="bg-zinc-800 p-3 rounded-2xl group-hover:bg-emerald-500 overflow-hidden transition-colors">
                <CreditCard className="w-6 h-6 text-zinc-400 group-hover:text-[#09090b] transition-colors" />
              </div>
              <span className="text-[10px] font-extrabold px-3 py-1 bg-zinc-800 text-zinc-400 rounded-full uppercase tracking-tighter">
                {account.subtype}
              </span>
            </div>
            <h4 className="text-lg font-bold text-zinc-100 mb-1">{account.name}</h4>
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500 font-medium tracking-widest uppercase">•••• {account.mask}</p>
              <p className="text-2xl font-light text-white stat-value">${account.balances.current?.toLocaleString()}</p>
            </div>
            <div className="mt-6 pt-6 border-t border-zinc-800 flex justify-between items-center">
              <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Available</span>
              <span className="text-sm font-bold text-emerald-500">${account.balances.available?.toLocaleString() || 'N/A'}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderCurrentView = () => {
    switch (activeTab) {
      case 'Transactions': return renderTransactionsView();
      case 'Accounts': return renderAccountsView();
      case 'Dashboard':
      default: return renderDashboard();
    }
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-[#fafafa] font-sans overflow-hidden">
      {/* Sidebar - Same as before but ensuring onClick works correctly */}
      <aside className="w-72 border-r border-zinc-800 flex flex-col h-full bg-[#09090b]">
        <div className="p-8 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer" onClick={() => setActiveTab('Dashboard')}>
              <Wallet className="w-5 h-5 text-[#09090b]" />
            </div>
            <span className="font-extrabold text-2xl tracking-tighter uppercase italic cursor-pointer" onClick={() => setActiveTab('Dashboard')}>Ledge</span>
          </div>

          <nav className="space-y-1">
            <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'Dashboard'} onClick={() => setActiveTab('Dashboard')} />
            <SidebarItem icon={ArrowRightLeft} label="Transactions" active={activeTab === 'Transactions'} onClick={() => setActiveTab('Transactions')} />
            <SidebarItem icon={PieChart} label="Analytics" active={activeTab === 'Analytics'} onClick={() => setActiveTab('Analytics')} />
            <SidebarItem icon={CreditCard} label="Accounts" active={activeTab === 'Accounts'} onClick={() => setActiveTab('Accounts')} />
            <SidebarItem icon={Settings} label="Settings" active={activeTab === 'Settings'} onClick={() => setActiveTab('Settings')} />
          </nav>

          <div className="mt-auto pt-6 space-y-4">
            <div className="card-dark p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 -mr-12 -mt-12 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors"></div>
              <div className="flex items-center justify-between mb-3 relative z-10">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">PLAID STATUS</span>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  connected ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-zinc-600"
                )}></div>
              </div>
              <p className="text-xs text-zinc-400 font-medium leading-relaxed relative z-10">
                {connected ? "Identity Synced" : "Auth Required"}
              </p>
              {connected ? (
                <button 
                  onClick={fetchData}
                  className="mt-4 w-full bg-zinc-800 py-2.5 text-[10px] font-bold rounded-xl hover:bg-zinc-700 transition-colors uppercase tracking-[0.2em] text-zinc-100 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              ) : (
                <button 
                  onClick={() => ready && open()}
                  disabled={!ready}
                  className="mt-4 w-full bg-emerald-600 py-2.5 text-[10px] font-bold rounded-xl hover:bg-emerald-500 transition-colors uppercase tracking-[0.2em] text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {ready ? 'Link Account' : 'Initializing...'}
                </button>
              )}
            </div>
            
            <button 
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 p-3 text-zinc-500 hover:text-rose-400 transition-colors group"
            >
              <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs font-semibold">Terminate Session</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#09090b]">
        {connected ? (
          <div className="flex-1 overflow-y-auto p-8 md:p-12">
        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex flex-col gap-2 text-rose-400 font-medium"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">
                {typeof error === 'object' ? (error as any).error_message || (error as any).error || JSON.stringify(error) : error}
              </span>
            </div>
            {(error as any).diagnostic && (
              <div className="ml-8 text-[10px] opacity-60 font-mono">
                Diagnostic: {JSON.stringify((error as any).diagnostic)}
              </div>
            )}
          </motion.div>
        )}

            {/* Dynamic View Rendering */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {renderCurrentView()}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
            {/* Visual background gradient blur */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none"></div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center max-w-2xl relative z-10"
            >
              <div className="w-20 h-20 bg-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-[0_0_50px_rgba(16,185,129,0.15)] ring-1 ring-emerald-400/20">
                <ArrowRightLeft className="w-10 h-10 text-[#09090b]" />
              </div>
              <h2 className="text-5xl font-bold tracking-tighter text-white mb-6 leading-tight">
                Your finances, <br/> <span className="text-emerald-500">fully unified.</span>
              </h2>
              <p className="text-lg text-zinc-500 font-medium mb-12 leading-relaxed">
                Unlock professional-grade analytics and unified transaction history by connecting your primary institution via Plaid securely.
              </p>
              
              <div className="flex flex-col items-center gap-6">
                <button 
                  onClick={() => ready && open()}
                  disabled={!ready}
                  className="w-full sm:w-80 px-8 py-5 bg-emerald-500 text-[#09090b] rounded-[1.25rem] font-bold text-lg hover:bg-emerald-400 transition-all shadow-[0_10px_30px_rgba(16,185,129,0.15)] hover:-translate-y-1 active:scale-[0.98] disabled:opacity-40 disabled:hover:translate-y-0"
                >
                  {ready ? 'Link Account' : 'Initializing Plugin...'}
                </button>
                
                {error && (
                  <p className="text-rose-500 text-sm font-bold bg-rose-500/10 px-4 py-2 rounded-lg border border-rose-500/20">
                    Configuration Error: Check your Plaid Secrets
                  </p>
                )}
                
                <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.3em] flex items-center gap-2">
                   <div className="w-1 h-1 rounded-full bg-zinc-700"></div> ENCRYPTED • 256-BIT • PRIVACY BY DESIGN
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}
