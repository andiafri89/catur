/* ==========================================
   ♚ CHESS MASTER — Complete Chess Engine
   ========================================== */

// ==================== PIECE DEFINITIONS ====================
const PIECES = {
    KING: 'k',
    QUEEN: 'q',
    ROOK: 'r',
    BISHOP: 'b',
    KNIGHT: 'n',
    PAWN: 'p'
};

const COLORS = { WHITE: 'w', BLACK: 'b' };

const PIECE_SYMBOLS = {
    'wk': '♚', 'wq': '♛', 'wr': '♜', 'wb': '♝', 'wn': '♞', 'wp': '♟',
    'bk': '♚', 'bq': '♛', 'br': '♜', 'bb': '♝', 'bn': '♞', 'bp': '♟'
};

const PIECE_UNICODE_LARGE = {
    'wk': '♚', 'wq': '♛', 'wr': '♜', 'wb': '♝', 'wn': '♞', 'wp': '♟',
    'bk': '♚', 'bq': '♛', 'br': '♜', 'bb': '♝', 'bn': '♞', 'bp': '♟'
};

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const FILES = 'abcdefgh';
const RANKS = '87654321';

// ==================== CHESS ENGINE ====================
class ChessEngine {
    constructor() {
        this.reset();
    }

    reset() {
        this.board = this.createInitialBoard();
        this.turn = COLORS.WHITE;
        this.moveHistory = [];
        this.moveLog = [];
        this.positionHistory = [];
        this.castlingRights = {
            w: { kingSide: true, queenSide: true },
            b: { kingSide: true, queenSide: true }
        };
        this.enPassantTarget = null;
        this.halfMoveClock = 0;
        this.fullMoveNumber = 1;
        this.gameOver = false;
        this.gameResult = null;
        this.kingPositions = {
            w: { row: 7, col: 4 },
            b: { row: 0, col: 4 }
        };
        this.capturedPieces = { w: [], b: [] };
        this.lastMove = null;
        this.positionHistory.push(this.getPositionKey());
    }

    createInitialBoard() {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        const backRow = [PIECES.ROOK, PIECES.KNIGHT, PIECES.BISHOP, PIECES.QUEEN,
        PIECES.KING, PIECES.BISHOP, PIECES.KNIGHT, PIECES.ROOK];

        for (let col = 0; col < 8; col++) {
            board[0][col] = { type: backRow[col], color: COLORS.BLACK };
            board[1][col] = { type: PIECES.PAWN, color: COLORS.BLACK };
            board[6][col] = { type: PIECES.PAWN, color: COLORS.WHITE };
            board[7][col] = { type: backRow[col], color: COLORS.WHITE };
        }
        return board;
    }

    getPositionKey() {
        let key = '';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p) key += p.color + p.type;
                else key += '.';
            }
        }
        key += this.turn;
        key += (this.castlingRights.w.kingSide ? 'K' : '') +
            (this.castlingRights.w.queenSide ? 'Q' : '') +
            (this.castlingRights.b.kingSide ? 'k' : '') +
            (this.castlingRights.b.queenSide ? 'q' : '');
        key += this.enPassantTarget ? this.enPassantTarget : '-';
        return key;
    }

    isInBounds(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    getPieceAt(row, col) {
        if (!this.isInBounds(row, col)) return null;
        return this.board[row][col];
    }

    isEnemy(row, col, color) {
        const piece = this.getPieceAt(row, col);
        return piece && piece.color !== color;
    }

    isFriendly(row, col, color) {
        const piece = this.getPieceAt(row, col);
        return piece && piece.color === color;
    }

    isEmpty(row, col) {
        return this.isInBounds(row, col) && this.board[row][col] === null;
    }

    cloneBoard() {
        return this.board.map(row => row.map(cell => cell ? { ...cell } : null));
    }

    getLegalMovesForPiece(row, col) {
        const piece = this.getPieceAt(row, col);
        if (!piece) return [];

        const pseudoMoves = this.getPseudoLegalMoves(row, col, piece);
        return pseudoMoves.filter(move => {
            // Simulate the move and check if king is in check
            const savedBoard = this.cloneBoard();
            const savedEnPassant = this.enPassantTarget;
            const savedCastling = {
                w: { ...this.castlingRights.w },
                b: { ...this.castlingRights.b }
            };
            const savedKingPos = {
                w: { ...this.kingPositions.w },
                b: { ...this.kingPositions.b }
            };

            this.applyMoveInternal(row, col, move.row, move.col, piece, false, move.promotion);

            const inCheck = this.isKingInCheck(piece.color);

            // Restore
            this.board = savedBoard;
            this.enPassantTarget = savedEnPassant;
            this.castlingRights = savedCastling;
            this.kingPositions = savedKingPos;

            return !inCheck;
        });
    }

    isKingInCheck(color) {
        const kingPos = this.kingPositions[color];
        return this.isSquareAttacked(kingPos.row, kingPos.col, color);
    }

    isSquareAttacked(row, col, defendingColor) {
        const attackingColor = defendingColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

        // Check knight attacks
        const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        for (const [dr, dc] of knightMoves) {
            const r = row + dr, c = col + dc;
            if (this.isInBounds(r, c)) {
                const p = this.board[r][c];
                if (p && p.color === attackingColor && p.type === PIECES.KNIGHT) return true;
            }
        }

        // Check king attacks
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr, c = col + dc;
                if (this.isInBounds(r, c)) {
                    const p = this.board[r][c];
                    if (p && p.color === attackingColor && p.type === PIECES.KING) return true;
                }
            }
        }

        // Check pawn attacks
        const pawnDir = defendingColor === COLORS.WHITE ? -1 : 1;
        for (const dc of [-1, 1]) {
            const r = row + pawnDir, c = col + dc;
            if (this.isInBounds(r, c)) {
                const p = this.board[r][c];
                if (p && p.color === attackingColor && p.type === PIECES.PAWN) return true;
            }
        }

        // Check sliding pieces (queen, rook, bishop)
        const directions = {
            rook: [[-1, 0], [1, 0], [0, -1], [0, 1]],
            bishop: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
            queen: [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]
        };

        for (const [dr, dc] of directions.queen) {
            let r = row + dr, c = col + dc;
            while (this.isInBounds(r, c)) {
                const p = this.board[r][c];
                if (p) {
                    if (p.color === attackingColor) {
                        if (p.type === PIECES.QUEEN) return true;
                        if (p.type === PIECES.ROOK && (dr === 0 || dc === 0)) return true;
                        if (p.type === PIECES.BISHOP && (dr !== 0 && dc !== 0)) return true;
                    }
                    break;
                }
                r += dr;
                c += dc;
            }
        }

        return false;
    }

    isCheckmate(color) {
        if (!this.isKingInCheck(color)) return false;
        return !this.hasAnyLegalMove(color);
    }

    isStalemate(color) {
        if (this.isKingInCheck(color)) return false;
        return !this.hasAnyLegalMove(color);
    }

    hasAnyLegalMove(color) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p && p.color === color) {
                    const moves = this.getLegalMovesForPiece(r, c);
                    if (moves.length > 0) return true;
                }
            }
        }
        return false;
    }

    isDrawByRepetition() {
        const key = this.getPositionKey();
        let count = 0;
        for (const k of this.positionHistory) {
            if (k === key) count++;
        }
        return count >= 3;
    }

    isDrawByFiftyMoveRule() {
        return this.halfMoveClock >= 100;
    }

    isInsufficientMaterial() {
        const pieces = { w: [], b: [] };
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p) pieces[p.color].push({ ...p, row: r, col: c });
            }
        }

        for (const color of [COLORS.WHITE, COLORS.BLACK]) {
            const other = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
            const myPieces = pieces[color];
            const theirPieces = pieces[other];

            // King vs King
            if (myPieces.length === 1 && theirPieces.length === 1) return true;

            // King + bishop/knight vs King
            if (myPieces.length === 2 && theirPieces.length === 1) {
                const piece = myPieces.find(p => p.type !== PIECES.KING);
                if (piece && (piece.type === PIECES.BISHOP || piece.type === PIECES.KNIGHT)) return true;
            }

            // King + bishop vs King + bishop (same color bishops)
            if (myPieces.length === 2 && theirPieces.length === 2) {
                const myBishop = myPieces.find(p => p.type === PIECES.BISHOP);
                const theirBishop = theirPieces.find(p => p.type === PIECES.BISHOP);
                if (myBishop && theirBishop) {
                    const mySquare = (myBishop.row + myBishop.col) % 2;
                    const theirSquare = (theirBishop.row + theirBishop.col) % 2;
                    if (mySquare === theirSquare) return true;
                }
            }
        }

        return false;
    }

    getPseudoLegalMoves(row, col, piece) {
        const moves = [];
        const { type, color } = piece;

        switch (type) {
            case PIECES.PAWN:
                this.getPawnMoves(row, col, color, moves);
                break;
            case PIECES.KNIGHT:
                this.getKnightMoves(row, col, color, moves);
                break;
            case PIECES.BISHOP:
                this.getSlidingMoves(row, col, color, moves, [[-1, -1], [-1, 1], [1, -1], [1, 1]]);
                break;
            case PIECES.ROOK:
                this.getSlidingMoves(row, col, color, moves, [[-1, 0], [1, 0], [0, -1], [0, 1]]);
                break;
            case PIECES.QUEEN:
                this.getSlidingMoves(row, col, color, moves, [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]);
                break;
            case PIECES.KING:
                this.getKingMoves(row, col, color, moves);
                break;
        }

        return moves;
    }

    getPawnMoves(row, col, color, moves) {
        const dir = color === COLORS.WHITE ? -1 : 1;
        const startRow = color === COLORS.WHITE ? 6 : 1;
        const promoRow = color === COLORS.WHITE ? 0 : 7;

        // Forward one
        if (this.isEmpty(row + dir, col)) {
            if (row + dir === promoRow) {
                for (const promo of [PIECES.QUEEN, PIECES.ROOK, PIECES.BISHOP, PIECES.KNIGHT]) {
                    moves.push({ row: row + dir, col, promotion: promo });
                }
            } else {
                moves.push({ row: row + dir, col });
            }

            // Forward two from start
            if (row === startRow && this.isEmpty(row + 2 * dir, col)) {
                moves.push({ row: row + 2 * dir, col, doublePawnPush: true });
            }
        }

        // Captures
        for (const dc of [-1, 1]) {
            const r = row + dir, c = col + dc;
            if (this.isInBounds(r, c)) {
                // Normal capture
                if (this.isEnemy(r, c, color)) {
                    if (r === promoRow) {
                        for (const promo of [PIECES.QUEEN, PIECES.ROOK, PIECES.BISHOP, PIECES.KNIGHT]) {
                            moves.push({ row: r, col: c, promotion: promo });
                        }
                    } else {
                        moves.push({ row: r, col: c });
                    }
                }

                // En passant
                if (this.enPassantTarget === `${FILES[c]}${8 - r}`) {
                    moves.push({ row: r, col: c, enPassant: true });
                }
            }
        }
    }

    getKnightMoves(row, col, color, moves) {
        const offsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        for (const [dr, dc] of offsets) {
            const r = row + dr, c = col + dc;
            if (this.isInBounds(r, c) && !this.isFriendly(r, c, color)) {
                moves.push({ row: r, col: c, capture: !!this.board[r][c] });
            }
        }
    }

    getSlidingMoves(row, col, color, moves, directions) {
        for (const [dr, dc] of directions) {
            let r = row + dr, c = col + dc;
            while (this.isInBounds(r, c)) {
                if (this.isEmpty(r, c)) {
                    moves.push({ row: r, col: c });
                } else {
                    if (this.isEnemy(r, c, color)) {
                        moves.push({ row: r, col: c, capture: true });
                    }
                    break;
                }
                r += dr;
                c += dc;
            }
        }
    }

    getKingMoves(row, col, color, moves) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr, c = col + dc;
                if (this.isInBounds(r, c) && !this.isFriendly(r, c, color)) {
                    moves.push({ row: r, col: c });
                }
            }
        }

        // Castling
        const rank = color === COLORS.WHITE ? 7 : 0;
        if (row === rank && col === 4) {
            const rights = this.castlingRights[color];

            // Kingside castling
            if (rights.kingSide) {
                const betweenEmpty = this.isEmpty(rank, 5) && this.isEmpty(rank, 6);
                const rookExists = this.board[rank][7] && this.board[rank][7].type === PIECES.ROOK && this.board[rank][7].color === color;
                if (betweenEmpty && rookExists) {
                    const notAttacked = !this.isSquareAttacked(rank, 4, color) &&
                        !this.isSquareAttacked(rank, 5, color) &&
                        !this.isSquareAttacked(rank, 6, color);
                    if (notAttacked) {
                        moves.push({ row: rank, col: 6, castling: 'kingSide' });
                    }
                }
            }

            // Queenside castling
            if (rights.queenSide) {
                const betweenEmpty = this.isEmpty(rank, 3) && this.isEmpty(rank, 2) && this.isEmpty(rank, 1);
                const rookExists = this.board[rank][0] && this.board[rank][0].type === PIECES.ROOK && this.board[rank][0].color === color;
                if (betweenEmpty && rookExists) {
                    const notAttacked = !this.isSquareAttacked(rank, 4, color) &&
                        !this.isSquareAttacked(rank, 3, color) &&
                        !this.isSquareAttacked(rank, 2, color);
                    if (notAttacked) {
                        moves.push({ row: rank, col: 2, castling: 'queenSide' });
                    }
                }
            }
        }
    }

    applyMoveInternal(fromRow, fromCol, toRow, toCol, piece, updateHistory = true, promotionPiece = null) {
        const captured = this.board[toRow][toCol];
        const moveData = {
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            piece: { ...piece },
            captured: captured ? { ...captured } : null,
            castling: null,
            enPassant: false,
            promotion: null,
            doublePawnPush: false
        };

        // Handle en passant capture
        const move = { row: toRow, col: toCol, promotion: promotionPiece };
        if (move.enPassant) {
            const epRow = piece.color === COLORS.WHITE ? toRow + 1 : toRow - 1;
            moveData.captured = { ...this.board[epRow][toCol] };
            this.board[epRow][toCol] = null;
            moveData.enPassant = true;
        }

        // Move the piece
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        moveData.promotion = move.promotion || null;

        // Handle promotion
        if (move.promotion) {
            this.board[toRow][toCol] = { type: move.promotion, color: piece.color };
            moveData.promotion = move.promotion;
        }

        // Handle castling
        if (move.castling) {
            moveData.castling = move.castling;
            const rank = piece.color === COLORS.WHITE ? 7 : 0;
            if (move.castling === 'kingSide') {
                this.board[rank][5] = this.board[rank][7];
                this.board[rank][7] = null;
            } else {
                this.board[rank][3] = this.board[rank][0];
                this.board[rank][0] = null;
            }
        }

        // Update king position
        if (piece.type === PIECES.KING) {
            this.kingPositions[piece.color] = { row: toRow, col: toCol };
        }

        // Update en passant target
        if (move.doublePawnPush) {
            const epRow = piece.color === COLORS.WHITE ? toRow + 1 : toRow - 1;
            moveData.enPassantTarget = `${FILES[fromCol]}${8 - epRow}`;
            this.enPassantTarget = moveData.enPassantTarget;
        } else {
            this.enPassantTarget = null;
        }

        // Update castling rights
        if (piece.type === PIECES.KING) {
            this.castlingRights[piece.color].kingSide = false;
            this.castlingRights[piece.color].queenSide = false;
        }
        if (piece.type === PIECES.ROOK) {
            if (fromCol === 0) this.castlingRights[piece.color].queenSide = false;
            if (fromCol === 7) this.castlingRights[piece.color].kingSide = false;
        }
        // If a rook is captured
        if (captured && captured.type === PIECES.ROOK) {
            if (toCol === 0) this.castlingRights[captured.color].queenSide = false;
            if (toCol === 7) this.castlingRights[captured.color].kingSide = false;
        }

        if (updateHistory) {
            // Track captured pieces
            if (moveData.captured) {
                const capturer = piece.color;
                this.capturedPieces[capturer].push(moveData.captured.type);
            }

            // Half-move clock
            if (piece.type === PIECES.PAWN || moveData.captured) {
                this.halfMoveClock = 0;
            } else {
                this.halfMoveClock++;
            }

            // Full move number
            if (piece.color === COLORS.BLACK) {
                this.fullMoveNumber++;
            }

            // Track move in history
            this.lastMove = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
            const notation = this.buildMoveNotation(moveData);

            // Update turn
            this.turn = this.turn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

            // Check game state
            const inCheck = this.isKingInCheck(this.turn);
            const checkmate = inCheck && !this.hasAnyLegalMove(this.turn);
            const stalemate = !inCheck && !this.hasAnyLegalMove(this.turn);
            const draw50 = this.isDrawByFiftyMoveRule();
            const repetition = this.isDrawByRepetition();
            const insufficient = this.isInsufficientMaterial();

            let gameEndSuffix = '';
            if (checkmate) {
                const winner = this.turn === COLORS.WHITE ? 'Black' : 'White';
                this.gameOver = true;
                this.gameResult = winner === 'White' ? '1-0' : '0-1';
                gameEndSuffix = '#';
            } else if (stalemate) {
                this.gameOver = true;
                this.gameResult = '½-½';
            } else if (draw50 || repetition || insufficient) {
                this.gameOver = true;
                this.gameResult = '½-½';
            }

            this.moveLog.push({
                notation: notation + gameEndSuffix,
                moveData: moveData,
                inCheck: inCheck && !checkmate,
                checkmate,
                stalemate,
                draw: draw50 || repetition || insufficient
            });

            this.moveHistory.push({
                from: { row: fromRow, col: fromCol },
                to: { row: toRow, col: toCol },
                piece: { ...piece },
                captured: captured ? { ...captured } : null,
                castling: move.castling || null,
                enPassant: move.enPassant || false,
                promotion: move.promotion || null,
                notation: notation
            });

            this.positionHistory.push(this.getPositionKey());
        }

        return moveData;
    }

    makeMove(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
        const piece = this.board[fromRow][fromCol];
        if (!piece) return null;
        if (piece.color !== this.turn) return null;
        if (this.gameOver) return null;

        // Find the matching pseudo-legal move
        const pseudoMoves = this.getPseudoLegalMoves(fromRow, fromCol, piece);
        let targetMove = pseudoMoves.find(m => m.row === toRow && m.col === toCol);

        if (!targetMove) return null;

        // If promotion, set the promotion piece
        if (targetMove.promotion) {
            if (!promotionPiece) return 'need_promotion';
            targetMove = { ...targetMove, promotion: promotionPiece };
        }

        // Filter to legal moves only
        const legalMoves = this.getLegalMovesForPiece(fromRow, fromCol);
        const legalMove = legalMoves.find(m => m.row === toRow && m.col === toCol &&
            (!m.promotion || m.promotion === promotionPiece));

        if (!legalMove) return null;

        return this.applyMoveInternal(fromRow, fromCol, toRow, toCol, piece, true, promotionPiece);
    }

    buildMoveNotation(moveData) {
        const { from, to, piece, captured, castling, promotion, enPassant } = moveData;
        let notation = '';

        if (castling === 'kingSide') return 'O-O';
        if (castling === 'queenSide') return 'O-O-O';

        const pieceChar = piece.type.toUpperCase();
        if (piece.type !== PIECES.PAWN) {
            notation += pieceChar;
            // Disambiguation (simplified - just file)
            notation += FILES[from.col];
        }

        if (captured || enPassant) {
            if (piece.type === PIECES.PAWN) notation += FILES[from.col];
            notation += 'x';
        }

        notation += FILES[to.col] + RANKS[to.row];

        if (promotion) notation += '=' + promotion.toUpperCase();

        return notation;
    }

    // ==================== AI (Simple Evaluation) ====================
    evaluateBoard() {
        let score = 0;
        const pieceEval = {
            p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000
        };

        // Pawn positional tables (center preference)
        const pawnTable = [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [50, 50, 50, 50, 50, 50, 50, 50],
            [10, 10, 20, 30, 30, 20, 10, 10],
            [5, 5, 10, 25, 25, 10, 5, 5],
            [0, 0, 0, 20, 20, 0, 0, 0],
            [5, -5, -10, 0, 0, -10, -5, 5],
            [5, 10, 10, -20, -20, 10, 10, 5],
            [0, 0, 0, 0, 0, 0, 0, 0]
        ];

        const knightTable = [
            [-50, -40, -30, -30, -30, -30, -40, -50],
            [-40, -20, 0, 0, 0, 0, -20, -40],
            [-30, 0, 10, 15, 15, 10, 0, -30],
            [-30, 5, 15, 20, 20, 15, 5, -30],
            [-30, 0, 15, 20, 20, 15, 0, -30],
            [-30, 5, 10, 15, 15, 10, 5, -30],
            [-40, -20, 0, 5, 5, 0, -20, -40],
            [-50, -40, -30, -30, -30, -30, -40, -50]
        ];

        const bishopTable = [
            [-20, -10, -10, -10, -10, -10, -10, -20],
            [-10, 0, 0, 0, 0, 0, 0, -10],
            [-10, 0, 5, 10, 10, 5, 0, -10],
            [-10, 5, 5, 10, 10, 5, 5, -10],
            [-10, 0, 10, 10, 10, 10, 0, -10],
            [-10, 10, 10, 10, 10, 10, 10, -10],
            [-10, 5, 0, 0, 0, 0, 5, -10],
            [-20, -10, -10, -10, -10, -10, -10, -20]
        ];

        const rookTable = [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [5, 10, 10, 10, 10, 10, 10, 5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [0, 0, 0, 5, 5, 0, 0, 0]
        ];

        const queenTable = [
            [-20, -10, -10, -5, -5, -10, -10, -20],
            [-10, 0, 0, 0, 0, 0, 0, -10],
            [-10, 0, 5, 5, 5, 5, 0, -10],
            [-5, 0, 5, 5, 5, 5, 0, -5],
            [0, 0, 5, 5, 5, 5, 0, -5],
            [-10, 5, 5, 5, 5, 5, 0, -10],
            [-10, 0, 5, 0, 0, 0, 0, -10],
            [-20, -10, -10, -5, -5, -10, -10, -20]
        ];

        const kingMidgame = [
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-20, -30, -30, -40, -40, -30, -30, -20],
            [-10, -20, -20, -20, -20, -20, -20, -10],
            [20, 20, 0, 0, 0, 0, 20, 20],
            [20, 30, 10, 0, 0, 10, 30, 20]
        ];

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (!p) continue;

                const val = pieceEval[p.type];
                let posVal = 0;

                const whiteIdx = p.color === COLORS.WHITE ? r : 7 - r;

                switch (p.type) {
                    case PIECES.PAWN: posVal = pawnTable[whiteIdx][c]; break;
                    case PIECES.KNIGHT: posVal = knightTable[whiteIdx][c]; break;
                    case PIECES.BISHOP: posVal = bishopTable[whiteIdx][c]; break;
                    case PIECES.ROOK: posVal = rookTable[whiteIdx][c]; break;
                    case PIECES.QUEEN: posVal = queenTable[whiteIdx][c]; break;
                    case PIECES.KING: posVal = kingMidgame[whiteIdx][c]; break;
                }

                score += (p.color === COLORS.WHITE ? 1 : -1) * (val + posVal);
            }
        }

        // Small random factor to avoid deterministic play
        score += (Math.random() - 0.5) * 10;

        return score;
    }

    minimax(depth, alpha, beta, isMaximizing) {
        if (depth === 0) return this.evaluateBoard();

        const color = isMaximizing ? COLORS.WHITE : COLORS.BLACK;
        const allMoves = [];

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p && p.color === color) {
                    const moves = this.getLegalMovesForPiece(r, c);
                    for (const m of moves) {
                        // Prioritize captures, promotions, checks
                        let score = 0;
                        if (m.capture || m.enPassant || m.promotion) {
                            const target = this.board[m.row][m.col] || (m.enPassant ? { type: PIECES.PAWN } : null);
                            if (target) score = PIECE_VALUES[target.type] * 10;
                            if (m.promotion) score += PIECE_VALUES[m.promotion];
                        }
                        allMoves.push({ row: r, col: c, move: m, score });
                    }
                }
            }
        }

        // Sort by capture value (captures first for better pruning)
        allMoves.sort((a, b) => b.score - a.score);

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const { row, col, move } of allMoves) {
                const savedBoard = this.cloneBoard();
                const savedEnPassant = this.enPassantTarget;
                const savedCastling = { w: { ...this.castlingRights.w }, b: { ...this.castlingRights.b } };
                const savedKingPos = { w: { ...this.kingPositions.w }, b: { ...this.kingPositions.b } };

                this.applyMoveInternal(row, col, move.row, move.col, this.board[row][col], false, move.promotion);

                const evalScore = this.minimax(depth - 1, alpha, beta, false);

                this.board = savedBoard;
                this.enPassantTarget = savedEnPassant;
                this.castlingRights = savedCastling;
                this.kingPositions = savedKingPos;

                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const { row, col, move } of allMoves) {
                const savedBoard = this.cloneBoard();
                const savedEnPassant = this.enPassantTarget;
                const savedCastling = { w: { ...this.castlingRights.w }, b: { ...this.castlingRights.b } };
                const savedKingPos = { w: { ...this.kingPositions.w }, b: { ...this.kingPositions.b } };

                this.applyMoveInternal(row, col, move.row, move.col, this.board[row][col], false, move.promotion);

                const evalScore = this.minimax(depth - 1, alpha, beta, true);

                this.board = savedBoard;
                this.enPassantTarget = savedEnPassant;
                this.castlingRights = savedCastling;
                this.kingPositions = savedKingPos;

                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    getAIMove(difficulty = 3) {
        const color = COLORS.BLACK;
        let bestMove = null;
        let bestScore = Infinity;

        const allMoves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p && p.color === color) {
                    const moves = this.getLegalMovesForPiece(r, c);
                    for (const m of moves) {
                        let score = 0;
                        if (m.capture || m.enPassant || m.promotion) {
                            const target = this.board[m.row][m.col] || (m.enPassant ? { type: PIECES.PAWN } : null);
                            if (target) score = PIECE_VALUES[target.type] * 10;
                            if (m.promotion) score += PIECE_VALUES[m.promotion];
                        }
                        allMoves.push({ row: r, col: c, move: m, score });
                    }
                }
            }
        }

        allMoves.sort((a, b) => b.score - a.score);

        const depth = Math.min(difficulty, allMoves.length > 20 ? difficulty : 4);

        for (const { row, col, move } of allMoves) {
            const savedBoard = this.cloneBoard();
            const savedEnPassant = this.enPassantTarget;
            const savedCastling = { w: { ...this.castlingRights.w }, b: { ...this.castlingRights.b } };
            const savedKingPos = { w: { ...this.kingPositions.w }, b: { ...this.kingPositions.b } };

            this.applyMoveInternal(row, col, move.row, move.col, this.board[row][col], false, move.promotion);

            const evalScore = this.minimax(depth - 1, -Infinity, Infinity, true);

            this.board = savedBoard;
            this.enPassantTarget = savedEnPassant;
            this.castlingRights = savedCastling;
            this.kingPositions = savedKingPos;

            if (evalScore < bestScore) {
                bestScore = evalScore;
                bestMove = { row, col, move };
            }
        }

        return bestMove;
    }
}

// ==================== UI CONTROLLER ====================
class ChessUI {
    constructor() {
        this.engine = new ChessEngine();
        this.selectedSquare = null;
        this.legalMoves = [];
        this.isDragging = false;
        this.dragPiece = null;
        this.dragStart = null;
        this.boardFlipped = false;
        this.isAIEnabled = true;
        this.isAIThinking = false;
        this.gameMode = 'ai'; // 'ai' or 'two-player'
        this.pendingPromotion = null;

        this.init();
    }

    init() {
        this.boardElement = document.getElementById('board');
        this.statusElement = document.getElementById('gameStatus');
        this.turnIndicator = document.getElementById('turnIndicator');
        this.moveHistoryElement = document.getElementById('moveHistory');
        this.capturedWhiteElement = document.getElementById('capturedWhitePieces');
        this.capturedBlackElement = document.getElementById('capturedBlackPieces');
        this.promotionModal = document.getElementById('promotionModal');
        this.promotionPieces = document.getElementById('promotionPieces');
        this.gameOverModal = document.getElementById('gameOverModal');
        this.gameModalTitle = document.getElementById('gameModalTitle');
        this.gameModalSubtitle = document.getElementById('gameModalSubtitle');
        this.gameModalIcon = document.getElementById('gameModalIcon');

        // Create coordinate labels
        this.createCoordinates();
        this.render();
        this.setupEventListeners();
        this.updateStatus();
    }

    createCoordinates() {
        const rankCoords = document.getElementById('rankCoords');
        const fileCoords = document.getElementById('fileCoords');
        rankCoords.innerHTML = '';
        fileCoords.innerHTML = '';

        for (let i = 0; i < 8; i++) {
            const rank = document.createElement('span');
            rank.textContent = 8 - i;
            rankCoords.appendChild(rank);
        }

        for (let i = 0; i < 8; i++) {
            const file = document.createElement('span');
            file.textContent = FILES[i];
            fileCoords.appendChild(file);
        }
    }

    render() {
        this.boardElement.innerHTML = '';

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const displayRow = this.boardFlipped ? 7 - r : r;
                const displayCol = this.boardFlipped ? 7 - c : c;

                const square = document.createElement('div');
                square.className = `square ${(displayRow + displayCol) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = displayRow;
                square.dataset.col = displayCol;

                // Last move highlight
                if (this.engine.lastMove) {
                    const lm = this.engine.lastMove;
                    if ((displayRow === lm.from.row && displayCol === lm.from.col) ||
                        (displayRow === lm.to.row && displayCol === lm.to.col)) {
                        square.classList.add('last-move');
                    }
                }

                // Selected square
                if (this.selectedSquare &&
                    displayRow === this.selectedSquare.row &&
                    displayCol === this.selectedSquare.col) {
                    square.classList.add('selected');
                }

                // Check highlight
                const piece = this.engine.board[displayRow][displayCol];
                if (piece && piece.type === PIECES.KING) {
                    if (this.engine.isKingInCheck(piece.color)) {
                        square.classList.add('in-check');
                    }
                }

                // Valid move indicators - class langsung di square
                const isValidTarget = this.legalMoves.some(m => m.row === displayRow && m.col === displayCol);
                if (isValidTarget) {
                    const hasCapture = this.engine.board[displayRow][displayCol] ||
                        this.legalMoves.some(m => m.row === displayRow && m.col === displayCol && (m.enPassant || m.capture));
                    if (hasCapture) {
                        square.classList.add('valid-capture');
                    } else {
                        square.classList.add('valid-move');
                    }
                }

                // Piece rendering
                if (piece) {
                    const pieceEl = document.createElement('div');
                    pieceEl.className = 'piece';
                    pieceEl.classList.add(piece.color === COLORS.WHITE ? 'piece-white' : 'piece-black');
                    if (piece.color === this.engine.turn && !this.engine.gameOver) {
                        pieceEl.classList.add('draggable');
                    }
                    pieceEl.textContent = PIECE_UNICODE_LARGE[piece.color + piece.type];
                    pieceEl.dataset.piece = piece.color + piece.type;
                    pieceEl.draggable = true;
                    square.appendChild(pieceEl);
                }

                square.addEventListener('click', () => this.onSquareClick(displayRow, displayCol));
                square.addEventListener('dragstart', (e) => this.onDragStart(e, displayRow, displayCol));
                square.addEventListener('dragover', (e) => this.onDragOver(e, displayRow, displayCol));
                square.addEventListener('drop', (e) => this.onDrop(e, displayRow, displayCol));
                square.addEventListener('dragend', (e) => this.onDragEnd(e));

                this.boardElement.appendChild(square);
            }
        }
    }

    getSquareElement(row, col) {
        return this.boardElement.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
    }

    onSquareClick(row, col) {
        if (this.engine.gameOver || this.isAIThinking) return;
        if (this.isAIEnabled && this.engine.turn === COLORS.BLACK) return;

        const piece = this.engine.board[row][col];

        if (this.gameMode === 'two-player' && !this.selectedSquare && piece && piece.color !== this.engine.turn) return;

        // If a piece is already selected
        if (this.selectedSquare) {
            // If clicking on own piece, reselect
            if (piece && piece.color === this.engine.turn) {
                this.selectedSquare = { row, col };
                this.legalMoves = this.engine.getLegalMovesForPiece(row, col);
                this.render();
                return;
            }

            // Try to move
            const isValid = this.legalMoves.some(m => m.row === row && m.col === col);
            if (isValid) {
                this.executeMove(this.selectedSquare.row, this.selectedSquare.col, row, col);
                return;
            }

            this.selectedSquare = null;
            this.legalMoves = [];
            this.render();
            return;
        }

        // Select a piece
        if (piece && piece.color === this.engine.turn) {
            this.selectedSquare = { row, col };
            this.legalMoves = this.engine.getLegalMovesForPiece(row, col);
            this.render();
        }
    }

    onDragStart(e, row, col) {
        const piece = this.engine.board[row][col];
        if (!piece || this.engine.gameOver || this.isAIThinking) {
            e.preventDefault();
            return;
        }
        if (this.isAIEnabled && this.engine.turn === COLORS.BLACK) {
            e.preventDefault();
            return;
        }
        if (piece.color !== this.engine.turn) {
            e.preventDefault();
            return;
        }

        this.isDragging = true;
        this.dragStart = { row, col };
        this.selectedSquare = { row, col };
        this.legalMoves = this.engine.getLegalMovesForPiece(row, col);

        const pieceEl = e.target.closest('.piece');
        if (pieceEl) {
            pieceEl.classList.add('dragging');
            this.dragPiece = pieceEl;
        }

        this.render();
    }

    onDragOver(e, row, col) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    onDrop(e, row, col) {
        e.preventDefault();
        if (!this.isDragging || !this.dragStart) return;

        this.executeMove(this.dragStart.row, this.dragStart.col, row, col);
        this.isDragging = false;
        this.dragPiece = null;
    }

    onDragEnd(e) {
        if (this.dragPiece) {
            this.dragPiece.classList.remove('dragging');
        }
        this.isDragging = false;
        this.dragPiece = null;
    }

    executeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.engine.board[fromRow][fromCol];
        if (!piece) return;

        const result = this.engine.makeMove(fromRow, fromCol, toRow, toCol);

        if (result === 'need_promotion') {
            this.pendingPromotion = { fromRow, fromCol, toRow, toCol };
            this.showPromotionModal(piece.color);
            return;
        }

        if (result) {
            this.selectedSquare = null;
            this.legalMoves = [];
            this.animateMove(fromRow, fromCol, toRow, toCol);

            // If it's en passant and we have a captured piece, animate the captured pawn
            if (result.enPassant) {
                const epRow = piece.color === COLORS.WHITE ? toRow + 1 : toRow - 1;
            }

            this.render();
            this.updateMoveHistory();
            this.updateCapturedPieces();
            this.updateStatus();

            // AI move
            if (this.isAIEnabled && !this.engine.gameOver && this.engine.turn === COLORS.BLACK) {
                this.scheduleAIMove();
            }
        } else {
            // Invalid move - shake animation
            const square = this.getSquareElement(toRow, toCol);
            if (square) {
                square.style.animation = 'shake 0.3s ease';
                setTimeout(() => { if (square) square.style.animation = ''; }, 300);
            }
        }

        if (this.engine.gameOver) {
            setTimeout(() => this.showGameOverModal(), 500);
        }
    }

    animateMove(fromRow, fromCol, toRow, toCol) {
        const toSquare = this.getSquareElement(toRow, toCol);
        const pieceEl = toSquare ? toSquare.querySelector('.piece') : null;
        if (pieceEl) {
            pieceEl.classList.remove('moving');
            // Force reflow
            void pieceEl.offsetWidth;
            pieceEl.classList.add('moving');
        }
    }

    scheduleAIMove() {
        this.isAIThinking = true;
        this.updateStatus();

        setTimeout(() => {
            const aiMove = this.engine.getAIMove(3);
            if (aiMove) {
                this.engine.makeMove(aiMove.row, aiMove.col, aiMove.move.row, aiMove.move.col, aiMove.move.promotion);
                this.selectedSquare = null;
                this.legalMoves = [];
                this.animateMove(aiMove.row, aiMove.col, aiMove.move.row, aiMove.move.col);
                this.render();
                this.updateMoveHistory();
                this.updateCapturedPieces();
                this.updateStatus();

                if (this.engine.gameOver) {
                    setTimeout(() => this.showGameOverModal(), 500);
                }
            }
            this.isAIThinking = false;
        }, 300);
    }

    showPromotionModal(color) {
        this.promotionModal.classList.add('show');
        this.promotionPieces.innerHTML = '';

        const types = [PIECES.QUEEN, PIECES.ROOK, PIECES.BISHOP, PIECES.KNIGHT];
        for (const type of types) {
            const btn = document.createElement('button');
            btn.className = 'promotion-piece';
            btn.textContent = PIECE_UNICODE_LARGE[color + type];
            btn.dataset.type = type;
            btn.addEventListener('click', () => {
                const { fromRow, fromCol, toRow, toCol } = this.pendingPromotion;
                this.promotionModal.classList.remove('show');
                this.engine.makeMove(fromRow, fromCol, toRow, toCol, type);
                this.pendingPromotion = null;
                this.selectedSquare = null;
                this.legalMoves = [];
                this.render();
                this.updateMoveHistory();
                this.updateCapturedPieces();
                this.updateStatus();

                if (this.isAIEnabled && !this.engine.gameOver && this.engine.turn === COLORS.BLACK) {
                    this.scheduleAIMove();
                }

                if (this.engine.gameOver) {
                    setTimeout(() => this.showGameOverModal(), 500);
                }
            });
            this.promotionPieces.appendChild(btn);
        }
    }

    updateStatus() {
        const turn = this.engine.turn === COLORS.WHITE ? 'White' : 'Black';
        const whiteActive = this.engine.turn === COLORS.WHITE;
        const blackActive = this.engine.turn === COLORS.BLACK;

        document.querySelector('.white-player').classList.toggle('active', whiteActive);
        document.querySelector('.black-player').classList.toggle('active', blackActive);

        if (this.engine.gameOver) {
            this.statusElement.textContent = 'Game Over';
            this.statusElement.classList.remove('active');
            this.turnIndicator.style.display = 'none';
            return;
        }

        if (this.isAIThinking) {
            this.statusElement.textContent = 'AI Thinking...';
            this.statusElement.classList.remove('active');
            this.turnIndicator.style.display = 'none';
            return;
        }

        if (this.isAIEnabled && this.engine.turn === COLORS.BLACK) {
            this.statusElement.textContent = 'AI\'s Turn';
        } else {
            this.statusElement.textContent = `${turn}'s Turn`;
        }
        this.statusElement.classList.add('active');
        this.turnIndicator.style.display = 'block';
    }

    updateMoveHistory() {
        this.moveHistoryElement.innerHTML = '';

        if (this.engine.moveLog.length === 0) {
            this.moveHistoryElement.innerHTML = '<div class="move-history-empty">No moves yet</div>';
            return;
        }

        const moves = this.engine.moveLog;
        for (let i = 0; i < moves.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            const entry = document.createElement('span');
            entry.className = 'move-entry';

            const numSpan = document.createElement('span');
            numSpan.className = 'move-number';
            numSpan.textContent = `${moveNum}. `;
            entry.appendChild(numSpan);

            const whiteSpan = document.createElement('span');
            whiteSpan.className = 'white-move';
            whiteSpan.textContent = moves[i].notation;
            entry.appendChild(whiteSpan);

            if (moves[i + 1]) {
                const blackSpan = document.createElement('span');
                blackSpan.className = 'black-move';
                blackSpan.textContent = ` ${moves[i + 1].notation}`;
                entry.appendChild(blackSpan);
            }

            this.moveHistoryElement.appendChild(entry);
        }

        // Auto-scroll to bottom
        this.moveHistoryElement.scrollTop = this.moveHistoryElement.scrollHeight;
    }

    updateCapturedPieces() {
        this.capturedBlackElement.innerHTML = '';
        this.capturedWhiteElement.innerHTML = '';

        const order = [PIECES.QUEEN, PIECES.ROOK, PIECES.BISHOP, PIECES.KNIGHT, PIECES.PAWN];

        for (const type of order) {
            const count = this.engine.capturedPieces.w.filter(p => p === type).length;
            for (let i = 0; i < count; i++) {
                const span = document.createElement('span');
                span.className = 'captured-piece';
                span.textContent = PIECE_UNICODE_LARGE['b' + type];
                this.capturedBlackElement.appendChild(span);
            }
        }

        for (const type of order) {
            const count = this.engine.capturedPieces.b.filter(p => p === type).length;
            for (let i = 0; i < count; i++) {
                const span = document.createElement('span');
                span.className = 'captured-piece';
                span.textContent = PIECE_UNICODE_LARGE['w' + type];
                this.capturedWhiteElement.appendChild(span);
            }
        }
    }

    showGameOverModal() {
        if (!this.engine.gameOver) return;

        const result = this.engine.gameResult;
        const lastMove = this.engine.moveLog[this.engine.moveLog.length - 1];

        let title, subtitle, icon;

        if (lastMove && lastMove.checkmate) {
            const winner = result === '1-0' ? 'White' : 'Black';
            title = `${winner} Wins!`;
            subtitle = 'Checkmate';
            icon = '👑';
        } else if (lastMove && lastMove.stalemate) {
            title = 'Draw';
            subtitle = 'Stalemate';
            icon = '🤝';
        } else if (lastMove && lastMove.draw) {
            if (this.engine.isDrawByFiftyMoveRule()) {
                title = 'Draw';
                subtitle = '50-Move Rule';
                icon = '🤝';
            } else if (this.engine.isDrawByRepetition()) {
                title = 'Draw';
                subtitle = 'Threefold Repetition';
                icon = '🔄';
            } else {
                title = 'Draw';
                subtitle = 'Insufficient Material';
                icon = '⚖️';
            }
        }

        this.gameModalTitle.textContent = title;
        this.gameModalSubtitle.textContent = subtitle;
        this.gameModalIcon.textContent = icon;
        this.gameOverModal.classList.add('show');
    }

    newGame() {
        this.engine.reset();
        this.selectedSquare = null;
        this.legalMoves = [];
        this.isAIThinking = false;
        this.pendingPromotion = null;
        this.gameOverModal.classList.remove('show');
        this.promotionModal.classList.remove('show');
        this.render();
        this.updateMoveHistory();
        this.updateCapturedPieces();
        this.updateStatus();
    }

    flipBoard() {
        this.boardFlipped = !this.boardFlipped;
        // Reorder rank coordinates
        const rankCoords = document.getElementById('rankCoords');
        const spans = rankCoords.querySelectorAll('span');
        const items = Array.from(spans);
        if (this.boardFlipped) {
            items.reverse();
        } else {
            items.sort((a, b) => parseInt(b.textContent) - parseInt(a.textContent));
        }
        rankCoords.innerHTML = '';
        items.forEach(s => rankCoords.appendChild(s));

        this.render();
    }

    toggleGameMode() {
        this.isAIEnabled = !this.isAIEnabled;
        this.gameMode = this.isAIEnabled ? 'ai' : 'two-player';

        // Update UI
        const modeLabel = document.getElementById('modeLabel');
        const modeIndicator = document.getElementById('modeIndicator');
        const blackPlayerName = document.getElementById('blackPlayerName');

        if (this.isAIEnabled) {
            modeLabel.textContent = 'vs AI';
            modeIndicator.classList.add('two-player');
            modeIndicator.classList.remove('ai');
            blackPlayerName.textContent = 'AI';
        } else {
            modeLabel.textContent = 'vs Player';
            modeIndicator.classList.remove('two-player');
            modeIndicator.classList.add('ai');
            blackPlayerName.textContent = 'Black';
        }

        // Reset game when switching modes
        this.newGame();
    }

    setupEventListeners() {
        document.getElementById('btnNewGame').addEventListener('click', () => this.newGame());
        document.getElementById('btnFlip').addEventListener('click', () => this.flipBoard());
        document.getElementById('btnUndo').addEventListener('click', () => this.undoMove());
        document.getElementById('btnPlayAgain').addEventListener('click', () => this.newGame());
        document.getElementById('btnResign').addEventListener('click', () => this.resign());
        document.getElementById('btnDraw').addEventListener('click', () => this.offerDraw());
        document.getElementById('btnGameMode').addEventListener('click', () => this.toggleGameMode());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'r' || e.key === 'R') this.newGame();
            if (e.key === 'f' || e.key === 'F') this.flipBoard();
            if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.undoMove();
            }
        });
    }

    undoMove() {
        if (this.engine.moveHistory.length === 0) return;
        if (this.isAIThinking) return;

        const movesToUndo = this.isAIEnabled ? 2 : 1;
        let movesToKeep = this.engine.moveLog.length - movesToUndo;
        if (movesToKeep < 0) movesToKeep = 0;

        // Save the moves we want to keep
        const savedMoves = this.engine.moveLog.slice(0, movesToKeep);

        // Full reset
        this.engine.reset();

        // Replay all saved moves
        for (const move of savedMoves) {
            const md = move.moveData;
            this.engine.makeMove(md.from.row, md.from.col, md.to.row, md.to.col, md.promotion || undefined);
        }

        this.selectedSquare = null;
        this.legalMoves = [];
        this.isAIThinking = false;
        this.render();
        this.updateMoveHistory();
        this.updateCapturedPieces();
        this.updateStatus();
    }

    resign() {
        if (this.engine.gameOver) return;
        const winner = this.engine.turn === COLORS.WHITE ? 'Black' : 'White';
        this.engine.gameOver = true;
        this.engine.gameResult = this.engine.turn === COLORS.WHITE ? '0-1' : '1-0';

        this.gameModalTitle.textContent = `${winner} Wins!`;
        this.gameModalSubtitle.textContent = `${this.engine.turn === COLORS.WHITE ? 'White' : 'Black'} resigned`;
        this.gameModalIcon.textContent = '🏳️';
        this.gameOverModal.classList.add('show');
        this.updateStatus();
        this.render();
    }

    offerDraw() {
        if (this.engine.gameOver) return;

        if (this.isAIEnabled) {
            if (this.engine.turn === COLORS.BLACK) return;

            const score = this.engine.evaluateBoard();
            // AI accepts draw if it's losing or roughly equal (otherwise declines)
            if (score <= 50) {
                this.engine.gameOver = true;
                this.engine.gameResult = '½-½';
                this.gameModalTitle.textContent = 'Draw';
                this.gameModalSubtitle.textContent = 'Draw agreed';
                this.gameModalIcon.textContent = '🤝';
                this.gameOverModal.classList.add('show');
                this.updateStatus();
                this.render();
            } else {
                this.statusElement.textContent = 'AI Declined Draw';
                setTimeout(() => this.updateStatus(), 1500);
            }
        } else {
            // Two-player mode: immediate draw agreement
            this.engine.gameOver = true;
            this.engine.gameResult = '½-½';
            this.gameModalTitle.textContent = 'Draw';
            this.gameModalSubtitle.textContent = 'Draw agreed';
            this.gameModalIcon.textContent = '🤝';
            this.gameOverModal.classList.add('show');
            this.updateStatus();
            this.render();
        }
    }
}

// Inject shake animation
const style = document.createElement('style');
style.textContent = `
@keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    75% { transform: translateX(4px); }
}
`;
document.head.appendChild(style);

// ==================== INITIALIZE ====================
document.addEventListener('DOMContentLoaded', () => {
    const chessUI = new ChessUI();
    window.chessUI = chessUI;
});
