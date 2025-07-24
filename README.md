# StockFlow Inventory Management

## 📋 Assignment Overview

This repository contains complete solutions for the StockFlow B2B inventory management case study:

- **Part 1**: Code Review & Debugging
- **Part 2**: Database Design
- **Part 3**: API Implementation

---

## Part 1: Code Review & Debugging Solution

### Issues Identified in Original Python Code

1. **❌ Missing Input Validation**
   - **Problem**: No validation for required fields or data types
   - **Impact**: Database errors, security vulnerabilities, data corruption

2. **❌ No Error Handling**
   - **Problem**: No try-catch blocks or transaction rollback
   - **Impact**: Unhandled exceptions could crash the application

3. **❌ Race Conditions**
   - **Problem**: Two separate commits without transaction handling
   - **Impact**: Data inconsistency if one operation fails

4. **❌ Missing SKU Uniqueness Check**
   - **Problem**: No validation for unique SKUs across platform
   - **Impact**: Duplicate SKUs causing inventory tracking issues

5. **❌ No Business Logic Validation**
   - **Problem**: Missing warehouse existence checks, price validation
   - **Impact**: Orphaned records and invalid data

6. **❌ Security Vulnerabilities**
   - **Problem**: No authentication, authorization, or SQL injection protection
   - **Impact**: Unauthorized access and data breaches

7. **❌ Missing Duplicate Prevention**
   - **Problem**: Could create multiple inventory records for same product-warehouse
   - **Impact**: Data inconsistency and tracking errors

### ✅ Corrected Node.js/Express Implementation

**File**: `routes/products.js`

```javascript
// PART 1 SOLUTION: Fixed Product Creation Endpoint
router.post('/api/products', auth, async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
        // 1. INPUT VALIDATION
        const { error, value } = createProductSchema.validate(req.body);
        if (error) {
            await transaction.rollback();
            return res.status(400).json({
                error: 'Validation failed',
                details: error.details.map(detail => detail.message)
            });
        }

        // 2. SKU UNIQUENESS CHECK
        const existingProduct = await Product.findOne({
            where: { sku: value.sku },
            transaction
        });

        if (existingProduct) {
            await transaction.rollback();
            return res.status(409).json({
                error: 'SKU already exists'
            });
        }

        // 3. BUSINESS LOGIC VALIDATION
        const warehouse = await Warehouse.findOne({
            where: {
                id: value.warehouseId,
                companyId: req.user.companyId,
                isActive: true
            },
            transaction
        });

        if (!warehouse) {
            await transaction.rollback();
            return res.status(400).json({
                error: 'Invalid warehouse'
            });
        }

        // 4. CREATE PRODUCT (ATOMIC TRANSACTION)
        const product = await Product.create({
            companyId: req.user.companyId,
            ...value
        }, { transaction });

        // 5. CREATE INVENTORY RECORD
        const inventory = await Inventory.create({
            productId: product.id,
            warehouseId: value.warehouseId,
            quantity: value.initialQuantity,
            reservedQuantity: 0
        }, { transaction });

        // 6. CREATE AUDIT TRAIL
        await InventoryMovement.create({
            inventoryId: inventory.id,
            movementType: 'in',
            quantity: value.initialQuantity,
            previousQuantity: 0,
            newQuantity: value.initialQuantity,
            referenceType: 'initial_stock',
            userId: req.user.id
        }, { transaction });

        // 7. COMMIT TRANSACTION
        await transaction.commit();

        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            data: { product_id: product.id }
        });

    } catch (error) {
        await transaction.rollback();
        // Handle specific errors...
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});
```

---

## Part 2: Database Design Solution

### Complete Schema Design

**File**: `database/schema.sql`

```sql
-- Multi-tenant Companies
CREATE TABLE companies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    subscription_plan ENUM('basic', 'premium', 'enterprise') DEFAULT 'basic',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Multiple Warehouses per Company
CREATE TABLE warehouses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Supplier Management
CREATE TABLE suppliers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    lead_time_days INT DEFAULT 7,
    is_active BOOLEAN DEFAULT TRUE
);

-- Product Categories with Default Thresholds
CREATE TABLE product_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    low_stock_threshold INT DEFAULT 10
);

-- Products with Bundle Support
CREATE TABLE products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    category_id INT,
    supplier_id INT,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL UNIQUE,
    price DECIMAL(10,2) NOT NULL,
    low_stock_threshold INT DEFAULT 10,
    is_bundle BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- Inventory Tracking per Warehouse
CREATE TABLE inventory (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_product_warehouse (product_id, warehouse_id)
);

-- Sales Data for Velocity Calculation
CREATE TABLE sales_data (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    quantity_sold INT NOT NULL,
    sale_date DATE NOT NULL,
    revenue DECIMAL(10,2),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
);

-- Audit Trail for Inventory Changes
CREATE TABLE inventory_movements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    inventory_id INT NOT NULL,
    movement_type ENUM('in', 'out', 'adjustment', 'transfer') NOT NULL,
    quantity INT NOT NULL,
    previous_quantity INT NOT NULL,
    new_quantity INT NOT NULL,
    user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
);
```

### Missing Requirements Identified

1. **User Management**: Authentication and authorization system
2. **Multi-tenancy**: Data isolation strategy between companies
3. **Reorder Automation**: Automatic purchase order generation triggers
4. **Sales Velocity**: Historical data requirements for accurate calculations
5. **Product Variants**: Size, color, or other variation handling
6. **Seasonal Adjustments**: Dynamic threshold changes based on patterns
7. **Supplier Integration**: API connectivity for real-time data
8. **Batch/Lot Tracking**: Product recall and expiration management
9. **Pricing Strategy**: Customer-specific or volume-based pricing
10. **Warehouse Transfers**: Inter-warehouse movement workflows

---

## Part 3: API Implementation Solution

### Low-Stock Alerts Endpoint

**File**: `routes/alerts.js`

**Endpoint**: `GET /api/companies/{company_id}/alerts/low-stock`

```javascript
// PART 3 SOLUTION: Low-Stock Alerts with Business Logic
router.get('/api/companies/:company_id/alerts/low-stock', auth, async (req, res) => {
    try {
        const { company_id } = req.params;
        
        // Authorization check
        if (req.user.companyId !== parseInt(company_id)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Access denied to company data'
            });
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Complex query implementing all business rules
        const lowStockQuery = `
            SELECT DISTINCT
                p.id as product_id,
                p.name as product_name,
                p.sku,
                w.id as warehouse_id,
                w.name as warehouse_name,
                (i.quantity - i.reserved_quantity) as current_stock,
                COALESCE(p.low_stock_threshold, pc.low_stock_threshold, 10) as threshold,
                s.id as supplier_id,
                s.name as supplier_name,
                s.contact_email as supplier_contact_email,
                s.lead_time_days,
                -- Calculate average daily sales velocity
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
                ) as avg_daily_sales
            FROM products p
            INNER JOIN inventory i ON p.id = i.product_id
            INNER JOIN warehouses w ON i.warehouse_id = w.id
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.company_id = :companyId
              AND p.is_active = true
              AND w.is_active = true
              -- Low stock condition: current stock <= threshold
              AND (i.quantity - i.reserved_quantity) <= COALESCE(p.low_stock_threshold, pc.low_stock_threshold, 10)
              -- Only products with recent sales activity
              AND EXISTS(
                  SELECT 1 FROM sales_data sd 
                  WHERE sd.product_id = p.id 
                    AND sd.warehouse_id = w.id
                    AND sd.sale_date >= :thirtyDaysAgo
              )
            ORDER BY (i.quantity - i.reserved_quantity) ASC
        `;

        const results = await sequelize.query(lowStockQuery, {
            type: sequelize.QueryTypes.SELECT,
            replacements: {
                companyId: parseInt(company_id),
                thirtyDaysAgo: thirtyDaysAgo.toISOString().split('T')[0]
            }
        });

        // Calculate days until stockout
        const alerts = results.map(row => {
            const avgDailySales = parseFloat(row.avg_daily_sales) || 0;
            let daysUntilStockout;

            if (avgDailySales > 0) {
                daysUntilStockout = Math.floor(row.current_stock / avgDailySales);
            } else {
                daysUntilStockout = row.current_stock > 0 ? 90 : 0;
            }

            return {
                product_id: row.product_id,
                product_name: row.product_name,
                sku: row.sku,
                warehouse_id: row.warehouse_id,
                warehouse_name: row.warehouse_name,
                current_stock: row.current_stock,
                threshold: row.threshold,
                days_until_stockout: Math.max(0, daysUntilStockout),
                supplier: row.supplier_id ? {
                    id: row.supplier_id,
                    name: row.supplier_name,
                    contact_email: row.supplier_contact_email,
                    lead_time_days: row.lead_time_days
                } : null
            };
        });

        res.json({
            alerts: alerts,
            total_alerts: alerts.length
        });

    } catch (error) {
        console.error('Low-stock alerts error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to retrieve low-stock alerts'
        });
    }
});
```

### Business Rules Implemented

1. **✅ Variable Thresholds**: Product-specific overrides category defaults
2. **✅ Recent Sales Filter**: Only products sold in last 30 days
3. **✅ Multi-warehouse**: Separate alerts per warehouse location  
4. **✅ Supplier Integration**: Reorder contact information included
5. **✅ Stockout Calculation**: Based on 30-day sales velocity average

### Edge Cases Handled

- **Zero/Negative Stock**: Immediate alerts (0 days until stockout)
- **No Sales History**: Default to 90 days for planning purposes
- **Missing Suppliers**: Graceful null handling in response
- **Database Errors**: Proper error responses and logging
- **Authorization**: Company-specific data access control

---

## 🔧 Setup Instructions

### Prerequisites
- Node.js 16+
- MySQL 8.0+

### Installation
1. **Install dependencies**: `npm install`
2. **Setup database**: 
   ```bash
   # Create MySQL database and user
   mysql -u root -p
   ```
   ```sql
   CREATE DATABASE stockflow_db;
   CREATE USER 'stockflow'@'localhost' IDENTIFIED BY 'stockflow123';
   GRANT ALL PRIVILEGES ON stockflow_db.* TO 'stockflow'@'localhost';
   FLUSH PRIVILEGES;
   exit
   ```
   ```bash
   # Load schema (Windows PowerShell)
   Get-Content database/schema.sql | mysql -u stockflow -p stockflow_db
   
   # Load schema (Linux/Mac)
   mysql -u stockflow -p stockflow_db < database/schema.sql
   ```
3. **Configure environment**: Create `.env` file in root directory:
   ```env
   # StockFlow Environment Configuration
   NODE_ENV=development
   PORT=3000
   
   # Database Configuration  
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=stockflow_db
   DB_USER=stockflow
   DB_PASSWORD=stockflow123
   
   # JWT Configuration
   JWT_SECRET=stockflow_secret_key_change_in_production
   ```
4. **Start server**: `npm start`

### Testing
- **Health Check**: `GET http://localhost:3000/health`
- **Product Creation**: `POST /api/products` (requires auth)
- **Low Stock Alerts**: `GET /api/companies/{id}/alerts/low-stock` (requires auth)

---

## 📝 Key Assumptions Made

1. **Sales Velocity**: 30-day rolling average for stockout calculations
2. **Authentication**: JWT-based with company context in token
3. **Threshold Priority**: Product-specific > Category > Default (10)
4. **Stock Calculation**: Available = Total Quantity - Reserved
5. **Recent Activity**: Products must have sales within 30 days
6. **Multi-tenancy**: Company-based data isolation
7. **Error Handling**: Graceful degradation with meaningful messages

---

## 📊 Technical Decisions Explained

### Database Design
- **Normalization**: Balanced performance vs. data integrity
- **Indexing**: Optimized for common query patterns
- **Constraints**: Foreign keys with appropriate cascade rules

### API Implementation  
- **Raw SQL**: Complex business logic requires fine-tuned queries
- **Transaction Handling**: ACID compliance for data consistency
- **Error Responses**: Consistent structure with appropriate HTTP codes

### Security Considerations
- **Input Validation**: Joi schema validation on all inputs
- **SQL Injection**: Parameterized queries throughout
- **Authorization**: Company-based access control

---