# 📚 C0llecti0n

A beautiful, personal media collection tracker built with [Astro](https://astro.build).  
Track your books, movies, TV series, and music albums in a stunning, interactive digital shelf.

## ✨ Features

- **Multi-Media Tracking**: Dedicated sections for **Library** (Books), **Cinema** (Movies & Series), and **Concert Hall** (Music).
- **Beautiful Design**: Modern, glassmorphism-inspired UI with smooth animations.
- **Theme Support**: Seamless **Light/Dark mode** switching.
- **Interactive Shelf**: Visual "Book Spines" and "CD Drawers" that feel like a real collection.
- **Smart Filters**: Filter your collection by Status (Reading/Watching), Country, Artist, Year, and more.
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
│   └── styles/       # Global styles & animations
└── public/           # Static assets
```

## 📝 Data Management

Data is stored in `src/data/`:
- `books.json`
- `movies.json`
- `series.json`
- `music.json`

You can edit these directly or use the **Admin Panel** running locally.
