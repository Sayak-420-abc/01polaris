import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { verifyToken } from "@clerk/backend";

import { inngest } from "@/inngest/client";
import { convex } from "@/lib/convex-client";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

const requestSchema = z.object({
  conversationId: z.string(),
  message: z.string(),
});

export async function POST(request: Request) {
  const authData = await auth();
  let userId = authData.userId;

  console.log("=== API Auth Debug ===");
  console.log("Cookie userId:", userId);
  console.log("sessionId:", authData.sessionId);
  console.log("Clerk Publishable Key:", process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  console.log("Clerk Secret Key exists:", !!process.env.CLERK_SECRET_KEY);

  if (!userId) {
    // Fallback: Check Authorization header for Bearer token
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const verifiedToken = await verifyToken(token, {
          secretKey: process.env.CLERK_SECRET_KEY,
          clockSkewInMs: 15000000, // 4 hours leeway for system clock drift
        });
        userId = verifiedToken.sub;
        console.log("Bearer userId verified:", userId);
      } catch (err) {
        console.error("Clerk verifyToken failed for bearer token:", err);
      }
    }
  }
  console.log("Final userId:", userId);
  console.log("=== End API Auth Debug ===");

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;

  if (!internalKey) {
    return NextResponse.json(
      { error: "Internal key not configured" },
      { status: 500 },
    );
  }

  const body = await request.json();
  const { conversationId, message } = requestSchema.parse(body);

  // Call convex mutation, query
  const conversation = await convex.query(api.system.getConversationById, {
    internalKey,
    conversationId: conversationId as Id<"conversations">,
  });

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  const projectId = conversation.projectId;

  // Find all processing messages in this project
  const processingMessages = await convex.query(
    api.system.getProcessingMessages,
    {
      internalKey,
      projectId,
    },
  );

  if (processingMessages.length > 0) {
    // Cancel all processing messages
    await Promise.all(
      processingMessages.map(async (msg) => {
        await inngest.send({
          name: "message/cancel",
          data: {
            messageId: msg._id,
          },
        });

        await convex.mutation(api.system.updateMessageStatus, {
          internalKey,
          messageId: msg._id,
          status: "cancelled",
        });
      }),
    );
  }

  // Create user message
  await convex.mutation(api.system.createMessage, {
    internalKey,
    conversationId: conversationId as Id<"conversations">,
    projectId,
    role: "user",
    content: message,
  });

  // Create assistant message placeholder with processing status
  const assistantMessageId = await convex.mutation(api.system.createMessage, {
    internalKey,
    conversationId: conversationId as Id<"conversations">,
    projectId,
    role: "assistant",
    content: "",
    status: "processing",
  });

  // Trigger Inngest to process the message
  const event = await inngest.send({
    name: "message/sent",
    data: {
      messageId: assistantMessageId,
      conversationId,
      projectId,
      message,
    },
  });

  return NextResponse.json({
    success: true,
    eventId: event.ids[0],
    messageId: assistantMessageId,
  });
}
