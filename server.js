const express = require("express");
const path = require("path");
const cors = require("cors");
const serveStatic = require("serve-static");
const uploadRouter = require("./routes/upload");
const roomRouter = require("./routes/room");
const {md2html} = require("./utils");
const fs = require('fs');
const app = express();
const server = require("http").createServer(app);
let io = require("socket.io")(server);
app.io = io;
app.use(cors());
app.use(serveStatic(path.join(__dirname, "public"), {maxAge: "600000"}));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use("/upload", uploadRouter);

app.get("/", (req, res) => {
  if (req.query && Object.keys(req.query).length > 0) {
    const roomID = Object.keys(req.query)[0];
    res.render("chat", { roomID });
  } else {
    res.render("index", {title: "Secure Chat"});
  }
});

app.use("/", roomRouter);

app.use(function (req, res) {
  res.status(404);
  res.send({error: "Not found"});
});

let rooms = new Map();
let userID2roomID = new Map();

function getAnnouncementFilePath(roomID) {
  return path.join(__dirname, 'public/upload', `__announcement-${roomID}.json`);
}

function loadSpecialRoomAnnouncement(roomID) {
  if (!isSpecialRoom(roomID)) return "";
  
  const filePath = getAnnouncementFilePath(roomID);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify({ announcement: "" }), 'utf8');
      return "";
    }
    const data = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(data);
    return parsed.announcement || "";
  } catch (err) {
    console.error('Error loading announcement:', err);
    return "";
  }
}

function saveSpecialRoomAnnouncement(roomID, announcement) {
  if (!isSpecialRoom(roomID)) return;
  
  const filePath = getAnnouncementFilePath(roomID);
  try {
    fs.writeFileSync(filePath, JSON.stringify({ announcement }, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving announcement:', err);
  }
}

function getRoom(roomID) {
  let room = rooms.get(roomID);
  if (!room) {
    room = {
      users: new Map(),
      usernameSet: new Set(),
      password: getSpecialRoomPassword(roomID),
      announcement: loadSpecialRoomAnnouncement(roomID)
    };
    rooms.set(roomID, room);
  }
  return room;
}

function getSpecialRoomPassword(roomID) {
  switch(roomID) { // Special roomID && Password
    case "MyLove": return "5201314"; 
    case "Tech": return "abc";
    case "Sci": return "xyz";
    default: return null;
  }
}

function loadChatHistory(roomID) {
  if (!isSpecialRoom(roomID)) return [];
  
  const filePath = path.join(__dirname, 'public/upload', `_records-${roomID}.json`);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([]), 'utf8');
      return [];
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading chat history:', err);
    return [];
  }
}

function saveChatHistory(roomID, message) {
  if (!isSpecialRoom(roomID)) return;
  
  const filePath = path.join(__dirname, 'public/upload', `_records-${roomID}.json`);
  try {
    let records = [];
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      records = JSON.parse(data || '[]');
    }
    records.push(message);
    fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving chat history:', err);
  }
}

function isSpecialRoom(roomID) {
  return ["MyLove", "Tech", "Sci"].includes(roomID); // Special roomID
}

io.sockets.on("connection", function (socket) {
  socket.on("register", function (username, roomID = "/", password = "") {
    let room = getRoom(roomID);

    if (room.usernameSet.has(username)) {
      socket.emit("conflict username");
      return;
    }

    if (isSpecialRoom(roomID)) {
      if (roomID === "MyLove") {
        if (username !== "Jack" && username !== "Amy") { // Special Special UserName
          socket.emit("unauthorized user");
          return;
        }
      }
      if (password !== room.password) {
        socket.emit("invalid password");
        return;
      }
    }

    room.users.set(socket.id, {
      username,
      isAdmin: room.users.size === 0
    });
    room.usernameSet.add(username);
    userID2roomID.set(socket.id, roomID);
    socket.join(roomID);
    socket.emit("register success");

    let data = {
      content: `${username} 加入聊天！`,
      sender: "Admin",
      type: "TEXT",
      timestamp: new Date().toISOString()
    };
    io.to(roomID).emit("message", data);
    io.to(roomID).emit("update users", Array.from(room.users.values()));
    
    // 新增：发送当前公告给新加入的用户
    if (room.announcement) {
      socket.emit("update announcement", md2html(room.announcement));
    }

    if (isSpecialRoom(roomID)) {
      const chatHistory = loadChatHistory(roomID);
      socket.emit("chat history", chatHistory);
    }
  });
  
  socket.on("update announcement", function (newAnnouncement) {
    let roomID = userID2roomID.get(socket.id);
    if (roomID) {
      let room = getRoom(roomID);
      if (room.users.get(socket.id).isAdmin) {
        room.announcement = newAnnouncement;
        const htmlAnnouncement = md2html(newAnnouncement);
        if (isSpecialRoom(roomID)) {
          saveSpecialRoomAnnouncement(roomID, newAnnouncement);
        }
        io.to(roomID).emit("update announcement", htmlAnnouncement);
      } else {
        socket.emit("message", {
          content: "只有管理员可以更新公告!",
          sender: "Admin",
          type: "TEXT",
          timestamp: new Date().toISOString()
        });
      }
    }
  });
  
  

  socket.on("change username", function (newUsername, roomID = "/") {
    let room = getRoom(roomID);
    let oldUsername = room.users.get(socket.id).username;
	
	// Special handling for MyLove room
	if (roomID === "MyLove") {
		if (newUsername !== "Jack" && newUsername !== "Amy") { //Special Special UserName
		socket.emit("username change failed", "千山鸟飞绝，唯待知音来...");
		return;
		}
	}
	
    if (room.usernameSet.has(newUsername) && newUsername !== oldUsername) {
      socket.emit("username change failed", "用户昵称已被占用");
      return;
    }
	
    room.usernameSet.delete(oldUsername);
    room.usernameSet.add(newUsername);
	
    room.users.get(socket.id).username = newUsername;
	
    socket.emit("username change success", newUsername);
	
    let data = {
      content: `${oldUsername} 已更改昵称为 ${newUsername}`,
      sender: "Admin",
      type: "TEXT",
      timestamp: new Date().toISOString()
    };
    io.to(roomID).emit("message", data);
    io.to(roomID).emit("update users", Array.from(room.users.values()));
  });

  socket.on("message", function (data, roomID = "/") {  	
    let room = getRoom(roomID);
    if (room.users.has(socket.id)) {
      if (!data) return;
      if (data.content === undefined) return;
      if (data.type === undefined) data.type = "TEXT";
      let user = room.users.get(socket.id);
      if (user.username === undefined || user.username === "") {
        user.username = "Anonymous";
      }
      data.sender = user.username;
      data.timestamp = new Date().toISOString();
      if (data.type === "TEXT") {
        data.content = md2html(data.content);
      }
      io.to(roomID).emit("message", data);
      if (isSpecialRoom(roomID)) {
        saveChatHistory(roomID, data);
      }
    } else {
      let data = {
        content: `登录已过期，请刷新页面或点击[修改昵称]!`,
        sender: "Admin",
        type: "TEXT",
        timestamp: new Date().toISOString()
      };
      socket.emit("message", data);
    }
  });

  socket.on("disconnect", () => {
    let roomID = userID2roomID.get(socket.id);
    if (roomID) {
      let room = getRoom(roomID);
      if (room.users.has(socket.id)) {
        userID2roomID.delete(socket.id);
        let username = room.users.get(socket.id).username;
        room.users.delete(socket.id);
        room.usernameSet.delete(username);
        if (room.users.size === 0) {
          rooms.delete(roomID);
        }
		
        let data = {
          content: `${username} 已离开！`,
          sender: "Admin",
          type: "TEXT",
          timestamp: new Date().toISOString()
        };
        io.to(roomID).emit("message", data);		
        io.to(roomID).emit("update users", Array.from(room.users.values()));		
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});