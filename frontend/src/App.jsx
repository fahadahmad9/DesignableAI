import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/dashboard";
import Login from "./pages/login";
import Signup from "./pages/signup";
import Sketch from "./pages/Sketch";
import LandingPage from "./pages/LandingPage";

function App() {
  return (
    <Router>  
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/sketch" element={<Sketch />} />
      </Routes>
    </Router>
  );
}

export default App;
