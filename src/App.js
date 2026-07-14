import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

// Import Pages
import LandingScreen from './LandingScreen';
import AnalysisPage from './pages/AnalysisPage';
import OnlinePage from './pages/OnlinePage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/online" element={<OnlinePage />} />
      </Routes>
      <ToastContainer 
        position="bottom-right" 
        autoClose={3000} 
        hideProgressBar={false} 
        newestOnTop={false} 
        closeOnClick 
        rtl={false} 
        pauseOnFocusLoss 
        draggable 
        pauseOnHover 
        theme="dark"
      />
    </Router>
  );
}

export default App;