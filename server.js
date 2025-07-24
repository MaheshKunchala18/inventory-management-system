const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { testConnection, sequelize } = require('./config/database');
require('./models');

// API route handlers
const productRoutes = require('./routes/products');
const alertRoutes = require('./routes/alerts');

// Create Express application
const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.'
    }
});
app.use('/api/', limiter);

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'StockFlow API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// API documentation endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'StockFlow Inventory Management API',
        version: '1.0.0',
        description: 'B2B Inventory Management System for StockFlow',
        endpoints: {
            health: 'GET /health',
            products: {
                create: 'POST /api/products',
                list: 'GET /api/products'
            },
            alerts: {
                lowStock: 'GET /api/companies/{company_id}/alerts/low-stock',
                summary: 'GET /api/companies/{company_id}/alerts/low-stock/summary'
            }
        },
        authentication: 'Bearer Token (JWT)',
        documentation: 'See SOLUTION_DOCUMENT.md for complete implementation details'
    });
});

// Mount routes
app.use(productRoutes);
app.use(alertRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    
    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(err.status || 500).json({
        error: 'Internal server error',
        message: isDevelopment ? err.message : 'Something went wrong',
        ...(isDevelopment && { stack: err.stack })
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        availableEndpoints: [
            'GET /health',
            'GET /api',
            'POST /api/products',
            'GET /api/products',
            'GET /api/companies/{company_id}/alerts/low-stock'
        ]
    });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    
    try {
        // Close database connections
        await sequelize.close();
        console.log('Database connections closed.');
        
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
};

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
    try {
        // Test database connection
        await testConnection();
        
        // Sync database models (create tables if they don't exist)
        await sequelize.sync({ force: false }); // Set to true to recreate tables
        console.log('Database models synchronized successfully.');
        
        // Start Express server
        const server = app.listen(PORT, () => {
            console.log('\nStockFlow API Server Started');
            console.log(`Server running on port ${PORT}`);
        });

        // Handle server errors
        server.on('error', (error) => {
            if (error.syscall !== 'listen') {
                throw error;
            }

            const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

            switch (error.code) {
                case 'EACCES':
                    console.error(`${bind} requires elevated privileges`);
                    process.exit(1);
                    break;
                case 'EADDRINUSE':
                    console.error(`${bind} is already in use`);
                    process.exit(1);
                    break;
                default:
                    throw error;
            }
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Start the application
startServer();

module.exports = app; 