import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/dashboard";
import Login from "./pages/login";
import Signup from "./pages/signup";
import Sketch from "./pages/Sketch";
import LandingPage from "./pages/Landingpage"; // Corrected casing
import VisualizeChair from "./components/VisualizeChair";

function App() {
  return (
    <Router>  
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/sketch" element={<Sketch />} />
        <Route path="/visualize" element={<VisualizeChair />} />
      </Routes>
    </Router>
  );
}

export default App;