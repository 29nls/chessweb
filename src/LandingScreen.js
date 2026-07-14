import React from 'react';
import { Cpu, Globe } from 'react-feather';
import './LandingScreen.css';

const LandingScreen = ({ onSelectMode }) => {
  return (
    <div className="landing-screen">
      <div className="landing-header">
        <h1>ChessWeb</h1>
        <p>Choose how you want to play</p>
      </div>

      <div className="landing-cards">
        <div className="landing-card" onClick={() => onSelectMode('analysis')}>
          <div className="card-icon">
            <Cpu size={40} />
          </div>
          <h2>Analysis Mode</h2>
          <p>
            Play locally with the powerful Stockfish 18 engine. Analyze positions, 
            get move classifications, and practice your openings.
          </p>
        </div>

        <div className="landing-card online" onClick={() => onSelectMode('online')}>
          <div className="card-icon">
            <Globe size={40} />
          </div>
          <h2>Play Online</h2>
          <p>
            Challenge a friend to a 1v1 match in real-time. Just create a game 
            and share your 6-character invite code.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingScreen;
