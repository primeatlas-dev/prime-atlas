-- PRIME ATLAS ERP SYSTEM - DATABASE SCHEMA
-- PostgreSQL Database Schema for Property Sourcing Platform

-- Users Table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Buying Agents Table (Your Clients)
CREATE TABLE buying_agents (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  whatsapp VARCHAR(20),
  company_name VARCHAR(255),
  address TEXT,
  
  -- Deal Preferences/Criteria
  preferred_regions TEXT[], -- Array of regions they focus on
  min_price DECIMAL(15, 2),
  max_price DECIMAL(15, 2),
  property_types TEXT[], -- Residential, Commercial, Land, etc.
  preferred_bedrooms INT,
  
  -- Commission/Fee Info
  commission_percentage DECIMAL(5, 2),
  fee_per_deal DECIMAL(10, 2),
  
  -- Status & Dates
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, pending
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_contact TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Properties Table
CREATE TABLE properties (
  id SERIAL PRIMARY KEY,
  
  -- Basic Info
  property_title VARCHAR(500) NOT NULL,
  address TEXT NOT NULL,
  postcode VARCHAR(10),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  region VARCHAR(100),
  
  -- Property Details
  property_type VARCHAR(50), -- Residential, Commercial, Land, Development
  bedrooms INT,
  bathrooms INT,
  car_parking INT,
  plot_size DECIMAL(10, 2), -- in m²
  built_year INT,
  condition VARCHAR(50), -- Excellent, Good, Fair, Poor
  
  -- Price & Valuation
  price DECIMAL(15, 2),
  price_range VARCHAR(100), -- For flexibility
  valuation DECIMAL(15, 2),
  price_per_sqm DECIMAL(10, 2),
  
  -- Sourcing Info
  source VARCHAR(100), -- Pre-market, Off-market, Portal, Direct, Network
  sourced_from VARCHAR(255), -- Agent name or contact
  sourced_date DATE,
  
  -- Rental Info (if applicable)
  is_rented BOOLEAN DEFAULT FALSE,
  rental_yield_percentage DECIMAL(5, 2),
  estimated_rental_income DECIMAL(10, 2),
  
  -- Deal Status
  deal_status VARCHAR(50) DEFAULT 'sourced', -- sourced, pitched, in_negotiation, closed, rejected, on_hold
  deal_status_updated_at TIMESTAMP,
  
  -- Risk/Overlay Info
  bushfire_risk VARCHAR(50) DEFAULT 'undetected',
  flood_risk VARCHAR(50) DEFAULT 'undetected',
  heritage_zone BOOLEAN DEFAULT FALSE,
  social_housing_percentage DECIMAL(5, 2),
  
  -- Amenities/Transport
  nearest_bus_stop_distance VARCHAR(50),
  airport_distance VARCHAR(50),
  railway_distance VARCHAR(50),
  schools_nearby TEXT[],
  hospitals_nearby TEXT[],
  shopping_centers_nearby TEXT[],
  
  -- Documents & Notes
  description TEXT,
  notes_from_agent TEXT,
  commission_notes TEXT,
  
  -- Tracking
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT REFERENCES users(id)
);

-- Property Photos/Gallery
CREATE TABLE property_photos (
  id SERIAL PRIMARY KEY,
  property_id INT REFERENCES properties(id) ON DELETE CASCADE,
  photo_url TEXT,
  photo_type VARCHAR(50), -- Interior, Exterior, Location, Aerial
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Property Documents (PDF, Title deeds, surveys, etc.)
CREATE TABLE property_documents (
  id SERIAL PRIMARY KEY,
  property_id INT REFERENCES properties(id) ON DELETE CASCADE,
  document_name VARCHAR(255),
  document_url TEXT,
  document_type VARCHAR(100), -- Survey, Title Deed, Floor Plan, etc.
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deals (Linking Properties to Buying Agents)
CREATE TABLE deals (
  id SERIAL PRIMARY KEY,
  property_id INT REFERENCES properties(id) ON DELETE CASCADE,
  buying_agent_id INT REFERENCES buying_agents(id) ON DELETE CASCADE,
  
  -- Deal Info
  brief_id VARCHAR(50), -- Reference to agent's brief
  deal_status VARCHAR(50) DEFAULT 'pitched', -- pitched, interested, negotiating, closed, rejected
  status_updated_at TIMESTAMP,
  
  -- Dates
  pitched_date TIMESTAMP,
  response_date TIMESTAMP,
  closed_date TIMESTAMP,
  
  -- Commission
  agreed_commission DECIMAL(10, 2),
  commission_status VARCHAR(50) DEFAULT 'pending', -- pending, paid, on_hold
  
  -- Notes
  agent_feedback TEXT,
  reason_if_rejected VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Communication/Follow-up Tracker
CREATE TABLE communications (
  id SERIAL PRIMARY KEY,
  buying_agent_id INT REFERENCES buying_agents(id) ON DELETE CASCADE,
  property_id INT REFERENCES properties(id) ON DELETE CASCADE,
  deal_id INT REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Communication Details
  communication_type VARCHAR(50), -- Call, Email, WhatsApp, Meeting, SMS
  subject VARCHAR(255),
  message TEXT,
  
  -- Status
  status VARCHAR(50) DEFAULT 'sent', -- sent, read, replied, pending_reply
  follow_up_date DATE,
  follow_up_completed BOOLEAN DEFAULT FALSE,
  
  -- Tracking
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT REFERENCES users(id)
);

-- Sales Comparables (For Property Valuation)
CREATE TABLE sales_comparables (
  id SERIAL PRIMARY KEY,
  property_id INT REFERENCES properties(id) ON DELETE CASCADE,
  comparable_address VARCHAR(500),
  comparable_price DECIMAL(15, 2),
  sale_date DATE,
  price_per_sqm DECIMAL(10, 2),
  notes TEXT,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard Metrics & Reporting
CREATE TABLE deal_metrics (
  id SERIAL PRIMARY KEY,
  metric_date DATE,
  
  -- Daily/Weekly/Monthly Counts
  total_properties_sourced INT DEFAULT 0,
  new_deals_pitched INT DEFAULT 0,
  deals_closed INT DEFAULT 0,
  deals_rejected INT DEFAULT 0,
  
  -- Revenue
  total_commission_earned DECIMAL(15, 2) DEFAULT 0,
  total_commission_pending DECIMAL(15, 2) DEFAULT 0,
  
  -- By Agent
  agent_id INT REFERENCES buying_agents(id),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_properties_status ON properties(deal_status);
CREATE INDEX idx_properties_region ON properties(region);
CREATE INDEX idx_properties_source ON properties(source);
CREATE INDEX idx_properties_created ON properties(created_at);
CREATE INDEX idx_deals_agent ON deals(buying_agent_id);
CREATE INDEX idx_deals_property ON deals(property_id);
CREATE INDEX idx_deals_status ON deals(deal_status);
CREATE INDEX idx_communications_agent ON communications(buying_agent_id);
CREATE INDEX idx_communications_date ON communications(created_at);
