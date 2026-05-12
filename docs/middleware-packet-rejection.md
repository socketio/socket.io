# Socket.IO Middleware: Rejecting Packets

This guide explains how to reject or drop packets from Socket.IO middleware without causing errors.

## Overview

Socket.IO middleware allows you to intercept and process packets before they reach their handlers. Sometimes you need to reject or drop packets based on certain conditions (e.g., ACL permissions, rate limiting, validation).

## Basic Middleware

### Socket Middleware

Socket middleware runs for every packet received by the socket:

```javascript
io.use(function(socket, next) {
  // Authentication middleware
  if (socket.handshake.auth.token) {
    // Verify token
    return next();
  }
  next(new Error('Authentication error'));
});
```

### Packet Middleware

Packet middleware runs for every event received by the socket:

```javascript
io.use(function(socket, next) {
  socket.use(function([event, data], next) {
    // Process packet
    console.log(`Received event: ${event}`);
    next();
  });
  next();
});
```

## Rejecting Packets

### Method 1: Return Without Calling Next

The simplest way to reject a packet is to return from the middleware without calling `next()`:

```javascript
io.use(function(socket, next) {
  socket.use(function([event, data], next) {
    // Check if user has permission to emit this event
    if (!hasPermission(socket, event)) {
      // Silently drop the packet
      return;
    }
    
    // Allow the packet to proceed
    next();
  });
  next();
});
```

### Method 2: Conditional Processing

You can conditionally process packets based on event type:

```javascript
io.use(function(socket, next) {
  socket.use(function([event, data], next) {
    // Allow public events
    if (event.startsWith('public:')) {
      return next();
    }
    
    // Check authentication for private events
    if (!socket.handshake.auth.token) {
      // Drop the packet silently
      return;
    }
    
    // Check permissions
    if (!hasPermission(socket, event)) {
      // Drop the packet silently
      return;
    }
    
    next();
  });
  next();
});
```

### Method 3: With Error Handling

If you want to notify the client about the rejection:

```javascript
io.use(function(socket, next) {
  socket.use(function([event, data], next) {
    // Check permissions
    if (!hasPermission(socket, event)) {
      // Emit error to client
      socket.emit('error', {
        message: 'Permission denied',
        event: event
      });
      return;
    }
    
    next();
  });
  next();
});
```

## Common Use Cases

### ACL (Access Control List)

```javascript
io.use(function(socket, next) {
  socket.use(function([event, data], next) {
    // Define allowed events for each role
    const acl = {
      admin: ['*'],  // Admin can do everything
      user: ['message', 'typing', 'status'],
      guest: ['message']
    };
    
    const role = socket.handshake.auth.role || 'guest';
    const allowedEvents = acl[role] || [];
    
    // Check if event is allowed
    if (allowedEvents.includes('*') || allowedEvents.includes(event)) {
      return next();
    }
    
    // Drop the packet
    console.log(`User ${socket.id} (${role}) not allowed to emit ${event}`);
    return;
  });
  next();
});
```

### Rate Limiting

```javascript
io.use(function(socket, next) {
  const rateLimit = new Map();
  
  socket.use(function([event, data], next) {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 10;
    
    // Get or initialize rate limit for this event
    if (!rateLimit.has(event)) {
      rateLimit.set(event, { count: 0, resetTime: now + windowMs });
    }
    
    const limit = rateLimit.get(event);
    
    // Reset if window has passed
    if (now > limit.resetTime) {
      limit.count = 0;
      limit.resetTime = now + windowMs;
    }
    
    // Check rate limit
    if (limit.count >= maxRequests) {
      // Drop the packet
      socket.emit('error', {
        message: 'Rate limit exceeded',
        event: event
      });
      return;
    }
    
    // Increment count and allow
    limit.count++;
    next();
  });
  next();
});
```

### Input Validation

```javascript
io.use(function(socket, next) {
  socket.use(function([event, data], next) {
    // Define validation schemas
    const schemas = {
      message: {
        required: ['text'],
        types: { text: 'string' }
      },
      status: {
        required: ['status'],
        types: { status: 'string' },
        enum: { status: ['online', 'offline', 'away'] }
      }
    };
    
    const schema = schemas[event];
    if (!schema) {
      // Unknown event, drop it
      return;
    }
    
    // Validate required fields
    for (const field of schema.required) {
      if (!(field in data)) {
        socket.emit('error', {
          message: `Missing required field: ${field}`,
          event: event
        });
        return;
      }
    }
    
    // Validate types
    for (const [field, type] of Object.entries(schema.types)) {
      if (field in data && typeof data[field] !== type) {
        socket.emit('error', {
          message: `Invalid type for ${field}: expected ${type}`,
          event: event
        });
        return;
      }
    }
    
    // Validate enum values
    for (const [field, values] of Object.entries(schema.enum || {})) {
      if (field in data && !values.includes(data[field])) {
        socket.emit('error', {
          message: `Invalid value for ${field}: must be one of ${values.join(', ')}`,
          event: event
        });
        return;
      }
    }
    
    next();
  });
  next();
});
```

### Authentication

```javascript
io.use(function(socket, next) {
  // First middleware: authenticate connection
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  
  // Verify token
  try {
    const user = verifyToken(token);
    socket.user = user;
  } catch (err) {
    return next(new Error('Authentication error'));
  }
  
  // Second middleware: authorize events
  socket.use(function([event, data], next) {
    // Check if user is authorized for this event
    if (!isAuthorized(socket.user, event)) {
      // Drop the packet silently
      return;
    }
    
    next();
  });
  
  next();
});
```

## Best Practices

### 1. Silent Rejection vs Error Notification

Choose based on your use case:

```javascript
// Silent rejection (security through obscurity)
socket.use(function([event, data], next) {
  if (!hasPermission(socket, event)) {
    return;  // Don't reveal that the event exists
  }
  next();
});

// Error notification (better for debugging)
socket.use(function([event, data], next) {
  if (!hasPermission(socket, event)) {
    socket.emit('error', { message: 'Permission denied' });
    return;
  }
  next();
});
```

### 2. Logging Rejected Packets

Always log rejected packets for debugging:

```javascript
socket.use(function([event, data], next) {
  if (!hasPermission(socket, event)) {
    console.warn(`Rejected packet: ${event} from ${socket.id}`);
    return;
  }
  next();
});
```

### 3. Performance Considerations

Keep middleware lightweight:

```javascript
// Good: Simple check
socket.use(function([event, data], next) {
  if (!socket.user) return;
  next();
});

// Bad: Heavy computation in middleware
socket.use(function([event, data], next) {
  // Don't do expensive operations here
  const result = expensiveOperation(data);
  if (!result) return;
  next();
});
```

### 4. Order Matters

Place security middleware first:

```javascript
io.use(function(socket, next) {
  // 1. Authentication
  if (!socket.handshake.auth.token) {
    return next(new Error('Authentication error'));
  }
  next();
});

io.use(function(socket, next) {
  // 2. Authorization
  socket.use(function([event, data], next) {
    if (!hasPermission(socket, event)) return;
    next();
  });
  next();
});
```

## Complete Example

```javascript
const io = require('socket.io')(3000);

// ACL configuration
const acl = {
  admin: ['*'],
  user: ['message', 'typing', 'status'],
  guest: ['message']
};

io.use(function(socket, next) {
  // Authentication
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  
  try {
    const user = verifyToken(token);
    socket.user = user;
    socket.role = user.role || 'guest';
  } catch (err) {
    return next(new Error('Authentication error'));
  }
  
  // Authorization middleware
  socket.use(function([event, data], next) {
    const allowedEvents = acl[socket.role] || [];
    
    if (allowedEvents.includes('*') || allowedEvents.includes(event)) {
      console.log(`Allowed: ${socket.id} (${socket.role}) -> ${event}`);
      return next();
    }
    
    console.warn(`Rejected: ${socket.id} (${socket.role}) -> ${event}`);
    socket.emit('error', {
      message: 'Permission denied',
      event: event
    });
  });
  
  next();
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id} (${socket.role})`);
  
  socket.on('message', (data) => {
    io.emit('message', {
      user: socket.user.name,
      text: data.text
    });
  });
  
  socket.on('typing', () => {
    socket.broadcast.emit('typing', {
      user: socket.user.name
    });
  });
  
  socket.on('status', (data) => {
    socket.broadcast.emit('status', {
      user: socket.user.name,
      status: data.status
    });
  });
});
```

## Related Documentation

- [Socket.IO Middleware](https://socket.io/docs/v3/server-socket-instance/#Socket-middlewares)
- [Socket.IO Authentication](https://socket.io/docs/v3/middlewares/)
- [Socket.IO Authorization](https://socket.io/docs/v3/emit-cheatsheet/)
