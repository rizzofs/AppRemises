# Backend Setup Instructions

## Environment Configuration

To run the backend server, you need to create a `.env` file in the `backend` directory with the following content:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/app_remises"

# JWT
JWT_SECRET="your-super-secret-jwt-key-here-change-this-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-here-change-this-in-production"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Server
PORT=3001
NODE_ENV="development"

# CORS
FRONTEND_URL="http://localhost:3000"
```

## Database Setup

1. Install PostgreSQL
2. Create a database named `app_remises`
3. Update the `DATABASE_URL` in the `.env` file with your database credentials
4. Run the following commands in the backend directory:

```bash
npm install
npx prisma generate
npx prisma db push
```

## Running the Backend

```bash
cd backend
npm run dev
```

## Demo Mode

The application is currently configured to run in **demo mode** which means:
- No backend server is required
- Uses hardcoded demo data
- All API calls return simulated data
- Perfect for testing and development

To use demo mode, simply log in with any of these credentials:
- **Admin**: admin@appremises.com / demo123
- **Coordinador**: coordinador@appremises.com / demo123
- **Dueño**: duenio@appremises.com / demo123
- **Cliente**: cliente@appremises.com / demo123
