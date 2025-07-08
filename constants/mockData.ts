import { User, Pet, Chat, Message } from '@/types';

export const mockUsers: User[] = [
  {
    id: '1',
    email: 'shelter@happypaws.org',
    name: 'Happy Paws Shelter',
    avatar: 'https://images.pexels.com/photos/4498362/pexels-photo-4498362.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&dpr=2',
    role: 'shelter',
    location: {
      latitude: 40.7128,
      longitude: -74.0060,
      address: 'New York, NY',
    },
    verified: true,
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    email: 'sarah@email.com',
    name: 'Sarah Johnson',
    avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&dpr=2',
    role: 'adopter',
    location: {
      latitude: 40.7589,
      longitude: -73.9851,
      address: 'Manhattan, NY',
    },
    verified: true,
    createdAt: '2024-02-01T14:30:00Z',
  },
];

export const mockPets: Pet[] = [
  {
    id: '1',
    name: 'Luna',
    species: 'dog',
    breed: 'Golden Retriever',
    age: 3,
    gender: 'female',
    size: 'large',
    color: 'Golden',
    description: 'Luna is a gentle, loving dog who adores children and other pets. She\'s house-trained, knows basic commands, and loves long walks in the park. Perfect for an active family!',
    photos: [
      'https://images.pexels.com/photos/1805164/pexels-photo-1805164.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1254140/pexels-photo-1254140.jpeg?auto=compress&cs=tinysrgb&w=800',
    ],
    location: {
      latitude: 40.7128,
      longitude: -74.0060,
      address: 'New York, NY',
    },
    shelter: {
      id: '1',
      name: 'Happy Paws Shelter',
      avatar: 'https://images.pexels.com/photos/4498362/pexels-photo-4498362.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&dpr=2',
    },
    status: 'available',
    healthStatus: {
      vaccinated: true,
      spayed: true,
      microchipped: true,
    },
    personality: ['Friendly', 'Energetic', 'Loyal', 'Good with kids'],
    goodWith: {
      kids: true,
      dogs: true,
      cats: true,
    },
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    name: 'Max',
    species: 'cat',
    breed: 'British Shorthair',
    age: 2,
    gender: 'male',
    size: 'medium',
    color: 'Gray',
    description: 'Max is a calm, affectionate cat who loves cuddles and quiet afternoons. He\'s perfect for someone looking for a loving companion who enjoys the simple pleasures of life.',
    photos: [
      'https://images.pexels.com/photos/1170986/pexels-photo-1170986.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1741205/pexels-photo-1741205.jpeg?auto=compress&cs=tinysrgb&w=800',
    ],
    location: {
      latitude: 40.7128,
      longitude: -74.0060,
      address: 'New York, NY',
    },
    shelter: {
      id: '1',
      name: 'Happy Paws Shelter',
      avatar: 'https://images.pexels.com/photos/4498362/pexels-photo-4498362.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&dpr=2',
    },
    status: 'available',
    healthStatus: {
      vaccinated: true,
      spayed: true,
      microchipped: true,
    },
    personality: ['Calm', 'Affectionate', 'Independent', 'Gentle'],
    goodWith: {
      kids: true,
      dogs: false,
      cats: true,
    },
    createdAt: '2024-01-20T15:30:00Z',
  },
  {
    id: '3',
    name: 'Bella',
    species: 'dog',
    breed: 'Border Collie',
    age: 4,
    gender: 'female',
    size: 'medium',
    color: 'Black & White',
    description: 'Bella is an intelligent, active dog who loves mental stimulation and physical exercise. She\'s great with kids and would thrive in an active household.',
    photos: [
      'https://images.pexels.com/photos/1490908/pexels-photo-1490908.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1888559/pexels-photo-1888559.jpeg?auto=compress&cs=tinysrgb&w=800',
    ],
    location: {
      latitude: 40.7128,
      longitude: -74.0060,
      address: 'New York, NY',
    },
    shelter: {
      id: '1',
      name: 'Happy Paws Shelter',
      avatar: 'https://images.pexels.com/photos/4498362/pexels-photo-4498362.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&dpr=2',
    },
    status: 'available',
    healthStatus: {
      vaccinated: true,
      spayed: true,
      microchipped: true,
    },
    personality: ['Intelligent', 'Active', 'Trainable', 'Loyal'],
    goodWith: {
      kids: true,
      dogs: true,
      cats: false,
    },
    createdAt: '2024-01-25T09:15:00Z',
  },
];

export const mockMessages: Message[] = [
  {
    id: '1',
    senderId: '2',
    receiverId: '1',
    petId: '1',
    content: 'Hi! I\'m interested in adopting Luna. Could you tell me more about her daily routine?',
    timestamp: '2024-01-28T10:30:00Z',
    read: true,
    type: 'text',
  },
  {
    id: '2',
    senderId: '1',
    receiverId: '2',
    petId: '1',
    content: 'Hello Sarah! Luna is wonderful. She loves morning walks and playing fetch. Would you like to schedule a meet and greet?',
    timestamp: '2024-01-28T11:00:00Z',
    read: false,
    type: 'text',
  },
];

export const mockChats: Chat[] = [
  {
    id: '1',
    participants: [mockUsers[0], mockUsers[1]],
    lastMessage: mockMessages[1],
    pet: mockPets[0],
    unreadCount: 1,
    updatedAt: '2024-01-28T11:00:00Z',
  },
];