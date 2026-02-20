# MBC Reservation: Product, Pricing & Deployment Guide

## 1. Project Overview & Commercial Value
MBC Reservation is a premium, high-aesthetic table reservation system designed for high-end restaurants. Unlike generic solutions, it offers:
- **Real-time Floor Plan Visualisation**: High-performance interactive SVG map.
- **Intelligent Table Clustering**: BFS-based algorithm that automatically combines adjacent tables for large groups.
- **Micro-animation UX**: Built with Framer Motion for a "luxury" feel that converts users.
- **Multi-language Support**: French, English, and Italian natively integrated.

---

## 2. Infrastructure & Cost Analysis (SaaS Model)

To host this for a client, the following "Production Ready" stack is recommended. All have generous free tiers for initial rollout.

| Service | Purpose | Recommended Plan | Estimated Cost |
| :--- | :--- | :--- | :--- |
| **Vercel** | Frontend (React/Vite) | Pro (for teams) | $20 / month |
| **Render** | Backend (Node.js/Express) | Starter ($7/mo) | $7 / month |
| **Aiven.io** | Managed PostgreSQL | Free / Hobby | $0 - $15 / month |
| **Resend** | Transactional Emails | Free (3k/mo) | $0 / month |
| **Total Fixed Costs** | | | **~$27 / month** |

### Implementation Details:
- **Vercel**: Handles the frontend globally with CDN edge caching. 
- **Console.aiven.io**: Provides a managed PostgreSQL instance with backups. (Note: Aiven has a solid free tier for small DBs).
- **Render**: Best for hosting the continuous Node server. Avoid "Free" tier for production as it "sleeps" and causes 30s delays.
- **Resend**: Chosen for high deliverability and easy API integration for confirmation/feedback emails.

---

## 3. Selling Strategy: "The Premium Edge"

When selling to restaurant owners, focus on **Revenue Protection** and **Brand Image**:

1. **Anti-No-Show**: Integrated Turnstile verification and automated email reminders.
2. **Optimized Occupancy**: The clustering algorithm ensures you don't waste 4-seaters on 2-person groups if a 2-seater is available nearby.
3. **No Commission**: Unlike TheFork or Zomato, you don't pay $2 per guest. One fixed fee.
4. **Data Ownership**: The restaurant owns their guest database (GDPR compliant).

---

## 4. Facturation (Billing Model)

### A. Subscription Model (Recommended)
Charge a flat monthly fee for access to the dashboard.
- **Standard**: $99/mo (Includes hosting + priority support).
- **Enterprise**: $249/mo (Includes custom floor plan design + API access).

### B. Setup Fee
One-time setup fee ($500 - $1,500) to:
- Digitalize their restaurant floor plan into SVG.
- Configure their specific table IDs and capacities.
- Integrate their DNS (e.g., `booking.restaurant-name.com`).

---

## 5. Automated Billing Integration
To automate this, the following steps are recommended:
1. **Stripe Billing**: Create a "Product" in Stripe with a recurring Monthly Price.
2. **Customer Portal**: Use Stripe's pre-built portal to let restaurants manage their own credit cards.
3. **Webhooks**: Listen for `invoice.paid` events in the Backend to toggle the `isActive` status of a restaurant's account.

---

## 6. Deployment Checklist for New Clients
1. [ ] Clone Backend & Frontend.
2. [ ] Provision PG Database on Aiven.
3. [ ] Register Domain/Sender on Resend.
4. [ ] Upload SVG Floor Plan to `/src/utils/floorPlanData.ts`.
5. [ ] Set Environment Variables:
   - `DATABASE_URL`
   - `RESEND_API_KEY`
   - `FRONTEND_URL`
   - `JWT_ACCESS_SECRET`
