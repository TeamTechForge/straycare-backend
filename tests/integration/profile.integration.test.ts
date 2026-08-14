import request from 'supertest';
import { setupTestDB } from '../setupIntegration';
import User from '../../src/models/User';
const GeneralUserProfile = require('../../src/models/GeneralUserProfile');
const Rescuer = require('../../src/models/Rescuer');

const app = require('../../src/app');

// Setup in-memory DB and reset collections after each test
setupTestDB();

describe('Profile Integration Tests', () => {
  let userToken: string;
  let volunteerToken: string;
  
  const generalUserPayload = {
    name: 'General User',
    email: 'general@test.com',
    password: 'Password123!',
    phone: '+94771111111',
  };

  const volunteerPayload = {
    name: 'Volunteer User',
    email: 'volunteer@test.com',
    password: 'Password123!',
    phone: '+94772222222',
  };

  beforeEach(async () => {
    // 1. Register a general user
    const resGeneral = await request(app).post('/api/auth/register').send(generalUserPayload);
    userToken = resGeneral.body.token;

    // 2. Register a volunteer user
    const resVolunteer = await request(app).post('/api/auth/register').send(volunteerPayload);
    volunteerToken = resVolunteer.body.token;
    
    // Update the volunteer user's role manually since registration defaults to general_user
    await User.updateOne({ email: volunteerPayload.email }, { role: 'volunteer' });
  });

  describe('POST /api/profiles/general', () => {
    it('should create a general profile, update the user, and return 201', async () => {
      const profileData = {
        location: 'Colombo, Sri Lanka',
        bio: 'Animal lover',
        profileImage: 'http://example.com/avatar.jpg'
      };

      const response = await request(app)
        .post('/api/profiles/general')
        .set('Authorization', `Bearer ${userToken}`)
        .send(profileData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'General profile created');
      expect(response.body.profile).toHaveProperty('bio', 'Animal lover');

      // Verify the profile was actually saved in DB
      const dbProfile = await GeneralUserProfile.findOne({ bio: 'Animal lover' });
      expect(dbProfile).not.toBeNull();

      // Verify the base User model was updated
      const dbUser = await User.findOne({ email: generalUserPayload.email });
      expect(dbUser?.profileCompleted).toBe(true);
      expect(dbUser?.profileImage).toBe('http://example.com/avatar.jpg');
    });

    it('should return 401 if token is missing', async () => {
      const response = await request(app).post('/api/profiles/general').send({});
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/profiles/volunteer', () => {
    it('should create a volunteer profile and accurately provision a Rescuer record', async () => {
      const volunteerData = {
        location: 'Kandy, Sri Lanka',
        bio: 'Available for weekend rescues',
        profileImage: 'http://example.com/volunteer.jpg',
        name: 'Volunteer User Updated',
        latitude: 7.2906,
        longitude: 80.6337
      };

      const response = await request(app)
        .post('/api/profiles/volunteer')
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send(volunteerData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Volunteer profile created');

      // Verify the Rescuer was successfully provisioned
      const dbRescuer = await Rescuer.findOne({ phone: volunteerPayload.phone });
      expect(dbRescuer).not.toBeNull();
      expect(dbRescuer?.isAvailable).toBe(true);
      expect(dbRescuer?.location.latitude).toBe(7.2906);
    });
  });

  describe('GET /api/profiles/me', () => {
    it('should retrieve the created profile for the authenticated general user', async () => {
      // Create profile first
      await request(app)
        .post('/api/profiles/general')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ location: 'Galle', bio: 'Looking to adopt' });

      // Fetch profile
      const response = await request(app)
        .get('/api/profiles/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('bio', 'Looking to adopt');
    });

    it('should return 404 if the user has not completed their profile yet', async () => {
      // Newly registered user fetching profile without creating one first
      const response = await request(app)
        .get('/api/profiles/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Profile not found');
    });
  });
});
