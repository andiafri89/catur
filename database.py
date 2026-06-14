""" ==========================================
    ♚ CHESS MASTER — Online WebSocket Server
    ==========================================
    Host this on Render.com as a Web Service.
    The chess frontend (GitHub Pages) connects here
    for real-time multiplayer gameplay.

    Requirements: pip install websockets
    Start: python database.py
    ========================================== """

import asyncio
import json
import random
import string
import os
import logging
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional

import websockets
from websockets.server import WebSocketServerProtocol
from websockets.exceptions import ConnectionClosed

# ─── Logging ───────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-5s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger('chess-server')


# ─── Data Structures ───────────────────────────────────────
@dataclass
class Player:
    name: str
    color: str  # 'w' or 'b'
    websocket: WebSocketServerProtocol

    @property
    def id(self):
        return id(self.websocket)


@dataclass
class Game:
    code: str
    host: Player
    guest: Optional[Player] = None
    status: str = 'waiting'  # 'waiting' | 'playing' | 'finished'
    turn: str = 'w'
    last_move: Optional[dict] = None
    result: Optional[str] = None
    move_count: int = 0
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    @property
    def is_full(self):
        return self.guest is not None


# ─── Global State ──────────────────────────────────────────
games: dict[str, Game] = {}
player_map: dict[int, tuple[str, str]] = {}  # websocket_id -> (game_code, color)


# ─── Helpers ───────────────────────────────────────────────
def generate_code(length: int = 4) -> str:
    """Generate a unique alphanumeric game code."""
    chars = string.ascii_uppercase + string.digits
    while True:
        code = ''.join(random.choices(chars, k=length))
        if code not in games:
            return code


def find_player(game_code: str, color: str) -> Optional[Player]:
    """Find a player by game code and color."""
    game = games.get(game_code)
    if not game:
        return None
    if color == 'w':
        return game.host
    elif color == 'b':
        return game.guest
    return None


def find_opponent(game_code: str, my_color: str) -> Optional[Player]:
    """Find the opponent of a given player."""
    return find_player(game_code, 'b' if my_color == 'w' else 'w')


async def send_json(websocket: WebSocketServerProtocol, data: dict):
    """Send JSON data to a websocket connection safely."""
    try:
        await websocket.send(json.dumps(data))
    except ConnectionClosed:
        pass


async def broadcast(game_code: str, data: dict, exclude_color: Optional[str] = None):
    """Send a message to all connected players in a game."""
    game = games.get(game_code)
    if not game:
        return
    for player in [game.host, game.guest]:
        if player and player.color != exclude_color:
            await send_json(player.websocket, data)


async def cleanup_game(game_code: str):
    """Clean up a game and its connections."""
    game = games.pop(game_code, None)
    if game:
        logger.info(f'🧹 Cleaned up game {game_code}')


# ─── Message Handlers ──────────────────────────────────────
async def handle_create_game(websocket: WebSocketServerProtocol, data: dict):
    """Create a new game room."""
    player_name = data.get('playerName', 'Player').strip() or 'Player'
    code = generate_code()

    game = Game(
        code=code,
        host=Player(name=player_name, color='w', websocket=websocket)
    )
    games[code] = game
    player_map[id(websocket)] = (code, 'w')

    await send_json(websocket, {
        'type': 'game_created',
        'gameCode': code,
        'color': 'w',
        'playerName': player_name,
        'opponentName': None
    })

    logger.info(f'🎮 {player_name} created game {code}')


async def handle_join_game(websocket: WebSocketServerProtocol, data: dict):
    """Join an existing game room."""
    code = data.get('gameCode', '').upper().strip()
    player_name = data.get('playerName', 'Player').strip() or 'Player'

    # Validate game code
    if code not in games:
        await send_json(websocket, {
            'type': 'error',
            'message': '❌ Game not found. Check the code and try again.'
        })
        return

    game = games[code]

    # Validate game state
    if game.status != 'waiting':
        await send_json(websocket, {
            'type': 'error',
            'message': '❌ This game is already full or has ended.'
        })
        return

    if game.host.name.lower() == player_name.lower():
        await send_json(websocket, {
            'type': 'error',
            'message': '❌ You cannot join your own game.'
        })
        return

    # Assign as guest
    game.guest = Player(name=player_name, color='b', websocket=websocket)
    game.status = 'playing'
    player_map[id(websocket)] = (code, 'b')

    # Notify joiner
    await send_json(websocket, {
        'type': 'game_joined',
        'gameCode': code,
        'color': 'b',
        'playerName': player_name,
        'opponentName': game.host.name
    })

    # Notify host
    await send_json(game.host.websocket, {
        'type': 'opponent_joined',
        'opponentName': player_name,
        'yourTurn': True  # Host (white) always goes first
    })

    logger.info(f'👋 {player_name} joined game {code} — game started!')


async def handle_move(websocket: WebSocketServerProtocol, data: dict):
    """Handle a chess move from a player."""
    code = data.get('gameCode', '')
    move_data = data.get('move', {})
    game_over = data.get('gameOver', False)
    result = data.get('result')

    # Validate player is in this game
    conn_info = player_map.get(id(websocket))
    if not conn_info or conn_info[0] != code:
        return

    my_color = conn_info[1]
    game = games.get(code)

    if not game or game.status != 'playing':
        return

    # Validate it's this player's turn
    if my_color != game.turn:
        await send_json(websocket, {
            'type': 'error',
            'message': '⏳ It\'s not your turn!'
        })
        return

    # Update game state
    game.turn = 'b' if game.turn == 'w' else 'w'
    game.last_move = move_data
    game.move_count += 1

    if game_over:
        game.status = 'finished'
        game.result = result

    # Relay move to opponent
    opponent = find_opponent(code, my_color)
    if opponent:
        await send_json(opponent.websocket, {
            'type': 'opponent_move',
            'move': move_data,
            'gameOver': game_over,
            'result': result
        })

    # Acknowledge to mover
    await send_json(websocket, {
        'type': 'move_ack',
        'turn': game.turn
    })


async def handle_resign(websocket: WebSocketServerProtocol, data: dict):
    """Handle a player resigning."""
    code = data.get('gameCode', '')
    conn_info = player_map.get(id(websocket))

    if not conn_info or conn_info[0] != code:
        return

    my_color = conn_info[1]
    game = games.get(code)
    if not game or game.status == 'finished':
        return

    game.status = 'finished'
    winner_color = 'b' if my_color == 'w' else 'w'
    result = '1-0' if winner_color == 'w' else '0-1'
    game.result = result

    # Notify both players
    await broadcast(code, {
        'type': 'game_over',
        'result': result,
        'reason': 'resignation',
        'winner': find_player(code, winner_color).name
    })

    logger.info(f'🏳️ {conn_info[1]} resigned in game {code}')


async def handle_offer_draw(websocket: WebSocketServerProtocol, data: dict):
    """Handle a draw offer."""
    code = data.get('gameCode', '')
    conn_info = player_map.get(id(websocket))

    if not conn_info or conn_info[0] != code:
        return

    my_color = conn_info[1]
    game = games.get(code)
    if not game or game.status == 'finished':
        return

    player = find_player(code, my_color)
    opponent = find_opponent(code, my_color)

    if opponent:
        await send_json(opponent.websocket, {
            'type': 'draw_offered',
            'byColor': my_color,
            'byName': player.name
        })
        logger.info(f'🤝 {player.name} offered a draw in game {code}')


async def handle_draw_response(websocket: WebSocketServerProtocol, data: dict):
    """Handle a player's response to a draw offer."""
    code = data.get('gameCode', '')
    accept = data.get('accept', False)

    conn_info = player_map.get(id(websocket))
    if not conn_info or conn_info[0] != code:
        return

    my_color = conn_info[1]
    game = games.get(code)
    if not game:
        return

    opponent = find_opponent(code, my_color)

    if accept:
        game.status = 'finished'
        game.result = '½-½'

        await broadcast(code, {
            'type': 'game_over',
            'result': '½-½',
            'reason': 'draw_agreed'
        })
        logger.info(f'🤝 Draw agreed in game {code}')
    else:
        if opponent:
            await send_json(opponent.websocket, {
                'type': 'draw_declined'
            })
            logger.info(f'❌ Draw declined in game {code}')


async def handle_rematch(websocket: WebSocketServerProtocol, data: dict):
    """Handle a rematch request."""
    code = data.get('gameCode', '')
    conn_info = player_map.get(id(websocket))

    if not conn_info or conn_info[0] != code:
        return

    my_color = conn_info[1]
    game = games.get(code)
    if not game:
        return

    # Reset the game state
    game.status = 'playing'
    game.turn = 'w'
    game.last_move = None
    game.result = None
    game.move_count = 0

    # Notify opponent
    opponent = find_opponent(code, my_color)
    if opponent:
        await send_json(opponent.websocket, {
            'type': 'rematch_requested',
            'byColor': my_color
        })

    logger.info(f'🔄 Rematch requested in game {code}')


async def handle_rematch_response(websocket: WebSocketServerProtocol, data: dict):
    """Handle rematch response."""
    code = data.get('gameCode', '')
    accept = data.get('accept', False)

    conn_info = player_map.get(id(websocket))
    if not conn_info or conn_info[0] != code:
        return

    my_color = conn_info[1]
    opponent = find_opponent(code, my_color)

    if accept and opponent:
        game = games.get(code)
        if game:
            game.status = 'playing'
            game.turn = 'w'
            game.last_move = None
            game.result = None
            game.move_count = 0

        await broadcast(code, {
            'type': 'rematch_started',
            'turn': 'w'
        })
        logger.info(f'🔄 Rematch started in game {code}')
    elif opponent:
        await send_json(opponent.websocket, {
            'type': 'rematch_declined'
        })


async def handle_ping(websocket: WebSocketServerProtocol, data: dict):
    """Respond to keep-alive ping."""
    await send_json(websocket, {'type': 'pong'})


# ─── Connection Lifecycle ──────────────────────────────────
async def handle_disconnect(websocket: WebSocketServerProtocol):
    """Handle a player disconnection."""
    conn_info = player_map.pop(id(websocket), None)
    if not conn_info:
        return

    code, color = conn_info
    game = games.get(code)
    if not game:
        return

    player = find_player(code, color)
    player_name = player.name if player else 'Unknown'

    # Notify opponent
    opponent = find_opponent(code, color)
    if opponent:
        await send_json(opponent.websocket, {
            'type': 'opponent_disconnected',
            'message': f'{player_name} disconnected'
        })

    # If the game was active, mark as finished
    if game.status == 'playing':
        game.status = 'finished'
        winner_color = 'b' if color == 'w' else 'w'
        winner = find_player(code, winner_color)
        result = '1-0' if winner_color == 'w' else '0-1'
        game.result = result

        if opponent:
            await send_json(opponent.websocket, {
                'type': 'game_over',
                'result': result,
                'reason': 'disconnection',
                'winner': winner.name if winner else 'Unknown'
            })

    logger.info(f'🔌 {player_name} ({color}) disconnected from game {code}')

    # Clean up if both players disconnected
    if not find_player(code, 'w') and not find_player(code, 'b'):
        await cleanup_game(code)


async def connection_handler(websocket: WebSocketServerProtocol):
    """Main handler for each WebSocket connection."""
    address = websocket.remote_address
    logger.info(f'🔗 New connection from {address}')

    try:
        async for raw_message in websocket:
            try:
                data = json.loads(raw_message)
                msg_type = data.get('type', '')

                # Route to appropriate handler
                handlers = {
                    'create_game': handle_create_game,
                    'join_game': handle_join_game,
                    'move': handle_move,
                    'resign': handle_resign,
                    'offer_draw': handle_offer_draw,
                    'draw_response': handle_draw_response,
                    'rematch': handle_rematch,
                    'rematch_response': handle_rematch_response,
                    'ping': handle_ping,
                }

                handler = handlers.get(msg_type)
                if handler:
                    await handler(websocket, data)
                else:
                    await send_json(websocket, {
                        'type': 'error',
                        'message': f'Unknown message type: {msg_type}'
                    })

            except json.JSONDecodeError:
                await send_json(websocket, {
                    'type': 'error',
                    'message': 'Invalid JSON'
                })

    except ConnectionClosed:
        pass
    finally:
        await handle_disconnect(websocket)
        logger.info(f'👋 Connection from {address} closed')


# ─── Server Entry Point ────────────────────────────────────
async def main():
    port = int(os.environ.get('PORT', 8765))
    host = '0.0.0.0'

    logger.info('')
    logger.info('╔═══════════════════════════════════════════╗')
    logger.info('║    ♚ CHESS MASTER — WebSocket Server     ║')
    logger.info('╠═══════════════════════════════════════════╣')
    logger.info(f'║  Listening on: ws://{host}:{port}          ║')
    logger.info('║  Mode:       Multiplayer Relay           ║')
    logger.info('╚═══════════════════════════════════════════╝')
    logger.info('')

    async with websockets.serve(
        connection_handler,
        host,
        port,
        ping_interval=30,  # Auto-ping every 30s
        ping_timeout=10,   # Timeout after 10s
        max_size=2 ** 16,  # 64KB max message size
    ):
        await asyncio.Future()  # Run forever


if __name__ == '__main__':
    asyncio.run(main())
