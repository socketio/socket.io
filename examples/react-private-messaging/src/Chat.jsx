import "./App.css";
import { socket } from "./socket";
import { useState } from "react";

export default function Chat({
  currentUser,
  users,
  selectedUser,
  setSelectedUser,
  currentChat,
  setCurrentChat,
}) {
  const [newMsg, setNewMsg] = useState("");
  const handleOnSelectUser = (user) => {
    if (user.userID !== currentUser.userID) {
      setSelectedUser(user);
      setCurrentChat(user.messages);
    }
  };
  const handleNewMsgKeyDown = (e) => {
    if (e.keyCode === 13) {
      console.log("socket emit new message");
      const message = {
        from: currentUser.userID,
        to: selectedUser.userID,
        content: newMsg,
      };
      socket.emit("private message", message);
      selectedUser.messages.push(message);
      setSelectedUser(selectedUser);
      setNewMsg("");
    }
  };
  const renderWhenNoUserOrNoSelectedUser = () => {
    let message;
    if (users.length === 1) {
      message = "Please wait for users to join";
    } else if (selectedUser == null) {
      message = "Please select a user to chat with";
    }
    return (
      <div
        style={{
          textAlign: "center",
        }}
      >
        <h2>{message}</h2>
      </div>
    );
  };

  return (
    <div className="chat-container">
      <div className="user-list">
        <h3>Users</h3>
        <ul>
          {users.map((u) => (
            <li
              className={
                "user " +
                (selectedUser && selectedUser.userID === u.userID
                  ? "selected"
                  : "")
              }
              onClick={() => handleOnSelectUser(u)}
            >
              <span className="name">{u.username}</span>
              {u.connected ? (
                <span className="status logged-in">●</span>
              ) : (
                <span className="status logged-off">●</span>
              )}
              {u.userID === currentUser.userID && <span>&nbsp;(You)</span>}
            </li>
          ))}
        </ul>
      </div>
      <div className="chat-window">
        {users.length === 1 || selectedUser == null ? (
          renderWhenNoUserOrNoSelectedUser()
        ) : (
          <>
            <ul className="chat-messages">
              {currentChat.length > 0 &&
                currentChat.map((m) => (
                  <li
                    className={
                      "message " +
                      (m.from === currentUser.userID ? "sent" : "received")
                    }
                  >
                    <div className="wrapper">
                      <span>{m.content}</span>
                    </div>
                  </li>
                ))}
            </ul>
            <input
              className="chat-input"
              type="text"
              placeholder="begin your chat"
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              onKeyDown={handleNewMsgKeyDown}
            />
          </>
        )}
      </div>
    </div>
  );
}
