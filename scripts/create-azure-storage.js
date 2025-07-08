// Script to create Azure Storage Account via Azure CLI
// Run this if you haven't created storage manually

const { execSync } = require('child_process');

function createAzureStorage() {
  console.log('🗄️ Creating Azure Storage Account for Pet Sanctuary...');
  
  const resourceGroup = 'pet-sanctuary-rg';
  const storageAccount = 'petsanctuarystorage';
  const location = 'eastus';
  
  try {
    // Create storage account
    console.log('Creating storage account...');
    execSync(`az storage account create \
      --name ${storageAccount} \
      --resource-group ${resourceGroup} \
      --location ${location} \
      --sku Standard_LRS \
      --kind StorageV2 \
      --access-tier Hot`, { stdio: 'inherit' });
    
    // Get storage account key
    console.log('Getting storage account key...');
    const keyResult = execSync(`az storage account keys list \
      --resource-group ${resourceGroup} \
      --account-name ${storageAccount} \
      --query "[0].value" \
      --output tsv`).toString().trim();
    
    // Create blob container
    console.log('Creating blob container...');
    execSync(`az storage container create \
      --name pet-images \
      --account-name ${storageAccount} \
      --account-key "${keyResult}" \
      --public-access blob`, { stdio: 'inherit' });
    
    console.log('✅ Azure Storage setup completed!');
    console.log('📝 Add these to your .env file:');
    console.log(`AZURE_STORAGE_ACCOUNT_NAME=${storageAccount}`);
    console.log(`AZURE_STORAGE_ACCOUNT_KEY=${keyResult}`);
    console.log('AZURE_STORAGE_CONTAINER_NAME=pet-images');
    
  } catch (error) {
    console.error('❌ Failed to create Azure Storage:', error.message);
    console.log('💡 You can create it manually in the Azure portal instead.');
  }
}

if (require.main === module) {
  createAzureStorage();
}

module.exports = { createAzureStorage };