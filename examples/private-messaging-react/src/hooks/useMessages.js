import { useState, useEffect, useContext } from "react";
import SocketContext from "../context/SocketContext";

function useMessages() {
    const socket = useContext(SocketContext);
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        socket.on("private message", message => {
            setMessages(messages => [
                ...messages,
                message
            ]);
        });

        return () => socket.off();
    }, [socket]);

    return [messages, setMessages];
}

export default useMessages;