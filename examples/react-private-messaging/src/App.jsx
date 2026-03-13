import { useEffect, useState } from "react";
import SignIn from "./SignIn";
import Chat from "./Chat";
import { socket } from "./socket";
import "./App.css";

const defaultUser = {
  isLoggedIn: false,
  username: null,
  userID: null,
  connected: false,
};

function App() {
  const [user, setUser] = useState(defaultUser);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState();
  const [currentChatMsg, setCurrentChatMsg] = useState(
    selectedUser?.messages || []
  );

  const onSignIn = (username) => {
    setUser({
      ...user,
      isLoggedIn: username.length > 0,
      username,
    });
  };

  useEffect(() => {
    if (user.isLoggedIn) {
      function getAllUsers(users) {
        console.log(users);
        users = users.sort((a, b) => {
          if (a.self) return -1;
          if (b.self) return 1;
          if (a.username < b.username) return -1;
          return a.username > b.username ? 1 : 0;
        });
        console.log(users);
        setAllUsers(users);
      }
      function setSession({ sessionID, userID }) {
        socket.auth.sessionID = sessionID;
        socket.userID = userID;
        setUser({
          ...user,
          sessionID,
          userID,
        });
        localStorage.setItem("sessionID", sessionID);
      }
      function handleConnectError(err) {
        if (err.message === "invalid username") {
          setUser(defaultUser);
        }
      }
      function addNewUser(user) {
        let newList = [...allUsers];
        newList.push(user);
        newList = newList.sort((a, b) => {
          if (a.self) return -1;
          if (b.self) return 1;
          if (a.username < b.username) return -1;
          return a.username > b.username ? 1 : 0;
        });
        setAllUsers(newList);
      }
      function removeUser(userID) {
        let newList = allUsers.filter((au) => au.userID !== userID);
        setAllUsers([...newList]);
      }
      function updateWithMessages({ from, to, content }) {
        for (let i = 0; i < allUsers.length; i++) {
          const user = allUsers[i];
          if (user.userID === from) {
            user.messages.push({
              from,
              to,
              content,
            });
          }
          if (user.userID === to) {
            user.messages.push({
              from,
              to,
              content,
            });
          }
        }

        setAllUsers([...allUsers]);
        if (new Set([from, to]).has(selectedUser?.userID)) {
          setCurrentChatMsg(
            allUsers.filter((u) => u.userID === selectedUser?.userID)[0]
              .messages
          );
        }
      }
      if (!socket.auth) {
        socket.auth = { username: user.username };
      }
      socket.connect();
      socket.on("connect_error", handleConnectError);
      socket.on("users", getAllUsers);
      socket.on("session", setSession);
      socket.on("user connected", addNewUser);
      socket.on("user disconnected", removeUser);
      socket.on("private message", updateWithMessages);
      return () => {
        socket.off("connect_error", handleConnectError);
        socket.off("users", getAllUsers);
        socket.off("session", setSession);
        socket.off("user connected", addNewUser);
        socket.off("user disconnected", removeUser);
        socket.off("private message", updateWithMessages);
      };
    }
  }, [user.isLoggedIn, allUsers.length]);

  return (
    <>
      <div className="app-container">
        {user.isLoggedIn ? (
          <Chat
            currentUser={user}
            users={allUsers}
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            currentChat={currentChatMsg}
            setCurrentChat={setCurrentChatMsg}
          />
        ) : (
          <SignIn onSignIn={onSignIn} />
        )}
      </div>
    </>
  );
}

export default App;
