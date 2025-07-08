import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

export class AzureStorageService {
  private blobServiceClient: BlobServiceClient;
  private containerClient: ContainerClient;

  constructor() {
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'pet-images';

    if (!accountName || !accountKey) {
      throw new Error('Azure Storage credentials not configured');
    }

    this.blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      { accountName, accountKey }
    );

    this.containerClient = this.blobServiceClient.getContainerClient(containerName);
  }

  async uploadImage(file: File, fileName: string): Promise<string> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
      
      // Convert File to ArrayBuffer for upload
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: file.type
        }
      });

      return blockBlobClient.url;
    } catch (error) {
      console.error('Failed to upload image:', error);
      throw new Error('Image upload failed');
    }
  }

  async deleteImage(fileName: string): Promise<void> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
      await blockBlobClient.delete();
    } catch (error) {
      console.error('Failed to delete image:', error);
      throw new Error('Image deletion failed');
    }
  }

  async listImages(prefix?: string): Promise<string[]> {
    try {
      const images: string[] = [];
      
      for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
        images.push(blob.name);
      }
      
      return images;
    } catch (error) {
      console.error('Failed to list images:', error);
      throw new Error('Failed to list images');
    }
  }
}