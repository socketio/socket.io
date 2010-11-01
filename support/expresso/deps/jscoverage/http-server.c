/*
    http-server.c - generic HTTP server
    Copyright (C) 2008 siliconforks.com

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program; if not, write to the Free Software Foundation, Inc.,
    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
*/

#include <config.h>

#include "http-server.h"

#include <stdarg.h>
#include <string.h>

#ifdef HAVE_PTHREAD_H
#include <pthread.h>
#endif

#ifdef __MINGW32__
#include <process.h>
#endif

#include "util.h"

#ifdef __MINGW32__
typedef void ThreadRoutineReturnType;
#define THREAD_ROUTINE_RETURN return
#else
typedef void * ThreadRoutineReturnType;
#define THREAD_ROUTINE_RETURN return NULL
#endif

struct HTTPServer {
  char * ip_address;
  uint16_t port;
  HTTPServerHandler handler;
  SOCKET s;
};

struct HTTPServerConnection {
  HTTPConnection * connection;
  struct HTTPServer * server;
};

static bool is_shutdown = false;
#ifdef __MINGW32__
CRITICAL_SECTION shutdown_mutex;
#define LOCK EnterCriticalSection
#define UNLOCK LeaveCriticalSection
#else
pthread_mutex_t shutdown_mutex = PTHREAD_MUTEX_INITIALIZER;
#define LOCK pthread_mutex_lock
#define UNLOCK pthread_mutex_unlock
#endif

static ThreadRoutineReturnType handle_connection(void * p) {
  struct HTTPServerConnection * connection = p;
  uint16_t port = connection->server->port;

  HTTPExchange * exchange = HTTPExchange_new(connection->connection);
  if (HTTPExchange_read_request_headers(exchange) == 0) {
    connection->server->handler(exchange);
  }
  else {
    HTTPExchange_set_status_code(exchange, 400);
    const char * message = "Could not parse request headers\n";
    if (HTTPExchange_write_response(exchange, message, strlen(message)) != 0) {
      HTTPServer_log_err("Warning: error writing to client\n");
    }
  }
  if (HTTPExchange_flush_response(exchange) != 0) {
    HTTPServer_log_err("Warning: error writing to client\n");
  }
  HTTPExchange_delete(exchange);
  if (HTTPConnection_delete(connection->connection) != 0) {
    HTTPServer_log_err("Warning: error closing connection to client\n");
  }
  free(connection);

  /* HACK: make connection to server to force accept() to return */
  LOCK(&shutdown_mutex);
  if (is_shutdown) {
    SOCKET s = socket(PF_INET, SOCK_STREAM, 0);
    if (s == INVALID_SOCKET) {
      HTTPServer_log_err("Warning: error creating socket\n");
    }
    else {
      struct sockaddr_in a;
      a.sin_family = AF_INET;
      a.sin_port = htons(port);
      a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
      if (connect(s, (struct sockaddr *) &a, sizeof(a)) == -1) {
        HTTPServer_log_err("Warning: error connecting to server\n");
      }
      closesocket(s);
    }
  }
  UNLOCK(&shutdown_mutex);

  THREAD_ROUTINE_RETURN;
}

static struct HTTPServer * HTTPServer_new(const char * ip_address, uint16_t port, HTTPServerHandler handler) {
  struct HTTPServer * result = xmalloc(sizeof(struct HTTPServer));
  if (ip_address == NULL) {
    result->ip_address = NULL;
  }
  else {
    result->ip_address = xstrdup(ip_address);
  }
  result->port = port;
  result->handler = handler;
  result->s = -1;
  return result;
}

static void HTTPServer_delete(struct HTTPServer * server) {
  free(server->ip_address);
  closesocket(server->s);
  free(server);
}

void HTTPServer_run(const char * ip_address, uint16_t port, HTTPServerHandler handler) {
  struct HTTPServer * server = HTTPServer_new(ip_address, port, handler);

#ifdef __MINGW32__
  WSADATA data;
  if (WSAStartup(MAKEWORD(1, 1), &data) != 0) {
    fatal("could not start Winsock");
  }
  InitializeCriticalSection(&shutdown_mutex);
#endif

  server->s = socket(PF_INET, SOCK_STREAM, 0);
  if (server->s == INVALID_SOCKET) {
    fatal("could not create socket");
  }

  /* http://hea-www.harvard.edu/~fine/Tech/addrinuse.html */
  int optval = 1;
  setsockopt(server->s, SOL_SOCKET, SO_REUSEADDR, (const char *) &optval, sizeof(optval));

  struct sockaddr_in a;
  a.sin_family = AF_INET;
  a.sin_port = htons(server->port);
  if (server->ip_address == NULL) {
    /*
    a.sin_addr.s_addr = htonl(INADDR_ANY);
    */
    a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  }
  else {
    if (inet_aton(server->ip_address, &(a.sin_addr)) == 0) {
      closesocket(server->s);
      fatal("invalid address: %s", server->ip_address);
    }
  }

  if (bind(server->s, (struct sockaddr *) &a, sizeof(a)) == -1) {
    closesocket(server->s);
    fatal("could not bind to address");
  }

  if (listen(server->s, 5) == -1) {
    closesocket(server->s);
    fatal("could not listen for connections");
  }

  for (;;) {
    struct sockaddr_in client_address;
    size_t client_address_size = sizeof(client_address);
    SOCKET s = accept(server->s, (struct sockaddr *) &client_address, &client_address_size);
    if (s == INVALID_SOCKET) {
      HTTPServer_log_err("Warning: could not accept client connection\n");
      continue;
    }

    LOCK(&shutdown_mutex);
    if (is_shutdown) {
      closesocket(s);
      break;
    }
    UNLOCK(&shutdown_mutex);

    struct HTTPServerConnection * connection = xmalloc(sizeof(struct HTTPServerConnection));
    connection->server = server;
    connection->connection = HTTPConnection_new_server(s);

#ifdef __MINGW32__
    unsigned long thread = _beginthread(handle_connection, 0, connection);
#else
    pthread_t thread;
    pthread_attr_t a;
    pthread_attr_init(&a);
    pthread_attr_setdetachstate(&a, PTHREAD_CREATE_DETACHED);
    pthread_create(&thread, &a, handle_connection, connection);
    pthread_attr_destroy(&a);
#endif
  }

  HTTPServer_delete(server);
}

void HTTPServer_shutdown(void) {
  LOCK(&shutdown_mutex);
  is_shutdown = true;
  UNLOCK(&shutdown_mutex);
}

void HTTPServer_log_out(const char * format, ...) {
  va_list a;
  va_start(a, format);
  vfprintf(stdout, format, a);
  va_end(a);
  fflush(stdout);
}

void HTTPServer_log_err(const char * format, ...) {
  va_list a;
  va_start(a, format);
  vfprintf(stderr, format, a);
  va_end(a);
  fflush(stderr);
}
