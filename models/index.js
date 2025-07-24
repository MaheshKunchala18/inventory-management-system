const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Define all models
const Company = sequelize.define('Company', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    phone: {
        type: DataTypes.STRING(20)
    },
    address: {
        type: DataTypes.TEXT
    },
    subscriptionPlan: {
        type: DataTypes.ENUM('basic', 'premium', 'enterprise'),
        defaultValue: 'basic'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'companies'
});

const Warehouse = sequelize.define('Warehouse', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Company,
            key: 'id'
        }
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    address: {
        type: DataTypes.TEXT
    },
    managerName: {
        type: DataTypes.STRING(255)
    },
    managerEmail: {
        type: DataTypes.STRING(255),
        validate: {
            isEmail: true
        }
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'warehouses',
    indexes: [
        {
            fields: ['company_id']
        }
    ]
});

const Supplier = sequelize.define('Supplier', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    contactEmail: {
        type: DataTypes.STRING(255),
        validate: {
            isEmail: true
        }
    },
    contactPhone: {
        type: DataTypes.STRING(20)
    },
    address: {
        type: DataTypes.TEXT
    },
    paymentTerms: {
        type: DataTypes.STRING(100)
    },
    leadTimeDays: {
        type: DataTypes.INTEGER,
        defaultValue: 7
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'suppliers',
    indexes: [
        {
            fields: ['name']
        }
    ]
});

const ProductCategory = sequelize.define('ProductCategory', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
    },
    description: {
        type: DataTypes.TEXT
    },
    lowStockThreshold: {
        type: DataTypes.INTEGER,
        defaultValue: 10
    }
}, {
    tableName: 'product_categories'
});

const Product = sequelize.define('Product', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Company,
            key: 'id'
        }
    },
    categoryId: {
        type: DataTypes.INTEGER,
        references: {
            model: ProductCategory,
            key: 'id'
        }
    },
    supplierId: {
        type: DataTypes.INTEGER,
        references: {
            model: Supplier,
            key: 'id'
        }
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    sku: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    description: {
        type: DataTypes.TEXT
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0
        }
    },
    cost: {
        type: DataTypes.DECIMAL(10, 2),
        validate: {
            min: 0
        }
    },
    weight: {
        type: DataTypes.DECIMAL(8, 2)
    },
    dimensions: {
        type: DataTypes.STRING(100)
    },
    lowStockThreshold: {
        type: DataTypes.INTEGER,
        defaultValue: 10
    },
    isBundle: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'products',
    indexes: [
        {
            fields: ['company_id']
        },
        {
            fields: ['sku']
        },
        {
            fields: ['supplier_id']
        }
    ]
});

const BundleComponent = sequelize.define('BundleComponent', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    bundleProductId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Product,
            key: 'id'
        }
    },
    componentProductId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Product,
            key: 'id'
        }
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    }
}, {
    tableName: 'bundle_components',
    indexes: [
        {
            unique: true,
            fields: ['bundle_product_id', 'component_product_id']
        }
    ]
});

const Inventory = sequelize.define('Inventory', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Product,
            key: 'id'
        }
    },
    warehouseId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Warehouse,
            key: 'id'
        }
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    reservedQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    lastUpdated: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'inventory',
    indexes: [
        {
            unique: true,
            fields: ['product_id', 'warehouse_id']
        },
        {
            fields: ['warehouse_id']
        },
        {
            fields: ['product_id', 'quantity']
        }
    ]
});

const InventoryMovement = sequelize.define('InventoryMovement', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    inventoryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Inventory,
            key: 'id'
        }
    },
    movementType: {
        type: DataTypes.ENUM('in', 'out', 'adjustment', 'transfer'),
        allowNull: false
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    previousQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    newQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    referenceId: {
        type: DataTypes.STRING(100)
    },
    referenceType: {
        type: DataTypes.STRING(50)
    },
    notes: {
        type: DataTypes.TEXT
    },
    userId: {
        type: DataTypes.INTEGER
    }
}, {
    tableName: 'inventory_movements',
    indexes: [
        {
            fields: ['inventory_id']
        },
        {
            fields: ['created_at']
        }
    ]
});

const SalesData = sequelize.define('SalesData', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Product,
            key: 'id'
        }
    },
    warehouseId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Warehouse,
            key: 'id'
        }
    },
    quantitySold: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    saleDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    revenue: {
        type: DataTypes.DECIMAL(10, 2)
    }
}, {
    tableName: 'sales_data',
    indexes: [
        {
            fields: ['product_id', 'sale_date']
        },
        {
            fields: ['sale_date']
        }
    ]
});

// Define associations
Company.hasMany(Warehouse, { foreignKey: 'companyId', as: 'warehouses' });
Company.hasMany(Product, { foreignKey: 'companyId', as: 'products' });

Warehouse.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
Warehouse.hasMany(Inventory, { foreignKey: 'warehouseId', as: 'inventory' });
Warehouse.hasMany(SalesData, { foreignKey: 'warehouseId', as: 'sales' });

Product.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
Product.belongsTo(ProductCategory, { foreignKey: 'categoryId', as: 'category' });
Product.belongsTo(Supplier, { foreignKey: 'supplierId', as: 'supplier' });
Product.hasMany(Inventory, { foreignKey: 'productId', as: 'inventory' });
Product.hasMany(SalesData, { foreignKey: 'productId', as: 'sales' });

ProductCategory.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });

Supplier.hasMany(Product, { foreignKey: 'supplierId', as: 'products' });

BundleComponent.belongsTo(Product, { foreignKey: 'bundleProductId', as: 'bundleProduct' });
BundleComponent.belongsTo(Product, { foreignKey: 'componentProductId', as: 'componentProduct' });

Inventory.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Inventory.belongsTo(Warehouse, { foreignKey: 'warehouseId', as: 'warehouse' });
Inventory.hasMany(InventoryMovement, { foreignKey: 'inventoryId', as: 'movements' });

InventoryMovement.belongsTo(Inventory, { foreignKey: 'inventoryId', as: 'inventory' });

SalesData.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
SalesData.belongsTo(Warehouse, { foreignKey: 'warehouseId', as: 'warehouse' });

module.exports = {
    sequelize,
    Company,
    Warehouse,
    Supplier,
    ProductCategory,
    Product,
    BundleComponent,
    Inventory,
    InventoryMovement,
    SalesData
}; 