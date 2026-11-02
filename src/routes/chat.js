const express = require("express");
const chatRouter = express.Router();
const { userAuth } = require("../middlewares/auth");
const Chat = require("../models/chat");
const { validatePagination } = require("../middlewares/validation");

// Sanitize message to prevent XSS - using a map to avoid HTML entity encoding issues
const sanitizeMessage = (text) => {
  const entityMap = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": "'",
    '/': '&#x2F;'
  };
  return String(text).replace(/[&<>"'\/]/g, (char) => entityMap[char] || char);
};

/**
 * @route GET /api/chat/:targetUserId
 * @description Get chat messages with cursor-based pagination
 * @queryParams: cursor (message ID), limit (default 50, max 100)
 */
chatRouter.get("/:targetUserId", userAuth, validatePagination, async (req, res) => {
  const userId = req.user._id;
  const targetUserId = req.params.targetUserId;
  const { cursor, limit = 50 } = req.query;

  try {
    const chat = await Chat.findOne({
      participants: { $all: [userId, targetUserId] }
    }).populate("messages.senderId", "firstName");

    if (!chat) {
      return res.status(200).json({
        success: true,
        data: [],
        nextCursor: null,
        hasMore: false
      });
    }

    // Sort messages by createdAt descending (newest first)
    let messages = [...chat.messages].sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Apply cursor-based pagination
    if (cursor) {
      const cursorIndex = messages.findIndex(msg => msg._id.toString() === cursor);
      if (cursorIndex !== -1) {
        messages = messages.slice(cursorIndex + 1);
      }
    }

    // Limit results
    const limitedMessages = messages.slice(0, parseInt(limit));
    const hasMore = messages.length > parseInt(limit);
    const nextCursor = hasMore ? limitedMessages[limitedMessages.length - 1]._id.toString() : null;

    // Reverse to show oldest first for frontend
    limitedMessages.reverse();

    res.status(200).json({
      success: true,
      data: limitedMessages,
      nextCursor,
      hasMore
    });

  } catch (error) {
    console.error("Error fetching chat:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch chat messages"
    });
  }
});

/**
 * @route DELETE /api/chat/message/:messageId
 * @description Delete a specific message
 */
chatRouter.delete("/message/:messageId", userAuth, async (req, res) => {
  const userId = req.user._id;
  const { messageId } = req.params;

  try {
    const chat = await Chat.findOne({
      participants: userId,
      "messages._id": messageId
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    const message = chat.messages.id(messageId);
    if (!message || message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to delete this message"
      });
    }

    message.deleteOne();
    await chat.save();

    res.status(200).json({
      success: true,
      message: "Message deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete message"
    });
  }
});

/**
 * @route PATCH /api/chat/message/:messageId
 * @description Edit a specific message
 */
chatRouter.patch("/message/:messageId", userAuth, async (req, res) => {
  const userId = req.user._id;
  const { messageId } = req.params;
  const { text } = req.body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "Message text is required"
    });
  }

  if (text.length > 5000) {
    return res.status(400).json({
      success: false,
      message: "Message too long (max 5000 characters)"
    });
  }

  try {
    const chat = await Chat.findOne({
      participants: userId,
      "messages._id": messageId
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    const message = chat.messages.id(messageId);
    if (!message || message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to edit this message"
      });
    }

    // Sanitize
    const sanitizedText = sanitizeMessage(text);

    message.text = sanitizedText;
    await chat.save();

    res.status(200).json({
      success: true,
      message: "Message updated successfully",
      data: message
    });

  } catch (error) {
    console.error("Error editing message:", error);
    res.status(500).json({
      success: false,
      message: "Failed to edit message"
    });
  }
});

module.exports = chatRouter;