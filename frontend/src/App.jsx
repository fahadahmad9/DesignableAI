import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import RoomPreview from "./pages/Roompreview copy.jsx";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import SculptStudio from "./pages/SculptStudio";
import DrawCanvas from "./pages/DrawCanvas";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        
        <Route path="/sculpt" element={<SculptStudio />} />
        <Route path="/canvas" element={<DrawCanvas />} />
        <Route path="/room" element={<RoomPreview />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;