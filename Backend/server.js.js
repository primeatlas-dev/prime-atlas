// PRIME ATLAS ERP - BACKEND SERVER
// Node.js + Express + PostgreSQL

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'prime-atlas-secret-key-change-in-production';

// ==================== AUTHENTICATION ====================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid password' });
    }
    
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name',
      [email, hashedPassword, name, 'admin']
    );
    
    const token = jwt.sign({ userId: result.rows[0].id, email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ token, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Middleware: Verify JWT
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.userId = decoded.userId;
    next();
  });
};

// ==================== BUYING AGENTS ====================

// Get all buying agents
app.get('/api/buying-agents', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM buying_agents ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single buying agent
app.get('/api/buying-agents/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM buying_agents WHERE id = $1',
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create buying agent
app.post('/api/buying-agents', verifyToken, async (req, res) => {
  try {
    const { name, email, phone, whatsapp, company_name, preferred_regions, min_price, max_price, property_types, commission_percentage, notes } = req.body;
    
    const result = await pool.query(
      `INSERT INTO buying_agents 
       (name, email, phone, whatsapp, company_name, preferred_regions, min_price, max_price, property_types, commission_percentage, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [name, email, phone, whatsapp, company_name, preferred_regions || [], min_price, max_price, property_types || [], commission_percentage, notes, 'active']
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update buying agent
app.put('/api/buying-agents/:id', verifyToken, async (req, res) => {
  try {
    const { name, email, phone, whatsapp, company_name, preferred_regions, min_price, max_price, property_types, commission_percentage, notes, status } = req.body;
    
    const result = await pool.query(
      `UPDATE buying_agents 
       SET name=$1, email=$2, phone=$3, whatsapp=$4, company_name=$5, preferred_regions=$6, min_price=$7, max_price=$8, property_types=$9, commission_percentage=$10, notes=$11, status=$12, updated_at=CURRENT_TIMESTAMP
       WHERE id=$13
       RETURNING *`,
      [name, email, phone, whatsapp, company_name, preferred_regions, min_price, max_price, property_types, commission_percentage, notes, status, req.params.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== PROPERTIES ====================

// Get all properties
app.get('/api/properties', verifyToken, async (req, res) => {
  try {
    const { status, region, minPrice, maxPrice } = req.query;
    
    let query = 'SELECT * FROM properties WHERE 1=1';
    const params = [];
    let paramCount = 1;
    
    if (status) {
      query += ` AND deal_status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    if (region) {
      query += ` AND region = $${paramCount}`;
      params.push(region);
      paramCount++;
    }
    
    if (minPrice) {
      query += ` AND price >= $${paramCount}`;
      params.push(minPrice);
      paramCount++;
    }
    
    if (maxPrice) {
      query += ` AND price <= $${paramCount}`;
      params.push(maxPrice);
      paramCount++;
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single property
app.get('/api/properties/:id', verifyToken, async (req, res) => {
  try {
    const propResult = await pool.query('SELECT * FROM properties WHERE id = $1', [req.params.id]);
    const photosResult = await pool.query('SELECT * FROM property_photos WHERE property_id = $1', [req.params.id]);
    const docsResult = await pool.query('SELECT * FROM property_documents WHERE property_id = $1', [req.params.id]);
    const comparablesResult = await pool.query('SELECT * FROM sales_comparables WHERE property_id = $1', [req.params.id]);
    const dealsResult = await pool.query(`
      SELECT d.*, ba.name as agent_name, ba.phone, ba.email 
      FROM deals d 
      LEFT JOIN buying_agents ba ON d.buying_agent_id = ba.id 
      WHERE d.property_id = $1
    `, [req.params.id]);
    
    res.json({
      property: propResult.rows[0],
      photos: photosResult.rows,
      documents: docsResult.rows,
      comparables: comparablesResult.rows,
      deals: dealsResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create property
app.post('/api/properties', verifyToken, async (req, res) => {
  try {
    const {
      property_title, address, postcode, region, property_type, bedrooms, bathrooms,
      car_parking, plot_size, built_year, condition, price, valuation, source,
      sourced_from, sourced_date, is_rented, rental_yield_percentage, description, notes_from_agent
    } = req.body;
    
    const result = await pool.query(
      `INSERT INTO properties 
       (property_title, address, postcode, region, property_type, bedrooms, bathrooms, car_parking, 
        plot_size, built_year, condition, price, valuation, source, sourced_from, sourced_date, 
        is_rented, rental_yield_percentage, description, notes_from_agent, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       RETURNING *`,
      [
        property_title, address, postcode, region, property_type, bedrooms, bathrooms, car_parking,
        plot_size, built_year, condition, price, valuation, source, sourced_from, sourced_date,
        is_rented, rental_yield_percentage, description, notes_from_agent, req.userId
      ]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update property
app.put('/api/properties/:id', verifyToken, async (req, res) => {
  try {
    const {
      property_title, address, postcode, region, property_type, bedrooms, bathrooms,
      car_parking, plot_size, built_year, condition, price, valuation, source,
      sourced_from, deal_status, is_rented, rental_yield_percentage, description, notes_from_agent
    } = req.body;
    
    const result = await pool.query(
      `UPDATE properties 
       SET property_title=$1, address=$2, postcode=$3, region=$4, property_type=$5, bedrooms=$6, bathrooms=$7,
           car_parking=$8, plot_size=$9, built_year=$10, condition=$11, price=$12, valuation=$13, source=$14,
           sourced_from=$15, is_rented=$16, rental_yield_percentage=$17, description=$18, notes_from_agent=$19,
           deal_status=$20, updated_at=CURRENT_TIMESTAMP
       WHERE id=$21
       RETURNING *`,
      [
        property_title, address, postcode, region, property_type, bedrooms, bathrooms, car_parking,
        plot_size, built_year, condition, price, valuation, source, sourced_from, is_rented,
        rental_yield_percentage, description, notes_from_agent, deal_status, req.params.id
      ]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== PROPERTY PHOTOS ====================

// Upload property photo
app.post('/api/properties/:id/photos', verifyToken, upload.single('photo'), async (req, res) => {
  try {
    const { photo_type } = req.body;
    
    // In production, upload to S3 or similar. For now, use base64
    const photoBase64 = req.file.buffer.toString('base64');
    const photoUrl = `data:${req.file.mimetype};base64,${photoBase64}`;
    
    const result = await pool.query(
      'INSERT INTO property_photos (property_id, photo_url, photo_type) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, photoUrl, photo_type]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get property photos
app.get('/api/properties/:id/photos', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM property_photos WHERE property_id = $1', [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== DEALS ====================

// Create deal (pitch property to buying agent)
app.post('/api/deals', verifyToken, async (req, res) => {
  try {
    const { property_id, buying_agent_id, brief_id, agreed_commission } = req.body;
    
    const result = await pool.query(
      `INSERT INTO deals (property_id, buying_agent_id, brief_id, deal_status, pitched_date, agreed_commission)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
       RETURNING *`,
      [property_id, buying_agent_id, brief_id, 'pitched', agreed_commission]
    );
    
    // Create communication log
    await pool.query(
      `INSERT INTO communications (buying_agent_id, property_id, deal_id, communication_type, subject, message, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [buying_agent_id, property_id, result.rows[0].id, 'Email', 'Property Pitch', `New property opportunity pitched: ${property_id}`, req.userId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all deals
app.get('/api/deals', verifyToken, async (req, res) => {
  try {
    const { status, agentId } = req.query;
    
    let query = `
      SELECT d.*, p.property_title, p.price, ba.name as agent_name
      FROM deals d
      LEFT JOIN properties p ON d.property_id = p.id
      LEFT JOIN buying_agents ba ON d.buying_agent_id = ba.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;
    
    if (status) {
      query += ` AND d.deal_status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    if (agentId) {
      query += ` AND d.buying_agent_id = $${paramCount}`;
      params.push(agentId);
      paramCount++;
    }
    
    query += ' ORDER BY d.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update deal status
app.put('/api/deals/:id', verifyToken, async (req, res) => {
  try {
    const { deal_status, agent_feedback, reason_if_rejected } = req.body;
    
    const result = await pool.query(
      `UPDATE deals 
       SET deal_status=$1, agent_feedback=$2, reason_if_rejected=$3, status_updated_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
       WHERE id=$4
       RETURNING *`,
      [deal_status, agent_feedback, reason_if_rejected, req.params.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== COMMUNICATIONS ====================

// Log communication
app.post('/api/communications', verifyToken, async (req, res) => {
  try {
    const { buying_agent_id, property_id, deal_id, communication_type, subject, message, follow_up_date } = req.body;
    
    const result = await pool.query(
      `INSERT INTO communications (buying_agent_id, property_id, deal_id, communication_type, subject, message, follow_up_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [buying_agent_id, property_id, deal_id, communication_type, subject, message, follow_up_date, req.userId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get communications for agent
app.get('/api/buying-agents/:id/communications', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM communications WHERE buying_agent_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== DASHBOARD METRICS ====================

// Get dashboard summary
app.get('/api/dashboard/summary', verifyToken, async (req, res) => {
  try {
    const totalPropertiesResult = await pool.query('SELECT COUNT(*) FROM properties');
    const totalDealsClosedResult = await pool.query(`SELECT COUNT(*) FROM deals WHERE deal_status = 'closed'`);
    const dealsInProgressResult = await pool.query(`SELECT COUNT(*) FROM deals WHERE deal_status IN ('pitched', 'interested', 'negotiating')`);
    const totalCommissionResult = await pool.query(`SELECT SUM(agreed_commission) FROM deals WHERE deal_status = 'closed'`);
    
    const propertiesByStatusResult = await pool.query(`
      SELECT deal_status, COUNT(*) as count FROM properties GROUP BY deal_status
    `);
    
    const propertiesByRegionResult = await pool.query(`
      SELECT region, COUNT(*) as count FROM properties GROUP BY region ORDER BY count DESC LIMIT 10
    `);
    
    res.json({
      total_properties_sourced: parseInt(totalPropertiesResult.rows[0].count),
      total_deals_closed: parseInt(totalDealsClosedResult.rows[0].count),
      deals_in_progress: parseInt(dealsInProgressResult.rows[0].count),
      total_commission_earned: parseFloat(totalCommissionResult.rows[0].sum || 0),
      properties_by_status: propertiesByStatusResult.rows,
      properties_by_region: propertiesByRegionResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Prime Atlas API running on port ${PORT}`);
});

module.exports = app;
