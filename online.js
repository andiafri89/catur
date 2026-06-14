/* ==========================================
   ♚ CHESS MASTER — Online Game Manager
   Client-side WebSocket handler for
   real-time multiplayer chess.
   ========================================== */

// ─── Server Configuration ──────────────────────────────
// PRODUCTION: Ganti URL ini dengan WebSocket server kamu
// Contoh: 'wss://chess-server.onrender.com'
// LOCAL: 'ws://localhost:8765'
const SERVER_URL = 'wss://5aaa9e18bcc0bf.lhr.life';

// ───────────────────────────────────────────────────────

class OnlineGameManager {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.gameCode = null;
        this.myColor = null;       // 'w' or 'b'
        this.myName = '';
        this.opponentName = '';
        this.playerId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        this.intentionalClose = false;

        // Callbacks — set by ChessUI
        this.onConnected = null;
        this.onConnectionEstablished = null;  // NEW: fires when ws opens
        this.onDisconnected = null;
        this.onReconnecting = null;
        this.onGameCreated = null;
        this.onGameJoined = null;
        this.onOpponentJoined = null;
        this.onOpponentDisconnected = null;
        this.onMoveReceived = null;
        this.onMoveAck = null;
        this.onGameOver = null;
        this.onDrawOffered = null;
        this.onDrawDeclined = null;
        this.onDrawResponded = null;
        this.onRematchRequested = null;
        this.onRematchStarted = null;
        this.onRematchDeclined = null;
        this.onGameCodeCopied = null;   // NEW: fires when game code is copied
        this.onError = null;
    }

    // ─── Connection ────────────────────────────────────────

    connect(serverUrl) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
        this.intentionalClose = false;

        try {
            this.ws = new WebSocket(serverUrl);
        } catch (err) {
            if (this.onError) this.onError(`Failed to connect: ${err.message}`);
            return;
        }

        this.ws.onopen = () => {
            this.connected = true;
            this.reconnectAttempts = 0;
            if (this.onConnected) this.onConnected();
            if (this.onConnectionEstablished) this.onConnectionEstablished();
        };

        this.ws.onclose = (event) => {
            this.connected = false;
            if (!this.intentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.attemptReconnect(serverUrl);
                return;
            }
            if (this.onDisconnected) this.onDisconnected();
        };

        this.ws.onerror = () => {
            // onclose will fire after this
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (err) {
                console.error('Invalid message from server:', err);
            }
        };
    }

    attemptReconnect(serverUrl) {
        this.reconnectAttempts++;
        if (this.onReconnecting) this.onReconnecting(this.reconnectAttempts, this.maxReconnectAttempts);
        setTimeout(() => this.connect(serverUrl), this.reconnectDelay);
    }

    disconnect() {
        this.intentionalClose = true;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.gameCode = null;
        this.myColor = null;
        this.opponentName = '';
    }

    // ─── Send Messages ─────────────────────────────────────

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
            return true;
        }
        return false;
    }

    createGame(playerName) {
        this.myName = playerName;
        return this.send({ type: 'create_game', playerName });
    }

    joinGame(gameCode, playerName) {
        this.myName = playerName;
        return this.send({ type: 'join_game', gameCode, playerName });
    }

    sendMove(fromRow, fromCol, toRow, toCol, promotion, gameOver, result) {
        return this.send({
            type: 'move',
            gameCode: this.gameCode,
            move: { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol }, promotion },
            gameOver: !!gameOver,
            result: result || null
        });
    }

    sendResign() {
        return this.send({ type: 'resign', gameCode: this.gameCode });
    }

    offerDraw() {
        return this.send({ type: 'offer_draw', gameCode: this.gameCode });
    }

    respondDraw(accept) {
        return this.send({ type: 'draw_response', gameCode: this.gameCode, accept });
    }

    requestRematch() {
        return this.send({ type: 'rematch', gameCode: this.gameCode });
    }

    respondRematch(accept) {
        return this.send({ type: 'rematch_response', gameCode: this.gameCode, accept });
    }

    sendPing() {
        this.send({ type: 'ping' });
    }

    // ─── Incoming Message Router ────────────────────────────

    handleMessage(data) {
        switch (data.type) {
            case 'game_created':
                this.gameCode = data.gameCode;
                this.myColor = data.color;
                this.opponentName = data.opponentName || '';
                if (this.onGameCreated) this.onGameCreated(data);
                break;

            case 'game_joined':
                this.gameCode = data.gameCode;
                this.myColor = data.color;
                this.opponentName = data.opponentName || '';
                if (this.onGameJoined) this.onGameJoined(data);
                break;

            case 'opponent_joined':
                this.opponentName = data.opponentName;
                if (this.onOpponentJoined) this.onOpponentJoined(data);
                break;

            case 'opponent_move':
                if (this.onMoveReceived) this.onMoveReceived(data);
                break;

            case 'move_ack':
                if (this.onMoveAck) this.onMoveAck(data);
                break;

            case 'game_over':
                if (this.onGameOver) this.onGameOver(data);
                break;

            case 'opponent_disconnected':
                if (this.onOpponentDisconnected) this.onOpponentDisconnected(data);
                break;

            case 'draw_offered':
                if (this.onDrawOffered) this.onDrawOffered(data);
                break;

            case 'draw_declined':
                if (this.onDrawDeclined) this.onDrawDeclined(data);
                break;

            case 'rematch_requested':
                if (this.onRematchRequested) this.onRematchRequested(data);
                break;

            case 'rematch_started':
                if (this.onRematchStarted) this.onRematchStarted(data);
                break;

            case 'rematch_declined':
                if (this.onRematchDeclined) this.onRematchDeclined(data);
                break;

            case 'pong':
                break;

            case 'error':
                if (this.onError) this.onError(data.message);
                break;

            default:
                console.warn('Unknown message type:', data.type);
        }
    }

    // ─── Helpers ────────────────────────────────────────────

    isMyTurn(currentTurn) {
        return this.myColor === currentTurn;
    }

    isHost() {
        return this.myColor === 'w';
    }

    // ─── Clipboard ─────────────────────────────────────────

    copyGameCode() {
        if (this.gameCode && navigator.clipboard) {
            navigator.clipboard.writeText(this.gameCode).then(() => {
                if (this.onGameCodeCopied) this.onGameCodeCopied(this.gameCode);
            });
        }
    }
}
