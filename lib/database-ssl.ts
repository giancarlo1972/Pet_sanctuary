import { Client, Pool } from 'pg';
import fs from 'fs';
import path from 'path';

export class SecureDatabase {
  private pool: Pool;

  constructor() {
    const certPath = path.join(process.cwd(), 'certs', 'DigiCertGlobalRootCA.crt.pem');
    
    // Check if certificate exists
    if (!fs.existsSync(certPath)) {
      throw new Error('SSL certificate not found. Run setup script first.');
    }

    this.pool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync(certPath).toString()
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async query(text: string, params?: any[]) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async transaction(callback: (client: any) => Promise<any>) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

// Pet Sanctuary specific database operations
export class PetSanctuaryDB extends SecureDatabase {
  
  // User operations
  async createUser(userData: any) {
    const query = `
      INSERT INTO users (email, name, password_hash, role, location, avatar_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, name, role, created_at
    `;
    
    const values = [
      userData.email,
      userData.name,
      userData.passwordHash,
      userData.role,
      JSON.stringify(userData.location),
      userData.avatarUrl
    ];
    
    const result = await this.query(query, values);
    return result.rows[0];
  }

  async getUserByEmail(email: string) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.query(query, [email]);
    return result.rows[0];
  }

  // Pet operations
  async createPet(petData: any) {
    const query = `
      INSERT INTO pets (
        name, species, breed, age, gender, size, color, description,
        photos, location, shelter_id, health_status, personality, good_with
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    
    const values = [
      petData.name,
      petData.species,
      petData.breed,
      petData.age,
      petData.gender,
      petData.size,
      petData.color,
      petData.description,
      JSON.stringify(petData.photos),
      JSON.stringify(petData.location),
      petData.shelterId,
      JSON.stringify(petData.healthStatus),
      JSON.stringify(petData.personality),
      JSON.stringify(petData.goodWith)
    ];
    
    const result = await this.query(query, values);
    return result.rows[0];
  }

  async getPetsByStatus(status: string = 'available') {
    const query = `
      SELECT p.*, u.name as shelter_name, u.avatar_url as shelter_avatar
      FROM pets p
      JOIN users u ON p.shelter_id = u.id
      WHERE p.status = $1
      ORDER BY p.created_at DESC
    `;
    
    const result = await this.query(query, [status]);
    return result.rows;
  }

  async searchPets(filters: any) {
    let query = `
      SELECT p.*, u.name as shelter_name, u.avatar_url as shelter_avatar
      FROM pets p
      JOIN users u ON p.shelter_id = u.id
      WHERE p.status = 'available'
    `;
    
    const values: any[] = [];
    let paramCount = 0;

    if (filters.species) {
      paramCount++;
      query += ` AND p.species = $${paramCount}`;
      values.push(filters.species);
    }

    if (filters.size) {
      paramCount++;
      query += ` AND p.size = $${paramCount}`;
      values.push(filters.size);
    }

    if (filters.search) {
      paramCount++;
      query += ` AND (p.name ILIKE $${paramCount} OR p.breed ILIKE $${paramCount})`;
      values.push(`%${filters.search}%`);
    }

    query += ' ORDER BY p.created_at DESC';
    
    const result = await this.query(query, values);
    return result.rows;
  }

  // Message operations
  async createMessage(messageData: any) {
    const query = `
      INSERT INTO messages (sender_id, receiver_id, pet_id, content, message_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const values = [
      messageData.senderId,
      messageData.receiverId,
      messageData.petId,
      messageData.content,
      messageData.type || 'text'
    ];
    
    const result = await this.query(query, values);
    return result.rows[0];
  }

  async getMessagesBetweenUsers(userId1: string, userId2: string, petId?: string) {
    let query = `
      SELECT m.*, 
             s.name as sender_name, s.avatar_url as sender_avatar,
             r.name as receiver_name, r.avatar_url as receiver_avatar
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.receiver_id = r.id
      WHERE (m.sender_id = $1 AND m.receiver_id = $2)
         OR (m.sender_id = $2 AND m.receiver_id = $1)
    `;
    
    const values = [userId1, userId2];

    if (petId) {
      query += ' AND m.pet_id = $3';
      values.push(petId);
    }

    query += ' ORDER BY m.created_at ASC';
    
    const result = await this.query(query, values);
    return result.rows;
  }
}