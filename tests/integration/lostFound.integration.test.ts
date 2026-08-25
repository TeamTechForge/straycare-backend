import request from "supertest";
import { setupTestDB } from "../setupIntegration";
import User from "../../src/models/User";
import LostFoundPost from "../../src/models/LostFoundPost";

const app = require("../../src/app");

setupTestDB();

describe("Lost & Found Integration Tests", () => {
  let userToken: string;
  let userId: string;
  let post1Id: string;

  beforeEach(async () => {
    // 1. Register a test user
    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "LostFound Tester",
        email: "lostfound@test.com",
        password: "Password123!",
        phone: "0771234567",
      });

    userToken = registerResponse.body.token;
    userId = registerResponse.body.user ? registerResponse.body.user._id : registerResponse.body._id;

    // 2. Create a test post in MongoDB directly
    const dbUser = await User.findOne({ email: "lostfound@test.com" });
    if (dbUser) userId = dbUser._id.toString();

    const post = await LostFoundPost.create({
      userId,
      status: "lost",
      type: "dog",
      breed: "Labrador",
      name: "Max",
      description: "Friendly golden labrador missing near Colombo central park",
      location: "Colombo 03",
      contactName: "LostFound Tester",
      contactNumber: "0771234567",
      imageUrl: "https://res.cloudinary.com/test/image/upload/max.jpg",
      images: ["https://res.cloudinary.com/test/image/upload/max.jpg"],
    });

    post1Id = post._id.toString();
  });

  describe("GET /api/animals", () => {
    it("should fetch all lost/found posts", async () => {
      const response = await request(app).get("/api/animals");

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0]).toHaveProperty("name", "Max");
    });

    it("should filter by status via GET /api/animals?status=lost", async () => {
      const response = await request(app).get("/api/animals?status=lost");

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].status).toBe("lost");
    });

    it("should return empty array for GET /api/animals?status=found when none match", async () => {
      const response = await request(app).get("/api/animals?status=found");

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(0);
    });

    it("should fetch posts via explicit GET /api/animals/lost", async () => {
      const response = await request(app).get("/api/animals/lost");

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].status).toBe("lost");
    });

    it("should perform text search via GET /api/animals?search=Labrador", async () => {
      const response = await request(app).get("/api/animals?search=Labrador");

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].breed).toBe("Labrador");
    });
  });

  describe("GET /api/animals/:id", () => {
    it("should return single post by ID", async () => {
      const response = await request(app).get(`/api/animals/${post1Id}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("_id", post1Id);
      expect(response.body).toHaveProperty("name", "Max");
    });

    it("should return 400 for invalid ObjectId string", async () => {
      const response = await request(app).get("/api/animals/invalid-id-format");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("message", "Invalid post ID format");
    });

    it("should return 404 for non-existent ObjectId", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      const response = await request(app).get(`/api/animals/${fakeId}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("message", "Post not found");
    });
  });

  describe("POST /api/animals", () => {
    it("should create a new post when authorized and valid payload", async () => {
      const payload = {
        status: "found",
        type: "cat",
        breed: "Persian",
        description: "White Persian cat found near Galle Face Green",
        location: "Galle Face, Colombo",
        contactName: "Finder",
        contactNumber: "0719999999",
        imageUrl: "https://example.com/cat.jpg",
        images: ["https://example.com/cat.jpg"],
      };

      const response = await request(app)
        .post("/api/animals")
        .set("Authorization", `Bearer ${userToken}`)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("message", "Post created successfully");
      expect(response.body.data).toHaveProperty("status", "found");
      expect(response.body.data).toHaveProperty("breed", "Persian");
      expect(response.body.data).toHaveProperty("images");
      expect(response.body.data.images).toContain("https://example.com/cat.jpg");
    });

    it("should return 400 if required fields are missing", async () => {
      const payload = {
        status: "lost",
        // description missing!
        location: "Kandy",
      };

      const response = await request(app)
        .post("/api/animals")
        .set("Authorization", `Bearer ${userToken}`)
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("message", "Description is required");
    });

    it("should return 401 if request has no Bearer token", async () => {
      const response = await request(app)
        .post("/api/animals")
        .send({ status: "lost", description: "Test", location: "Loc" });

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /api/animals/:id", () => {
    it("should update post successfully when caller is owner", async () => {
      const response = await request(app)
        .put(`/api/animals/${post1Id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ name: "Maximus", description: "Updated description for Maximus pet" });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message", "Post updated successfully");
      expect(response.body.data).toHaveProperty("name", "Maximus");
    });
  });

  describe("POST /api/animals/:id/report", () => {
    it("should increment report count", async () => {
      const response = await request(app)
        .post(`/api/animals/${post1Id}/report`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("reportCount", 1);
    });
  });

  describe("DELETE /api/animals/:id", () => {
    it("should delete post when requested by owner", async () => {
      const response = await request(app)
        .delete(`/api/animals/${post1Id}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message", "Post deleted successfully");

      const checkResponse = await request(app).get(`/api/animals/${post1Id}`);
      expect(checkResponse.status).toBe(404);
    });
  });
});
