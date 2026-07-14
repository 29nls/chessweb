import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, Globe, Eye } from 'react-feather';
import './LandingScreen.css';

const LandingScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-screen">
      <div className="landing-header">
        <h1>ChessWeb</h1>
        <p>Choose how you want to play</p>
      </div>

      <div className="landing-cards">
        <div className="landing-card" onClick={() => navigate('/analysis')}>
          <div className="card-icon">
            <Cpu size={40} />
          </div>
          <h2>Analysis Mode</h2>
          <p>
            Play locally with the powerful Stockfish 18 engine. Analyze positions, 
            get move classifications, and practice your openings.
          </p>
        </div>

        <div className="landing-card online" onClick={() => navigate('/online?tab=play')}>
          <div className="card-icon">
            <Globe size={40} />
          </div>
          <h2>Play Online</h2>
          <p>
            Challenge a friend to a 1v1 match in real-time. Just create a game 
            and share your 6-character invite code.
          </p>
        </div>

        <div className="landing-card spectator" onClick={() => navigate('/online?tab=spectate')}>
          <div className="card-icon">
            <Eye size={40} />
          </div>
          <h2>Watch Live</h2>
          <p>
            Spectate ongoing matches in real-time. Join any active game 
            anonymously without disturbing the players.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingScreen;
