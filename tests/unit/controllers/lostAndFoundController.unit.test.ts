import mongoose from "mongoose";
import { mockRequest, mockResponse } from "../../helpers/mockRequestResponse";
import {
  getAnimalPosts,
  getAnimalPostsByUser,
  getAnimalPostById,
  createAnimalPost,
  updateAnimalPost,
  deleteAnimalPost,
  reportAnimalPost,
  LostFoundService,
} from "../../../src/controllers/lostAndFoundController";
import LostFoundPost from "../../../src/models/LostFoundPost";

jest.mock("../../../src/models/LostFoundPost");
jest.mock("../../../src/utils/cloudinaryUpload", () => ({
  uploadFileToCloudinary: jest.fn().mockResolvedValue("https://res.cloudinary.com/mock-upload.jpg"),
}));

describe("Lost & Found Controller Unit Tests", () => {
  let req: any;
  let res: any;

  const validUserId = new mongoose.Types.ObjectId().toString();
  const validPostId = new mongoose.Types.ObjectId().toString();
  const alternateUserId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    jest.clearAllMocks();
  });

  describe("getAnimalPosts", () => {
    it("should fetch all posts successfully", async () => {
      const mockPosts = [
        { _id: validPostId, status: "lost", description: "Lost Dog", location: "Colombo" },
      ];
      const mockPopulate = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockPosts),
      });
      (LostFoundPost.find as jest.Mock).mockReturnValue({ populate: mockPopulate });

      req.query = {};
      await getAnimalPosts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockPosts);
    });

    it("should filter posts by status and type", async () => {
      req.query = { status: "lost", type: "dog" };
      const mockPopulate = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      (LostFoundPost.find as jest.Mock).mockReturnValue({ populate: mockPopulate });

      await getAnimalPosts(req, res);

      expect(LostFoundPost.find).toHaveBeenCalledWith(
        expect.objectContaining({ status: "lost", type: "dog" })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should handle error when DB query fails", async () => {
      (LostFoundPost.find as jest.Mock).mockImplementation(() => {
        throw new Error("DB Error");
      });

      req.query = {};
      await getAnimalPosts(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "DB Error" });
    });
  });

  describe("getAnimalPostsByUser", () => {
    it("should return 400 for invalid user ID format", async () => {
      req.params = { userId: "invalid-id" };
      await getAnimalPostsByUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid user ID format" });
    });

    it("should fetch posts for a valid user ID", async () => {
      req.params = { userId: validUserId };
      const mockPopulate = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      (LostFoundPost.find as jest.Mock).mockReturnValue({ populate: mockPopulate });

      await getAnimalPostsByUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getAnimalPostById", () => {
    it("should return 400 for invalid post ID format", async () => {
      req.params = { id: "invalid-id" };
      await getAnimalPostById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid post ID format" });
    });

    it("should return 404 if post is not found", async () => {
      req.params = { id: validPostId };
      (LostFoundPost.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await getAnimalPostById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Post not found" });
    });

    it("should return 200 with post data when post exists", async () => {
      const mockPost = { _id: validPostId, name: "Buddy", status: "lost" };
      req.params = { id: validPostId };
      (LostFoundPost.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockPost),
      });

      await getAnimalPostById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockPost);
    });
  });

  describe("createAnimalPost", () => {
    it("should return 401 if user is unauthenticated", async () => {
      req.user = undefined;
      req.body = { description: "Lost cat", location: "Kandy" };

      await createAnimalPost(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 if description is missing", async () => {
      req.user = { id: validUserId, role: "user" };
      req.body = { status: "lost", location: "Colombo" };

      await createAnimalPost(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Description is required" });
    });

    it("should return 400 if location is missing", async () => {
      req.user = { id: validUserId, role: "user" };
      req.body = { status: "lost", description: "Golden Retriever lost" };

      await createAnimalPost(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Location is required" });
    });

    it("should return 400 for invalid status value", async () => {
      req.user = { id: validUserId, role: "user" };
      req.body = { status: "unknown", description: "Test pet", location: "Galle" };

      await createAnimalPost(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Status must be either 'lost' or 'found'" });
    });

    it("should create a post successfully with 201 status", async () => {
      req.user = { id: validUserId, role: "user" };
      req.body = {
        status: "lost",
        type: "dog",
        description: "Friendly brown dog missing near park",
        location: "Colombo 07",
        imageUrl: "https://example.com/dog.jpg",
      };

      const mockSavedPost = {
        _id: validPostId,
        userId: { _id: validUserId, name: "Test User" },
        status: "lost",
        type: "dog",
        description: "Friendly brown dog missing near park",
        location: "Colombo 07",
        imageUrl: "https://example.com/dog.jpg",
        images: ["https://example.com/dog.jpg"],
        toObject: () => ({
          _id: validPostId,
          status: "lost",
          type: "dog",
          description: "Friendly brown dog missing near park",
          location: "Colombo 07",
        }),
      };

      jest.spyOn(LostFoundService, "createPost").mockResolvedValue(mockSavedPost as any);

      await createAnimalPost(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Post created successfully",
          data: mockSavedPost,
        })
      );
    });
  });

  describe("updateAnimalPost", () => {
    it("should return 400 for invalid post ID format", async () => {
      req.user = { id: validUserId, role: "user" };
      req.params = { id: "invalid-id" };

      await updateAnimalPost(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 if post is not found", async () => {
      req.user = { id: validUserId, role: "user" };
      req.params = { id: validPostId };
      req.body = { description: "Updated description text" };

      jest.spyOn(LostFoundService, "updatePost").mockResolvedValue({ post: null, status: "NOT_FOUND" });

      await updateAnimalPost(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 403 if unauthorized user attempts update", async () => {
      req.user = { id: alternateUserId, role: "user" };
      req.params = { id: validPostId };
      req.body = { description: "Attempted update text" };

      jest.spyOn(LostFoundService, "updatePost").mockResolvedValue({ post: null, status: "UNAUTHORIZED" });

      await updateAnimalPost(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should update post successfully for owner", async () => {
      req.user = { id: validUserId, role: "user" };
      req.params = { id: validPostId };
      req.body = { description: "Updated description text long enough" };

      const updatedPost = {
        _id: validPostId,
        userId: validUserId,
        description: "Updated description text long enough",
        toObject: () => ({ _id: validPostId, description: "Updated description text long enough" }),
      };

      jest.spyOn(LostFoundService, "updatePost").mockResolvedValue({ post: updatedPost as any, status: "SUCCESS" });

      await updateAnimalPost(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Post updated successfully" })
      );
    });
  });

  describe("deleteAnimalPost", () => {
    it("should return 403 if user is unauthorized to delete", async () => {
      req.user = { id: alternateUserId, role: "user" };
      req.params = { id: validPostId };

      jest.spyOn(LostFoundService, "deletePost").mockResolvedValue("UNAUTHORIZED");

      await deleteAnimalPost(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should delete post successfully for owner or admin", async () => {
      req.user = { id: validUserId, role: "user" };
      req.params = { id: validPostId };

      jest.spyOn(LostFoundService, "deletePost").mockResolvedValue("SUCCESS");

      await deleteAnimalPost(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Post deleted successfully" });
    });
  });

  describe("reportAnimalPost", () => {
    it("should return 400 for invalid post ID format", async () => {
      req.params = { id: "invalid-id" };

      await reportAnimalPost(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should increment report count and return 200 when post reported", async () => {
      req.params = { id: validPostId };
      const reportedPost = { _id: validPostId, reportCount: 1 };

      jest.spyOn(LostFoundService, "reportPost").mockResolvedValue(reportedPost as any);

      await reportAnimalPost(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Post reported successfully", reportCount: 1 })
      );
    });
  });
});
