const { spawn } = require('child_process');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { Chess } = require('chess.js');
const fs = require('fs');
const path = require('path');
const escapeHtml = require('escape-html');

const app = express();
const server = http.createServer(app);
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

const io = socketIo(server, {
    cors: {
        origin: corsOrigin.split(',').map(s => s.trim()),
        methods: ["GET", "POST"]
    }
});
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/engines', (req, res) => {
    fs.readdir(ENGINES_DIR, (err, files) => {
        if (err) {
            console.error('Error reading engines directory:', err);
            return res.status(500).send({ message: 'Could not retrieve engine list.' });
        }
        const engineFiles = files
            .filter(file => file.endsWith('.exe') || !file.includes('.'))
            .map(file => escapeHtml(file));
        res.send(engineFiles);
    });
});

const ENGINES_DIR = path.join(__dirname, '../chessengines');
const ALLOWED_ENGINES = ['stockfish-ubuntu-x86-64-avx2'];
let currentEnginePath = path.join(ENGINES_DIR, 'stockfish-ubuntu-x86-64-avx2');

let stockfishProcess;
let stockfishRestartCount = 0;
let stockfishRestartTimer = null;
const MAX_STOCKFISH_RETRIES = 10;
const STOCKFISH_RESTART_DELAY = 2000; // 2 seconds
let outputBuffer = '';
const game = new Chess();
let fenHistory = [];
let candidateMoves = [];

function startStockfish() {
    if (!currentEnginePath) {
        console.error('[Backend] No chess engine selected or found. Cannot start Stockfish process.');
        return;
    }
    stockfishProcess = spawn(currentEnginePath, [], { shell: false });

    stockfishProcess.stdout.on('data', (data) => {
        const rawOutput = data.toString();
        outputBuffer += rawOutput;
        console.log(`[Stockfish Raw Output]: ${rawOutput.trim()}`); // Log all raw output

        // Process complete lines
        let newlineIndex;
        while ((newlineIndex = outputBuffer.indexOf('\n')) !== -1) {
            const line = outputBuffer.substring(0, newlineIndex).trim();
            outputBuffer = outputBuffer.substring(newlineIndex + 1);

            if (!line) continue;

            if (line.startsWith('info')) {
                const matchPv = line.match(/ pv (.+)/);
                if (matchPv) {
                    const moves = matchPv[1].split(' ');
                    if (moves.length > 0) {
                        candidateMoves.push(moves[0]);
                    }
                }
                const matchScore = line.match(/score (cp|mate) (-?\d+)/);
                const matchDepth = line.match(/depth (\d+)/);
                const matchNodes = line.match(/nodes (\d+)/);
                const matchNps = line.match(/nps (\d+)/);
                const matchtbhits = line.match(/tbhits (\d+)/);
                const parsedOutput = {
                    type: 'info',
                    raw: line,
                    score: matchScore ? { type: matchScore[1], value: parseInt(matchScore[2], 10) } : null,
                    pv: matchPv ? matchPv[1].split(' ') : [],
                    depth: matchDepth ? parseInt(matchDepth[1], 10) : null,
                    nodes: matchNodes ? parseInt(matchNodes[1], 10) : null,
                    nps: matchNps ? parseInt(matchNps[1], 10) : null,
                    tbhits: matchtbhits ? parseInt(matchtbhits[1], 10) : null,
                };
                io.emit('stockfish_output', parsedOutput);
                console.log(`[Backend] Emitted info: ${JSON.stringify(parsedOutput)}`);
            } else if (line.startsWith('bestmove')) {
                console.log(`[Backend] Detected bestmove line: ${line}`);
                const parts = line.split(' ');
                const bestMove = parts[1];
                console.log(`[Backend] Emitting bestmove: ${bestMove}`);
                io.emit('stockfish_output', { type: 'bestmove', move: bestMove, fen: currentFenForAnalysis });
            }
        }
    });

    stockfishProcess.stderr.on('data', (data) => {
        console.error(`Stockfish stderr: ${data}`);
        io.emit('stockfish_error', data.toString());
    });

    const currentProcess = stockfishProcess;

    currentProcess.on('close', (code) => {
        console.log(`Stockfish process exited with code ${code}`);
        io.emit('stockfish_status', { status: 'closed', code });

        // If a new process was already started (e.g. by select-engine), skip restart
        if (stockfishProcess !== currentProcess) return;

        // Auto-restart with retry limit and delay
        if (stockfishRestartCount < MAX_STOCKFISH_RETRIES) {
            stockfishRestartCount++;
            const delay = STOCKFISH_RESTART_DELAY * Math.min(stockfishRestartCount, 5);
            console.log(`[Backend] Restarting Stockfish in ${delay}ms (attempt ${stockfishRestartCount}/${MAX_STOCKFISH_RETRIES})...`);
            stockfishRestartTimer = setTimeout(() => {
                console.log('[Backend] Attempting to restart Stockfish...');
                startStockfish();
            }, delay);
        } else {
            console.error(`[Backend] Stockfish failed to restart after ${MAX_STOCKFISH_RETRIES} attempts. Giving up.`);
            io.emit('stockfish_status', { status: 'crashed_permanently', message: 'Max retries reached' });
        }
    });

    currentProcess.on('error', (err) => {
        console.error('Failed to start Stockfish process:', err);
        io.emit('stockfish_status', { status: 'error', message: err.message });
    });

    // Reset restart counter on successful start (any data from Stockfish = alive)
    currentProcess.stdout.once('data', () => {
        stockfishRestartCount = 0;
    });

    stockfishProcess.stdin.write('uci\n');
    stockfishProcess.stdin.write('setoption name Ponder value true\n');
    stockfishProcess.stdin.write('setoption name MultiPV value 1\n');
    stockfishProcess.stdin.write('setoption name Threads value 1\n');
    stockfishProcess.stdin.write('setoption name Hash value 64\n');
    stockfishProcess.stdin.write('setoption name NumaPolicy value auto\n');
    stockfishProcess.stdin.write('setoption name UCI_ShowWDL value true\n');
    stockfishProcess.stdin.write('setoption name UCI_Elo value 3190\n');
    stockfishProcess.stdin.write('isready\n');
}
let currentFenForAnalysis = ''; // Initialize currentFenForAnalysis

app.post('/make-move', (req, res) => {
    const { move, currentFen } = req.body;
    try {
        game.load(currentFen);
        const result = game.move(move);
        if (result) {
            io.emit('stockfish_output', { type: 'fen', fen: game.fen() });
            res.status(200).send({ success: true, newFen: game.fen() });
        } else {
            res.status(400).send({ error: 'Invalid move' });
        }
    } catch (e) {
        console.error('Error making move:', e);
        res.status(500).send({ error: e.message });
    }
});

app.post('/set-option', (req, res) => {
    const { name, value } = req.body;
    if (stockfishProcess && name && value !== undefined) {
        const command = `setoption name ${name} value ${value}\n`;
        stockfishProcess.stdin.write(command);
        console.log(`[Backend] Sent Stockfish option: ${command.trim()}`);
        res.status(200).send({ message: 'Option sent to Stockfish' });
    } else {
        res.status(400).send({ message: 'Invalid option or Stockfish not running' });
    }
});

app.post('/api/select-engine', (req, res) => {
    const { engineName } = req.body;

    if (!ALLOWED_ENGINES.includes(engineName)) {
        return res.status(400).send({ message: 'Engine not found or invalid name.' });
    }

    const newEnginePath = path.join(ENGINES_DIR, engineName);

    try {
        const safePath = fs.realpathSync(newEnginePath);
        if (!safePath.startsWith(ENGINES_DIR) || !fs.existsSync(safePath)) {
            return res.status(400).send({ message: 'Engine not found or invalid path.' });
        }
        currentEnginePath = safePath;
    } catch (e) {
        return res.status(400).send({ message: 'Invalid engine path.' });
    }

    // Clear any pending restart and reset counter
    if (stockfishRestartTimer) {
        clearTimeout(stockfishRestartTimer);
        stockfishRestartTimer = null;
    }
    stockfishRestartCount = 0;

    if (stockfishProcess) {
        stockfishProcess.kill();
    }

    startStockfish();

    res.send({ message: `Engine changed to ${engineName}` });
});


io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('command', (command) => {
        if (stockfishProcess) {
            console.log(`[Frontend] Received command: ${command}`);
            if (command.startsWith('position fen')) {
                currentFenForAnalysis = command.substring(13);
            }
            stockfishProcess.stdin.write(`${command}\n`);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

startStockfish();

server.listen(port, () => {
    console.log(`Stockfish backend server listening at http://localhost:${port}`);
    console.log('Waiting for Stockfish output...');
});
