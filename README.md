# LCGC Procurement ERP System

A modern, attractive Next.js 16 enterprise resource planning (ERP) system for procurement management. The application features a professional dashboard, RFQ management, purchase order tracking, vendor management, and multi-level approval workflows.

## Features

### Core Modules

- **Dashboard**: Real-time KPIs, procurement analytics, activity trends, and key metrics
- **RFQ Management**: Create, manage, and track requests for quotation with budget tracking
- **Purchase Orders**: Full PO lifecycle management with line item tracking and financial oversight
- **Vendor Management**: Comprehensive vendor database with ratings, contact information, and performance metrics
- **Approval Workflows**: Multi-level approval system with status tracking and audit trails
- **Settings**: User preferences, security settings, and notification management

### Design Highlights

- **Professional Theme**: Deep teal/blue primary colors with thoughtful accent colors (cyan, emerald, amber)
- **Responsive Layout**: Mobile-first design with adaptive layouts for all screen sizes
- **Dark Mode Support**: Full dark mode with semantic color tokens
- **Interactive Charts**: Recharts integration for KPI visualization and trend analysis
- **Smooth Animations**: Fade-in and slide-up animations for enhanced UX
- **Accessibility**: Semantic HTML, ARIA labels, and keyboard navigation support

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI Library**: Tailwind CSS v4 with custom theme
- **State Management**: Zustand for client-side state
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
.
├── app/
│   ├── layout.tsx                 # Root layout
│   ├── globals.css                # Global styles and theme
│   ├── page.tsx                   # Home page (redirects to dashboard)
│   └── dashboard/
│       ├── layout.tsx             # Dashboard layout with sidebar
│       ├── page.tsx               # Dashboard home
│       ├── rfq/
│       │   └── page.tsx           # RFQ Management
│       ├── po/
│       │   └── page.tsx           # Purchase Orders
│       ├── approvals/
│       │   └── page.tsx           # Approval Queue
│       ├── vendors/
│       │   └── page.tsx           # Vendor Management
│       └── settings/
│           └── page.tsx           # Settings
├── components/
│   ├── sidebar.tsx                # Navigation sidebar
│   ├── header.tsx                 # Top header
│   └── ui/
│       └── card.tsx               # Card components
├── lib/
│   ├── store.ts                   # Zustand state management
│   └── utils.ts                   # Utility functions
├── tailwind.config.ts             # Tailwind configuration
├── tsconfig.json                  # TypeScript configuration
└── package.json                   # Dependencies
```

## Color System

The application uses a carefully selected 5-color palette:

- **Primary**: Deep Teal (#1e5a6b) - Main brand color for interactive elements
- **Secondary**: Slate Blue (#2d5982) - Secondary actions and highlights
- **Accent**: Cyan (#06a0d8) - Links, hover states, and accents
- **Success**: Emerald (#22c55e) - Positive status indicators
- **Warning/Destructive**: Amber/Red - Status alerts and critical actions

Additional neutrals include white, grays, and blacks for text and backgrounds.

## Key Components

### Dashboard
Displays real-time KPIs with cards showing:
- Active RFQs and Purchase Orders
- Active Vendors count
- Total spending with trends
- Procurement Activity chart (6-month trend)
- Spend Distribution pie chart
- Recent RFQs and Pending Approvals lists

### RFQ Management
Features include:
- Search and filter by status
- Detailed RFQ table with budgets and due dates
- RFQ card view with line items
- Create, Edit, Delete functionality

### Purchase Orders
Comprehensive PO tracking with:
- Quick stats (Total, Pending, Approved)
- Searchable PO list
- Detailed PO cards with approval timeline
- Item-level breakdown
- Financial tracking

### Vendor Management
Vendor directory featuring:
- Vendor cards with ratings
- Contact information and location
- Performance metrics
- Order history
- Status indicators (Active/Inactive/Blocked)

### Approval Workflows
Multi-step approval system with:
- Approval queue dashboard
- Timeline visualization of approval steps
- Approve/Reject actions
- Comment functionality
- Audit trail with timestamps

## Customization

### Theme Colors

Edit `/app/globals.css` to customize colors:

```css
:root {
  --color-primary: #1e5a6b;
  --color-accent: #06a0d8;
  --color-success: #22c55e;
  /* ... other colors */
}
```

### Adding New Pages

1. Create a new directory under `app/dashboard/`
2. Add a `page.tsx` component
3. Add navigation link in `components/sidebar.tsx`

### Modifying the Data

Edit `lib/store.ts` to update mock data or connect to a real API.

## Performance

- Next.js Turbopack for fast builds
- Tree-shaking and code splitting
- Optimized images with next/image
- CSS-in-JS optimization
- TypeScript for type safety

## Deployment

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

### Deploy to other platforms

1. Build the project: `npm run build`
2. Deploy the `.next` folder
3. Set environment variables as needed

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Development Guidelines

- Use semantic HTML elements
- Follow Tailwind CSS best practices
- Keep components focused and reusable
- Use TypeScript for type safety
- Add error boundaries for fault tolerance

## License

Commercial - LCGC Inc

## Support

For issues or questions, contact the development team.

---

Built with ❤️ using Next.js, TypeScript, and Tailwind CSS
