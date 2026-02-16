require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const http = require("http");
const { Server: SocketIOServer } = require("socket.io");
const { randomUUID } = require("crypto");

const app = express();
const httpServer = http.createServer(app);

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:5173"];
const HAS_CONFIGURED_ORIGINS = Boolean(process.env.CLIENT_ORIGIN && process.env.CLIENT_ORIGIN.trim());
const ALLOWED_ORIGINS = (
  HAS_CONFIGURED_ORIGINS ? process.env.CLIENT_ORIGIN.split(",") : DEFAULT_ALLOWED_ORIGINS
)
  .map((origin) => origin.trim())
  .filter(Boolean);
const isOriginAllowed = (origin) =>
  !origin || !HAS_CONFIGURED_ORIGINS || ALLOWED_ORIGINS.includes(origin);

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
});

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-123";

const fluxNexusHandler = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

fluxNexusHandler.connect((err) => {
  if (err) {
    console.error("Error connecting to taskNexus:", err);
    return;
  }
  console.log("Successfully connected to taskNexus stability layer.");
});

const getUserIdFromToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  try {
    const token = authHeader.split(" ")[1];
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.id || null;
  } catch (error) {
    return null;
  }
};

const requireAuthUser = (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return userId;
};

const NOTIFICATION_TYPES = new Set(["deadline", "assignment", "mention", "invite"]);

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Invalid token format" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.authUser = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const parseNotificationMetadata = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return {};
  }
};

const normalizeNotificationRow = (row) => ({
  id: row.id,
  user_id: row.user_id,
  type: row.type,
  title: row.title,
  message: row.message,
  metadata: parseNotificationMetadata(row.metadata),
  is_read: Boolean(row.is_read),
  created_at: row.created_at,
});

const emitNotificationToUser = (userId, notification) => {
  if (!userId || !notification) return;
  io.to(`user:${userId}`).emit("notification:new", notification);
};

const createNotificationRecord = (payload, callback = () => {}) => {
  const userId = Number.parseInt(payload?.userId, 10);
  const type = String(payload?.type || "").trim();
  const title = String(payload?.title || "").trim();
  const message = String(payload?.message || "").trim();

  if (!Number.isInteger(userId) || userId <= 0) {
    callback(new Error("Invalid notification user"));
    return;
  }

  if (!NOTIFICATION_TYPES.has(type)) {
    callback(new Error("Unsupported notification type"));
    return;
  }

  if (!title || !message) {
    callback(new Error("Notification title and message are required"));
    return;
  }

  const dedupeKey =
    String(payload?.dedupeKey || payload?.metadata?.dedupeKey || "").trim() ||
    `${type}:${userId}:${title}:${message}`;

  const metadata = {
    ...(payload?.metadata || {}),
    dedupeKey,
  };
  const metadataJson = JSON.stringify(metadata);

  fluxNexusHandler.query(
    `SELECT id
     FROM notifications
     WHERE user_id = ?
       AND type = ?
       AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.dedupeKey')) = ?
     LIMIT 1`,
    [userId, type, dedupeKey],
    (existingErr, existingRows) => {
      if (existingErr) {
        callback(existingErr);
        return;
      }

      if (existingRows && existingRows.length > 0) {
        callback(null, null, false);
        return;
      }

      const notificationId = randomUUID();

      fluxNexusHandler.query(
        `INSERT INTO notifications (id, user_id, type, title, message, metadata, is_read)
         VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
        [notificationId, userId, type, title, message, metadataJson],
        (insertErr) => {
          if (insertErr) {
            callback(insertErr);
            return;
          }

          fluxNexusHandler.query(
            `SELECT id, user_id, type, title, message, metadata, is_read, created_at
             FROM notifications
             WHERE id = ?
             LIMIT 1`,
            [notificationId],
            (selectErr, selectRows) => {
              if (selectErr) {
                callback(selectErr);
                return;
              }

              const createdNotification = selectRows?.[0]
                ? normalizeNotificationRow(selectRows[0])
                : null;

              if (createdNotification) {
                emitNotificationToUser(userId, createdNotification);
              }

              callback(null, createdNotification, true);
            }
          );
        }
      );
    }
  );
};

const notifyTaskAssignment = ({ assigneeId, taskId, projectId, taskTitle, actorUserId }) => {
  const parsedAssigneeId = Number.parseInt(assigneeId, 10);
  const parsedActorId = Number.parseInt(actorUserId, 10);

  if (!Number.isInteger(parsedAssigneeId) || parsedAssigneeId <= 0) return;
  if (Number.isInteger(parsedActorId) && parsedActorId === parsedAssigneeId) return;

  createNotificationRecord(
    {
      userId: parsedAssigneeId,
      type: "assignment",
      title: "New task assignment",
      message: `Task "${taskTitle || "Untitled Task"}" was assigned to you.`,
      metadata: {
        taskId,
        projectId,
        assignedBy: parsedActorId || null,
      },
      dedupeKey: `assignment:${taskId}:${parsedAssigneeId}`,
    },
    () => {}
  );
};

const extractMentionTargets = (text) => {
  const source = String(text || "");
  const usernames = new Set();
  const emails = new Set();

  const usernameRegex = /(^|[\s(])@([a-zA-Z0-9._-]{2,50})/g;
  let usernameMatch = usernameRegex.exec(source);
  while (usernameMatch) {
    usernames.add(String(usernameMatch[2]).toLowerCase());
    usernameMatch = usernameRegex.exec(source);
  }

  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,})/gi;
  let emailMatch = emailRegex.exec(source);
  while (emailMatch) {
    emails.add(String(emailMatch[1]).toLowerCase());
    emailMatch = emailRegex.exec(source);
  }

  return {
    usernames: [...usernames],
    emails: [...emails],
  };
};

const notifyMentionedUsers = ({ text, actorUserId, taskId, projectId, taskTitle }) => {
  const targets = extractMentionTargets(text);
  if (targets.usernames.length === 0 && targets.emails.length === 0) return;

  const whereClauses = [];
  const params = [];

  if (targets.usernames.length > 0) {
    whereClauses.push(`LOWER(username) IN (${targets.usernames.map(() => "?").join(",")})`);
    params.push(...targets.usernames);
  }

  if (targets.emails.length > 0) {
    whereClauses.push(`LOWER(email) IN (${targets.emails.map(() => "?").join(",")})`);
    params.push(...targets.emails);
  }

  fluxNexusHandler.query(
    `SELECT id, username, email
     FROM users
     WHERE ${whereClauses.join(" OR ")}`,
    params,
    (userErr, userRows) => {
      if (userErr || !userRows || userRows.length === 0) return;

      userRows.forEach((mentionedUser) => {
        const mentionedUserId = Number.parseInt(mentionedUser.id, 10);
        const parsedActorId = Number.parseInt(actorUserId, 10);
        if (!Number.isInteger(mentionedUserId) || mentionedUserId <= 0) return;
        if (Number.isInteger(parsedActorId) && parsedActorId === mentionedUserId) return;

        createNotificationRecord(
          {
            userId: mentionedUserId,
            type: "mention",
            title: "You were mentioned",
            message: `You were mentioned in task "${taskTitle || "Untitled Task"}".`,
            metadata: {
              taskId,
              projectId,
              mentionedBy: parsedActorId || null,
              mentionTarget: mentionedUser.username || mentionedUser.email || null,
            },
            dedupeKey: `mention:${taskId}:${mentionedUserId}`,
          },
          () => {}
        );
      });
    }
  );
};

const createDeadlineNotificationsForUser = (userId, onComplete = () => {}) => {
  const parsedUserId = Number.parseInt(userId, 10);
  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    onComplete();
    return;
  }

  fluxNexusHandler.query(
    `SELECT t.id, t.title, t.due_date, t.project_id
     FROM tasks t
     WHERE t.assignee_id = ?
       AND t.due_date IS NOT NULL
       AND t.due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 24 HOUR)
       AND (t.completed = 0 OR t.completed IS NULL)
       AND t.status != 'done'
     ORDER BY t.due_date ASC`,
    [parsedUserId],
    (taskErr, taskRows) => {
      if (taskErr || !taskRows || taskRows.length === 0) {
        onComplete();
        return;
      }

      let pending = taskRows.length;
      taskRows.forEach((taskRow) => {
        const dueDateIso = taskRow?.due_date
          ? new Date(taskRow.due_date).toISOString()
          : null;

        createNotificationRecord(
          {
            userId: parsedUserId,
            type: "deadline",
            title: "Task due within 24 hours",
            message: `Task "${taskRow.title}" is due soon.`,
            metadata: {
              taskId: taskRow.id,
              projectId: taskRow.project_id,
              dueDate: dueDateIso,
            },
            dedupeKey: `deadline:${taskRow.id}:${dueDateIso || "unknown"}`,
          },
          () => {
            pending -= 1;
            if (pending === 0) onComplete();
          }
        );
      });
    }
  );
};

const inviteWorkspaceMember = (req, res) => {
  const inviterUserId = requireAuthUser(req, res);
  if (!inviterUserId) return;

  const workspaceId = Number.parseInt(req.params.id, 10);
  const email = String(req.body?.email || "").trim().toLowerCase();

  if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
    return res.status(400).json({ error: "Invalid workspace id" });
  }

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  fluxNexusHandler.query(
    "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
    [workspaceId, inviterUserId],
    (membershipErr, membershipRows) => {
      if (membershipErr) {
        return res.status(500).json({ error: membershipErr.message });
      }

      if (!membershipRows || membershipRows.length === 0) {
        return res.status(403).json({ error: "You are not a member of this workspace" });
      }

      const inviterRole = membershipRows[0].role;
      if (inviterRole !== "owner" && inviterRole !== "admin") {
        return res.status(403).json({ error: "Only owner or admin can invite members" });
      }

      fluxNexusHandler.query(
        "SELECT id, username, email FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1",
        [email],
        (userErr, userRows) => {
          if (userErr) {
            return res.status(500).json({ error: userErr.message });
          }

          if (!userRows || userRows.length === 0) {
            return res.status(404).json({ error: "User not found with this email" });
          }

          const invitee = userRows[0];

          fluxNexusHandler.query(
            "SELECT workspace_id, user_id FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1",
            [workspaceId, invitee.id],
            (existingErr, existingRows) => {
              if (existingErr) {
                return res.status(500).json({ error: existingErr.message });
              }

              if (existingRows && existingRows.length > 0) {
                return res.status(409).json({ error: "User is already a workspace member" });
              }

              fluxNexusHandler.query(
                "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'member')",
                [workspaceId, invitee.id],
                (insertErr) => {
                  if (insertErr) {
                    return res.status(500).json({ error: insertErr.message });
                  }

                  fluxNexusHandler.query(
                    `SELECT wm.workspace_id, wm.user_id, wm.role, wm.joined_at, u.username, u.email
                     FROM workspace_members wm
                     JOIN users u ON u.id = wm.user_id
                     WHERE wm.workspace_id = ? AND wm.user_id = ?
                     LIMIT 1`,
                    [workspaceId, invitee.id],
                    (memberErr, memberRows) => {
                      if (memberErr) {
                        return res.status(500).json({ error: memberErr.message });
                      }

                      const invitedMember = memberRows?.[0] || null;
                      createNotificationRecord(
                        {
                          userId: invitee.id,
                          type: "invite",
                          title: "Workspace collaboration invite",
                          message: `You have been invited to workspace #${workspaceId}.`,
                          metadata: {
                            workspaceId,
                            invitedBy: inviterUserId,
                          },
                          dedupeKey: `invite:${workspaceId}:${invitee.id}`,
                        },
                        () => {
                          res.status(201).json({
                            success: true,
                            message: "Collaborator invited successfully",
                            member: invitedMember,
                          });
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
};

app.get("/", (req, res) => {
  res.send("TaskNexus API running");
});

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

app.post("/api/auth/register", (req, res) => {
  const { username, email, password } = req.body;

  const query =
    "INSERT INTO users (username, email, password_hash) VALUES ('" +
    username +
    "', '" +
    email +
    "', '" +
    password +
    "')";

  fluxNexusHandler.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const wsQuery =
      "INSERT INTO workspaces (name, description, owner_id) VALUES ('" +
      username +
      " Workspace', 'Default workspace', " +
      results.insertId +
      ")";
    fluxNexusHandler.query(wsQuery, (err2, wsResults) => {
      if (wsResults) {
        fluxNexusHandler.query(
          "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (" +
            wsResults.insertId +
            ", " +
            results.insertId +
            ", 'owner')"
        );

        fluxNexusHandler.query(
          "INSERT INTO projects (name, description, workspace_id) VALUES ('My First Project', 'Default project', " +
            wsResults.insertId +
            ")"
        );
      }

      const token = jwt.sign(
        { id: results.insertId, username, email },
        JWT_SECRET
      );

      res.json({ token, user: { id: results.insertId, username, email } });
    });
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  const query = "SELECT * FROM users WHERE email = '" + email + "'";

  fluxNexusHandler.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: "No account found with this email" });
    }

    var user = results[0];

    if (user.password_hash !== password) {
      return res.status(401).json({ error: "Wrong password" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  });
});

app.get("/api/auth/me", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    fluxNexusHandler.query(
      "SELECT id, username, email FROM users WHERE id = ?",
      [decoded.id],
      (err, results) => {
        if (err) throw err;
        res.json(results[0]);
      }
    );
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

app.get("/api/notifications", authenticateToken, (req, res) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const requestedOffset = Number.parseInt(req.query.offset, 10);
  const requestedPage = Number.parseInt(req.query.page, 10);

  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 20;
  const offset = Number.isInteger(requestedOffset)
    ? Math.max(requestedOffset, 0)
    : Math.max((Number.isInteger(requestedPage) ? requestedPage : 1) - 1, 0) * limit;

  createDeadlineNotificationsForUser(req.userId, () => {
    fluxNexusHandler.query(
      `SELECT id, user_id, type, title, message, metadata, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [req.userId, limit, offset],
      (listErr, listRows) => {
        if (listErr) {
          return res.status(500).json({ error: listErr.message });
        }

        fluxNexusHandler.query(
          "SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?",
          [req.userId],
          (totalErr, totalRows) => {
            if (totalErr) {
              return res.status(500).json({ error: totalErr.message });
            }

            fluxNexusHandler.query(
              "SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = FALSE",
              [req.userId],
              (unreadErr, unreadRows) => {
                if (unreadErr) {
                  return res.status(500).json({ error: unreadErr.message });
                }

                res.json({
                  notifications: (listRows || []).map(normalizeNotificationRow),
                  unreadCount: Number(unreadRows?.[0]?.unread || 0),
                  pagination: {
                    total: Number(totalRows?.[0]?.total || 0),
                    limit,
                    offset,
                  },
                });
              }
            );
          }
        );
      }
    );
  });
});

app.post("/api/notifications", authenticateToken, (req, res) => {
  const { type, title, message, metadata, userId, user_id } = req.body || {};
  const targetUserId = Number.parseInt(userId ?? user_id ?? req.userId, 10);

  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ error: "Valid target user is required" });
  }

  if (targetUserId !== Number(req.userId)) {
    return res.status(403).json({ error: "Cannot create notification for another user" });
  }

  createNotificationRecord(
    {
      userId: targetUserId,
      type,
      title,
      message,
      metadata: metadata && typeof metadata === "object" ? metadata : {},
      dedupeKey:
        metadata && typeof metadata === "object" && metadata.dedupeKey
          ? metadata.dedupeKey
          : undefined,
    },
    (createErr, notification, created) => {
      if (createErr) {
        return res.status(400).json({ error: createErr.message });
      }

      if (!created) {
        return res.status(200).json({
          success: true,
          duplicate: true,
          notification: null,
        });
      }

      return res.status(201).json({
        success: true,
        duplicate: false,
        notification,
      });
    }
  );
});

app.patch("/api/notifications/read-all", authenticateToken, (req, res) => {
  fluxNexusHandler.query(
    "UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE",
    [req.userId],
    (updateErr, updateResult) => {
      if (updateErr) {
        return res.status(500).json({ error: updateErr.message });
      }

      return res.json({
        success: true,
        updated: Number(updateResult?.affectedRows || 0),
      });
    }
  );
});

app.patch("/api/notifications/:id/read", authenticateToken, (req, res) => {
  const notificationId = String(req.params.id || "").trim();
  if (!notificationId) {
    return res.status(400).json({ error: "Notification id is required" });
  }

  fluxNexusHandler.query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE id = ? AND user_id = ?`,
    [notificationId, req.userId],
    (updateErr, updateResult) => {
      if (updateErr) {
        return res.status(500).json({ error: updateErr.message });
      }

      if (!updateResult?.affectedRows) {
        return res.status(404).json({ error: "Notification not found" });
      }

      return res.json({ success: true });
    }
  );
});

app.get("/api/workspaces", (req, res) => {
  const authHeader = req.headers.authorization;
  let userId = 1;

  try {
    if (authHeader) {
      const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      userId = decoded.id;
    }
  } catch (e) {}

  fluxNexusHandler.query(
    `SELECT w.*, wm.role 
     FROM workspaces w
     JOIN workspace_members wm ON w.id = wm.workspace_id
     WHERE wm.user_id = ?
     ORDER BY w.created_at DESC`,
    [userId],
    (err, results) => {
      if (err) {
        return res.status(500).send("Nexus error");
      }
      res.json(results);
    }
  );
});

app.get("/api/workspaces/:id", (req, res) => {
  const userId = requireAuthUser(req, res);
  if (!userId) return;

  fluxNexusHandler.query(
    `SELECT w.*, wm.role
     FROM workspaces w
     JOIN workspace_members wm ON wm.workspace_id = w.id
     WHERE w.id = ? AND wm.user_id = ?
     LIMIT 1`,
    [req.params.id, userId],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!results || results.length === 0) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      res.json(results[0]);
    }
  );
});

app.post("/api/workspaces", (req, res) => {
  const { name, description } = req.body;

  let userId = 1;
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      userId = jwt.verify(token, JWT_SECRET).id;
    }
  } catch (e) {}

  const query =
    "INSERT INTO workspaces (name, description, owner_id) VALUES ('" +
    name +
    "', '" +
    description +
    "', " +
    userId +
    ")";

  fluxNexusHandler.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    fluxNexusHandler.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (" +
        results.insertId +
        ", " +
        userId +
        ", 'owner')"
    );

    res.json({
      id: results.insertId,
      name,
      description,
      owner_id: userId,
      role: "owner",
    });
  });
});

app.delete("/api/workspaces/:id", (req, res) => {
  fluxNexusHandler.query(
    "DELETE FROM workspaces WHERE id = ?",
    [req.params.id],
    (err, results) => {
      if (err) throw err;
      res.json({ message: "Workspace purged from nexus" });
    }
  );
});

app.get("/api/workspaces/:id/members", (req, res) => {
  const userId = requireAuthUser(req, res);
  if (!userId) return;

  const workspaceId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
    return res.status(400).json({ error: "Invalid workspace id" });
  }

  fluxNexusHandler.query(
    `SELECT u.id, wm.user_id, u.username, u.email, wm.role, wm.joined_at
     FROM workspace_members wm 
     JOIN users u ON wm.user_id = u.id 
     WHERE wm.workspace_id = ?
     ORDER BY wm.joined_at ASC`,
    [workspaceId],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(results);
    }
  );
});

app.get("/api/users/search", (req, res) => {
  const userId = requireAuthUser(req, res);
  if (!userId) return;

  const emailQuery = String(req.query.email || "").trim();
  const workspaceId = Number.parseInt(req.query.workspaceId, 10);

  if (!emailQuery || emailQuery.length < 2) {
    return res.json([]);
  }

  let query =
    "SELECT u.id, u.username, u.email FROM users u WHERE LOWER(u.email) LIKE LOWER(?)";
  const params = [`%${emailQuery}%`];

  if (Number.isInteger(workspaceId) && workspaceId > 0) {
    query +=
      " AND u.id NOT IN (SELECT user_id FROM workspace_members WHERE workspace_id = ?)";
    params.push(workspaceId);
  }

  query +=
    " ORDER BY CASE WHEN LOWER(u.email) = LOWER(?) THEN 0 ELSE 1 END, u.email ASC LIMIT 8";
  params.push(emailQuery);

  fluxNexusHandler.query(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows || []);
  });
});

app.post("/api/workspaces/:id/invite", inviteWorkspaceMember);

app.get("/api/projects/workspace/:workspaceId", (req, res) => {
  fluxNexusHandler.query(
    "SELECT * FROM projects WHERE workspace_id = ? ORDER BY created_at DESC",
    [req.params.workspaceId],
    (err, projects) => {
      if (err) return res.status(500).send("Error");

      if (projects.length === 0) return res.json([]);

      let completed = 0;
      projects.forEach((project, index) => {
        fluxNexusHandler.query(
          'SELECT COUNT(*) as task_count, SUM(CASE WHEN status = "done" THEN 1 ELSE 0 END) as completed_count FROM tasks WHERE project_id = ?',
          [project.id],
          (err2, counts) => {
            projects[index].task_count = counts ? counts[0].task_count : 0;
            projects[index].completed_count = counts
              ? counts[0].completed_count
              : 0;
            completed++;
            if (completed === projects.length) {
              res.json(projects);
            }
          }
        );
      });
    }
  );
});

app.get("/api/projects/:id", (req, res) => {
  fluxNexusHandler.query(
    "SELECT * FROM projects WHERE id = ?",
    [req.params.id],
    (err, results) => {
      res.json(results[0]);
    }
  );
});

app.post("/api/projects", (req, res) => {
  const { name, description, color, workspaceId } = req.body;

  const query =
    "INSERT INTO projects (name, description, color, workspace_id) VALUES ('" +
    name +
    "', '" +
    description +
    "', '" +
    (color || "#3B82F6") +
    "', " +
    workspaceId +
    ")";

  fluxNexusHandler.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      id: results.insertId,
      name,
      description,
      color: color || "#3B82F6",
      workspace_id: workspaceId,
      task_count: 0,
      completed_count: 0,
    });
  });
});

app.delete("/api/projects/:id", (req, res) => {
  fluxNexusHandler.query("DELETE FROM projects WHERE id = ?", [req.params.id], (err) => {
    if (err) throw err;
    res.json({ message: "Project purged" });
  });
});

app.get("/api/tasks", (req, res) => {
  const { projectId } = req.query;
  let query =
    "SELECT t.*, u.username as assignee_name FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id";

  if (projectId) {
    query += " WHERE t.project_id = " + projectId;
  }

  query += " ORDER BY t.created_at DESC";

  fluxNexusHandler.query(query, (err, results) => {
    res.json(results);
  });
});

app.post("/api/tasks", (req, res) => {
  const { title, description, status, priority, due_date, project_id, assignee_id } = req.body;

  let userId = 1;
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) userId = jwt.verify(token, JWT_SECRET).id;
  } catch (e) {}

  const parsedAssigneeId = Number.parseInt(assignee_id, 10);
  const safeAssigneeId =
    Number.isInteger(parsedAssigneeId) && parsedAssigneeId > 0
      ? parsedAssigneeId
      : null;

  const query =
    "INSERT INTO tasks (title, description, status, priority, due_date, project_id, assignee_id, created_by) VALUES ('" +
    title +
    "', '" +
    (description || "") +
    "', '" +
    (status || "todo") +
    "', '" +
    (priority || "medium") +
    "', " +
    (due_date ? "'" + due_date + "'" : "NULL") +
    ", " +
    project_id +
    ", " +
    (safeAssigneeId ? safeAssigneeId : "NULL") +
    ", " +
    userId +
    ")";

  fluxNexusHandler.query(query, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Nexus error");
    }
    const createdTask = {
      id: results.insertId,
      title,
      description: description || "",
      status: status || "todo",
      priority: priority || "medium",
      due_date,
      project_id,
      assignee_id: safeAssigneeId,
      created_by: userId,
      completed: false,
    };

    notifyTaskAssignment({
      assigneeId: safeAssigneeId,
      taskId: createdTask.id,
      projectId: createdTask.project_id,
      taskTitle: createdTask.title,
      actorUserId: userId,
    });

    if (description) {
      notifyMentionedUsers({
        text: description,
        actorUserId: userId,
        taskId: createdTask.id,
        projectId: createdTask.project_id,
        taskTitle: createdTask.title,
      });
    }

    res.json(createdTask);
  });
});

app.put("/api/tasks/:id", (req, res) => {
  const { id } = req.params;
  const { title, description, status, priority, due_date, completed, assignee_id } = req.body;

  let requesterId = 1;
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) requesterId = jwt.verify(token, JWT_SECRET).id;
  } catch (e) {}

  var fields = [];
  var values = [];

  if (title !== undefined) {
    fields.push("title = ?");
    values.push(title);
  }
  if (description !== undefined) {
    fields.push("description = ?");
    values.push(description);
  }
  if (status !== undefined) {
    fields.push("status = ?");
    values.push(status);
  }
  if (priority !== undefined) {
    fields.push("priority = ?");
    values.push(priority);
  }
  if (due_date !== undefined) {
    fields.push("due_date = ?");
    values.push(due_date);
  }
  if (completed !== undefined) {
    fields.push("completed = ?");
    values.push(completed);
    if (completed) fields.push("status = 'done'");
  }
  if (assignee_id !== undefined) {
    fields.push("assignee_id = ?");
    const parsedAssigneeId = Number.parseInt(assignee_id, 10);
    values.push(Number.isInteger(parsedAssigneeId) && parsedAssigneeId > 0 ? parsedAssigneeId : null);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: "No valid fields provided" });
  }

  values.push(id);
  var updateQuery = `UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`;
  fluxNexusHandler.query(updateQuery, values, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    fluxNexusHandler.query(
      "SELECT id, title, description, project_id, assignee_id FROM tasks WHERE id = ? LIMIT 1",
      [id],
      (taskErr, taskRows) => {
        if (!taskErr && taskRows && taskRows.length > 0) {
          const updatedTask = taskRows[0];

          if (assignee_id !== undefined) {
            notifyTaskAssignment({
              assigneeId: updatedTask.assignee_id,
              taskId: updatedTask.id,
              projectId: updatedTask.project_id,
              taskTitle: updatedTask.title,
              actorUserId: requesterId,
            });
          }

          if (description !== undefined && description !== null && description !== "") {
            notifyMentionedUsers({
              text: updatedTask.description,
              actorUserId: requesterId,
              taskId: updatedTask.id,
              projectId: updatedTask.project_id,
              taskTitle: updatedTask.title,
            });
          }
        }

        res.json({ success: true });
      }
    );
  });
});

app.delete("/api/tasks/:id", (req, res) => {
  const id = req.params.id;
  fluxNexusHandler.query("DELETE FROM tasks WHERE id = ?", [id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Failed to delete" });
    }
    res.json({ message: "Task purged from nexus" });
  });
});

app.get("/api/analytics/dashboard", (req, res) => {
  let userId = 1;
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) userId = jwt.verify(token, JWT_SECRET).id;
  } catch (e) {}

  fluxNexusHandler.query(
    "SELECT w.id FROM workspaces w JOIN workspace_members wm ON w.id = wm.workspace_id WHERE wm.user_id = ?",
    [userId],
    (err, workspaces) => {
      if (err || !workspaces || workspaces.length === 0) {
        return res.json({
          totalTasks: 0,
          completedTasks: 0,
          inProgressTasks: 0,
          overdueTasks: 0,
          totalProjects: 0,
          totalWorkspaces: 0,
          recentActivity: [],
          tasksByStatus: [],
          tasksByPriority: [],
        });
      }

      const wsIds = workspaces.map((w) => w.id);
      const placeholders = wsIds.map(() => "?").join(",");

      fluxNexusHandler.query(
        `SELECT COUNT(*) as totalTasks,
            SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completedTasks,
            SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as inProgressTasks,
            SUM(CASE WHEN t.due_date < NOW() AND t.status != 'done' THEN 1 ELSE 0 END) as overdueTasks
         FROM tasks t JOIN projects p ON t.project_id = p.id WHERE p.workspace_id IN (${placeholders})`,
        wsIds,
        (err2, stats) => {
          fluxNexusHandler.query(
            `SELECT COUNT(*) as totalProjects FROM projects WHERE workspace_id IN (${placeholders})`,
            wsIds,
            (err3, projStats) => {
              fluxNexusHandler.query(
                `SELECT t.status, COUNT(*) as count 
                 FROM tasks t JOIN projects p ON t.project_id = p.id 
                 WHERE p.workspace_id IN (${placeholders}) 
                 GROUP BY t.status`,
                wsIds,
                (err4, byStatus) => {
                  fluxNexusHandler.query(
                    `SELECT t.priority, COUNT(*) as count 
                     FROM tasks t JOIN projects p ON t.project_id = p.id 
                     WHERE p.workspace_id IN (${placeholders}) 
                     GROUP BY t.priority`,
                    wsIds,
                    (err5, byPriority) => {
                      res.json({
                        totalTasks: stats[0]?.totalTasks || 0,
                        completedTasks: stats[0]?.completedTasks || 0,
                        inProgressTasks: stats[0]?.inProgressTasks || 0,
                        overdueTasks: stats[0]?.overdueTasks || 0,
                        totalProjects: projStats[0]?.totalProjects || 0,
                        totalWorkspaces: wsIds.length,
                        recentActivity: [],
                        tasksByStatus: byStatus || [],
                        tasksByPriority: byPriority || [],
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

io.use((socket, next) => {
  try {
    const authToken = socket.handshake?.auth?.token || "";
    const bearerHeader = socket.handshake?.headers?.authorization || "";
    const tokenFromBearer = bearerHeader.startsWith("Bearer ")
      ? bearerHeader.slice(7)
      : "";
    const token = String(authToken || tokenFromBearer || "").trim();

    if (!token) {
      next(new Error("Authentication required"));
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (error) {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  const userId = Number.parseInt(socket.userId, 10);
  if (!Number.isInteger(userId) || userId <= 0) {
    socket.disconnect(true);
    return;
  }

  socket.join(`user:${userId}`);
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Nexus stability layer active on port ${PORT}`);
});
