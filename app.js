require("dotenv").config();

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const cron = require("node-cron");
const path = require("path");
const Message = require("./models/Message");

const app = express();
const PORT = process.env.PORT || 3000;

/* =======================
   HTTP + SOCKET.IO
======================= */
const server = http.createServer(app);
const io = new Server(server);

/* =======================
   APP CONFIG (FIXED)
======================= */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

/* =======================
   MONGODB CONNECT (SAFE)
======================= */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Atlas connected"))
  .catch(err => console.error("❌ Mongo error:", err.message));

/* =======================
   ROUTES
======================= */
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/chat", async (req, res) => {
  const { username, room } = req.query;

  if (!username || !room) {
    return res.redirect("/");
  }

  const messages = await Message.find({ room }).sort({ createdAt: 1 });
  res.render("chat", { username, room, messages });
});

/* =======================
   SOCKET.IO
======================= */
io.on("connection", (socket) => {
  socket.on("joinRoom", ({ username, room }) => {
    if (!username || !room) return;
    socket.join(room);
    socket.username = username;
    socket.room = room;
  });

  socket.on("chatMessage", async (msg) => {
    if (!socket.username || !socket.room || !msg.trim()) return;

    const message = await Message.create({
      user: socket.username,
      room: socket.room,
      text: msg
    });

    io.to(socket.room).emit("message", message);
  });
});

/* =======================
   CRON JOB (OK)
======================= */
cron.schedule("0 0 * * *", async () => {
  await Message.deleteMany({});
  console.log("🧹 Messages cleared");
});

/* =======================
   SERVER START (OK)
======================= */
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
