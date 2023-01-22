import React, { useEffect, useState } from 'react';
import Person from "../assets/person.png";
import "./Chat.css";
import socket from '../socket';

const initReactiveProperties = user => user.hasNewMessages = false;

function Chat({
    username
}) {
    const [users, setUsers] = useState([]);

    useEffect(() => {
        socket.on("users", users => setUsers(users));

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
    }, [users])

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
                            key={index}>
                            {user.username}
                        </div>
                    ))}
                </div>
            </div>
            <div className='right'>

            </div>
        </div>
    );
}

export default Chat;