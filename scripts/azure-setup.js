const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs');
const https = require('https');
const path = require('path');

// Download and install Azure SSL certificate
async function downloadSSLCertificate() {
  console.log('📜 Downloading Azure SSL certificate...');
  
  const certUrl = 'https://cacerts.digicert.com/DigiCertGlobalRootCA.crt.pem';
  const certPath = path.join(__dirname, '..', 'certs', 'DigiCertGlobalRootCA.crt.pem');
  
  // Create certs directory if it doesn't exist
  const certsDir = path.dirname(certPath);
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
  }
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(certPath);
    https.get(certUrl, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('✅ SSL certificate downloaded successfully');
        resolve(certPath);
      });
    }).on('error', (err) => {
      fs.unlink(certPath, () => {}); // Delete the file on error
      reject(err);
    });
  });
}

// Setup Azure Blob Storage
async function setupBlobStorage() {
  console.log('🗄️ Setting up Azure Blob Storage...');
  
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'pet-images';
  
  if (!accountName || !accountKey) {
    console.log('⚠️ Azure Storage credentials not found. Please set up storage manually.');
    return;
  }
  
  try {
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      { accountName, accountKey }
    );
    
    // Create container if it doesn't exist
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists({
      access: 'blob' // Public read access for images
    });
    
    console.log('✅ Azure Blob Storage container created successfully');
    return containerClient;
  } catch (error) {
    console.error('❌ Failed to setup blob storage:', error.message);
  }
}

// Test database connection with SSL
async function testDatabaseConnection() {
  console.log('🔌 Testing database connection with SSL...');
  
  const { Client } = require('pg');
  const certPath = path.join(__dirname, '..', 'certs', 'DigiCertGlobalRootCA.crt.pem');
  
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
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
    console.log('📊 Database version:', result.rows[0].version);
    
    await client.end();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

async function main() {
  try {
    await downloadSSLCertificate();
    await setupBlobStorage();
    await testDatabaseConnection();
    console.log('🎉 Azure setup completed successfully!');
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  downloadSSLCertificate,
  setupBlobStorage,
  testDatabaseConnection
};