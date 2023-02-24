import React, { useEffect, useState } from 'react';
import Person from "../assets/person.png";
import "./Chat.css";
import socket from '../socket';
import useMessages from '../hooks/useMessages';

function Chat({
    username
}) {
    const [users, setUsers] = useState([]);
    const [message, setMessage] = useState('');
    const [chatUser, setChatUser] = useState(0);
    const [messages, setMessages] = useMessages();

    const postMessage = message => {
        const msg = {
            content: message,
            to: users[chatUser].userID
        };

        socket.emit("private message", msg);

        setMessages(messages => [
            ...messages,
            msg
        ]);


        setMessage('');
    }

    useEffect(() => {
        socket.on("users", users => {
            setUsers(users);
            setChatUser(0);
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
                            className={`user ${chatUser === index ? 'active' : 'inactive'}`}
                            onClick={() => setChatUser(index)}
                            key={index}>
                            {user.username}
                        </div>
                    ))}
                </div>
            </div>

            <div className='right'>
                {users[chatUser] ?
                    <div>
                        <div className='sticky-header'>
                            <div className='user'>
                                <h3>{users[chatUser] ? users[chatUser].username : null}</h3>
                            </div>
                        </div>

                        <div className='chat-ui'>
                            <div className='messages-list'>
                                {
                                    messages
                                        .filter(message => message.from === users[chatUser].userID || message.to === users[chatUser].userID)
                                        .map((message, index) => (
                                            <div
                                                className={`message ${message.from === users[chatUser].userID ? 'received' : 'sent'}`}
                                                key={index}>
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