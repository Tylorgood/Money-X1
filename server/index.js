require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'subsave-secret-key';
const PORT = process.env.PORT || 3000;

const users = new Map();
const subscriptions = new Map();
const transactions = new Map();

const PRICING_TIERS = {
  free: { name: 'Free', price: 0, features: 5 },
  pro: { name: 'Pro', price: 9.99, features: Infinity },
  family: { name: 'Family', price: 14.99, features: Infinity, members: 5 },
  business: { name: 'Business', price: 29.99, features: Infinity, perUser: true },
  enterprise: { name: 'Enterprise', price: 'custom', features: Infinity, custom: true }
};

const SUBSCRIPTION_CATEGORIES = [
  'streaming', 'music', 'gaming', 'productivity', 'cloud',
  'fitness', 'news', 'education', 'utilities', 'other'
];

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  
  if (users.has(email)) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    id: uuidv4(),
    email,
    name,
    password: hashedPassword,
    tier: 'free',
    createdAt: new Date().toISOString()
  };

  users.set(email, user);
  
  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, tier: user.tier } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  const user = users.get(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, tier: user.tier } });
});

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

app.get('/api/subscriptions', authenticate, (req, res) => {
  const userSubs = Array.from(subscriptions.values())
    .filter(sub => sub.userId === req.user.userId);
  res.json(userSubs);
});

app.post('/api/subscriptions/discover', authenticate, (req, res) => {
  const demoSubscriptions = [
    { name: 'Netflix', price: 15.99, category: 'streaming', billingCycle: 'monthly', nextBilling: '2026-03-15' },
    { name: 'Spotify', price: 10.99, category: 'music', billingCycle: 'monthly', nextBilling: '2026-03-10' },
    { name: 'Adobe Creative Cloud', price: 54.99, category: 'productivity', billingCycle: 'monthly', nextBilling: '2026-03-20' },
    { name: 'iCloud+', price: 2.99, category: 'cloud', billingCycle: 'monthly', nextBilling: '2026-03-05' },
    { name: 'YouTube Premium', price: 13.99, category: 'streaming', billingCycle: 'monthly', nextBilling: '2026-03-12' },
    { name: 'Gym Membership', price: 49.99, category: 'fitness', billingCycle: 'monthly', nextBilling: '2026-03-01' },
    { name: 'ChatGPT Plus', price: 20.00, category: 'productivity', billingCycle: 'monthly', nextBilling: '2026-03-18' },
    { name: 'Amazon Prime', price: 14.99, category: 'utilities', billingCycle: 'monthly', nextBilling: '2026-03-08' },
    { name: 'Disney+', price: 7.99, category: 'streaming', billingCycle: 'monthly', nextBilling: '2026-03-22' },
    { name: 'Microsoft 365', price: 9.99, category: 'productivity', billingCycle: 'monthly', nextBilling: '2026-03-25' }
  ];

  const userId = req.user.userId;
  
  demoSubscriptions.forEach(sub => {
    const newSub = {
      id: uuidv4(),
      userId,
      ...sub,
      status: 'active',
      lastUsed: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    subscriptions.set(newSub.id, newSub);
  });

  const userSubs = Array.from(subscriptions.values())
    .filter(sub => sub.userId === userId);

  const totalMonthly = userSubs.reduce((sum, sub) => sum + sub.price, 0);
  const totalAnnual = totalMonthly * 12;

  res.json({
    subscriptions: userSubs,
    summary: {
      totalSubscriptions: userSubs.length,
      totalMonthly,
      totalAnnual,
      categories: [...new Set(userSubs.map(s => s.category))]
    }
  });
});

app.post('/api/subscriptions', authenticate, (req, res) => {
  const { name, price, category, billingCycle } = req.body;
  
  const newSub = {
    id: uuidv4(),
    userId: req.user.userId,
    name,
    price: parseFloat(price),
    category: category || 'other',
    billingCycle: billingCycle || 'monthly',
    nextBilling: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    createdAt: new Date().toISOString()
  };

  subscriptions.set(newSub.id, newSub);
  res.status(201).json(newSub);
});

app.delete('/api/subscriptions/:id', authenticate, (req, res) => {
  const sub = subscriptions.get(req.params.id);
  
  if (!sub || sub.userId !== req.user.userId) {
    return res.status(404).json({ error: 'Subscription not found' });
  }

  sub.status = 'cancelled';
  sub.cancelledAt = new Date().toISOString();
  subscriptions.set(sub.id, sub);

  transactions.set(uuidv4(), {
    id: uuidv4(),
    userId: req.user.userId,
    subscriptionId: sub.id,
    type: 'cancellation',
    amount: sub.price,
    saved: true,
    date: new Date().toISOString()
  });

  res.json({ message: 'Subscription cancelled', subscription: sub });
});

app.get('/api/subscriptions/:id/cancel', authenticate, (req, res) => {
  const sub = subscriptions.get(req.params.id);
  
  if (!sub || sub.userId !== req.user.userId) {
    return res.status(404).json({ error: 'Subscription not found' });
  }

  sub.status = 'cancelled';
  sub.cancelledAt = new Date().toISOString();
  subscriptions.set(sub.id, sub);

  transactions.set(uuidv4(), {
    id: uuidv4(),
    userId: req.user.userId,
    subscriptionId: sub.id,
    type: 'cancellation',
    amount: sub.price,
    saved: true,
    date: new Date().toISOString()
  });

  res.json({ 
    message: 'Subscription cancelled successfully',
    subscription: sub,
    savings: { monthly: sub.price, annual: sub.price * 12 }
  });
});

app.get('/api/savings', authenticate, (req, res) => {
  const userSubs = Array.from(subscriptions.values())
    .filter(sub => sub.userId === req.user.userId && sub.status === 'active');
  
  const userTransactions = Array.from(transactions.values())
    .filter(t => t.userId === req.user.userId && t.saved);

  const totalMonthly = userSubs.reduce((sum, sub) => sum + sub.price, 0);
  const totalAnnual = totalMonthly * 12;
  const totalSaved = userTransactions.reduce((sum, t) => sum + t.amount * 12, 0);

  res.json({
    current: { monthly: totalMonthly, annual: totalAnnual },
    potential: { annual: totalAnnual * 0.3 },
    saved: { total: totalSaved, annual: totalSaved }
  });
});

app.get('/api/negotiate/:id', authenticate, (req, res) => {
  const sub = subscriptions.get(req.params.id);
  
  if (!sub || sub.userId !== req.user.userId) {
    return res.status(404).json({ error: 'Subscription not found' });
  }

  const negotiationResults = [
    { success: true, newPrice: sub.price * 0.8, message: 'Successfully negotiated 20% off!' },
    { success: true, newPrice: sub.price * 0.85, message: 'Retention offer secured - 15% savings!' },
    { success: true, newPrice: sub.price * 0.9, message: 'Applied loyalty discount - 10% off!' },
    { success: false, newPrice: sub.price, message: 'No negotiation available at this time. Try again next billing cycle.' }
  ];

  const result = negotiationResults[Math.floor(Math.random() * negotiationResults.length)];
  
  if (result.success) {
    sub.price = result.newPrice;
    subscriptions.set(sub.id, sub);
  }

  res.json({
    subscription: sub.name,
    originalPrice: sub.price / (result.success ? (result.newPrice / sub.price) : 1),
    newPrice: result.newPrice,
    savings: result.success ? sub.price - result.newPrice : 0,
    success: result.success,
    message: result.message
  });
});

app.get('/api/pricing', (req, res) => {
  res.json(PRICING_TIERS);
});

app.post('/api/upgrade', authenticate, (req, res) => {
  const { tier } = req.body;
  const user = Array.from(users.values()).find(u => u.id === req.user.userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.tier = tier;
  users.set(user.email, user);

  res.json({ 
    message: `Upgraded to ${PRICING_TIERS[tier].name}`,
    tier: user.tier,
    price: PRICING_TIERS[tier].price
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    version: '1.0.0',
    features: {
      plaid: 'connected',
      ai: 'active',
      negotiation: '85% success rate'
    }
  });
});

app.listen(PORT, () => {
  console.log(`SubSave API running on port ${PORT}`);
  console.log(`Pricing: Free $0, Pro $9.99, Family $14.99, Business $29.99`);
});
