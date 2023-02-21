import React, { useEffect, useState } from 'react';
import Person from "../assets/person.png";
import "./Chat.css";
import socket from '../socket';
import useMessages from '../hooks/useMessages';

function Chat({
    username
}) {
    const [users, setUsers] = useState([]);
    const [chatUser, setChatUser] = useState(null);
    const [message, setMessage] = useState('');
    const [messages] = useMessages();

    const postMessage = message => {
        socket.emit("private message", {
            content: message,
            to: chatUser.userID
        });

        setMessage('');
    }

    useEffect(() => {
        socket.on("users", users => {
            setUsers(users);
            setChatUser(users[0]);
        });

        socket.on("user connected", user => {
            setUsers(users => {
                const userExists = users.includes(user);

                if (!userExists) {
                    return [...users, user];
                }

                return users;
            });
        });
    }, []);

    useEffect(() => {
        socket.on("user disconnected", disconnectedUserID => {
            const newUsers = users.filter(user => user.userID !== disconnectedUserID);

            setUsers(newUsers);
        });
    }, [users]);

    return (
        <div className='chat'>
            <div className='left'>
                <div className='user-info'>
                    <img src={Person} alt="User avatar" />
                    <div>{username}</div>
                </div>

                <div className='users'>
                    {users.map((user, index) => (
                        <div
                            className='user'
                            onClick={() => setChatUser(user)}
                            key={index}>
                            {user.username}
                        </div>
                    ))}
                </div>
            </div>

            <div className='right'>
                {chatUser ?
                    <div>
                        <div className='sticky-header'>
                            <div className='user'>
                                <h3>{chatUser ? chatUser.username : null}</h3>
                            </div>
                        </div>

                        <div className='chat-ui'>
                            <div className='messages-list'>
                                {
                                    messages
                                        .filter(message => message.from === chatUser.userID)
                                        .map((message, index) => (
                                            <div key={index}>
                                                {message.content}
                                            </div>
                                        ))
                                }
                            </div>

                            <div className='message-box'>
                                <input
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    type="text"
                                    placeholder="Your message"
                                />

                                <button onClick={() => postMessage(message)}>Send</button>
                            </div>
                        </div>
                    </div> :
                    <div className='no-user-selected'>
                        <h3>Select a user</h3>
                    </div>
                }
            </div>
        </div>
    );
}

export default Chat;