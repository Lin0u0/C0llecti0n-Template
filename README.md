# 📚 C0llecti0n

A beautiful, personal media collection tracker built with [Astro](https://astro.build).  
Track your books, movies, TV series, and music albums in a stunning, interactive digital shelf.

## ✨ Features

- **Multi-Media Tracking**: Dedicated sections for **Library** (Books), **Cinema** (Movies & Series), and **Concert Hall** (Music).
- **Beautiful Design**: Modern, glassmorphism-inspired UI with smooth animations.
- **Theme Support**: Seamless **Light/Dark mode** switching.
- **Interactive Shelf**: Visual "Book Spines" and "CD Drawers" that feel like a real collection.
- **Smart Filters**: Filter your collection by Status (Reading/Watching), Country, Artist, Year, and more.
- **Global Search**: Quick search with Cmd+K / Ctrl+K keyboard shortcut.
- **Admin Panel**: A built-in management interface (`/admin`) to easily Add, Edit, and Delete items without touching code.
- **Zero-Database**: All data is stored in simple, portable JSON files.

## 🛠️ Tech Stack

- **Framework**: [Astro 5](https://astro.build)
- **Styling**: Vanilla CSS (Variables, Flexbox/Grid, Animations)
- **Backend (Admin)**: Node.js (Custom file-system API)
- **Data**: JSON

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Available environment variables:
- `ADMIN_KEY` - Access key for admin panel
- `ADMIN_API_URL` - Admin API server URL (default: http://localhost:4322/api)
- `ADMIN_API_PORT` - Admin API server port (default: 4322)

### Running Locally

To run the full application (Frontend + Admin API), you need two terminal instances:

1. **Start the Admin API Server** (Handles data modifications):
   ```bash
   npm run admin-server
   ```
   > Server runs on `http://localhost:4322`

2. **Start the Astro Dev Server** (Frontend):
   ```bash
   npm run dev
   ```
   > Frontend runs on `http://localhost:4321`

Visit **[http://localhost:4321](http://localhost:4321)** to view your shelf.  
Visit **[http://localhost:4321/admin](http://localhost:4321/admin)** to manage your collection.

### Building for Production

```bash
npm run build
```

The output will be in the `dist/` directory.

To build without admin panel (for Vercel deployment):
```bash
npm run build:prod
```

## 📂 Project Structure

```text
/
├── admin-server.mjs  # Node.js server for handling JSON data updates
├── src/
│   ├── components/   # Reusable UI components (DiscDrawer, SearchButton, etc.)
│   ├── data/         # JSON data files (books, movies, series, music)
│   ├── layouts/      # Page layouts
│   ├── pages/        # App routes
│   │   ├── admin/    # Admin panel
│   │   ├── index.astro
│   │   ├── library.astro
│   │   ├── cinema.astro
│   │   └── concert-hall.astro
│   ├── scripts/      # Client-side JavaScript utilities
│   ├── styles/       # Global styles & animations
│   ├── types/        # TypeScript type definitions
│   └── utils/        # Utility functions
└── public/           # Static assets
```

## 📝 Data Management

Data is stored in `src/data/`:
- `books.json`
- `movies.json`
- `series.json`
- `music.json`

You can edit these directly or use the **Admin Panel** running locally.

### Data Validation

The admin server validates all incoming data:
- Required fields check
- Type validation (string, number, date, URL)
- Range validation (e.g., rating 1-10, year 1000-2100)
- Enum validation for status fields

### Data Types

See `src/types/index.ts` for all TypeScript interfaces:
- `Book` - Books with author, publisher, platform
- `Album` - Music with artist, genre
- `Movie` / `Series` - Video media with director, genre

## 🔧 Development

### Code Organization

- **Components**: Use shared types from `src/types/index.ts`
- **Filters**: Filter/sort logic is in `src/utils/filters.ts` and `src/scripts/filter-system.ts`
- **Pages**: Library, Cinema, and Concert Hall share the same filter system

### Styling

- CSS variables defined in `src/styles/global.css`
- Animations in `src/styles/animations.css`
- Component-specific styles use `<style>` tags

## 📄 License

© 2025 Lin0u0. All rights reserved.

Originally Designed by [DOU.OS](https://isdou.info/)
