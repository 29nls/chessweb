import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, Globe, Eye } from 'react-feather';
import './LandingScreen.css';

const LandingCard = ({ title, description, icon, variantClass = '', onClick }) => (
  <button className={`landing-card ${variantClass}`} onClick={onClick}>
    <div className="card-icon" aria-hidden="true">
      {icon}
    </div>
    <h2>{title}</h2>
    <p>{description}</p>
  </button>
);

const LandingScreen = () => {
  const navigate = useNavigate();

  return (
    <main className="landing-screen">
      <header className="landing-header">
        <h1>ChessWeb</h1>
        <p>Choose how you want to play</p>
      </header>

      <section className="landing-cards" aria-label="Game Modes">
        <LandingCard
          title="Analysis Mode"
          description="Play locally with the powerful Stockfish 18 engine. Analyze positions, get move classifications, and practice your openings."
          icon={<Cpu size={40} />}
          onClick={() => navigate('/analysis')}
        />

        <LandingCard
          title="Play Online"
          description="Challenge a friend to a 1v1 match in real-time. Just create a game and share your 6-character invite code."
          icon={<Globe size={40} />}
          variantClass="online"
          onClick={() => navigate('/online?tab=play')}
        />

        <LandingCard
          title="Watch Live"
          description="Spectate ongoing matches in real-time. Join any active game anonymously without disturbing the players."
          icon={<Eye size={40} />}
          variantClass="spectator"
          onClick={() => navigate('/online?tab=spectate')}
        />
      </section>
    </main>
  );
};

export default LandingScreen;
