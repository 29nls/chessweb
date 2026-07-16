import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Analytics } from '@vercel/analytics/react';
import './App.css';

// Import Layout & Pages
import AppLayout from './components/AppLayout';
import LandingScreen from './LandingScreen';
import AnalysisPage from './pages/AnalysisPage';
import OnlinePage from './pages/OnlinePage';

function App() {
  return (
    <Router>
      <AppLayout>
        <Routes>
          <Route path="/" element={<LandingScreen />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/online" element={<OnlinePage />} />
        </Routes>
      </AppLayout>
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
      <Analytics />
    </Router>
  );
}

export default App;