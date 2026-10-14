import { Routes, Route, Navigate } from 'react-router-dom';
import ChatView from './pages/Chat/ChatView';
import Login from './pages/Login/Login';
import Signup from './pages/Signup/Signup';

function App() {
  return (
    <Routes>
      <Route path="/" element={<ChatView />} />
      <Route path="/chat" element={<ChatView />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
