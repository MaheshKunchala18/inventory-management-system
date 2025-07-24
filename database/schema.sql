-- CREATE DATABASE stockflow_db;
-- USE stockflow_db;

-- Companies table (Multi-tenant support)
CREATE TABLE companies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    subscription_plan ENUM('basic', 'premium', 'enterprise') DEFAULT 'basic',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_company_email (email),
    INDEX idx_company_active (is_active)
);

-- Warehouses table
CREATE TABLE warehouses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    manager_name VARCHAR(255),
    manager_email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_company_warehouses (company_id),
    INDEX idx_warehouse_active (is_active)
);

-- Suppliers table
CREATE TABLE suppliers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    address TEXT,
    payment_terms VARCHAR(100),
    lead_time_days INT DEFAULT 7,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_supplier_name (name),
    INDEX idx_supplier_active (is_active)
);

-- Product categories table
CREATE TABLE product_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    low_stock_threshold INT DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category_name (name)
);

-- Products table
CREATE TABLE products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    category_id INT,
    supplier_id INT,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2),
    weight DECIMAL(8,2),
    dimensions VARCHAR(100),
    low_stock_threshold INT DEFAULT 10,
    is_bundle BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    INDEX idx_company_products (company_id),
    INDEX idx_sku (sku),
    INDEX idx_supplier_products (supplier_id),
    INDEX idx_product_active (is_active)
);

-- Bundle components table (for products that contain other products)
CREATE TABLE bundle_components (
    id INT PRIMARY KEY AUTO_INCREMENT,
    bundle_product_id INT NOT NULL,
    component_product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bundle_product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (component_product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_bundle_component (bundle_product_id, component_product_id)
);

-- Inventory table
CREATE TABLE inventory (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_product_warehouse (product_id, warehouse_id),
    INDEX idx_warehouse_inventory (warehouse_id),
    INDEX idx_low_stock (product_id, quantity),
    INDEX idx_inventory_updated (last_updated)
);

-- Inventory movements table (audit trail)
CREATE TABLE inventory_movements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    inventory_id INT NOT NULL,
    movement_type ENUM('in', 'out', 'adjustment', 'transfer') NOT NULL,
    quantity INT NOT NULL,
    previous_quantity INT NOT NULL,
    new_quantity INT NOT NULL,
    reference_id VARCHAR(100),
    reference_type VARCHAR(50),
    notes TEXT,
    user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
    INDEX idx_inventory_movements (inventory_id),
    INDEX idx_movement_date (created_at),
    INDEX idx_movement_type (movement_type)
);

-- Sales data table (for tracking recent sales activity)
CREATE TABLE sales_data (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    quantity_sold INT NOT NULL,
    sale_date DATE NOT NULL,
    revenue DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
    INDEX idx_product_sales (product_id, sale_date),
    INDEX idx_recent_sales (sale_date),
    INDEX idx_warehouse_sales (warehouse_id, sale_date)
);

-- Sample data for testing (optional)
INSERT INTO companies (name, email, phone, address) VALUES
('Acme Corporation', 'admin@acme.com', '+1-555-0123', '123 Business St, City, State'),
('Global Tech Solutions', 'contact@globaltech.com', '+1-555-0456', '456 Tech Ave, City, State');

INSERT INTO warehouses (company_id, name, address, manager_name, manager_email) VALUES
(1, 'Main Warehouse', '123 Storage Rd, City, State', 'John Manager', 'john@acme.com'),
(1, 'Secondary Warehouse', '456 Backup St, City, State', 'Jane Supervisor', 'jane@acme.com'),
(2, 'Central Hub', '789 Distribution Blvd, City, State', 'Bob Coordinator', 'bob@globaltech.com');

INSERT INTO suppliers (name, contact_email, contact_phone, address, payment_terms) VALUES
('Widget Supplier Corp', 'orders@widgetsupplier.com', '+1-555-7890', '789 Supply Chain Dr', 'Net 30'),
('Parts & Components Inc', 'sales@partscomponents.com', '+1-555-2468', '321 Component Way', 'Net 15'),
('Industrial Materials Ltd', 'info@industrial.com', '+1-555-1357', '654 Materials Blvd', 'Net 45');

INSERT INTO product_categories (name, description, low_stock_threshold) VALUES
('Electronics', 'Electronic components and devices', 15),
('Hardware', 'Physical hardware components', 10),
('Software', 'Software licenses and digital products', 5),
('Accessories', 'Additional accessories and add-ons', 20);

-- Sample products (for company 1)
INSERT INTO products (company_id, category_id, supplier_id, name, sku, description, price, cost, low_stock_threshold) VALUES
(1, 1, 1, 'Widget Pro 2000', 'WID-PRO-2000', 'Advanced widget with premium features', 299.99, 150.00, 20),
(1, 1, 1, 'Standard Widget', 'WID-STD-100', 'Basic widget for everyday use', 99.99, 50.00, 30),
(1, 2, 2, 'Premium Connector', 'CON-PREM-50', 'High-quality connector component', 49.99, 25.00, 15),
(1, 3, 3, 'Software License Pro', 'SWL-PRO-2023', 'Professional software license', 999.99, 500.00, 5);

-- Sample inventory
INSERT INTO inventory (product_id, warehouse_id, quantity, reserved_quantity) VALUES
(1, 1, 150, 10),  -- Widget Pro 2000 in Main Warehouse
(1, 2, 75, 5),    -- Widget Pro 2000 in Secondary Warehouse
(2, 1, 300, 20),  -- Standard Widget in Main Warehouse
(3, 1, 45, 5),    -- Premium Connector in Main Warehouse
(4, 1, 25, 2);    -- Software License in Main Warehouse

-- Sample sales data (for testing low-stock alerts)
INSERT INTO sales_data (product_id, warehouse_id, quantity_sold, sale_date, revenue) VALUES
-- Recent sales for Widget Pro 2000
(1, 1, 5, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 1499.95),
(1, 1, 3, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 899.97),
(1, 1, 2, DATE_SUB(CURDATE(), INTERVAL 7 DAY), 599.98),
(1, 1, 4, DATE_SUB(CURDATE(), INTERVAL 10 DAY), 1199.96),
(1, 1, 6, DATE_SUB(CURDATE(), INTERVAL 15 DAY), 1799.94),

-- Recent sales for Standard Widget
(2, 1, 10, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 999.90),
(2, 1, 8, DATE_SUB(CURDATE(), INTERVAL 5 DAY), 799.92),
(2, 1, 12, DATE_SUB(CURDATE(), INTERVAL 8 DAY), 1199.88),

-- Recent sales for Premium Connector
(3, 1, 3, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 149.97),
(3, 1, 2, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 99.98),
(3, 1, 5, DATE_SUB(CURDATE(), INTERVAL 12 DAY), 249.95);