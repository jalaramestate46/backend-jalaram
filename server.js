const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const { errorHandler, notFound } = require('./src/middleware/errorMiddleware');

const userRoutes = require('./src/routes/userRoutes');
const propertyRoutes = require('./src/routes/propertyRoutes');
const projectRoutes = require('./src/routes/projectRoutes');
const inquiryRoutes = require('./src/routes/inquiryRoutes');
const reviewRoutes = require('./src/routes/reviewRoutes');
const contentRoutes = require('./src/routes/contentRoutes');
const favoriteRoutes = require('./src/routes/favoriteRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Configure EJS view engine for backend dashboard
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// CORS configuration supporting credentials and custom ports
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Request loggers & parsers
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static folder configuration for uploaded local files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Main API Router Mount
app.use('/api/users', userRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/favorites', favoriteRoutes);

// Mount Admin Web Panel Dashboard Router
app.use('/admin', dashboardRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const { isConfigured } = require('./src/config/supabaseClient');
  res.status(200).json({
    success: true,
    message: 'Backend API is running.',
    timestamp: new Date(),
    supabaseConfigured: isConfigured
  });
});

// Fallback Middlewares
app.use(notFound);
app.use(errorHandler);

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}

module.exports = app;
