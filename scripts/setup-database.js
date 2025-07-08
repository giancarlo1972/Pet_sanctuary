// Database setup script for Pet Sanctuary
// Run this after your Azure PostgreSQL deployment completes

const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: {
    rejectUnauthorized: true,
    ca: require('fs').readFileSync(require('path').join(__dirname, '..', 'certs', 'DigiCertGlobalRootCA.crt.pem')).toString()
  }
});

async function setupDatabase() {
  try {
    console.log('🔌 Connecting to Pet Sanctuary database...');
    await client.connect();
    
    console.log('📋 Creating tables...');
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'adopter',
        avatar_url TEXT,
        location JSONB,
        verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Create pets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        species VARCHAR(50) NOT NULL,
        breed VARCHAR(255) NOT NULL,
        age INTEGER NOT NULL,
        gender VARCHAR(20) NOT NULL,
        size VARCHAR(20) NOT NULL,
        color VARCHAR(100),
        description TEXT,
        photos JSONB DEFAULT '[]',
        location JSONB NOT NULL,
        shelter_id UUID REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'available',
        health_status JSONB DEFAULT '{}',
        personality JSONB DEFAULT '[]',
        good_with JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Create messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id UUID REFERENCES users(id),
        receiver_id UUID REFERENCES users(id),
        pet_id UUID REFERENCES pets(id),
        content TEXT NOT NULL,
        message_type VARCHAR(50) DEFAULT 'text',
        read_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pets_species ON pets(species);
      CREATE INDEX IF NOT EXISTS idx_pets_status ON pets(status);
      CREATE INDEX IF NOT EXISTS idx_pets_shelter ON pets(shelter_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
    `);
    
    console.log('✅ Database setup completed successfully!');
    console.log('🏠 Pet Sanctuary database is ready for production!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
  } finally {
    await client.end();
  }
}

setupDatabase();