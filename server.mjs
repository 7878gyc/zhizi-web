import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { Server } from 'socket.io';
import { Client } from 'ssh2';

const dev = process.env.COZE_PROJECT_ENV !== 'PROD';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '5000', 10);
const sshConnectTimeout = parseInt(process.env.SSH_CONNECT_TIMEOUT || '30000', 10);
const sshIdleTimeout = 5 * 60 * 1000;

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // Attach Socket.IO server
  const io = new Server(httpServer, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Each client occupies its own room identified by socket.id
    const room = socket.id;

    socket.on('start-ssh-task', (params) => {
      const {
        host,
        port: sshPort,
        username,
        password,
        privateKey,
        command,
      } = params || {};

      // Validate required params
      if (!host || typeof host !== 'string') {
        io.to(room).emit('task-error', { error: '主机地址为必填项' });
        return;
      }
      if (!username || typeof username !== 'string') {
        io.to(room).emit('task-error', { error: '用户名为必填项' });
        return;
      }
      if (!command || typeof command !== 'string') {
        io.to(room).emit('task-error', { error: '启动命令为必填项' });
        return;
      }

      const conn = new Client();
      let sshConnected = false;
      let idleTimer = null;
      let lastOutputTime = Date.now();

      // Capture sensitive data into local bindings, then null them immediately after use
      let pwd = password && typeof password === 'string' ? password : null;
      let key = privateKey && typeof privateKey === 'string' ? privateKey : null;

      const cleanup = () => {
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
        if (sshConnected) {
          try {
            conn.end();
          } catch {
            // conn may already be closed
          }
          sshConnected = false;
        }
        // Erase sensitive data from memory
        pwd = null;
        key = null;
      };

      const resetIdleTimer = () => {
        lastOutputTime = Date.now();
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          io.to(room).emit('task-end', { reason: 'idle-timeout' });
          cleanup();
        }, sshIdleTimeout);
      };

      conn.on('ready', () => {
        sshConnected = true;
        io.to(room).emit('task-started', {});

        conn.exec(command, (err, stream) => {
          if (err) {
            io.to(room).emit('task-error', { error: `执行命令失败: ${err.message}` });
            cleanup();
            return;
          }

          stream.on('close', (code, signal) => {
            io.to(room).emit('task-end', { exitCode: code, signal: signal || undefined });
            cleanup();
          });

          stream.on('data', (data) => {
            io.to(room).emit('task-output', {
              type: 'stdout',
              data: data.toString('utf-8'),
            });
            resetIdleTimer();
          });

          stream.stderr.on('data', (data) => {
            io.to(room).emit('task-output', {
              type: 'stderr',
              data: data.toString('utf-8'),
            });
            resetIdleTimer();
          });

          resetIdleTimer();
        });
      });

      conn.on('error', (err) => {
        io.to(room).emit('task-error', { error: `SSH 连接失败: ${err.message}` });
        cleanup();
      });

      // Build connect config
      const connectConfig = {
        host,
        port: typeof sshPort === 'number' && sshPort > 0 ? sshPort : 22,
        username,
        readyTimeout: sshConnectTimeout,
      };

      if (pwd) {
        connectConfig.password = pwd;
      }
      if (key) {
        connectConfig.privateKey = key;
      }

      try {
        conn.connect(connectConfig);
      } catch (err) {
        io.to(room).emit('task-error', {
          error: `SSH 连接异常: ${err instanceof Error ? err.message : String(err)}`,
        });
        cleanup();
        return;
      }

      // Immediately wipe sensitive material from server-side memory
      pwd = null;
      key = null;
    });

    socket.on('stop-ssh-task', () => {
      // Client requests task termination — sent as acknowledgement only
      // Actual cleanup happens on the transport-level close/disconnect
      io.to(room).emit('task-end', { reason: 'user-stopped' });
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  httpServer.once('error', (err) => {
    console.error('HTTP server error:', err);
    process.exit(1);
  });

  httpServer.listen(port, () => {
    console.log(
      `> Server listening at http://${hostname}:${port} as ${
        dev ? 'development' : process.env.COZE_PROJECT_ENV || 'production'
      }`,
    );
  });
});
