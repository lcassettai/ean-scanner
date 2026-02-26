import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CreateSession from './pages/CreateSession';
import Scanner from './pages/Scanner';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CreateSession />} />
        <Route path="/scan" element={<Scanner />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
