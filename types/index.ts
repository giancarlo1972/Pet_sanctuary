export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'adopter' | 'shelter' | 'foster' | 'vet' | 'volunteer' | 'admin';
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  verified: boolean;
  createdAt: string;
}

export interface Pet {
  id: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed: string;
  age: number;
  gender: 'male' | 'female';
  size: 'small' | 'medium' | 'large';
  color: string;
  description: string;
  photos: string[];
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  shelter: {
    id: string;
    name: string;
    avatar?: string;
  };
  status: 'available' | 'pending' | 'adopted';
  healthStatus: {
    vaccinated: boolean;
    spayed: boolean;
    microchipped: boolean;
  };
  personality: string[];
  goodWith: {
    kids: boolean;
    dogs: boolean;
    cats: boolean;
  };
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  petId?: string;
  content: string;
  timestamp: string;
  read: boolean;
  type: 'text' | 'image' | 'video' | 'adoption_inquiry';
}

export interface Chat {
  id: string;
  participants: User[];
  lastMessage: Message;
  pet?: Pet;
  unreadCount: number;
  updatedAt: string;
}