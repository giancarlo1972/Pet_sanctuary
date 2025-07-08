const fs = require('fs');
const https = require('https');
const path = require('path');

// Download Azure SSL certificate
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
        console.log(`📁 Certificate saved to: ${certPath}`);
        resolve(certPath);
      });
    }).on('error', (err) => {
      fs.unlink(certPath, () => {}); // Delete the file on error
      console.error('❌ Failed to download SSL certificate:', err.message);
      reject(err);
    });
  });
}

if (require.main === module) {
  downloadSSLCertificate().catch(console.error);
}

module.exports = { downloadSSLCertificate };