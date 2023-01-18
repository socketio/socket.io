import logo from './logo.svg';
import './App.css';
import { useState } from 'react';
import socket from "./socket";

function App() {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState(null);

  const onUsernameSelection = () => {
    setStatus("loading");
    socket.auth = { username };
    socket.connect();
    setStatus("success");
  }

  return (
    <div className="App">
      <div className='form'>
        <div className='header'>
          <h3>💬 LiveChats</h3>
          <p>Login into to chat with strangers</p>
        </div>

        <input
          placeholder='Username'
          type={username}
          onChange={e => setUsername(e.target.value)}
        />

        <button className={status === "success" ? "joined" : null} onClick={onUsernameSelection}>
          {
            status === "loading" ?
              <div className='loader' /> :
              status === "success" ? <span>Joined Chat!</span> :
                <span>Join Chat</span>
          }
        </button>
      </div>
    </div>
  );
}

export default App;
