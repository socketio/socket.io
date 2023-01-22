const httpServer = require("http").createServer();
const io = require("socket.io")(httpServer, {
    cors: {
        origin: "*"
    }
});
const crypto = require("crypto");
const { InMemoryMessageStore } = require("./messageStore");
const randomId = () => crypto.randomBytes(8).toString("hex");

let users = [];
const messageStore = new InMemoryMessageStore();

io.use(async (socket, next) => {
    const username = socket.handshake.auth.username;

    if (!username) {
        return next(new Error("invalid username!"));
    }

    socket.userID = randomId();
    socket.username = username;
    next();
});

io.on("connection", async socket => {
    // emit session details
    socket.emit("session", {
        userID: socket.userID
    });

    // join the "userID" room
    socket.join(socket.userID);

    // fetch existing users
    const messages = messageStore.findMessagesForUser(socket.userID);
    const messagesPerUser = new Map();
    messages.forEach(message => {
        const { from, to } = message;
        const otherUser = socket.userID === from ? to : from;

        if (messagesPerUser.has(otherUser)) {
            messagesPerUser.get(otherUser).push(message);
        } else {
            messagesPerUser.set(otherUser, [message]);
        }
    });

    users.push({
        userID: socket.userID,
        username: socket.username,
        connected: socket.connected,
        messages: messagesPerUser.get(socket.userID) || [],
    });

    socket.emit("users", users);

    // notify existing users
    socket.broadcast.emit("user connected", {
        userID: socket.userID,
        username: socket.username,
        connected: true,
        messages: []
    });

    // forward the private messages to the right recipent (and to other tabs of the sender)
    socket.on("private message", ({ content, to }) => {
        const message = {
            content,
            from: socket.userID,
            to
        };

        socket.to(to).emit("private message", message);
        messageStore.saveMessage(message);
    });

    // notify users on disconnection
    socket.on("disconnect", async () => {
        const matchingSockets = await io.in(socket.userID).allSockets();
        const isDisconnected = matchingSockets.size === 0;

        if (isDisconnected) {
            socket.broadcast.emit("user disconnected", socket.userID);
        }

        users = users.filter(user => user.userID !== socket.userID);
    });
});

httpServer.listen(8080, () => {
    console.log("Listening on http://localhost:8080")
});