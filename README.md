# SubSave - AI Subscription Management

## Setup

1. Install dependencies:
```bash
cd subsave
npm install
```

2. Configure environment:
```bash
cp .env.example .env
```

3. Start the server:
```bash
npm start
```

4. Open http://localhost:3000

## Features

- **Bank API Integration**: Plaid + Stripe
- **Subscription Auto-Discovery**: Find all your subscriptions
- **AI Negotiation**: Automatically negotiate better rates
- **One-Click Cancellation**: Cancel with a single click
- **Family Plans**: Share with up to 5 family members
- **Business Dashboard**: Team management for enterprises

## Pricing

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | 5 subscriptions |
| Pro | $9.99/mo | Unlimited + AI |
| Family | $14.99/mo | 5 members |
| Business | $29.99/user | Team features |

## API Endpoints

- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/subscriptions` - List subscriptions
- `POST /api/subscriptions/discover` - Auto-discover
- `DELETE /api/subscriptions/:id` - Cancel subscription
- `GET /api/subscriptions/:id/cancel` - Quick cancel
- `GET /api/negotiate/:id` - AI negotiation
- `GET /api/savings` - View savings
- `GET /api/pricing` - View pricing tiers
- `POST /api/upgrade` - Upgrade plan

## Tech Stack

- Backend: Node.js + Express
- Auth: JWT + bcrypt
- Database: In-memory (production: PostgreSQL)
- Integration: Plaid API, Stripe API
