# VigilExam - Secure Online Examination & Proctoring System

[![Electron](https://img.shields.io/badge/Electron-v33.2-47848F?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-v18.3-61DAFB?logo=react)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-v4.21-000000?logo=express)](https://expressjs.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-v4.8-010101?logo=socketdotio)](https://socket.io/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**VigilExam** is a full-stack desktop examination and real-time proctoring platform developed for B.Tech CSE (Walchand College of Engineering, Sangli). 

Unlike conventional browser-only testing tools, VigilExam combines **browser/camera-based AI proctoring** with a **native OS system-level monitoring engine** that inspects running OS processes (flagging AnyDesk, TeamViewer, VirtualBox, Wireshark, etc.), enforces kiosk lockdown, tracks gaze/face anomalies, and streams real-time alerts to a central proctor dashboard.

---

## ⚡ How to Run in Development Mode

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ installed on Windows 10/11.

### 1. Install Dependencies
Open terminal in the project directory and run:
```bash
npm install
```

### 2. Start the Backend API & Socket Server (Terminal 1)
```bash
npm run server
```
*Backend server will start listening at `http://localhost:4000`.*

### 3. Start the Frontend & Electron Desktop App (Terminal 2)
```bash
# Terminal 2A: Start Vite UI Server
npx vite

# Terminal 2B: Launch Electron Desktop Window
npx electron .
```

---

## 📦 How to Package into a Standalone `.exe` Installer for GitHub

Yes! You can package VigilExam into a single `.exe` installer or portable executable so anyone can download and run it directly without needing Node.js or terminal commands.

### Build Step:
Run the build script:
```bash
npm run dist
```

This will automatically:
1. Compile the React UI into the production `dist/` bundle.
2. Package the app using `electron-builder`.
3. Generate the standalone installer `.exe` inside the `dist/` directory (e.g. `VigilExam-Setup-1.0.0.exe` or `VigilExam 1.0.0.exe`).

---

## 🚀 Publishing to GitHub & GitHub Releases

### Step 1: Initialize Git Repository & Push Code
```bash
git init
git add .
git commit -m "Initial commit of VigilExam Desktop Application"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/vigilexam-desktop.git
git push -u origin main
```

### Step 2: Upload `.exe` to GitHub Releases
1. Go to your GitHub repository page (`https://github.com/YOUR_USERNAME/vigilexam-desktop`).
2. On the right side, click **Releases** -> **Draft a new release**.
3. Tag the version (e.g., `v1.0.0`) and enter a title like **VigilExam v1.0.0 Release**.
4. In the **Attach binaries** section, drag and drop the `.exe` file generated in your local `dist/` folder.
5. Click **Publish Release**. Now anyone can download and install VigilExam with 1 click!

---

## 🎓 Authors & Guidance
- **Authors**: Gaurav Patil, Amit Rane, Ritesh Jagtap, Rugved Ganapule
- **Guide**: Prof. Swapnali A. Aitwade
- **Department**: Computer Science and Engineering, Walchand College of Engineering, Sangli.
