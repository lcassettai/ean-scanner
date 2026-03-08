import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PwaPrompt from './components/PwaPrompt';
import Home from './pages/Home';
import NewSession from './pages/NewSession';
import JoinSession from './pages/JoinSession';
import RecoverSession from './pages/RecoverSession';
import History from './pages/History';
import Scanner from './pages/Scanner';

function App() {
  return (
    <BrowserRouter>
      <PwaPrompt />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/nueva" element={<NewSession />} />
        <Route path="/unirme" element={<JoinSession />} />
        <Route path="/recuperar" element={<RecoverSession />} />
        <Route path="/historial" element={<History />} />
        <Route path="/scan" element={<Scanner />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
