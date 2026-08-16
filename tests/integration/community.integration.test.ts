import request from "supertest";
import { setupTestDB } from "../setupIntegration";
import CommunityLike from "../../src/models/CommunityLike";
import CommunityComment from "../../src/models/CommunityComment";
import SavedCommunityPost from "../../src/models/SavedCommunityPost";

const Notification = require("../../src/models/Notification");
const app = require("../../src/app");

setupTestDB();

const register = async (name: string, email: string) => {
  const response = await request(app).post("/api/auth/register").send({
    name,
    email,
    phone: "+9477" + Math.floor(1000000 + Math.random() * 8999999),
    password: "Password123!",
  });
  return { token: response.body.token as string, userId: response.body.user.id as string };
};

describe("Community Feed integration", () => {
  it("secures author identity and supports likes, comments, saves, ownership and deletion", async () => {
    const owner = await register("Post Owner", "community-owner@test.com");
    const visitor = await register("Feed Visitor", "community-visitor@test.com");

    const unauthenticatedCreate = await request(app).post("/api/community/create").send({
      title: "Unauthorized post", category: "Pet Care Tips", content: "This must not be created.",
    });
    expect(unauthenticatedCreate.status).toBe(401);

    const created = await request(app)
      .post("/api/community/create")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        title: "Safe feeding tips",
        category: "Pet Care Tips",
        content: "Always provide clean water and introduce new food gradually.",
        authorName: "Forged author",
      });
    expect(created.status).toBe(201);
    expect(created.body.data.authorUserId).toBe(owner.userId);
    expect(created.body.data.username).toBe("Post Owner");
    expect(created.body.data.isOwner).toBe(true);
    const postId = created.body.data._id as string;

    const myPosts = await request(app).get("/api/community/mine")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(myPosts.body.data.map((post: any) => post._id)).toContain(postId);

    const firstLike = await request(app).post(`/api/community/${postId}/like`)
      .set("Authorization", `Bearer ${visitor.token}`);
    const duplicateLike = await request(app).post(`/api/community/${postId}/like`)
      .set("Authorization", `Bearer ${visitor.token}`);
    expect(firstLike.body.data.likeCount).toBe(1);
    expect(duplicateLike.body.data.likeCount).toBe(1);
    expect(await CommunityLike.countDocuments({ postId })).toBe(1);
    expect(await Notification.countDocuments({ postId, type: "post_like" })).toBe(1);

    await request(app).post(`/api/community/${postId}/like`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(await Notification.countDocuments({ postId, type: "post_like" })).toBe(1);

    const unlike = await request(app).delete(`/api/community/${postId}/like`)
      .set("Authorization", `Bearer ${visitor.token}`);
    expect(unlike.body.data).toMatchObject({ isLiked: false, likeCount: 1 });
    await request(app).post(`/api/community/${postId}/like`)
      .set("Authorization", `Bearer ${visitor.token}`);
    expect(await Notification.countDocuments({ postId, type: "post_like" })).toBe(1);

    const emptyComment = await request(app).post(`/api/community/${postId}/comments`)
      .set("Authorization", `Bearer ${visitor.token}`).send({ content: "   " });
    expect(emptyComment.status).toBe(400);

    const comment = await request(app).post(`/api/community/${postId}/comments`)
      .set("Authorization", `Bearer ${visitor.token}`).send({ content: "Very helpful advice." });
    expect(comment.status).toBe(201);
    expect(comment.body.data.username).toBe("Feed Visitor");
    expect(comment.body.commentCount).toBe(1);
    expect(await CommunityComment.countDocuments({ postId })).toBe(1);
    expect(await Notification.countDocuments({ postId, type: "post_comment" })).toBe(1);

    await request(app).post(`/api/community/${postId}/save`)
      .set("Authorization", `Bearer ${visitor.token}`);
    await request(app).post(`/api/community/${postId}/save`)
      .set("Authorization", `Bearer ${visitor.token}`);
    expect(await SavedCommunityPost.countDocuments({ postId, userId: visitor.userId })).toBe(1);

    const saved = await request(app).get("/api/community/saved")
      .set("Authorization", `Bearer ${visitor.token}`);
    expect(saved.body.data).toHaveLength(1);
    expect(saved.body.data[0].isSaved).toBe(true);

    await request(app).delete(`/api/community/${postId}/save`)
      .set("Authorization", `Bearer ${visitor.token}`);
    expect(await SavedCommunityPost.countDocuments({ postId, userId: visitor.userId })).toBe(0);
    await request(app).post(`/api/community/${postId}/save`)
      .set("Authorization", `Bearer ${visitor.token}`);

    const forbiddenEdit = await request(app).put(`/api/community/${postId}`)
      .set("Authorization", `Bearer ${visitor.token}`)
      .send({ title: "Changed title", category: "Pet Care Tips", content: "This edit must be forbidden." });
    expect(forbiddenEdit.status).toBe(403);

    const ownerEdit = await request(app).put(`/api/community/${postId}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Updated feeding tips", category: "Health & First Aid", content: "Use clean bowls and introduce every dietary change gradually." });
    expect(ownerEdit.status).toBe(200);
    expect(ownerEdit.body.data.title).toBe("Updated feeding tips");

    const selfReport = await request(app).post(`/api/community/${postId}/report`)
      .set("Authorization", `Bearer ${owner.token}`).send({ reason: "Spam or irrelevant" });
    expect(selfReport.status).toBe(403);

    const report = await request(app).post(`/api/community/${postId}/report`)
      .set("Authorization", `Bearer ${visitor.token}`).send({ reason: "Spam or irrelevant" });
    const duplicateReport = await request(app).post(`/api/community/${postId}/report`)
      .set("Authorization", `Bearer ${visitor.token}`).send({ reason: "Spam or irrelevant" });
    expect(report.status).toBe(201);
    expect(duplicateReport.status).toBe(409);

    const refreshedFeed = await request(app).get("/api/community")
      .set("Authorization", `Bearer ${visitor.token}`);
    expect(refreshedFeed.body.data[0]).toMatchObject({
      _id: postId,
      likeCount: 2,
      commentCount: 1,
      isLiked: true,
      isSaved: true,
      isOwner: false,
    });

    const forbiddenDelete = await request(app).delete(`/api/community/${postId}`)
      .set("Authorization", `Bearer ${visitor.token}`);
    expect(forbiddenDelete.status).toBe(403);

    const deleted = await request(app).delete(`/api/community/${postId}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(deleted.status).toBe(200);
    expect(await CommunityLike.countDocuments({ postId })).toBe(0);
    expect(await CommunityComment.countDocuments({ postId })).toBe(0);
    expect(await SavedCommunityPost.countDocuments({ postId })).toBe(0);
    expect(await Notification.countDocuments({ postId })).toBe(0);
  });
});
