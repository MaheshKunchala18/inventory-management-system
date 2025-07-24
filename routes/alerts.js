const express = require('express');
const { sequelize } = require('../models');
const { auth } = require('../middleware/auth');
const router = express.Router();

/**
 * Get low-stock alerts for a company with sales velocity calculations
 * Filters products with recent sales activity and calculates days until stockout
 * based on 30-day sales average. Includes supplier contact information for reordering.
 */
router.get('/api/companies/:company_id/alerts/low-stock', auth, async (req, res) => {
    try {
        const { company_id } = req.params;
        const { page = 1, limit = 100 } = req.query;
        const offset = (page - 1) * limit;

        // Verify user has access to requested company data
        if (req.user.companyId !== parseInt(company_id)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'You do not have access to this company\'s data'
            });
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Query combines inventory levels, sales velocity, and supplier data
        const lowStockQuery = `
            SELECT DISTINCT
                p.id as product_id,
                p.name as product_name,
                p.sku,
                p.low_stock_threshold as product_threshold,
                pc.low_stock_threshold as category_threshold,
                w.id as warehouse_id,
                w.name as warehouse_name,
                i.quantity,
                i.reserved_quantity,
                (i.quantity - i.reserved_quantity) as current_stock,
                COALESCE(p.low_stock_threshold, pc.low_stock_threshold, 10) as threshold,
                s.id as supplier_id,
                s.name as supplier_name,
                s.contact_email as supplier_contact_email,
                s.lead_time_days as supplier_lead_time,
                -- Average daily sales over 30-day period for velocity calculation
                COALESCE(
                    (SELECT AVG(daily_sales.total_sold) 
                     FROM (
                         SELECT SUM(sd.quantity_sold) as total_sold
                         FROM sales_data sd 
                         WHERE sd.product_id = p.id 
                           AND sd.warehouse_id = w.id
                           AND sd.sale_date >= :thirtyDaysAgo
                         GROUP BY sd.sale_date
                     ) daily_sales), 
                     0
                ) as avg_daily_sales,
                -- Boolean flag for products with sales in last 30 days
                EXISTS(
                    SELECT 1 FROM sales_data sd2 
                    WHERE sd2.product_id = p.id 
                      AND sd2.warehouse_id = w.id
                      AND sd2.sale_date >= :thirtyDaysAgo
                ) as has_recent_sales
            FROM products p
            INNER JOIN inventory i ON p.id = i.product_id
            INNER JOIN warehouses w ON i.warehouse_id = w.id
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.company_id = :companyId
              AND p.is_active = true
              AND w.is_active = true
              AND w.company_id = :companyId
              -- Filter for items below their threshold (product > category > default 10)
              AND (i.quantity - i.reserved_quantity) <= COALESCE(p.low_stock_threshold, pc.low_stock_threshold, 10)
              -- Require recent sales activity to avoid stale inventory alerts
              AND EXISTS(
                  SELECT 1 FROM sales_data sd 
                  WHERE sd.product_id = p.id 
                    AND sd.warehouse_id = w.id
                    AND sd.sale_date >= :thirtyDaysAgo
              )
            ORDER BY (i.quantity - i.reserved_quantity) ASC
            LIMIT :limit OFFSET :offset
        `;

        const results = await sequelize.query(lowStockQuery, {
            type: sequelize.QueryTypes.SELECT,
            replacements: {
                companyId: parseInt(company_id),
                thirtyDaysAgo: thirtyDaysAgo.toISOString().split('T')[0],
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

        // Transform query results into API response format with stockout calculations
        const alerts = results.map(row => {
            const avgDailySales = parseFloat(row.avg_daily_sales) || 0;
            let daysUntilStockout;

            if (avgDailySales > 0) {
                daysUntilStockout = Math.floor(row.current_stock / avgDailySales);
            } else {
                // Default estimate when sales velocity cannot be calculated
                daysUntilStockout = row.current_stock > 0 ? 90 : 0;
            }

            daysUntilStockout = Math.max(0, daysUntilStockout);

            return {
                product_id: row.product_id,
                product_name: row.product_name,
                sku: row.sku,
                warehouse_id: row.warehouse_id,
                warehouse_name: row.warehouse_name,
                current_stock: row.current_stock,
                threshold: row.threshold,
                days_until_stockout: daysUntilStockout,
                supplier: row.supplier_id ? {
                    id: row.supplier_id,
                    name: row.supplier_name,
                    contact_email: row.supplier_contact_email,
                    lead_time_days: row.supplier_lead_time
                } : null
            };
        });

        // Query total count for pagination metadata
        const countQuery = `
            SELECT COUNT(DISTINCT CONCAT(p.id, '-', w.id)) as total
            FROM products p
            INNER JOIN inventory i ON p.id = i.product_id
            INNER JOIN warehouses w ON i.warehouse_id = w.id
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            WHERE p.company_id = :companyId
              AND p.is_active = true
              AND w.is_active = true
              AND w.company_id = :companyId
              AND (i.quantity - i.reserved_quantity) <= COALESCE(p.low_stock_threshold, pc.low_stock_threshold, 10)
              AND EXISTS(
                  SELECT 1 FROM sales_data sd 
                  WHERE sd.product_id = p.id 
                    AND sd.warehouse_id = w.id
                    AND sd.sale_date >= :thirtyDaysAgo
              )
        `;

        const countResult = await sequelize.query(countQuery, {
            type: sequelize.QueryTypes.SELECT,
            replacements: {
                companyId: parseInt(company_id),
                thirtyDaysAgo: thirtyDaysAgo.toISOString().split('T')[0]
            }
        });

        const totalAlerts = parseInt(countResult[0].total);

        res.json({
            alerts: alerts,
            total_alerts: totalAlerts,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(totalAlerts / limit),
                total_items: totalAlerts,
                limit: parseInt(limit)
            },
            metadata: {
                generated_at: new Date().toISOString(),
                criteria: {
                    recent_sales_period_days: 30,
                    company_id: parseInt(company_id)
                }
            }
        });

    } catch (error) {
        console.error('Low-stock alerts error:', error);

        if (error.name === 'SequelizeDatabaseError') {
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to retrieve low-stock alerts due to database error'
            });
        }

        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to retrieve low-stock alerts'
        });
    }
});

/**
 * Get aggregated low-stock alert summary grouped by product category
 */
router.get('/api/companies/:company_id/alerts/low-stock/summary', auth, async (req, res) => {
    try {
        const { company_id } = req.params;

        if (req.user.companyId !== parseInt(company_id)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'You do not have access to this company\'s data'
            });
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Aggregate alert counts by category with urgency breakdown
        const summaryQuery = `
            SELECT 
                COALESCE(pc.name, 'Uncategorized') as category_name,
                COUNT(*) as alert_count,
                SUM(CASE WHEN (i.quantity - i.reserved_quantity) = 0 THEN 1 ELSE 0 END) as out_of_stock_count,
                SUM(CASE WHEN (i.quantity - i.reserved_quantity) <= 5 THEN 1 ELSE 0 END) as critical_count,
                AVG(i.quantity - i.reserved_quantity) as avg_stock_level
            FROM products p
            INNER JOIN inventory i ON p.id = i.product_id
            INNER JOIN warehouses w ON i.warehouse_id = w.id
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            WHERE p.company_id = :companyId
              AND p.is_active = true
              AND w.is_active = true
              AND w.company_id = :companyId
              AND (i.quantity - i.reserved_quantity) <= COALESCE(p.low_stock_threshold, pc.low_stock_threshold, 10)
              AND EXISTS(
                  SELECT 1 FROM sales_data sd 
                  WHERE sd.product_id = p.id 
                    AND sd.warehouse_id = w.id
                    AND sd.sale_date >= :thirtyDaysAgo
              )
            GROUP BY pc.name
            ORDER BY alert_count DESC
        `;

        const summaryResults = await sequelize.query(summaryQuery, {
            type: sequelize.QueryTypes.SELECT,
            replacements: {
                companyId: parseInt(company_id),
                thirtyDaysAgo: thirtyDaysAgo.toISOString().split('T')[0]
            }
        });

        res.json({
            summary: summaryResults.map(row => ({
                category: row.category_name,
                total_alerts: parseInt(row.alert_count),
                out_of_stock: parseInt(row.out_of_stock_count),
                critical_alerts: parseInt(row.critical_count),
                average_stock_level: parseFloat(row.avg_stock_level).toFixed(2)
            })),
            generated_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('Low-stock summary error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to retrieve low-stock summary'
        });
    }
});

module.exports = router; 