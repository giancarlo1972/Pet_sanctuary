const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Test database connection with SSL
async function testDatabaseConnection() {
  console.log('🔌 Testing Pet Sanctuary database connection...');
  
  const certPath = path.join(__dirname, '..', 'certs', 'DigiCertGlobalRootCA.crt.pem');
  
  // Check if certificate exists
  if (!fs.existsSync(certPath)) {
    console.log('❌ SSL certificate not found. Run: npm run setup-ssl');
    return false;
  }
  
  const client = new Client({
    host: 'pet-sanctuary-db.postgres.database.azure.com',
    port: 5432,
    database: 'pet_sanctuary',
    user: 'petsanctuaryadmin',
    password: 'Kiers@48twenty',
    ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync(certPath).toString()
    }
  });
  
  try {
    await client.connect();
    console.log('✅ Database connection successful with SSL');
    
    // Test query
    const result = await client.query('SELECT version()');
    console.log('📊 Database version:', result.rows[0].version.substring(0, 50) + '...');
    
    // Check if tables exist
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('📋 Existing tables:', tables.rows.map(r => r.table_name));
    
    await client.end();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

if (require.main === module) {
  testDatabaseConnection();
}

module.exports = { testDatabaseConnection };