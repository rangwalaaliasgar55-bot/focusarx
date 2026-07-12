# Tech Stack
- React with TypeScript for frontend
- React Router for navigation
- Drizzle ORM with PostgreSQL for database
- Node.js/Express for backend API server
- shadcn/ui library for UI components
- Tailwind CSS for styling
- pnpm as package manager
- Custom libraries for business logic (api-client-react, focusarx, etc.)

# Library Usage Rules
1. Always use shadcn/ui components for UI elements (never modify existing ones)
2. Use Tailwind CSS exclusively for styling with class-based utilities
3. Keep API layer in lib/api-client-react with generated schemas
4. Database operations must go through Drizzle ORM
5. Business logic should reside in designated lib/ directories
6. New components should be created in src/components/ directory
7. Maintain TypeScript strictness across all files
8. Use pnpm for all package management
9. Keep API routes in artifacts/api-server/src/routes/
10. Never edit core shadcn/ui files - create new components when needed