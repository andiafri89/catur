# ♚ Chess Master — Online Multiplayer Chess

Premium chess game with full rules, AI opponent, and real-time online multiplayer.

---

## 📁 File Structure

| File | Description |
|---|---|
| `index.html` | Main page & UI structure |
| `style.css` | Styling & animations |
| `script.js` | Chess engine & UI logic |
| `online.js` | WebSocket client for multiplayer |
| `database.py` | **Backend** WebSocket server (hosted separately) |

---

## 🚀 Deploy to GitHub Pages (Frontend)

### Step 1: Upload to GitHub

1. Go to [github.com](https://github.com) and sign in
2. Click **+** (top-right) → **New repository**
3. Name it `chess` (or anything you like), keep **Public**
4. Click **Create repository**
5. Upload these files to the repository:
   - `index.html`
   - `style.css`
   - `script.js`
   - `online.js`
   
   *(You can drag & drop files on the GitHub upload page)*

### Step 2: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (left sidebar)
3. Under **Branch**, select `main` (or `master`) and `/ (root)`
4. Click **Save**
5. Wait 1-2 minutes, then your site will be live at:
   ```
   https://YOUR_USERNAME.github.io/chess/
   ```

---

## 🌐 Host WebSocket Server (For Online Multiplayer)

The `database.py` file needs a **server** that can run Python WebSockets. Free options:

### Option A: Render.com (Recommended)

1. Go to [render.com](https://render.com) and sign up
2. Click **New+** → **Web Service**
3. Connect your GitHub repository
4. Settings:
   - **Name**: `chess-server`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install websockets`
   - **Start Command**: `python database.py`
5. Click **Create Web Service**
6. After deploy, you'll get a URL like: `wss://chess-server.onrender.com`

### Option B: Railway.app

1. Go to [railway.app](https://railway.app)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your chess repository
4. Add a `requirements.txt` file with: `websockets`
5. Set start command: `python database.py`

### After Server is Online

Once you have your server URL (e.g., `wss://chess-server.onrender.com`):

1. Open `online.js` in your repository
2. Change line 11 from:
   ```js
   const SERVER_URL = 'ws://localhost:8765';
   ```
   to:
   ```js
   const SERVER_URL = 'wss://chess-server.onrender.com';
   ```
3. Commit & push the change to GitHub

---

## 🎮 How to Play Online

1. Both players open `https://YOUR_USERNAME.github.io/chess/`
2. Click the **🌐 Online** button
3. **Player 1** (White):
   - Enter your name
   - Enter the Server URL (e.g., `wss://chess-server.onrender.com`)
   - Click **Create Game**
   - Share the 4-digit **Game Code** with your friend
4. **Player 2** (Black):
   - Enter your name
   - Enter the same Server URL
   - Enter the **Game Code**
   - Click **Join Game**
5. Play! White goes first.

---

## 🏠 Local Mode

To play locally (2-player on same device or vs AI), just open `index.html` in your browser. No server needed.

---

## 💡 Tips

- **Always use `wss://`** (not `ws://`) when the server is on a public host like Render
- The free tier of Render.com goes to sleep after inactivity. First connection may take 30-60 seconds to wake up
- Game codes have **4 characters** (letters + numbers)
