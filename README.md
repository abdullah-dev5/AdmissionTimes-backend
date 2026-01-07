# AdmissionTimes Backend

Backend service for managing admission times and scheduling for educational institutions.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Package Manager**: pnpm

## Prerequisites

- Node.js (v18 or higher)
- pnpm (v10 or higher)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/abdullah-dev5/AdmissionTimes-backend.git
cd admission-times-backend
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp env.example .env
# Edit .env with your configuration
```

## Development

Run the development server with hot reload:
```bash
pnpm dev
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

## Available Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build the TypeScript project
- `pnpm start` - Start the production server (requires build first)
- `pnpm type-check` - Type check without building

## Project Structure

```
admission-times-backend/
├── src/
│   ├── config/         # Configuration files
│   ├── controllers/    # Request handlers
│   ├── middleware/     # Custom middleware
│   ├── models/         # Data models
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── utils/          # Utility functions
│   └── index.ts        # Application entry point
├── project-docs/       # Project documentation
├── dist/               # Compiled JavaScript (generated)
└── tests/              # Test files
```

## API Endpoints

### Health Check
- `GET /health` - Check if the server is running

## Environment Variables

See `env.example` for all available environment variables.

## Documentation

Project documentation is available in the `project-docs/` directory.

## License

ISC
