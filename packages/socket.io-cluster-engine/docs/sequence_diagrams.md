<h1>Sequence diagrams</h1>

<!-- TOC -->
  * [Scenarios](#scenarios)
    * [HTTP long-polling (read)](#http-long-polling-read)
    * [HTTP long-polling (write)](#http-long-polling-write)
    * [WebSocket upgrade](#websocket-upgrade)
  * [Message types](#message-types)
<!-- TOC -->

## Scenarios

### HTTP long-polling (read)

```mermaid
sequenceDiagram
    autonumber

    participant C as Client
    participant W1 as Worker A
    participant B as Cluster bus
    participant W2 as Worker B

    Note over W1: Initial Engine.IO session exists on Worker A

    C->>W2: HTTP GET polling<br/>sid=abc
    Note over W2: Session ID unknown locally

    W2->>B: ACQUIRE_LOCK<br/>sid=abc, transport=polling, type=read
    B->>W1: ACQUIRE_LOCK
    Note over W1: Lockable if current transport is polling<br/>and polling transport is not writable

    W1->>B: ACQUIRE_LOCK_RESPONSE<br/>success=true
    B->>W2: ACQUIRE_LOCK_RESPONSE
    Note over W2: Create remote polling transport

    Note over W1: When packets are flushed on Worker A

    W1->>B: DRAIN<br/>packets=[...]
    B->>W2: DRAIN

    W2->>C: HTTP polling response<br/>packets=[...]

    Note over W2: For polling, remote transport is drained once<br/>then removed
```

### HTTP long-polling (write)

```mermaid
sequenceDiagram
    autonumber

    participant C as Client
    participant W1 as Worker A
    participant B as Cluster bus
    participant W2 as Worker B

    C->>W2: HTTP POST polling<br/>sid=abc, packet=data
    Note over W2: Session ID unknown locally

    W2->>B: ACQUIRE_LOCK<br/>sid=abc, transport=polling, type=write
    B->>W1: ACQUIRE_LOCK
    Note over W1: Polling write is accepted<br/>if session is still on polling

    W1->>B: ACQUIRE_LOCK_RESPONSE<br/>success=true
    B->>W2: ACQUIRE_LOCK_RESPONSE
    Note over W2: Create remote polling transport

    W2->>B: PACKET<br/>sid=abc, packet=data
    B->>W1: PACKET

    alt connection still delayed
        Note over W1: Buffer packet
    else connection already emitted
        Note over W1: Call `client.onPacket()`
    end

    W2->>C: HTTP 200 OK
```

### WebSocket upgrade

```mermaid
sequenceDiagram
    autonumber

    participant C as Client
    participant W1 as Worker A
    participant B as Cluster bus
    participant W2 as Worker B

    Note over W1: Client is connected with HTTP long-polling on Worker A

    C->>W2: HTTP Upgrade WebSocket<br/>sid=abc
    Note over W2: Session ID unknown locally

    W2->>B: ACQUIRE_LOCK<br/>sid=abc, transport=websocket, type=read
    B->>W1: ACQUIRE_LOCK
    Note over W1: Lockable if current transport is polling<br/>and not already upgrading/upgraded

    W1->>B: ACQUIRE_LOCK_RESPONSE<br/>success=true
    B->>W2: ACQUIRE_LOCK_RESPONSE

    Note over W2: Accept WebSocket upgrade and start upgrade probe

    C->>W2: ping "probe"
    W2->>C: pong "probe"
    C->>W2: upgrade packet
    Note over W2: Hook remote WebSocket transport

    W2->>B: UPGRADE<br/>sid=abc, success=true
    B->>W1: UPGRADE

    alt connection was still delayed
        W1->>B: UPGRADE_RESPONSE<br/>takeOver=true, packets=buffered
        B->>W2: UPGRADE_RESPONSE

        Note over W2: Create local Socket on WebSocket transport
    else connection was already emitted
        W1->>B: UPGRADE_RESPONSE<br/>takeOver=false, packets=[]
        B->>W2: UPGRADE_RESPONSE

        Note over W1,W2: Session ownership remains on Worker A,<br/>WebSocket transport lives on Worker B
    end
```

## Message types

| Message type            | Direction                               | Purpose                                                                                                   |
|-------------------------|-----------------------------------------|-----------------------------------------------------------------------------------------------------------|
| `ACQUIRE_LOCK`          | Requesting worker → cluster             | Ask which worker owns the session ID and whether the requested transport operation is allowed.            |
| `ACQUIRE_LOCK_RESPONSE` | Owning worker → requesting worker       | Grant or deny the lock request.                                                                           |
| `DRAIN`                 | Owning worker → remote transport worker | Forward packets that need to be written back to the client.                                               |
| `PACKET`                | Remote transport worker → owning worker | Forward a packet received from the client to the worker that owns the session.                            |
| `UPGRADE`               | Upgrade worker → owning worker          | Notify the owning worker that the transport upgrade probe succeeded.                                      |
| `UPGRADE_RESPONSE`      | Owning worker → upgrade worker          | Tell the upgrade worker whether it should take over the session, and optionally include buffered packets. |
| `CLOSE`                 | Remote transport worker → owning worker | Notify the owning worker that the remote transport closed or errored.                                     |
