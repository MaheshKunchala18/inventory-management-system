const express = require('express');
const Joi = require('joi');
const { Op } = require('sequelize');
const { sequelize, Product, Inventory, Warehouse, InventoryMovement } = require('../models');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Validation schema for product creation
const createProductSchema = Joi.object({
    name: Joi.string().min(1).max(255).required(),
    sku: Joi.string().min(1).max(100).required(),
    description: Joi.string().allow('').optional(),
    price: Joi.number().positive().precision(2).required(),
    cost: Joi.number().positive().precision(2).optional(),
    weight: Joi.number().positive().precision(2).optional(),
    dimensions: Joi.string().max(100).optional(),
    categoryId: Joi.number().integer().positive().optional(),
    supplierId: Joi.number().integer().positive().optional(),
    lowStockThreshold: Joi.number().integer().min(0).default(10),
    warehouseId: Joi.number().integer().positive().required(),
    initialQuantity: Joi.number().integer().min(0).required()
});

/**
 * Create new product with inventory record
 * Fixes issues from original Python implementation: input validation, error handling,
 * transactions, SKU uniqueness, business logic validation, and duplicate prevention
 */
router.post('/api/products', auth, async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
        // Validate input data against schema
        const { error, value } = createProductSchema.validate(req.body);
        if (error) {
            await transaction.rollback();
            return res.status(400).json({
                error: 'Validation failed',
                details: error.details.map(detail => detail.message)
            });
        }

        const {
            name,
            sku,
            description,
            price,
            cost,
            weight,
            dimensions,
            categoryId,
            supplierId,
            lowStockThreshold,
            warehouseId,
            initialQuantity
        } = value;

        // Verify warehouse exists and belongs to authenticated company
        const warehouse = await Warehouse.findOne({
            where: {
                id: warehouseId,
                companyId: req.user.companyId,
                isActive: true
            },
            transaction
        });

        if (!warehouse) {
            await transaction.rollback();
            return res.status(400).json({
                error: 'Invalid warehouse',
                message: 'Warehouse not found or does not belong to your company'
            });
        }

        // Ensure SKU is unique across the platform
        const existingProduct = await Product.findOne({
            where: { sku },
            transaction
        });

        if (existingProduct) {
            await transaction.rollback();
            return res.status(409).json({
                error: 'SKU already exists',
                message: `Product with SKU '${sku}' already exists`
            });
        }

        // Create product record
        const product = await Product.create({
            companyId: req.user.companyId,
            name,
            sku,
            description,
            price,
            cost,
            weight,
            dimensions,
            categoryId,
            supplierId,
            lowStockThreshold,
            isActive: true
        }, { transaction });

        // Prevent duplicate inventory records for same product-warehouse combination
        const existingInventory = await Inventory.findOne({
            where: {
                productId: product.id,
                warehouseId: warehouseId
            },
            transaction
        });

        if (existingInventory) {
            await transaction.rollback();
            return res.status(409).json({
                error: 'Inventory already exists',
                message: 'Inventory record for this product-warehouse combination already exists'
            });
        }

        // Create initial inventory record
        const inventory = await Inventory.create({
            productId: product.id,
            warehouseId: warehouseId,
            quantity: initialQuantity,
            reservedQuantity: 0,
            lastUpdated: new Date()
        }, { transaction });

        // Record inventory movement for audit trail
        await InventoryMovement.create({
            inventoryId: inventory.id,
            movementType: 'in',
            quantity: initialQuantity,
            previousQuantity: 0,
            newQuantity: initialQuantity,
            referenceType: 'initial_stock',
            referenceId: product.id.toString(),
            notes: 'Initial stock entry for new product',
            userId: req.user.id
        }, { transaction });

        await transaction.commit();

        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            data: {
                product: {
                    id: product.id,
                    name: product.name,
                    sku: product.sku,
                    price: product.price,
                    warehouseId: warehouseId,
                    initialQuantity: initialQuantity
                }
            }
        });

    } catch (error) {
        await transaction.rollback();
        
        console.error('Product creation error:', error);
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                error: 'Duplicate entry',
                message: 'A record with this information already exists'
            });
        }
        
        if (error.name === 'SequelizeForeignKeyConstraintError') {
            return res.status(400).json({
                error: 'Invalid reference',
                message: 'Referenced entity does not exist'
            });
        }

        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to create product'
        });
    }
});

/**
 * List products for authenticated company with optional search and pagination
 */
router.get('/api/products', auth, async (req, res) => {
    try {
        const { page = 1, limit = 50, search = '' } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = {
            companyId: req.user.companyId,
            isActive: true
        };

        if (search) {
            whereClause[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { sku: { [Op.like]: `%${search}%` } }
            ];
        }

        const products = await Product.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: Inventory,
                    as: 'inventory',
                    include: [{
                        model: Warehouse,
                        as: 'warehouse',
                        attributes: ['id', 'name']
                    }]
                }
            ]
        });

        res.json({
            success: true,
            data: {
                products: products.rows,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(products.count / limit),
                    totalItems: products.count,
                    limit: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to retrieve products'
        });
    }
});

module.exports = router; 