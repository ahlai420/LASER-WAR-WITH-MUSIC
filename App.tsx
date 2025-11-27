
import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, Play, User, Cpu, Crown, Crosshair, Flame, History, Sparkles,
  MessageSquare, BrainCircuit, Info, RefreshCw, Download, Copy, CheckCircle,
  BookOpen, Atom, Globe, ShieldAlert, Target, Move, RefreshCcw, FileText,
  Home, Volume2, VolumeX, Terminal, Radio, Flag, Upload, Music
} from 'lucide-react';

import { PieceType, Owner, Phase, Piece, Position, GRID_SIZE } from './types';
import { createBoard, calculateLaserPath, findPiece, DIRS } from './services/gameLogic';
import { geminiService } from './services/geminiService';
import { Prism, Block, PowerSupplyPiece, ShooterPiece } from './components/Pieces';
import { Dice } from './components/Dice';
import { ExplosionEffect, BlockExplosionEffect, LaserOverlay } from './components/Effects';

// --- SOUND EFFECTS ---
const playCrackleSound = () => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  
  const ctx = new AudioContext();
  const bufferSize = ctx.sampleRate * 0.1; // 100ms
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

  noise.connect(gain);
  gain.connect(ctx.destination);
  noise.start();
};

const playDiceSound = () => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const now = ctx.currentTime;
  
  // Simulate multiple rattling hits
  const count = 6;
  for(let i=0; i<count; i++) {
    const t = now + (i * 0.06) + (Math.random() * 0.02);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Random pitch for each 'clack'
    osc.frequency.setValueAtTime(400 + Math.random() * 300, t);
    osc.type = 'triangle'; // softer than square
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(t);
    osc.stop(t + 0.06);
  }
};

// --- DATA ---

const FLASHCARDS = {
  STORY: [
    {
      en: { title: "BACKGROUND", text: "In the year 2050, World War III breaks out. As a frontline soldier piloting a tank equipped with a high-performance laser cannon, you have achieved many victories." },
      bm: { title: "LATAR BELAKANG", text: "Pada tahun 2050, Perang Dunia Ketiga tercetus. Sebagai seorang askar barisan hadapan yang mengendalikan kereta kebal yang dipasang dengan meriam laser berprestasi tinggi, anda telah meraih banyak kemenangan." }
    },
    {
      en: { title: "THE AMBUSH", text: "However, in a fierce battle near a prism factory, your squad was annihilated, leaving you as the sole survivor. You must rely on your wits and use the many triangular prisms scattered around the factory to outsmart the enemy." },
      bm: { title: "SERANGAN HENDAP", text: "Namun, dalam pertempuran sengit berhampiran sebuah kilang prisma, skuad anda telah dimusnahkan, menjadikan anda satu-satunya yang masih hidup. Anda mesti bergantung pada kebijaksanaan anda dan menggunakan banyak prisma tiga sisi yang berselerak di kawasan kilang untuk menewaskan musuh." }
    },
    {
      en: { title: "THE MISSION", text: "You must ensure that your power generator is not destroyed. The only way to win is to strike first and destroy the enemy’s power generator." },
      bm: { title: "MISI", text: "Anda juga mesti memastikan alat penjana kuasa anda tidak dimusnahkan. Satu-satunya cara untuk menang ialah bertindak dahulu dan memusnahkan penjana kuasa musuh." }
    }
  ],
  RULES: [
    {
      en: { title: "OBJECTIVE", text: "Protect your Generator (Power Supply). Destroy the Enemy Generator." },
      bm: { title: "OBJEKTIF", text: "Lindungi Penjana Kuasa anda. Hancurkan Penjana Kuasa Musuh." }
    },
    {
      en: { title: "ACTION POINTS", text: "Roll 1-3 AP. Use AP to MOVE (up to AP distance) or ROTATE (90°)." },
      bm: { title: "MATA TINDAKAN", text: "Baling 1-3 AP. Guna AP untuk GERAK (sehingga jarak AP) atau PUTAR (90°)." }
    },
    {
      en: { title: "NEUTRAL PIECES", text: "Prisms and Blocks are neutral. Both players can Move or Rotate Prisms, and Move Blocks." },
      bm: { title: "KEPINGAN NEUTRAL", text: "Prisma dan Blok adalah neutral. Kedua-dua pemain boleh Gerak atau Putar Prisma, dan Gerak Blok." }
    },
    {
      en: { title: "BLOCKS", text: "Blocks absorb 2 hits. They crack after the first hit." },
      bm: { title: "BLOK", text: "Blok menyerap 2 tembakan. Ia retak selepas tembakan pertama." }
    }
  ],
  PHYSICS: [
    {
      en: { title: "THE PRISM CONCEPT", text: "In this simulation, we model glass prisms with a critical angle of ~42°." },
      bm: { title: "KONSEP PRISMA", text: "Dalam simulasi ini, kami menggunakan model prisma kaca dengan sudut kritikal ~42°." }
    },
    {
      en: { title: "T.I.R (REFLECTION)", text: "Total Internal Reflection occurs when light hits the flat internal surface at 45° (> 42° critical angle). It acts like a mirror." },
      bm: { title: "PANTULAN DALAM PENUH", text: "Pantulan berlaku apabila cahaya melanggar permukaan rata dalaman pada 45° (> sudut kritikal 42°). Ia bertindak seperti cermin." }
    },
    {
      en: { title: "REFRACTION", text: "When light hits the slanted hypotenuse perpendicularly (0° incidence), it passes straight through without bending." },
      bm: { title: "PEMBIASAN", text: "Apabila cahaya melanggar hipotenus condong secara tegak (sudut tuju 0°), ia tembus lurus tanpa membengkok." }
    }
  ]
};

// --- COMPONENTS ---

const Scanline = () => (
  <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden opacity-30">
    <div className="w-full h-full bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
  </div>
);

const EducationModal = ({ type, onClose }: { type: 'RULES' | 'PHYSICS' | 'STORY', onClose: () => void }) => {
  const [lang, setLang] = useState<'en' | 'bm'>('en');
  const [index, setIndex] = useState(0);
  
  let data = FLASHCARDS.RULES;
  let title = "BRIEFING";
  let icon = <BookOpen size={20}/>;

  if (type === 'PHYSICS') {
    data = FLASHCARDS.PHYSICS;
    title = "TACTICAL INTEL";
    icon = <Atom size={20}/>;
  } else if (type === 'STORY') {
    data = FLASHCARDS.STORY;
    title = "OPERATION BACKSTORY";
    icon = <FileText size={20}/>;
  }
  
  const current = data[index];

  return (
    <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-lg bg-[#2A2A2A] border-2 border-[#4B5320] rounded-sm shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#4B5320] p-4 flex justify-between items-center border-b border-[#6E7376] shrink-0">
          <h2 className="text-[#C2B280] font-black tracking-widest text-xl flex items-center gap-2">
            {icon} {title}
          </h2>
          <button onClick={onClose} className="text-[#C2B280] hover:text-white font-bold">X</button>
        </div>

        {/* Content */}
        <div className="p-8 flex-1 flex flex-col items-center justify-center text-center relative overflow-y-auto">
          <div className="absolute top-2 right-2 flex gap-2">
             <button onClick={() => setLang('en')} className={`text-xs px-2 py-1 border ${lang === 'en' ? 'bg-[#C2B280] text-black border-[#C2B280]' : 'text-[#6E7376] border-[#6E7376]'}`}>EN</button>
             <button onClick={() => setLang('bm')} className={`text-xs px-2 py-1 border ${lang === 'bm' ? 'bg-[#C2B280] text-black border-[#C2B280]' : 'text-[#6E7376] border-[#6E7376]'}`}>BM</button>
          </div>

          <div className="mb-6 mt-8">
            <h3 className="text-2xl text-white font-bold mb-4 uppercase decoration-2 underline-offset-4 decoration-[#E25822] underline">{current[lang].title}</h3>
            <p className="text-[#C2B280] text-lg leading-relaxed">{current[lang].text}</p>
          </div>

          {/* Visual Aid for Physics */}
          {type === 'PHYSICS' && index === 1 && (
             <div className="mt-4 border border-white/20 p-2 bg-black/50">
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <path d="M10,90 L10,10 L90,90 Z" fill="none" stroke="#22d3ee" strokeWidth="2"/>
                  <path d="M50,90 L50,50 L10,50" fill="none" stroke="red" strokeWidth="2" strokeDasharray="4"/>
                  <text x="50" y="30" fill="white" fontSize="8" textAnchor="middle">TIR (Reflection)</text>
                </svg>
             </div>
          )}
           {type === 'PHYSICS' && index === 2 && (
             <div className="mt-4 border border-white/20 p-2 bg-black/50">
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <path d="M10,90 L10,10 L90,90 Z" fill="none" stroke="#22d3ee" strokeWidth="2"/>
                  <line x1="10" y1="50" x2="60" y2="100" stroke="red" strokeWidth="2" strokeDasharray="4"/>
                  <text x="60" y="20" fill="white" fontSize="8" textAnchor="middle">Refraction</text>
                </svg>
             </div>
          )}
        </div>

        {/* Navigation */}
        <div className="bg-[#1a1a1a] p-4 flex justify-between items-center border-t border-[#6E7376] shrink-0">
          <button 
            onClick={() => setIndex(i => Math.max(0, i-1))} 
            disabled={index === 0}
            className="px-4 py-2 bg-[#6E7376] disabled:opacity-30 text-white font-mono text-sm"
          >
            PREV
          </button>
          <div className="flex gap-1">
            {data.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i === index ? 'bg-[#E25822]' : 'bg-[#6E7376]'}`}></div>
            ))}
          </div>
          <button 
             onClick={() => setIndex(i => Math.min(data.length-1, i+1))} 
             disabled={index === data.length-1}
             className="px-4 py-2 bg-[#6E7376] disabled:opacity-30 text-white font-mono text-sm"
          >
            NEXT
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---

export default function LaserWarApp() {
  const [view, setView] = useState<'lobby' | 'game'>('lobby');
  const [nickname, setNickname] = useState('');
  const [config, setConfig] = useState({ prismCount: 2, blockCount: 2 });
  const [bgmUrl, setBgmUrl] = useState("bgm.mp3");
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  
  const [board, setBoard] = useState<Piece[][]>([]);
  const [turnPhase, setTurnPhase] = useState<Phase>(Phase.ROLL);
  const [turnOwner, setTurnOwner] = useState<Owner>(Owner.PLAYER);
  const [diceValue, setDiceValue] = useState(1); 
  const [actionPoints, setActionPoints] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const [laserPath, setLaserPath] = useState<Position[]>([]);
  const [winner, setWinner] = useState<Owner | null>(null);
  const [gameTime, setGameTime] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [turnsCount, setTurnsCount] = useState(0); 
  const [explosions, setExplosions] = useState<(Position & { type: 'generic' | 'block' })[]>([]); 
  const [explodingKing, setExplodingKing] = useState<Owner | null>(null); 
  const [copied, setCopied] = useState(false);
  
  const [aiDialogue, setAiDialogue] = useState("");
  const [advisorLoading, setAdvisorLoading] = useState(false);
  
  const [eduModal, setEduModal] = useState<'RULES' | 'PHYSICS' | 'STORY' | null>(null);

  // New Interaction State
  const [selectedPiece, setSelectedPiece] = useState<Position & { type: PieceType } | null>(null);
  const [interactionMode, setInteractionMode] = useState<'NONE' | 'MENU' | 'MOVE' | 'ROTATE'>('NONE');

  // Scoring
  const [score, setScore] = useState(0);
  const [comboAnim, setComboAnim] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Background Music Ref
  const bgmRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (view === 'game' && !winner) {
      const timer = setInterval(() => setGameTime(t => t + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [view, winner]);

  useEffect(() => {
    if (view === 'game' && turnOwner === Owner.AI && !winner) {
      executeAITurn();
    }
  }, [turnOwner, turnPhase, view]);
  
  // Handle Background Music play on first interaction and mute state
  useEffect(() => {
    const audio = bgmRef.current;
    if (!audio) return;
    
    audio.volume = 0.4;
    audio.muted = isMusicMuted;

    const playMusic = () => {
      if (!isMusicMuted) {
        audio.play().catch(e => {
          console.log("Audio autoplay blocked waiting for interaction");
        });
      }
    };
    
    // Attempt play immediately, if blocked, wait for click
    playMusic();
    document.addEventListener('click', playMusic, { once: true });
    return () => document.removeEventListener('click', playMusic);
  }, [isMusicMuted, bgmUrl]); // Re-run if URL or Mute changes

  const handleBgmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setBgmUrl(url);
    }
  };

  const generateAIComment = async (action: string) => {
    const text = await geminiService.getTaunt(action);
    setAiDialogue(text);
  };

  const getTacticalAdvice = async () => {
    if (advisorLoading) return;
    setAdvisorLoading(true);
    const advice = await geminiService.getTacticalAdvice();
    setLogs(prev => [`ADVISOR: ${advice}`, ...prev]);
    setAdvisorLoading(false);
  };

  // Helper to check if path is clear for linear movement
  const isPathClear = (fx: number, fy: number, tx: number, ty: number): boolean => {
    const dx = Math.sign(tx - fx);
    const dy = Math.sign(ty - fy);
    let x = fx + dx;
    let y = fy + dy;
    
    while (x !== tx || y !== ty) {
       if (board[y][x].type !== PieceType.EMPTY) return false;
       x += dx;
       y += dy;
    }
    return board[ty][tx].type === PieceType.EMPTY;
  };

  const executeAITurn = async () => {
    if (winner) return;

    if (turnPhase === Phase.ROLL) {
      setIsRolling(true);
      await new Promise(r => setTimeout(r, 1000));
      const roll = Math.floor(Math.random() * 3) + 1;
      setDiceValue(roll);
      setIsRolling(false);
      setActionPoints(roll);
      addLog(`AI Rolled ${roll} AP`);
      setTurnPhase(Phase.ACTION);
    }
    else if (turnPhase === Phase.ACTION) {
      await new Promise(r => setTimeout(r, 1000));
      let currentAP = actionPoints;
      const aiPieces: (Piece & Position)[] = [];
      
      // AI considers its own pieces AND neutral prisms/blocks
      for(let y=0; y<GRID_SIZE; y++) 
        for(let x=0; x<GRID_SIZE; x++) 
          if ((board[y][x].owner === Owner.AI || board[y][x].type === PieceType.PRISM || board[y][x].type === PieceType.BLOCK) && board[y][x].type !== PieceType.SHOOTER) {
             aiPieces.push({x,y, ...board[y][x]});
          }

      let attempts = 0;
      while(currentAP > 0 && attempts < 20 && aiPieces.length > 0) {
        const piece = aiPieces[Math.floor(Math.random() * aiPieces.length)];
        const actionType = Math.random() > 0.6 && piece.type === PieceType.PRISM ? 'ROTATE' : 'MOVE';

        if (actionType === 'ROTATE') {
          const newRot = (piece.rotation + 90) % 360;
          updateBoard(piece.x, piece.y, { rotation: newRot });
          addLog("AI Rotated Piece");
          currentAP--;
          await new Promise(r => setTimeout(r, 600));
        } else {
          const dir = [DIRS.LEFT, DIRS.RIGHT, DIRS.DOWN, DIRS.UP][Math.floor(Math.random()*4)];
          const tx = piece.x + dir.x;
          const ty = piece.y + dir.y;
          if (isValidMove(tx, ty)) {
            movePiece(piece.x, piece.y, tx, ty);
            // Update piece ref locally for loop
            piece.x = tx; piece.y = ty; 
            addLog(`AI Moved to ${tx},${ty}`);
            currentAP--;
            await new Promise(r => setTimeout(r, 600));
          }
        }
        attempts++;
      }
      setActionPoints(0);
      setTurnPhase(Phase.SHOOT);
    }
    else if (turnPhase === Phase.SHOOT) {
      await new Promise(r => setTimeout(r, 1000));
      const shooter = findPiece(board, PieceType.SHOOTER, Owner.AI);
      let nextBoard = board;
      if (shooter) {
        let targetX = Math.floor(Math.random() * GRID_SIZE);
        if (board[0][targetX].type === PieceType.EMPTY) {
           nextBoard = movePiece(shooter.x, shooter.y, targetX, 0);
        }
      }
      await new Promise(r => setTimeout(r, 500));
      handleFireLaser(nextBoard);
    }
  };

  const isValidMove = (x: number, y: number) => {
    return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE && board[y][x].type === PieceType.EMPTY;
  };

  const movePiece = (fx: number, fy: number, tx: number, ty: number) => {
    const newBoard = board.map(row => [...row]);
    newBoard[ty][tx] = newBoard[fy][fx];
    newBoard[fy][fx] = { type: PieceType.EMPTY, owner: Owner.NONE, rotation: 0 };
    setBoard(newBoard);
    return newBoard;
  };

  const updateBoard = (x: number, y: number, changes: Partial<Piece>) => {
    const newBoard = board.map(row => [...row]);
    newBoard[y][x] = { ...newBoard[y][x], ...changes };
    setBoard(newBoard);
  };

  const startGame = () => {
    if (!nickname) return alert("Please enter a nickname!");
    
    setBoard(createBoard(config));
    setWinner(null);
    setGameTime(0);
    setTurnsCount(0);
    setLogs([`Mission Start. Cmdr ${nickname} vs SKYNET.`]);
    setTurnOwner(Owner.PLAYER);
    setTurnPhase(Phase.ROLL);
    setDiceValue(1);
    setActionPoints(0);
    setIsRolling(false);
    setLaserPath([]);
    setAiDialogue("");
    setSelectedPiece(null);
    setInteractionMode('NONE');
    setExplosions([]);
    setExplodingKing(null);
    setCopied(false);
    setScore(0);
    setComboAnim(null);
    
    setView('game');
  };

  const rollDice = () => {
    if (isRolling || turnPhase !== Phase.ROLL) return;
    setIsRolling(true);
    playDiceSound();
    setTimeout(() => {
      const val = Math.floor(Math.random() * 3) + 1; // 1 to 3
      setDiceValue(val);
      setIsRolling(false);
      
      setActionPoints(val);
      addLog(`Rolled: ${val} AP`);
      setTurnPhase(Phase.ACTION);
    }, 600);
  };

  const handleSurrender = () => {
    // Immediate surrender without confirmation
    handleWin(Owner.AI, Owner.PLAYER);
    addLog("PLAYER SURRENDERED");
  };

  const handleGridClick = (x: number, y: number) => {
    if (winner || turnOwner !== Owner.PLAYER) return;
    const cell = board[y][x];

    // Handle Selecting a Piece
    if (turnPhase === Phase.ACTION) {
      
      // If choosing a move destination
      if (interactionMode === 'MOVE' && selectedPiece) {
         if (cell.type === PieceType.EMPTY) {
            const dist = Math.abs(x - selectedPiece.x) + Math.abs(y - selectedPiece.y);
            const isLinear = (x === selectedPiece.x || y === selectedPiece.y);
            
            // Valid if linear, clear path, and distance <= AP
            if (isLinear && dist <= actionPoints && isPathClear(selectedPiece.x, selectedPiece.y, x, y)) {
               movePiece(selectedPiece.x, selectedPiece.y, x, y);
               const newAP = actionPoints - dist;
               setActionPoints(newAP);
               addLog(`Moved ${dist} steps. AP Left: ${newAP}`);
               
               if (newAP === 0) {
                 setInteractionMode('NONE');
                 setSelectedPiece(null);
                 setTurnPhase(Phase.SHOOT);
               } else {
                 setInteractionMode('NONE');
                 setSelectedPiece(null);
               }
            } else {
               // Invalid move or blocked or not enough AP
               // Just deselect or do nothing? Deselecting for better UX if user changes mind
               setInteractionMode('NONE');
               setSelectedPiece(null);
            }
         } else {
            // Clicked occupied cell, cancel selection
            setInteractionMode('NONE');
            setSelectedPiece(null);
         }
         return;
      }

      // Allow selecting own pieces OR any Prism OR any Block (neutral)
      const isMyPiece = cell.owner === Owner.PLAYER;
      const isPrism = cell.type === PieceType.PRISM;
      const isBlock = cell.type === PieceType.BLOCK;
      
      if ((isMyPiece || isPrism || isBlock) && cell.type !== PieceType.SHOOTER) {
        // If switching piece
        if (selectedPiece && (selectedPiece.x !== x || selectedPiece.y !== y)) {
             setInteractionMode('NONE');
        }

        setSelectedPiece({ x, y, type: cell.type });
        
        if (cell.type === PieceType.PRISM) {
           setInteractionMode('MENU'); // Open Move/Rotate Menu
        } else {
           setInteractionMode('MOVE'); // Others can only move
        }
      }
    }

    // Shooter logic
    if (turnPhase === Phase.SHOOT) {
      if (y === GRID_SIZE - 1 && cell.type === PieceType.EMPTY) {
        const shooter = findPiece(board, PieceType.SHOOTER, Owner.PLAYER);
        if (shooter) {
          movePiece(shooter.x, shooter.y, x, y);
        }
      }
    }
  };

  const handlePrismAction = (action: 'MOVE' | 'ROTATE') => {
    if (action === 'MOVE') {
      setInteractionMode('MOVE');
    } else {
      setInteractionMode('ROTATE');
    }
  };

  const executeRotation = (deg: number) => {
    if (selectedPiece && interactionMode === 'ROTATE') {
      updateBoard(selectedPiece.x, selectedPiece.y, { rotation: deg });
      const newAP = actionPoints - 1;
      setActionPoints(newAP);
      addLog(`Rotated to ${deg}°. AP Left: ${newAP}`);
      
      if (newAP === 0) {
         setInteractionMode('NONE');
         setSelectedPiece(null);
         setTurnPhase(Phase.SHOOT);
      } else {
         setInteractionMode('NONE');
         setSelectedPiece(null);
      }
    }
  };

  const calculateScore = (prismHits: number): number => {
    if (prismHits === 0) return 50;
    if (prismHits === 1) return 100;
    if (prismHits === 2) return 200;
    // For 3 and above: (Prism Count * 100) * 2
    return (prismHits * 100) * 2;
  };

  const handleFireLaser = async (boardOverride?: Piece[][]) => {
    const activeBoard = (Array.isArray(boardOverride) && boardOverride.length === GRID_SIZE) ? boardOverride : board;

    setTurnPhase(Phase.ANIMATING);
    const shooter = findPiece(activeBoard, PieceType.SHOOTER, turnOwner);
    const { path, prismHits } = calculateLaserPath(activeBoard, shooter, turnOwner);
    
    for (let i = 1; i <= path.length; i++) {
      setLaserPath(path.slice(0, i));
      await new Promise(r => setTimeout(r, 60)); 
    }

    const last = path[path.length - 1];
    if (last.x >= 0 && last.x < GRID_SIZE && last.y >= 0 && last.y < GRID_SIZE) {
      const hitCell = activeBoard[last.y][last.x];
      
      if (hitCell.type === PieceType.KING && hitCell.owner !== turnOwner) {
        // Show Combo Text
        if (prismHits > 0) {
           const comboText = prismHits >= 3 ? `SUPER COMBO ${prismHits}!` : `COMBO ${prismHits}!`;
           setComboAnim(comboText);
        }
        
        // Calculate Score (only if Player wins)
        if (turnOwner === Owner.PLAYER) {
           const turnScore = calculateScore(prismHits);
           setScore(turnScore);
        }

        handleWin(turnOwner, hitCell.owner);
        return;
      } else if (hitCell.type === PieceType.BLOCK) {
        playCrackleSound(); // Sound Effect
        const newBoard = activeBoard.map(row => [...row]);
        const block = newBoard[last.y][last.x];
        const newHealth = (block.health || 2) - 1;
        
        if (newHealth <= 0) {
          setExplosions(prev => [...prev, { x: last.x, y: last.y, type: 'block' }]);
          addLog("Block Destroyed!");
          setTimeout(() => {
            newBoard[last.y][last.x] = { type: PieceType.EMPTY, owner: Owner.NONE, rotation: 0 };
            setBoard(newBoard);
            setExplosions(prev => prev.filter(e => e.x !== last.x || e.y !== last.y));
          }, 600);
        } else {
          newBoard[last.y][last.x] = { ...block, health: newHealth };
          setBoard(newBoard);
          addLog("Block Cracked!");
        }
      }
    }

    await new Promise(r => setTimeout(r, 800));
    setLaserPath([]);
    
    if (!winner && !explodingKing) {
      setTurnOwner(prev => prev === Owner.PLAYER ? Owner.AI : Owner.PLAYER);
      setTurnPhase(Phase.ROLL);
      setTurnsCount(t => t + 1);
      setAiDialogue(""); 
      addLog(turnOwner === Owner.PLAYER ? "AI Turn" : "Your Turn");
    }
  };

  const handleWin = (wid: Owner, loserId: Owner) => {
    setExplodingKing(loserId);
    
    setTimeout(() => {
      setWinner(wid);
      
      if (wid === Owner.PLAYER) {
        generateAIComment("Critical failure. System shutdown.");
      } else {
        generateAIComment("Target eliminated. Superiority confirmed.");
      }
    }, 1500);
  };

  const downloadReport = () => {
    if (!winner) return;
    const headers = "Date,Time,Player Name,Winner,Duration (s),Turns,Prisms,Blocks,Score\n";
    const row = `${new Date().toLocaleDateString()},${new Date().toLocaleTimeString()},${nickname},${winner === Owner.PLAYER ? 'PLAYER' : 'AI'},${gameTime},${turnsCount},${config.prismCount},${config.blockCount},${score}`;
    const blob = new Blob([headers + row], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LaserWar_Report_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = () => {
    if (!winner) return;
    const row = `${new Date().toLocaleDateString()}\t${new Date().toLocaleTimeString()}\t${nickname}\t${winner === Owner.PLAYER ? 'PLAYER' : 'AI'}\t${gameTime}\t${turnsCount}\t${config.prismCount}\t${config.blockCount}\t${score}`;
    const textArea = document.createElement("textarea");
    textArea.value = row;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {}
    document.body.removeChild(textArea);
  };

  const addLog = (msg: string) => setLogs(p => [msg, ...p].slice(0, 50));

  return (
    <div className="h-[100dvh] bg-slate-950 text-[#C2B280] font-mono flex flex-col relative overflow-hidden">
      {/* Background Music Player */}
      <audio ref={bgmRef} loop id="bgm-player">
         <source src={bgmUrl} type="audio/mpeg" />
      </audio>

      {/* Atmospheric BG */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#2A2A2A] via-slate-950 to-black"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30"></div>
        {/* Smoke/Dust Particles (CSS animation) */}
        <style>{`
          @keyframes float { 0% { transform: translateY(0) rotate(0deg); opacity: 0; } 50% { opacity: 0.5; } 100% { transform: translateY(-100px) rotate(180deg); opacity: 0; } }
          .particle { position: absolute; width: 4px; height: 4px; background: #6E7376; border-radius: 50%; animation: float 10s infinite linear; }
          @keyframes popIn { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        `}</style>
        {[...Array(20)].map((_, i) => (
          <div key={i} className="particle" style={{ left: `${Math.random()*100}%`, top: `${Math.random()*100}%`, animationDelay: `${Math.random()*5}s`, width: `${Math.random()*6}px`, height: `${Math.random()*6}px` }}></div>
        ))}
      </div>

      {/* HEADER */}
      <header className="h-14 md:h-16 shrink-0 bg-[#1a1a1a] border-b-2 border-[#4B5320] flex items-center justify-between px-4 md:px-6 z-40 shadow-lg relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-[#2A2A2A] rounded border border-[#4B5320] flex items-center justify-center shadow-[0_0_10px_rgba(75,83,32,0.5)]">
            <Crosshair className="text-[#C2B280]" size={20} />
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-black tracking-[0.2em] text-[#C2B280] drop-shadow-md">LASER WAR</h1>
            <div className="text-[8px] text-[#6E7376] uppercase tracking-widest hidden md:block">Tactical Optics Simulation</div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           {/* Music Toggle */}
           <button 
             onClick={() => setIsMusicMuted(!isMusicMuted)}
             className={`p-2 rounded border transition-colors ${isMusicMuted ? 'border-red-500 text-red-500 bg-red-900/20' : 'border-[#4B5320] text-[#C2B280] bg-[#2A2A2A]'}`}
             title={isMusicMuted ? "Unmute Music" : "Mute Music"}
           >
              {isMusicMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
           </button>

          {view === 'game' && (
            <div className="flex items-center gap-4 md:gap-8 bg-[#0f0f0f] px-3 py-1 md:px-6 md:py-2 rounded border border-[#2A2A2A] text-xs md:text-base">
              <div className={`flex items-center gap-2 ${turnOwner === Owner.PLAYER ? 'text-emerald-500 animate-pulse' : 'text-[#6E7376]'}`}>
                <User size={16}/> {nickname.toUpperCase().substring(0, 8)}
              </div>
              <div className="h-4 w-px bg-[#2A2A2A]"></div>
              <div className={`flex items-center gap-2 ${turnOwner === Owner.AI ? 'text-red-500 animate-pulse' : 'text-[#6E7376]'}`}>
                AI CORE <Cpu size={16}/>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* MAIN VIEW */}
      <main className="flex-1 relative flex z-10 overflow-hidden">
        {view === 'lobby' ? (
          <div className="w-full flex items-center justify-center p-4">
            <div className="relative z-10 max-w-md w-full bg-[#1a1a1a]/90 border-2 border-[#4B5320] p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-sm">
              {/* Decorative Corners */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#C2B280]"></div>
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#C2B280]"></div>
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#C2B280]"></div>
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#C2B280]"></div>

              <div className="text-center mb-10">
                <Crown className="w-16 h-16 mx-auto text-[#C2B280] mb-4 drop-shadow-[0_0_10px_rgba(194,178,128,0.5)]" strokeWidth={1.5} />
                <h2 className="text-3xl font-black text-white tracking-widest">LASER WAR</h2>
                <div className="text-xs text-[#4B5320] font-bold tracking-[0.5em] mt-1">TACTICAL DEPLOYMENT</div>
              </div>
              
              <div className="space-y-6">
                <div className="group">
                  <label className="text-[10px] font-bold text-[#6E7376] uppercase tracking-widest mb-1 block">NICKNAME</label>
                  <input 
                    value={nickname} 
                    onChange={e => setNickname(e.target.value)} 
                    className="w-full bg-black border border-[#2A2A2A] py-3 px-4 text-[#C2B280] text-lg focus:border-[#C2B280] focus:outline-none transition-all font-mono placeholder-[#2A2A2A]" 
                    placeholder="ENTER CALLSIGN" 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-[#6E7376] uppercase tracking-widest mb-1 block">PRISMS</label>
                    <select value={config.prismCount} onChange={e => setConfig({...config, prismCount: +e.target.value})} className="w-full bg-black border border-[#2A2A2A] text-[#C2B280] p-2 font-mono">
                      {[0,1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#6E7376] uppercase tracking-widest mb-1 block">BLOCKS</label>
                    <select value={config.blockCount} onChange={e => setConfig({...config, blockCount: +e.target.value})} className="w-full bg-black border border-[#2A2A2A] text-[#C2B280] p-2 font-mono">
                      {[0,1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>

                {/* BGM Upload Section */}
                 <div className="group border-t border-[#2A2A2A] pt-4 mt-2">
                  <label className="text-[10px] font-bold text-[#6E7376] uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Music size={12}/> BACKGROUND MUSIC
                  </label>
                  <div className="flex gap-2">
                     <div className="flex-1 bg-black border border-[#2A2A2A] py-2 px-3 text-[#C2B280] text-xs truncate flex items-center">
                        {bgmUrl !== "bgm.mp3" ? "Custom File Loaded" : "Default (bgm.mp3)"}
                     </div>
                     <label className="cursor-pointer bg-[#2A2A2A] hover:bg-[#333] border border-[#6E7376] text-[#C2B280] px-3 flex items-center justify-center transition-colors" title="Upload MP3">
                        <Upload size={16}/>
                        <input type="file" accept="audio/*" className="hidden" onChange={handleBgmUpload} />
                     </label>
                  </div>
                  <div className="text-[9px] text-[#6E7376] mt-1">Select an MP3 file to play during the match.</div>
                </div>

                <button onClick={startGame} className="w-full py-4 bg-[#4B5320] hover:bg-[#3a4019] text-white font-black tracking-widest text-lg border border-[#6E7376] shadow-lg transition-all flex items-center justify-center gap-2 group mt-4">
                  <Play size={20} className="group-hover:scale-110 transition-transform"/> START
                </button>

                <div className="flex gap-2 pt-4 border-t border-[#2A2A2A]">
                   <button onClick={() => setEduModal('STORY')} className="flex-1 py-2 bg-[#1a1a1a] border border-[#2A2A2A] hover:border-[#C2B280] text-[#6E7376] hover:text-[#C2B280] text-xs font-bold flex items-center justify-center gap-2 transition-all">
                     <FileText size={14}/> STORY
                   </button>
                   <button onClick={() => setEduModal('RULES')} className="flex-1 py-2 bg-[#1a1a1a] border border-[#2A2A2A] hover:border-[#C2B280] text-[#6E7376] hover:text-[#C2B280] text-xs font-bold flex items-center justify-center gap-2 transition-all">
                     <BookOpen size={14}/> BRIEFING
                   </button>
                   <button onClick={() => setEduModal('PHYSICS')} className="flex-1 py-2 bg-[#1a1a1a] border border-[#2A2A2A] hover:border-[#C2B280] text-[#6E7376] hover:text-[#C2B280] text-xs font-bold flex items-center justify-center gap-2 transition-all">
                     <Atom size={14}/> INTEL
                   </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col-reverse landscape:flex-row md:flex-row items-stretch">
            {/* SIDEBAR (Controls & Logs) */}
            <div className="w-full landscape:w-80 md:w-80 h-auto md:h-full shrink-0 bg-[#111] border-t landscape:border-t-0 landscape:border-r md:border-t-0 md:border-r border-[#2A2A2A] p-3 md:p-6 flex flex-row landscape:flex-col md:flex-col items-center landscape:items-stretch md:items-stretch gap-4 z-20 shadow-2xl relative overflow-y-auto">
              
              {/* AI Dialogue Box - Context sensitive positioning */}
              {aiDialogue && (
                <div className="absolute bottom-full left-0 w-full mb-2 md:mb-0 md:top-4 md:bottom-auto md:left-full md:w-64 bg-red-900/90 border-t-2 md:border-t-0 md:border-l-4 border-red-500 text-red-100 p-4 text-xs font-mono shadow-[0_0_20px_rgba(220,38,38,0.3)] animate-in slide-in-from-bottom-2 md:slide-in-from-left-4 z-50">
                  <div className="flex items-center gap-2 mb-2 text-red-400 font-bold border-b border-red-700/50 pb-1 uppercase tracking-wider"><MessageSquare size={12}/> AI Transmission</div>
                  <p className="italic">"{aiDialogue}"</p>
                </div>
              )}

              {/* Status Section */}
              <div className="shrink-0 text-center border-r landscape:border-r-0 landscape:border-b md:border-r-0 md:border-b border-[#2A2A2A] pr-4 landscape:pr-0 landscape:pb-6 landscape:mb-8 md:pr-0 md:pb-6 md:mb-8 flex flex-col justify-center">
                <div className="text-[8px] md:text-[10px] text-[#6E7376] tracking-[0.3em] uppercase mb-1 md:mb-2">Mission Status</div>
                <div className={`text-xl md:text-3xl font-black uppercase tracking-tighter ${turnPhase === Phase.SHOOT ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                  {turnPhase === Phase.ANIMATING ? 'FIRING' : turnPhase}
                </div>
              </div>

              {/* Game Controls Section */}
              <div className="flex-1 flex flex-row landscape:flex-col md:flex-col items-center justify-center gap-4 landscape:space-y-8 md:space-y-8 relative">
                {turnPhase === Phase.ROLL && (
                  <div className="shrink-0 flex flex-col items-center space-y-2 md:space-y-4 animate-in zoom-in">
                    <div className="scale-75 md:scale-100 origin-center">
                      <Dice value={diceValue} rolling={isRolling} onClick={rollDice} />
                    </div>
                    <div className="text-[8px] md:text-[10px] text-[#6E7376] uppercase tracking-widest whitespace-nowrap">Tap to Roll</div>
                  </div>
                )}
                {turnPhase === Phase.ACTION && (
                  <div className="shrink-0 text-center space-y-2 md:space-y-4 animate-in fade-in">
                    <div className="w-16 h-16 md:w-24 md:h-24 rounded-full border-4 border-dashed border-[#4B5320] flex items-center justify-center mx-auto bg-[#1a1a1a]">
                      <div className="text-2xl md:text-5xl font-black text-[#C2B280]">{actionPoints}</div>
                    </div>
                    <div className="text-[10px] md:text-sm text-[#C2B280] font-bold tracking-widest uppercase leading-none">AP Left</div>
                  </div>
                )}
                {turnPhase === Phase.SHOOT && turnOwner === Owner.PLAYER && (
                  <div className="shrink-0 text-center space-y-2 md:space-y-6 animate-in slide-in-from-bottom-10 flex flex-col items-center">
                    <button onClick={() => handleFireLaser()} className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-red-600 to-red-800 border-4 border-red-950 shadow-[0_0_30px_rgba(220,38,38,0.4)] flex items-center justify-center group transition-all hover:scale-105 active:scale-95">
                      <Flame className="text-white drop-shadow-lg scale-75 md:scale-100 w-6 h-6 md:w-10 md:h-10" fill="currentColor" />
                    </button>
                    <div className="text-[8px] md:text-[10px] text-red-500 tracking-[0.2em] font-bold uppercase hidden md:block">Execute Fire</div>
                  </div>
                )}
              </div>

              {/* Footer Section (Advice & Logs) */}
              <div className="shrink-0 flex landscape:flex-col md:flex-col gap-2 mt-auto landscape:pt-6 landscape:border-t md:pt-6 md:border-t border-[#2A2A2A] landscape:space-y-3 md:space-y-3 w-auto landscape:w-full md:w-full items-center">
                <button onClick={getTacticalAdvice} disabled={advisorLoading} className="w-10 h-10 md:w-full md:h-auto md:py-3 bg-[#1a1a1a] hover:bg-[#252525] border border-[#4B5320]/50 rounded-sm flex items-center justify-center md:gap-2 text-[10px] text-[#C2B280] transition-colors uppercase tracking-widest">
                  {advisorLoading ? <Sparkles className="animate-spin" size={16}/> : <BrainCircuit size={16}/>} <span className="hidden md:inline">Tactical Intel</span>
                </button>
              </div>
              
              {/* COMBAT LOGS (Redesigned Fixed Box) */}
              <div className="hidden landscape:block md:block w-full bg-[#050a05] rounded-sm border border-[#4B5320] p-1 relative shadow-[0_0_10px_rgba(75,83,32,0.2)] mt-0 md:mt-4 shrink-0 overflow-hidden">
                {/* Twinkling Effect */}
                <div className="absolute inset-0 bg-emerald-500/10 animate-pulse pointer-events-none z-0"></div>
                
                <div className="relative z-10">
                  <Scanline />
                  <div className="flex items-center justify-between px-2 py-1 bg-[#4B5320]/20 border-b border-[#4B5320] mb-1">
                    <span className="text-[9px] text-[#4B5320] font-bold tracking-widest flex items-center gap-1"><Terminal size={10} /> LOG_TERMINAL</span>
                    <div className="flex gap-1">
                       <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                  <div className="font-mono p-2 space-y-1">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className="h-4 text-[10px] truncate flex items-center border-b border-white/5 last:border-0">
                        {logs[i] ? (
                          <>
                             <span className="opacity-50 mr-1 text-[#4B5320]">{new Date().toLocaleTimeString().split(' ')[0]}</span>
                             <span className={`uppercase ${i===0?'text-emerald-400 font-bold':'text-emerald-900'}`}>{logs[i]}</span>
                          </>
                        ) : (
                          <span className="opacity-10 text-emerald-900 tracking-widest">-- EMPTY --</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* GAME BOARD AREA */}
            <div className="flex-1 bg-[#050505] relative flex flex-col items-center justify-center p-2 md:p-10 perspective-[1200px] overflow-visible">
               
               {/* Mobile Logs HUD Overlay (Heads-Up Display) - Updated to 4-row box */}
               <div className="md:hidden landscape:hidden w-full max-w-[95vw] absolute top-2 z-30 pointer-events-none">
                  <div className="bg-[#050a05]/90 border border-[#4B5320] p-1 relative overflow-hidden shadow-lg backdrop-blur-sm">
                     <Scanline />
                     <div className="font-mono text-[9px] space-y-0.5 h-16 overflow-hidden">
                        {[0, 1, 2, 3].map(i => (
                          <div key={i} className="truncate flex items-center text-emerald-400">
                             <span className="opacity-50 mr-1 text-[#4B5320]">></span>
                             {logs[i] || <span className="opacity-20">...</span>}
                          </div>
                        ))}
                     </div>
                  </div>
               </div>

               {/* Surrender Button */}
               <button 
                 onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSurrender();
                 }}
                 type="button"
                 className="absolute bottom-4 right-4 md:top-4 md:right-4 z-[100] bg-red-900/20 hover:bg-red-900/40 border border-red-500/30 text-red-500 p-2 rounded-sm backdrop-blur-sm transition-all cursor-pointer pointer-events-auto"
                 title="Surrender"
               >
                 <Flag size={20} />
               </button>
               
               {/* Combo Animation Overlay */}
               {comboAnim && (
                 <div className="absolute top-[15%] left-1/2 -translate-x-1/2 z-[100] pointer-events-none animate-[popIn_0.5s_ease-out_forwards]">
                    <div className="text-4xl md:text-6xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)] tracking-tighter skew-x-12 border-4 border-black bg-white/10 px-6 py-2 rotate-[-5deg]">
                       {comboAnim}
                    </div>
                 </div>
               )}

               {/* Grid Background */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(20,20,20,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(20,20,20,0.5)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] pointer-events-none"></div>
              
              {/* BOARD CONTAINER */}
              <div 
                className="relative bg-[#1e1e1e] rounded-sm shadow-[0_0_50px_rgba(0,0,0,0.8)] border-4 border-[#424242] transition-all duration-300 w-[min(90vw,55vh)] landscape:w-[min(50vw,90vh)] md:w-[min(60vw,80vh)] aspect-square overflow-visible"
                style={{
                  transform: 'rotateX(20deg)', 
                  transformStyle: 'preserve-3d'
                }}
              >
                <div className="absolute inset-0 w-full h-full" 
                     style={{ 
                        display: 'grid', 
                        gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, 
                        gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
                        transformStyle: 'preserve-3d'
                     }}
                >
                    {board.map((row, y) => (
                      row.map((cell, x) => {
                        const isSelected = selectedPiece?.x === x && selectedPiece?.y === y;
                        let isHighlighted = false;
                        if (interactionMode === 'MOVE' && selectedPiece) {
                          const dist = Math.abs(x - selectedPiece.x) + Math.abs(y - selectedPiece.y);
                          const isLinear = (x === selectedPiece.x || y === selectedPiece.y);
                          if (isLinear && dist <= actionPoints && cell.type === PieceType.EMPTY) {
                             if (isPathClear(selectedPiece.x, selectedPiece.y, x, y)) isHighlighted = true;
                          }
                        }

                        // Determine Edge Status for Rotation Controls
                        const isTopRow = y < 2;
                        const isRightEdge = x >= 6; // If in last two columns

                        return (
                          <div 
                            key={`${x}-${y}`} 
                            onClick={() => handleGridClick(x, y)} 
                            className={`
                              relative border border-[#333] transition-all duration-200
                              ${isSelected ? 'bg-emerald-900/30 shadow-[inset_0_0_20px_rgba(16,185,129,0.4)] border-emerald-500/50' : ''}
                              ${isHighlighted ? 'bg-[#C2B280]/20 cursor-pointer hover:bg-[#C2B280]/40' : ''}
                              ${turnPhase === Phase.SHOOT && y === GRID_SIZE-1 && cell.type === PieceType.EMPTY && turnOwner === Owner.PLAYER ? 'hover:bg-red-900/20 cursor-crosshair' : ''}
                            `}
                            style={{ transformStyle: 'preserve-3d' }}
                          >
                            {isHighlighted && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-2 h-2 bg-[#C2B280] rounded-full animate-ping"></div></div>}

                            <div className="w-full h-full relative" style={{ transform: 'translateZ(10px)' }}>
                              {cell.type === PieceType.PRISM && (<Prism owner={cell.owner} rotation={cell.rotation} />)}
                              {cell.type === PieceType.BLOCK && <Block health={cell.health} />}
                              {cell.type === PieceType.KING && <PowerSupplyPiece owner={cell.owner} />}
                              {cell.type === PieceType.SHOOTER && <ShooterPiece owner={cell.owner} rotation={cell.rotation} />}
                            </div>
                            
                            {explosions.some(e => e.x === x && e.y === y) && (
                               explosions.find(e => e.x === x && e.y === y)?.type === 'block' ? <BlockExplosionEffect /> : <ExplosionEffect />
                            )}
                            
                            {cell.type === PieceType.KING && explodingKing === cell.owner && <ExplosionEffect />}

                            {isSelected && interactionMode === 'MENU' && (
                              <div 
                                className={`absolute flex gap-2 z-50 transition-all duration-200
                                  ${isRightEdge ? 'right-[100%] mr-2 origin-right' : 'left-1/2 -translate-x-1/2 origin-center'}
                                  ${isTopRow ? 'top-full mt-2' : 'bottom-full mb-2'}
                                `} 
                                style={{ transform: 'translateZ(60px)' }}
                              >
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); handlePrismAction('MOVE'); }}
                                   className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 border border-blue-400 shadow-lg hover:bg-blue-500 flex flex-col items-center rounded-sm"
                                 >
                                   <Move size={12} className="mb-1"/> MOVE
                                 </button>
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); handlePrismAction('ROTATE'); }}
                                   className="bg-purple-600 text-white text-[10px] font-bold px-3 py-1 border border-purple-400 shadow-lg hover:bg-purple-500 flex flex-col items-center rounded-sm"
                                 >
                                   <RefreshCcw size={12} className="mb-1"/> ROTATE
                                 </button>
                              </div>
                            )}

                             {isSelected && interactionMode === 'ROTATE' && (
                              <div className="absolute inset-0 z-50 pointer-events-none" style={{ transform: 'translateZ(10px)' }}>
                                 {/* UP (0 deg) */}
                                 <div 
                                    className="absolute left-0 bottom-full w-full h-full bg-black/90 hover:bg-emerald-900/40 border border-emerald-500 shadow-lg pointer-events-auto cursor-pointer flex items-center justify-center transition-all"
                                    onClick={(e) => {e.stopPropagation(); executeRotation(0);}}
                                 >
                                    <div className="scale-75 opacity-75"><Prism owner={cell.owner} rotation={0} /></div>
                                 </div>

                                 {/* RIGHT (90 deg) */}
                                 <div 
                                    className="absolute left-full top-0 w-full h-full bg-black/90 hover:bg-emerald-900/40 border border-emerald-500 shadow-lg pointer-events-auto cursor-pointer flex items-center justify-center transition-all"
                                    onClick={(e) => {e.stopPropagation(); executeRotation(90);}}
                                 >
                                    <div className="scale-75 opacity-75"><Prism owner={cell.owner} rotation={90} /></div>
                                 </div>

                                 {/* DOWN (180 deg) */}
                                 <div 
                                    className="absolute left-0 top-full w-full h-full bg-black/90 hover:bg-emerald-900/40 border border-emerald-500 shadow-lg pointer-events-auto cursor-pointer flex items-center justify-center transition-all"
                                    onClick={(e) => {e.stopPropagation(); executeRotation(180);}}
                                 >
                                    <div className="scale-75 opacity-75"><Prism owner={cell.owner} rotation={180} /></div>
                                 </div>

                                 {/* LEFT (270 deg) */}
                                 <div 
                                    className="absolute right-full top-0 w-full h-full bg-black/90 hover:bg-emerald-900/40 border border-emerald-500 shadow-lg pointer-events-auto cursor-pointer flex items-center justify-center transition-all"
                                    onClick={(e) => {e.stopPropagation(); executeRotation(270);}}
                                 >
                                    <div className="scale-75 opacity-75"><Prism owner={cell.owner} rotation={270} /></div>
                                 </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ))}
                </div>

                <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: 'translateZ(20px)' }}>
                    <LaserOverlay path={laserPath} />
                </div>
              </div>
            </div>

            {/* GAME OVER MODAL */}
            {winner && (
              <div className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center animate-in zoom-in duration-500">
                <div className="text-center space-y-8 p-12 border-y-4 border-[#C2B280] bg-[#1a1a1a] relative max-w-2xl w-full">
                  <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                  
                  <div className="relative z-10">
                    <div className="text-xs font-bold tracking-[0.5em] text-[#6E7376] mb-2">MISSION REPORT</div>
                    <h1 className={`text-7xl font-black tracking-tighter mb-4 ${winner === Owner.PLAYER ? 'text-emerald-500' : 'text-red-600'}`}>
                      {winner === Owner.PLAYER ? 'YOU WIN' : 'YOU LOSE'}
                    </h1>
                    
                    <div className="grid grid-cols-4 gap-4 text-center font-mono text-sm text-[#C2B280] bg-black/50 p-6 border border-[#2A2A2A] mb-8">
                      <div>
                        <div className="text-[10px] text-[#6E7376] uppercase">Duration</div>
                        <div className="text-xl">{Math.floor(gameTime/60)}m {gameTime%60}s</div>
                      </div>
                      <div>
                         <div className="text-[10px] text-[#6E7376] uppercase">Turns</div>
                         <div className="text-xl">{turnsCount}</div>
                      </div>
                      <div>
                         <div className="text-[10px] text-[#6E7376] uppercase">Status</div>
                         <div className={winner === Owner.PLAYER ? "text-emerald-500" : "text-red-500"}>
                           {winner === Owner.PLAYER ? 'SUCCESS' : 'FAILED'}
                         </div>
                      </div>
                      <div>
                         <div className="text-[10px] text-[#6E7376] uppercase">Score</div>
                         <div className="text-xl font-bold text-yellow-500">{winner === Owner.PLAYER ? score : 0}</div>
                      </div>
                    </div>

                    <div className="flex gap-4 justify-center">
                      <button onClick={handleCopyToClipboard} className="px-6 py-3 bg-[#0f0f0f] border border-[#2A2A2A] hover:border-[#C2B280] text-[#C2B280] font-bold text-xs tracking-widest flex items-center gap-2 transition-all">
                         {copied ? <CheckCircle size={16}/> : <Copy size={16}/>} COPY DATA
                      </button>
                      <button onClick={downloadReport} className="px-6 py-3 bg-[#0f0f0f] border border-[#2A2A2A] hover:border-[#C2B280] text-[#C2B280] font-bold text-xs tracking-widest flex items-center gap-2 transition-all">
                         <Download size={16}/> DOWNLOAD LOG
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-8">
                       <button onClick={() => setView('lobby')} className="w-full py-4 bg-[#2A2A2A] hover:bg-[#333] text-[#C2B280] border border-[#6E7376] font-bold tracking-[0.2em] text-sm transition-all flex items-center justify-center gap-2">
                        <Home size={18} /> MENU
                      </button>
                      <button onClick={startGame} className="w-full py-4 bg-[#C2B280] hover:bg-[#b0a070] text-black font-black tracking-[0.2em] text-lg shadow-[0_0_20px_rgba(194,178,128,0.3)] transition-all flex items-center justify-center gap-2">
                        <RefreshCw size={20} /> RETRY
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* EDUCATIONAL MODAL */}
            {eduModal && <EducationModal type={eduModal} onClose={() => setEduModal(null)} />}

          </div>
        )}
      </main>
    </div>
  );
}
