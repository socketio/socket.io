import { useState, useEffect } from "react";
import socket from "../socket";

function useMessages() {
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        socket.on("private message", message => {
            setMessages(messages => [
                ...messages,
                message
            ]);
        });
    }, [messages]);

    return [messages];
}

export default useMessages;