import logo from './logo.svg';
import './App.css';
import { useState } from 'react';
import socket from "./socket";

function App() {
  const [username, setUsername] = useState("");

  const onUsernameSelection = () => {
    socket.auth = { username };
    socket.connect();
  }

  return (
    <div className="App">
      <input
        placeholder='Username'
        type={username}
        onChange={e => setUsername(e.target.value)}
      />

      <button onClick={onUsernameSelection}>Submit</button>
    </div>
  );
}

export default App;
