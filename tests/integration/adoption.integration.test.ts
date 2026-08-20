import request from "supertest";
import { setupTestDB } from "../setupIntegration";
import AdoptionPost from "../../src/models/AdoptionPost";

const app = require("../../src/app");
setupTestDB();

const register = async () => {
  const response = await request(app).post("/api/auth/register").send({
    name: "Adoption Owner",
    email: "adoption-owner@test.com",
    phone: "+94771234567",
    password: "Password123!",
  });
  return { token: response.body.token as string, userId: response.body.user.id as string };
};

const validPayload = {
  category: "Dog",
  breed: "Mixed breed",
  ageValue: 6,
  ageUnit: "Months",
  gender: "Male",
  name: "Buddy",
  status: "Available",
  healthStatus: "Healthy",
  description: "Friendly dog looking for a permanent and caring home.",
  traits: ["Vaccinated"],
  images: ["https://example.com/buddy-1.jpg", "https://example.com/buddy-2.jpg"],
  location: "Matara, Sri Lanka",
  posterName: "Adoption Owner",
  contact: "+94771234567",
};

describe("Adoption Corner integration", () => {
  it("validates structured age and preserves image arrays", async () => {
    const owner = await register();
    const invalid = await request(app).post("/api/adoption").set("Authorization", `Bearer ${owner.token}`).send({ ...validPayload, ageValue: 0 });
    expect(invalid.status).toBe(400);

    const created = await request(app).post("/api/adoption").set("Authorization", `Bearer ${owner.token}`).send(validPayload);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ age: "6 Months", ageValue: 6, ageUnit: "Months", location: "Matara, Sri Lanka", images: validPayload.images });

    const updated = await request(app).put(`/api/adoption/${created.body._id}`).set("Authorization", `Bearer ${owner.token}`).send({ name: "Buddy II" });
    expect(updated.status).toBe(200);
    expect(updated.body.images).toEqual(validPayload.images);
    expect(updated.body.location).toBe("Matara, Sri Lanka");
  });

  it("continues returning legacy posts without structured age or coordinates", async () => {
    const owner = await register();
    const legacy = await AdoptionPost.create({ ...validPayload, userId: owner.userId, age: "2 Years", ageValue: undefined, ageUnit: undefined });
    const response = await request(app).get(`/api/adoption/${legacy._id}`);
    expect(response.status).toBe(200);
    expect(response.body.age).toBe("2 Years");
    expect(response.body.images).toEqual(validPayload.images);
  });
});
